import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { leader } from "../middleware/leader.js";
import pool from "../db/pool.js";

const router = Router();

// Configurações do Even3 (usar variáveis de ambiente)
const EVEN3_API_URL = process.env.EVEN3_API_URL || "https://www.even3.com.br/api/v1";
const EVEN3_TOKEN = process.env.EVEN3_TOKEN;
const EVEN3_EVENT_LINK = process.env.EVEN3_EVENT_LINK || "https://www.even3.com.br/technovacao-robotica-687768/";

router.post("/checkout", auth, leader, async (req, res) => {
  const { teamId, memberIds, robotIds } = req.body;

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
        return res.status(400).json({ error: `Limite de inscritos atingido! Restam apenas ${Math.max(0, LIMIT - currentPaid)} vagas.` });
      }
    }

    // --- LOG DOS ITENS PARA DEBUG ---
    const items = [];
    let totalAmount = 0;

    // 1. Membros (R$ 55,00)
    if (memberIds && memberIds.length > 0) {
      const members = await pool.query("SELECT name, email FROM users WHERE id = ANY($1::uuid[])", [memberIds]);
      members.rows.forEach(m => {
        items.push({ type: 'participant', name: m.name, email: m.email, amount: 55.00 });
        totalAmount += 55.00;
      });
    }

    // 2. Robôs (R$ 20,00)
    if (robotIds && robotIds.length > 0) {
      const robots = await pool.query("SELECT name FROM robots WHERE id = ANY($1::uuid[])", [robotIds]);
      robots.rows.forEach(r => {
        items.push({ type: 'robot', name: r.name, amount: 20.00 });
        totalAmount += 20.00;
      });
    }

    console.log("Checkout iniciado:", { teamId, items, totalAmount });

    // Redireciona para a página do evento Even3
    // O pagamento será feito lá e o webhook notificará nosso sistema
    res.json({ paymentUrl: EVEN3_EVENT_LINK });

  } catch (err) {
    console.error("ERRO PAGAMENTO:", err);
    res.status(500).json({ error: "Erro ao gerar pagamento" });
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

    const { data } = await response.json();
    let synced = 0;

    for (const payment of data) {
      if (payment.status === 'Pago' || payment.status === 'Confirmado') {
        const result = await pool.query(
          `UPDATE team_members
           SET is_paid = true
           WHERE user_id = (SELECT id FROM users WHERE email = $1)
           AND is_paid = false`,
          [payment.buyer_email]
        );
        synced += result.rowCount;
      }
    }

    res.json({ total: data.length, synced });

  } catch (err) {
    console.error("Erro sync Even3:", err);
    res.status(500).json({ error: "Erro na sincronização" });
  }
});

// --- ROTA PÚBLICA: CONTAGEM DE INSCRITOS PAGOS ---
router.get("/count", async (req, res) => {
  try {
    const countRes = await pool.query("SELECT COUNT(*) FROM team_members WHERE is_paid = true");
    const count = parseInt(countRes.rows[0].count);
    res.json({ count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar contagem" });
  }
});

export default router;
