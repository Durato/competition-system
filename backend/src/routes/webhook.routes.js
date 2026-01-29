import { Router } from "express";
import pool from "../db/pool.js";
import { auth } from "../middleware/auth.js";
import * as mercadopagoService from "../services/mercadopago.service.js";

const router = Router();

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
    console.log("[Webhook] Não foi possível salvar log no banco:", err.message);
  }
}

// Webhook do Mercado Pago - Recebe notificações de pagamento
router.post("/mercadopago", async (req, res) => {
  console.log("=== WEBHOOK MERCADO PAGO RECEBIDO ===");
  console.log("Timestamp:", new Date().toISOString());
  console.log("Headers:", JSON.stringify(req.headers, null, 2));
  console.log("Body:", JSON.stringify(req.body, null, 2));
  console.log("Query:", JSON.stringify(req.query, null, 2));
  console.log("=====================================");

  // Salvar no banco antes de qualquer processamento
  await saveWebhookLog('mercadopago', req.body?.type || req.query?.topic || 'unknown', req.body, req.headers);

  try {
    // Mercado Pago envia notificações em diferentes formatos
    const topic = req.query?.topic || req.body?.topic || req.body?.type;
    const resourceId = req.query?.id || req.body?.data?.id || req.body?.id;

    console.log(`[Webhook MP] Topic: ${topic}, Resource ID: ${resourceId}`);

    // Responde imediatamente para confirmar recebimento
    res.status(200).send("OK");

    // Processa apenas notificações de pagamento
    if (topic === 'payment' || topic === 'merchant_order') {
      if (!resourceId) {
        console.log("[Webhook MP] Nenhum ID de recurso encontrado");
        return;
      }

      // Aguarda 2 segundos para dar tempo do MP processar
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Busca os detalhes do pagamento
      const payment = await mercadopagoService.getPayment(resourceId);
      console.log("[Webhook MP] Pagamento encontrado:", {
        id: payment.id,
        status: payment.status,
        status_detail: payment.status_detail,
        external_reference: payment.external_reference
      });

      // Verifica se o pagamento foi aprovado
      if (mercadopagoService.isPaymentApproved(payment)) {
        await processApprovedPayment(payment);
      } else {
        console.log(`[Webhook MP] Pagamento ${payment.id} não aprovado ainda. Status: ${payment.status}`);
      }
    } else {
      console.log(`[Webhook MP] Topic não processado: ${topic}`);
    }

  } catch (err) {
    console.error("[Webhook MP] Erro ao processar:", err);
    // Não retorna erro para o MP para evitar retentativas desnecessárias
  }
});

/**
 * Processa um pagamento aprovado
 */
async function processApprovedPayment(payment) {
  console.log(`[Webhook MP] Processando pagamento aprovado: ${payment.id}`);

  // Extrai metadata (contém teamId, memberIds, robotIds)
  const metadata = mercadopagoService.getPaymentMetadata(payment);
  const { teamId, memberIds, robotIds, userId } = metadata;

  if (!teamId) {
    console.error("[Webhook MP] Nenhum teamId encontrado na metadata");
    return;
  }

  console.log("[Webhook MP] Metadata:", { teamId, memberIds, robotIds, userId });

  // 1. Atualizar team_members como pagos
  if (memberIds && memberIds.length > 0) {
    try {
      const memberResult = await pool.query(
        `UPDATE team_members
         SET is_paid = true
         WHERE user_id = ANY($1::uuid[]) AND is_paid = false`,
        [memberIds]
      );
      console.log(`[Webhook MP] ${memberResult.rowCount} membros marcados como pagos`);
    } catch (err) {
      console.error("[Webhook MP] Erro ao atualizar membros:", err);
    }
  }

  // 2. Atualizar robots como pagos
  if (robotIds && robotIds.length > 0) {
    try {
      const robotResult = await pool.query(
        `UPDATE robots
         SET is_paid = true
         WHERE id = ANY($1::uuid[]) AND is_paid = false`,
        [robotIds]
      );
      console.log(`[Webhook MP] ${robotResult.rowCount} robôs marcados como pagos`);
    } catch (err) {
      console.error("[Webhook MP] Erro ao atualizar robôs:", err);
    }
  }

  // 3. Atualizar pending_payment como completo
  try {
    const pendingResult = await pool.query(
      `UPDATE pending_payments
       SET status = 'completed',
           completed_at = NOW(),
           mp_payment_id = $1
       WHERE team_id = $2
       AND user_id = $3
       AND status = 'pending'`,
      [payment.id.toString(), teamId, userId]
    );
    console.log(`[Webhook MP] ${pendingResult.rowCount} pending_payments marcados como completos`);
  } catch (err) {
    console.error("[Webhook MP] Erro ao atualizar pending_payment:", err);
  }

  console.log(`[Webhook MP] Pagamento ${payment.id} processado com sucesso!`);
}

// Endpoint de health check
router.get("/mercadopago/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Mercado Pago Webhook",
    timestamp: new Date().toISOString()
  });
});

// Endpoint para consultar logs de webhooks (requer auth)
router.get("/mercadopago/logs", auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, source, action, payload, headers, received_at, processed
       FROM webhook_logs
       WHERE source = 'mercadopago'
       ORDER BY received_at DESC
       LIMIT 50`
    );
    res.json({ count: result.rowCount, logs: result.rows });
  } catch (err) {
    res.status(500).json({
      error: "Erro ao buscar logs",
      message: err.message
    });
  }
});

export default router;
