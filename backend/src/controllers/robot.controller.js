import pool from "../db/pool.js";

export async function createRobot(req, res) {
  const { name, category_id } = req.body;
  const userId = req.user.id;

  try {
    // Verifica se usuário é líder de alguma equipe
    const teamResult = await pool.query(
      "SELECT id FROM teams WHERE leader_id = $1",
      [userId]
    );

    if (teamResult.rowCount === 0) {
      return res.status(403).json({ error: "Só líderes podem cadastrar robôs" });
    }

    const teamId = teamResult.rows[0].id;

    // Conta robôs na categoria
    const countResult = await pool.query(
      "SELECT COUNT(*) FROM robots WHERE category_id = $1",
      [category_id]
    );

    // Pega limite da categoria
    const limitResult = await pool.query(
      "SELECT robot_limit FROM categories WHERE id = $1",
      [category_id]
    );

    if (limitResult.rowCount === 0) {
      return res.status(404).json({ error: "Categoria não encontrada" });
    }

    const registered = parseInt(countResult.rows[0].count);
    const limit = limitResult.rows[0].robot_limit;

    if (registered >= limit) {
      return res.status(400).json({ error: "Categoria cheia" });
    }

    const result = await pool.query(
      "INSERT INTO robots (name, team_id, category_id) VALUES ($1, $2, $3) RETURNING *",
      [name, teamId, category_id]
    );

    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: "Erro ao cadastrar robô" });
  }
}
