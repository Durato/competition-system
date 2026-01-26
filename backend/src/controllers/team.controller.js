import pool from "../db/pool.js";

export async function createTeam(req, res) {
  const { name } = req.body;
  const userId = req.user.id;

  try {
    // Verifica se já é líder de alguma equipe
    const exists = await pool.query(
      "SELECT id FROM teams WHERE leader_id = $1",
      [userId]
    );

    if (exists.rowCount > 0) {
      return res.status(400).json({ error: "Você já lidera uma equipe" });
    }

    const result = await pool.query(
      "INSERT INTO teams (name, leader_id) VALUES ($1, $2) RETURNING *",
      [name, userId]
    );

    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: "Erro ao criar equipe" });
  }
}

export async function myTeam(req, res) {
  const userId = req.user.id;

  try {
    const result = await pool.query(
      "SELECT * FROM teams WHERE leader_id = $1",
      [userId]
    );

    if (result.rowCount === 0) {
      return res.json({ msg: "Você ainda não tem equipe" });
    }

    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: "Erro ao buscar equipe" });
  }
}
