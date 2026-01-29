import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { leader } from "../middleware/leader.js";
import pool from "../db/pool.js";
import * as mercadopagoService from "../services/mercadopago.service.js";

const router = Router();

// Preços unificados (TESTE - R$ 0,10)
const PRICE_MEMBER = 0.10;
const PRICE_ROBOT = 0.10;

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

    // Buscar dados do usuário que está fazendo o checkout
    const userRes = await pool.query("SELECT email, name FROM users WHERE id = $1", [userId]);
    const userEmail = userRes.rows[0].email;
    const userName = userRes.rows[0].name;

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

    // --- COLETAR DADOS DOS ITENS PARA O MERCADO PAGO ---
    const mpItems = [];
    let totalAmount = 0;

    // 1. Processar Membros (R$ 55,00 cada)
    if (memberIds && memberIds.length > 0) {
      const members = await pool.query(
        "SELECT id, name FROM users WHERE id = ANY($1::uuid[])",
        [memberIds]
      );

      for (const member of members.rows) {
        mpItems.push({
          title: `Inscrição - ${member.name}`,
          quantity: 1,
          unit_price: PRICE_MEMBER
        });
        totalAmount += PRICE_MEMBER;
      }
    }

    // 2. Processar Robôs (R$ 55,00 cada)
    if (robotIds && robotIds.length > 0) {
      const robots = await pool.query(
        `SELECT r.id, r.name, c.name as category
         FROM robots r
         JOIN categories c ON r.category_id = c.id
         WHERE r.id = ANY($1::uuid[]) AND r.team_id = $2`,
        [robotIds, teamId]
      );

      for (const robot of robots.rows) {
        mpItems.push({
          title: `Robô - ${robot.name} (${robot.category})`,
          quantity: 1,
          unit_price: PRICE_ROBOT
        });
        totalAmount += PRICE_ROBOT;
      }
    }

    console.log("[Checkout] Processando checkout:", {
      teamId,
      userEmail,
      items: mpItems.length,
      totalAmount
    });

    // --- CRIAR PREFERÊNCIA NO MERCADO PAGO ---
    const preference = await mercadopagoService.createPaymentPreference({
      items: mpItems,
      payer: {
        email: userEmail,
        name: userName
      },
      metadata: {
        teamId: teamId,
        memberIds: memberIds || [],
        robotIds: robotIds || [],
        userId: userId
      }
    });

    // --- SALVAR PENDING PAYMENT PARA TRACKING ---
    try {
      await pool.query(
        `INSERT INTO pending_payments
         (user_id, team_id, user_email, member_ids, robot_ids, total_amount, status, mp_preference_id)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)`,
        [userId, teamId, userEmail, memberIds || [], robotIds || [], totalAmount, preference.id]
      );
      console.log("[Checkout] Pending payment salvo com ID:", preference.id);
    } catch (pendingErr) {
      console.error("[Checkout] Erro ao salvar pending_payment:", pendingErr.message);
    }

    // --- RETORNA O LINK DE PAGAMENTO ---
    res.json({
      success: true,
      preferenceId: preference.id,
      paymentUrl: preference.init_point, // Link de produção
      sandboxPaymentUrl: preference.sandbox_init_point, // Link de teste
      items: mpItems.length,
      total: totalAmount,
      message: "Você será redirecionado para o Mercado Pago para concluir o pagamento."
    });

  } catch (err) {
    console.error("ERRO CHECKOUT:", err);
    res.status(500).json({
      error: "Erro ao processar checkout",
      details: err.message
    });
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

// --- LISTAR PENDING PAYMENTS DE UMA EQUIPE ---
router.get("/pending/:teamId", auth, async (req, res) => {
  const { teamId } = req.params;
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT id, member_ids, robot_ids, total_amount, status, mp_preference_id, created_at, completed_at
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

export default router;
