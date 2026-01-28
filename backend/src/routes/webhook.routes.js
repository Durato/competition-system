import { Router } from "express";
import pool from "../db/pool.js";

const router = Router();

// Webhook da Even3 - Recebe notificações de inscrição e pagamento
router.post("/even3", async (req, res) => {
  console.log("Webhook Even3 recebido:", JSON.stringify(req.body, null, 2));

  try {
    const { action, data } = req.body;

    if (action === 'venda' || action === 'sale') {
      // Pagamento confirmado
      const email = data?.buyer_email || data?.email;

      if (email) {
        // Atualiza is_paid para o usuário que pagou
        const result = await pool.query(
          `UPDATE team_members
           SET is_paid = true
           WHERE user_id = (SELECT id FROM users WHERE email = $1)`,
          [email]
        );

        console.log(`Pagamento confirmado para ${email}. Rows atualizadas: ${result.rowCount}`);
      }
    }

    if (action === 'inscricao' || action === 'registration') {
      // Nova inscrição (pode ser usada para criar usuário automaticamente)
      console.log("Nova inscrição recebida:", data);
    }

    // Responde 200 para confirmar recebimento
    res.status(200).json({ received: true });

  } catch (err) {
    console.error("Erro no webhook Even3:", err);
    res.status(500).json({ error: "Erro ao processar webhook" });
  }
});

export default router;
