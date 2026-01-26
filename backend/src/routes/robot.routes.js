import { Router } from "express";
import pool from "../db/pool.js";
import { auth } from "../middleware/auth.js";
import { leader } from "../middleware/leader.js";
import multer from "multer";
import path from "path";

const router = Router();

// Configuração do Multer (Upload)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Pasta onde salva
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

router.post("/", auth, upload.single("photo"), leader, async (req, res) => {
  const { name, teamId, categoryId } = req.body;
  const photo = req.file ? req.file.filename : null; // Nome do arquivo salvo

  if (!name || !teamId || !categoryId)
    return res.status(400).json({ error: "Preencha todos os campos" });

  try {
    const category = await pool.query("SELECT robot_limit FROM categories WHERE id = $1", [categoryId]);

    if (category.rowCount === 0) return res.status(404).json({ error: "Categoria nÃ£o encontrada" });

    const count = await pool.query("SELECT COUNT(*) FROM robots WHERE category_id = $1", [categoryId]);

    if (parseInt(count.rows[0].count) >= category.rows[0].robot_limit)
      return res.status(400).json({ error: "Limite da categoria atingido" });

    const result = await pool.query(
      "INSERT INTO robots (name, team_id, category_id, photo) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, teamId, categoryId, photo]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("ERRO CRIAR ROBÃ”:", err);
    res.status(500).json({ error: "Erro ao criar robÃ´" });
  }
});
// GET /robots/category/:id
router.get("/category/:id", async (req, res) => {
  const categoryId = req.params.id;
  try {
    const result = await pool.query(
      `SELECT r.id, r.name, r.photo, t.name AS team_name
       FROM robots r
       JOIN teams t ON t.id = r.team_id
       WHERE r.category_id = $1`,
      [categoryId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar robôs" });
  }
});

export default router;