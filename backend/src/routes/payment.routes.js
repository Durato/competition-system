import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { leader } from "../middleware/leader.js";
import { MercadoPagoConfig, Preference } from 'mercadopago';
import pool from "../db/pool.js";

const router = Router();

// Configure com seu ACCESS TOKEN do Mercado Pago
// IMPORTANTE: Substitua 'SEU_ACCESS_TOKEN_AQUI' pelo seu token de teste do Mercado Pago
const client = new MercadoPagoConfig({ accessToken: 'SEU_ACCESS_TOKEN_AQUI' });

router.post("/checkout", auth, leader, async (req, res) => {
  const { teamId, memberIds, robotIds } = req.body;

  try {
    // --- VERIFICAÇÃO DE LIMITE GLOBAL (400 INSCRITOS) ---
    if (memberIds && memberIds.length > 0) {
      const LIMIT = 400;
      const countRes = await pool.query("SELECT COUNT(*) FROM team_members WHERE is_paid = true");
      const currentPaid = parseInt(countRes.rows[0].count);

      if (currentPaid + memberIds.length > LIMIT) {
        return res.status(400).json({ error: `Limite de inscritos atingido! Restam apenas ${Math.max(0, LIMIT - currentPaid)} vagas.` });
      }
    }

    const items = [];

    // 1. Adicionar Membros (R$ 55,00)
    if (memberIds && memberIds.length > 0) {
      // Busca nomes para colocar na fatura
      const members = await pool.query("SELECT name FROM users WHERE id = ANY($1::int[])", [memberIds]);
      
      members.rows.forEach(m => {
        items.push({
          title: `Inscrição: ${m.name}`,
          quantity: 1,
          unit_price: 55.00,
          currency_id: 'BRL',
        });
      });
    }

    // 2. Adicionar Robôs (R$ 20,00)
    if (robotIds && robotIds.length > 0) {
      const robots = await pool.query("SELECT name FROM robots WHERE id = ANY($1::int[])", [robotIds]);
      
      robots.rows.forEach(r => {
        items.push({
          title: `Robô: ${r.name}`,
          quantity: 1,
          unit_price: 20.00,
          currency_id: 'BRL',
        });
      });
    }

    if (items.length === 0) {
      return res.status(400).json({ error: "Nenhum item selecionado para pagamento." });
    }

    // 3. Criar Preferência no Mercado Pago
    const preference = new Preference(client);
    const result = await preference.create({
      body: {
        items: items,
        back_urls: {
          success: "http://localhost:5500", // URL do seu frontend (ajuste se necessário)
          failure: "http://localhost:5500",
          pending: "http://localhost:5500"
        },
        auto_return: "approved",
      }
    });

    // Retorna o link para o frontend redirecionar
    res.json({ init_point: result.init_point });

  } catch (err) {
    console.error("ERRO PAGAMENTO:", err);
    res.status(500).json({ error: "Erro ao gerar pagamento" });
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