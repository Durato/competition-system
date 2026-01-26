import pool from "../db/pool.js";

export async function listCategories(req, res) {
  try {
    const result = await pool.query(`
      SELECT 
        c.id,
        c.name,
        c.robot_limit,
        COUNT(r.id) AS registered
      FROM categories c
      LEFT JOIN robots r ON r.category_id = c.id
      GROUP BY c.id
      ORDER BY c.name
    `);

    res.json(result.rows);
  } catch {
    res.status(500).json({ error: "Erro ao listar categorias" });
  }
}
