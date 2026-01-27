import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { leader } from "../middleware/leader.js";
import pool from "../db/pool.js";

const router = Router();

// Configurações do Even3
// Você precisará da documentação da API do Even3 para obter o Endpoint correto e a Chave de API
const EVEN3_API_URL = "https://www.even3.com.br/api/v1"; // Exemplo - Verifique a doc oficial
const EVEN3_TOKEN = "d7a399b4-67b4-4a9d-9554-e786397c69f0"; 
const EVEN3_EVENT_LINK = "https://www.even3.com.br/technovacao-robotica-687768/"; // Link oficial do evento

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

    // --- PREPARAÇÃO DOS DADOS PARA API ---
    // Recuperamos os dados do banco para enviar para a API do Even3
    const items = [];
    let totalAmount = 0;

    // 1. Membros (R$ 55,00)
    if (memberIds && memberIds.length > 0) {
      const members = await pool.query("SELECT name, email FROM users WHERE id = ANY($1::uuid[])", [memberIds]);
      members.rows.forEach(m => {
        items.push({
          type: 'participant',
          name: m.name,
          email: m.email,
          amount: 55.00
        });
        totalAmount += 55.00;
      });
    }

    // 2. Robôs (R$ 20,00)
    if (robotIds && robotIds.length > 0) {
      const robots = await pool.query("SELECT name FROM robots WHERE id = ANY($1::uuid[])", [robotIds]);
      robots.rows.forEach(r => {
        items.push({
          type: 'robot',
          name: r.name,
          amount: 20.00
        });
        totalAmount += 20.00;
      });
    }

    // --- CHAMADA À API DO EVEN3 ---
    try {
      // Tenta criar a transação via API
      const apiResponse = await fetch(`${EVEN3_API_URL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${EVEN3_TOKEN}` },
        body: JSON.stringify({ items, total: totalAmount, buyer_id: req.user.id })
      });

      if (apiResponse.ok) {
        const apiData = await apiResponse.json();
        // Se a API retornar um link de checkout específico, usamos ele
        if (apiData.checkoutUrl) return res.json({ paymentUrl: apiData.checkoutUrl });
      } else {
        console.warn("API Even3 retornou erro (usando fallback):", await apiResponse.text());
      }
    } catch (apiError) {
      console.error("Erro na integração Even3 (usando fallback):", apiError);
    }

    // --- MODO SIMPLIFICADO (Fallback) ---
    // Enquanto a API não está configurada, redireciona para a página geral
    console.log("Itens processados para checkout:", items);
    res.json({ paymentUrl: EVEN3_EVENT_LINK });

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