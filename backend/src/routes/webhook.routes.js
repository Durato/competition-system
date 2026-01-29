import { Router } from "express";
import pool from "../db/pool.js";
import { auth } from "../middleware/auth.js";

const router = Router();

// Token de segurança do webhook (configurado no Even3)
const WEBHOOK_TOKEN = process.env.EVEN3_WEBHOOK_TOKEN;

/**
 * Salva webhook no banco para auditoria
 */
async function saveWebhookLog(source, action, payload, headers) {
  try {
    await pool.query(
      `INSERT INTO webhook_logs (source, action, payload, headers, received_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [source, action, JSON.stringify(payload), JSON.stringify(headers)]
    );
  } catch (err) {
    // Tabela pode não existir ainda - não é crítico
    console.log("[Webhook] Não foi possível salvar log no banco:", err.message);
  }
}

// Webhook da Even3 - Recebe notificações de inscrição e pagamento
router.post("/even3", async (req, res) => {
  // 1. Log completo para debug
  console.log("=== WEBHOOK EVEN3 RECEBIDO ===");
  console.log("Timestamp:", new Date().toISOString());
  console.log("Headers:", JSON.stringify(req.headers, null, 2));
  console.log("Body:", JSON.stringify(req.body, null, 2));
  console.log("==============================");

  // Salvar no banco antes de qualquer processamento
  await saveWebhookLog('even3', req.body?.action || 'unknown', req.body, req.headers);

  try {
    // 2. Validar token de segurança (se configurado)
    if (WEBHOOK_TOKEN) {
      const receivedToken =
        req.headers['x-even3-token'] ||
        req.headers['authorization-token'] ||
        req.headers['x-webhook-token'] ||
        req.body?.token ||
        req.body?.security_token;

      if (receivedToken !== WEBHOOK_TOKEN) {
        console.warn("[Webhook] Token inválido recebido:", receivedToken?.substring(0, 5) + "...");
        // Ainda retorna 200 para não gerar retentativas, mas loga o erro
        return res.status(200).json({ received: true, warning: "Token validation failed" });
      }
      console.log("[Webhook] Token validado com sucesso");
    } else {
      console.warn("[Webhook] EVEN3_WEBHOOK_TOKEN não configurado - aceitando todas as requisições");
    }

    // 3. Extrair action e data (suportar múltiplos formatos)
    const action = (
      req.body?.action ||
      req.body?.acao ||
      req.body?.type ||
      req.body?.evento ||
      'unknown'
    ).toLowerCase();

    const data = req.body?.data || req.body?.dados || req.body;

    console.log(`[Webhook] Action: ${action}`);

    // 4. Processar conforme o tipo de ação
    const saleActions = ['venda', 'sale', 'venda_aprovada', 'sale_approved', 'payment_confirmed', 'pagamento_confirmado'];
    const registrationActions = ['inscricao', 'registration', 'inscricao_confirmada', 'registration_confirmed'];

    if (saleActions.includes(action)) {
      await handleSaleApproved(data);
    } else if (registrationActions.includes(action)) {
      await handleRegistration(data);
    } else {
      console.log(`[Webhook] Ação não tratada: ${action}`);
    }

    // 5. Sempre retorna 200 para confirmar recebimento
    res.status(200).json({ received: true, action });

  } catch (err) {
    console.error("[Webhook] Erro ao processar:", err);
    // Retorna 200 mesmo com erro para evitar retentativas infinitas
    // O erro está logado para investigação
    res.status(200).json({ received: true, error: "Processing error logged" });
  }
});

/**
 * Processa venda/pagamento aprovado
 */
async function handleSaleApproved(data) {
  // Extrair email de múltiplos campos possíveis
  const email =
    data?.buyer_email ||
    data?.email ||
    data?.email_attendee ||
    data?.email_comprador ||
    data?.pessoa?.email ||
    data?.attendee?.email;

  if (!email) {
    console.error("[Webhook] Nenhum email encontrado no payload de venda");
    return;
  }

  console.log(`[Webhook] Processando pagamento para: ${email}`);

  // 1. Atualizar team_members
  const memberResult = await pool.query(
    `UPDATE team_members
     SET is_paid = true
     WHERE user_id = (SELECT id FROM users WHERE LOWER(email) = LOWER($1))
     AND is_paid = false`,
    [email]
  );
  console.log(`[Webhook] Team members atualizados: ${memberResult.rowCount}`);

  // 2. Buscar e atualizar pending_payments
  try {
    const pendingResult = await pool.query(
      `UPDATE pending_payments
       SET status = 'completed', completed_at = NOW()
       WHERE LOWER(user_email) = LOWER($1)
       AND status = 'pending'
       RETURNING id, member_ids, robot_ids`,
      [email]
    );

    if (pendingResult.rowCount > 0) {
      console.log(`[Webhook] Pending payments encontrados: ${pendingResult.rowCount}`);

      for (const pending of pendingResult.rows) {
        // Atualizar robots se houver
        if (pending.robot_ids && pending.robot_ids.length > 0) {
          const robotResult = await pool.query(
            `UPDATE robots SET is_paid = true WHERE id = ANY($1::uuid[]) AND is_paid = false`,
            [pending.robot_ids]
          );
          console.log(`[Webhook] Robots atualizados do pending ${pending.id}: ${robotResult.rowCount}`);
        }

        // Atualizar members adicionais se especificados
        if (pending.member_ids && pending.member_ids.length > 0) {
          const additionalMemberResult = await pool.query(
            `UPDATE team_members
             SET is_paid = true
             WHERE user_id = ANY($1::uuid[]) AND is_paid = false`,
            [pending.member_ids]
          );
          console.log(`[Webhook] Members adicionais atualizados do pending ${pending.id}: ${additionalMemberResult.rowCount}`);
        }
      }
    } else {
      console.log(`[Webhook] Nenhum pending_payment encontrado para ${email}`);
    }
  } catch (pendingErr) {
    // Tabela pending_payments pode não existir ainda
    console.log(`[Webhook] Nota: Tabela pending_payments não disponível: ${pendingErr.message}`);
  }

  // 3. Log do total de atualizações
  console.log(`[Webhook] Pagamento processado com sucesso para ${email}`);
}

/**
 * Processa nova inscrição
 */
async function handleRegistration(data) {
  const email = data?.email || data?.pessoa?.email || data?.attendee?.email;
  const name = data?.name || data?.nome || data?.pessoa?.nome || data?.attendee?.name;

  console.log(`[Webhook] Nova inscrição recebida: ${name} (${email})`);

  // Por enquanto apenas loga - pode ser usado para criar usuário automaticamente no futuro
}

// Endpoint de teste/health check para o webhook
router.get("/even3/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    tokenConfigured: !!WEBHOOK_TOKEN
  });
});

// Endpoint para consultar logs de webhooks recebidos (requer auth)
router.get("/even3/logs", auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, source, action, payload, headers, received_at, processed
       FROM webhook_logs
       WHERE source = 'even3'
       ORDER BY received_at DESC
       LIMIT 50`
    );
    res.json({ count: result.rowCount, logs: result.rows });
  } catch (err) {
    res.status(500).json({
      error: "Tabela webhook_logs não existe. Execute a migração: backend/migrations/001_add_pending_payments.sql"
    });
  }
});

// Endpoint de diagnóstico temporário (sem auth, com chave simples)
router.get("/even3/debug", async (req, res) => {
  const key = req.query.key;
  if (key !== "techno26debug") {
    return res.status(403).json({ error: "Chave inválida. Use ?key=techno26debug" });
  }

  try {
    const logs = await pool.query(
      `SELECT id, action, payload, received_at
       FROM webhook_logs
       WHERE source = 'even3'
       ORDER BY received_at DESC
       LIMIT 20`
    );
    res.json({ count: logs.rowCount, logs: logs.rows });
  } catch (err) {
    res.status(500).json({
      error: "Tabela webhook_logs não existe",
      message: err.message
    });
  }
});

export default router;
