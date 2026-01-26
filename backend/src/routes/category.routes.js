import { Router } from "express";
import pool from "../db/pool.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const categories = await pool.query(`
      SELECT c.id, c.name, c.robot_limit, COUNT(r.id) AS registered
      FROM categories c
      LEFT JOIN robots r ON r.category_id = c.id
      GROUP BY c.id
      ORDER BY c.name
    `);

    res.json(categories.rows);
  } catch (err) {
    console.error("ERRO CATEGORIES:", err);
    res.status(500).json({ error: "Erro ao listar categorias" });
  }
});

export default router;
