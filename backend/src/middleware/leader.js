import pool from "../db/pool.js";

export async function leader(req, res, next) {
  const userId = req.user.id;
  const { teamId } = req.body;

  try {
    const result = await pool.query(
      "SELECT leader_id FROM teams WHERE id = $1",
      [teamId]
    );

    if (result.rowCount === 0)
      return res.status(404).json({ error: "Equipe não encontrada" });

    if (result.rows[0].leader_id !== userId)
      return res.status(403).json({ error: "Apenas o líder pode executar esta ação" });

    next();
  } catch (err) {
    console.error("ERRO LEADER:", err);
    res.status(500).json({ error: "Erro interno" });
  }
}
