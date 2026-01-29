import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { leader } from "../middleware/leader.js";
import pool from "../db/pool.js";
import * as even3Service from "../services/even3.service.js";

const router = Router();

// Configurações do Even3 (usar variáveis de ambiente)
const EVEN3_API_URL = process.env.EVEN3_API_URL || "https://www.even3.com.br/api/v1";
const EVEN3_TOKEN = process.env.EVEN3_TOKEN;
const EVEN3_EVENT_LINK = process.env.EVEN3_EVENT_LINK || "https://www.even3.com.br/technovacao-robotica-687768/";

// IDs dos tickets do Even3 (configurar via variáveis de ambiente)
const TICKET_COMPETIDOR = process.env.EVEN3_TICKET_COMPETIDOR;

// Preços
const PRICE_MEMBER = 55.00;
const PRICE_ROBOT = 20.00;

router.post("/checkout", auth, leader, async (req, res) => {
  const { teamId, memberIds, robotIds } = req.body;
  const userId = req.user.id;

  try {
    // Verifica se pelo menos um item foi selecionado
    if ((!memberIds || memberIds.length === 0) && (!robotIds || robotIds.length === 0)) {
      return res.status(400).json({ error: "Nenhum item selecionado para pagamento." });
    }

    // --- VERIFICAÇÃO DE LIMITE GLOBAL (400 INSCRITOS) ---
    if (memberIds && memberIds.length > 0) {
      const LIMIT = 400;
      const countRes = await pool.query("SELECT COUNT(*) FROM team_members WHERE is_paid = true");
      const currentPaid = parseInt(countRes.rows[0].count);

      if (currentPaid + memberIds.length > LIMIT) {
        return res.status(400).json({
          error: `Limite de inscritos atingido! Restam apenas ${Math.max(0, LIMIT - currentPaid)} vagas.`
        });
      }
    }

    // Buscar email do usuário que está fazendo o checkout
    const userRes = await pool.query("SELECT email FROM users WHERE id = $1", [userId]);
    const userEmail = userRes.rows[0].email;

    // --- VALIDAR PERTENCIMENTO À EQUIPE ---
    if (memberIds && memberIds.length > 0) {
      const memberCheck = await pool.query(
        "SELECT user_id FROM team_members WHERE team_id = $1 AND user_id = ANY($2::uuid[])",
        [teamId, memberIds]
      );
      if (memberCheck.rowCount !== memberIds.length) {
        return res.status(400).json({ error: "Alguns membros não pertencem a esta equipe." });
      }
    }

    if (robotIds && robotIds.length > 0) {
      const robotCheck = await pool.query(
        "SELECT id FROM robots WHERE team_id = $1 AND id = ANY($2::uuid[])",
        [teamId, robotIds]
      );
      if (robotCheck.rowCount !== robotIds.length) {
        return res.status(400).json({ error: "Alguns robôs não pertencem a esta equipe." });
      }
    }

    // --- COLETAR DADOS DOS ITENS ---
    const items = [];
    let totalAmount = 0;
    const errors = [];

    // 1. Processar Membros (R$ 55,00 cada)
    if (memberIds && memberIds.length > 0) {
      const members = await pool.query(
        "SELECT id, name, email FROM users WHERE id = ANY($1::uuid[])",
        [memberIds]
      );

      for (const member of members.rows) {
        items.push({
          type: 'participant',
          id: member.id,
          name: member.name,
          email: member.email,
          amount: PRICE_MEMBER
        });
        totalAmount += PRICE_MEMBER;

        // Criar inscrição no Even3 (se token e ticket ID configurados)
        if (EVEN3_TOKEN && TICKET_COMPETIDOR) {
          try {
            await even3Service.createAttendee(
              { name: member.name, email: member.email },
              TICKET_COMPETIDOR,
              PRICE_MEMBER
            );
            console.log(`[Checkout] Inscrição criada no Even3 para membro: ${member.email}`);
          } catch (even3Err) {
            console.error(`[Checkout] Erro ao criar inscrição Even3 para ${member.email}:`, even3Err.message);
            errors.push(`Erro ao inscrever ${member.name}: ${even3Err.message}`);
          }
        }
      }
    }

    // 2. Processar Robôs (R$ 20,00 cada)
    if (robotIds && robotIds.length > 0) {
      const robots = await pool.query(
        `SELECT r.id, r.name, c.name as category, u.email as owner_email, u.name as owner_name
         FROM robots r
         JOIN categories c ON r.category_id = c.id
         JOIN teams t ON r.team_id = t.id
         JOIN users u ON t.leader_id = u.id
         WHERE r.id = ANY($1::uuid[]) AND r.team_id = $2`,
        [robotIds, teamId]
      );

      for (const robot of robots.rows) {
        items.push({
          type: 'robot',
          id: robot.id,
          name: robot.name,
          category: robot.category,
          amount: PRICE_ROBOT
        });
        totalAmount += PRICE_ROBOT;

        // Criar inscrição no Even3 para o robô
        if (EVEN3_TOKEN) {
          const ticketId = even3Service.getTicketIdForCategory(robot.category);
          if (ticketId) {
            try {
              await even3Service.createAttendee(
                { name: `${robot.name} (${robot.category})`, email: robot.owner_email },
                ticketId,
                PRICE_ROBOT
              );
              console.log(`[Checkout] Inscrição criada no Even3 para robô: ${robot.name}`);
            } catch (even3Err) {
              console.error(`[Checkout] Erro ao criar inscrição Even3 para robô ${robot.name}:`, even3Err.message);
              errors.push(`Erro ao inscrever robô ${robot.name}: ${even3Err.message}`);
            }
          } else {
            console.warn(`[Checkout] Ticket ID não encontrado para categoria: ${robot.category}`);
          }
        }
      }
    }

    console.log("[Checkout] Checkout processado:", { teamId, userEmail, items: items.length, totalAmount });

    // --- SALVAR PENDING PAYMENT PARA TRACKING ---
    try {
      await pool.query(
        `INSERT INTO pending_payments
         (user_id, team_id, user_email, member_ids, robot_ids, total_amount, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
        [userId, teamId, userEmail, memberIds || [], robotIds || [], totalAmount]
      );
      console.log("[Checkout] Pending payment salvo");
    } catch (pendingErr) {
      // Tabela pode não existir - não é crítico
      console.log("[Checkout] Nota: Não foi possível salvar pending_payment:", pendingErr.message);
    }

    // --- RESPOSTA ---
    if (EVEN3_TOKEN && (TICKET_COMPETIDOR || items.some(i => i.type === 'robot'))) {
      // Se configurado para usar API Even3
      res.json({
        success: true,
        message: "Inscrições criadas no Even3! Verifique seu email para realizar o pagamento.",
        items: items.length,
        total: totalAmount,
        errors: errors.length > 0 ? errors : undefined,
        paymentUrl: EVEN3_EVENT_LINK // Fallback caso precise acessar diretamente
      });
    } else {
      // Fallback: redireciona para página do Even3 (modo antigo)
      console.log("[Checkout] API Even3 não configurada, usando redirecionamento");
      res.json({
        paymentUrl: EVEN3_EVENT_LINK,
        items: items.length,
        total: totalAmount,
        message: "Você será redirecionado para completar o pagamento no Even3."
      });
    }

  } catch (err) {
    console.error("ERRO PAGAMENTO:", err);
    res.status(500).json({ error: "Erro ao processar checkout" });
  }
});

// --- SINCRONIZAÇÃO MANUAL COM EVEN3 ---
router.post("/sync", auth, async (req, res) => {
  if (!EVEN3_TOKEN) {
    return res.status(500).json({ error: "EVEN3_TOKEN não configurado" });
  }

  try {
    const response = await fetch(`${EVEN3_API_URL}/payments`, {
      headers: { 'Authorization-Token': EVEN3_TOKEN }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro API Even3:", errorText);
      return res.status(response.status).json({ error: "Erro ao consultar Even3", details: errorText });
    }

    const result = await response.json();
    const payments = result.data || result;
    let syncedMembers = 0;
    let syncedRobots = 0;

    for (const payment of payments) {
      const status = payment.status || payment.status_payment;
      const email = payment.buyer_email || payment.email_buyer || payment.email;

      if (!email) continue;

      // Verificar se pagamento está confirmado
      const confirmedStatuses = ['Pago', 'Confirmado', 'paid', 'confirmed', 'approved'];
      if (!confirmedStatuses.some(s => status?.toLowerCase().includes(s.toLowerCase()))) {
        continue;
      }

      // Atualizar team_members
      const memberResult = await pool.query(
        `UPDATE team_members
         SET is_paid = true
         WHERE user_id = (SELECT id FROM users WHERE LOWER(email) = LOWER($1))
         AND is_paid = false`,
        [email]
      );
      syncedMembers += memberResult.rowCount;

      // Buscar e atualizar pending_payments
      try {
        const pendingResult = await pool.query(
          `UPDATE pending_payments
           SET status = 'completed', completed_at = NOW()
           WHERE LOWER(user_email) = LOWER($1)
           AND status = 'pending'
           RETURNING robot_ids`,
          [email]
        );

        for (const pending of pendingResult.rows) {
          if (pending.robot_ids && pending.robot_ids.length > 0) {
            const robotResult = await pool.query(
              `UPDATE robots SET is_paid = true WHERE id = ANY($1::uuid[]) AND is_paid = false`,
              [pending.robot_ids]
            );
            syncedRobots += robotResult.rowCount;
          }
        }
      } catch (pendingErr) {
        // Tabela pode não existir
      }
    }

    res.json({
      total_payments: payments.length,
      synced_members: syncedMembers,
      synced_robots: syncedRobots
    });

  } catch (err) {
    console.error("Erro sync Even3:", err);
    res.status(500).json({ error: "Erro na sincronização" });
  }
});

// --- LISTAR PENDING PAYMENTS DE UMA EQUIPE ---
router.get("/pending/:teamId", auth, async (req, res) => {
  const { teamId } = req.params;
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT id, member_ids, robot_ids, total_amount, status, created_at, completed_at
       FROM pending_payments
       WHERE team_id = $1 AND user_id = $2
       ORDER BY created_at DESC
       LIMIT 10`,
      [teamId, userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Erro buscar pending:", err);
    res.status(500).json({ error: "Erro ao buscar pagamentos pendentes" });
  }
});

// --- ROTA PÚBLICA: CONTAGEM DE INSCRITOS PAGOS ---
router.get("/count", async (req, res) => {
  try {
    const countRes = await pool.query("SELECT COUNT(*) FROM team_members WHERE is_paid = true");
    const count = parseInt(countRes.rows[0].count);
    res.json({ count, limit: 400 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar contagem" });
  }
});

// --- DEBUG: BUSCAR INFO DO EVENTO EVEN3 ---
router.get("/even3/info", auth, async (req, res) => {
  if (!EVEN3_TOKEN) {
    return res.status(500).json({ error: "EVEN3_TOKEN não configurado" });
  }

  try {
    const eventInfo = await even3Service.getEventInfo();
    res.json(eventInfo);
  } catch (err) {
    console.error("Erro buscar info Even3:", err);
    res.status(500).json({ error: "Erro ao buscar informações do evento" });
  }
});

export default router;
