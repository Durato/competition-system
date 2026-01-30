import { Router } from "express";
import { register, login, forgotPassword, resetPassword } from "../controllers/auth.controller.js";
import { auth } from "../middleware/auth.js";
import pool from "../db/pool.js";
import multer from "multer";
import DatauriParser from "datauri/parser.js";
import path from "path";
import cloudinary from "../config/cloudinary.js";

const router = Router();

// Usar memoryStorage para processar em memória antes do Cloudinary
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post("/register", upload.single("photo"), async (req, res) => {
  // Upload para Cloudinary será feito aqui antes de chamar o controller
  let photoUrl = null;

  if (req.file) {
    try {
      const parser = new DatauriParser();
      const fileExtension = path.extname(req.file.originalname).toString();
      const fileDataUri = parser.format(fileExtension, req.file.buffer);
      const result = await cloudinary.uploader.upload(fileDataUri.content, {
        folder: "competition_system/users",
      });
      photoUrl = result.secure_url;
    } catch (uploadErr) {
      console.error("ERRO UPLOAD CLOUDINARY (register):", uploadErr);
      // Continua sem foto se upload falhar
    }
  }

  // Passa a URL para o controller via req
  req.photoUrl = photoUrl;
  return register(req, res);
});

router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// Rota para obter dados do usuário autenticado
router.get("/me", auth, async (req, res) => {
  try {
    const user = await pool.query(
      "SELECT id, name, email, photo, cpf, needs_accommodation FROM users WHERE id = $1",
      [req.user.id]
    );

    if (user.rowCount === 0) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    res.json(user.rows[0]);
  } catch (err) {
    console.error("Erro ao buscar usuário:", err);
    res.status(500).json({ error: "Erro ao buscar dados do usuário" });
  }
});

// Atualizar opção de alojamento do usuário
router.put("/accommodation", auth, async (req, res) => {
  const { needs_accommodation } = req.body;

  try {
    // Se quer ativar, verificar limite de 200 vagas
    if (needs_accommodation) {
      const countRes = await pool.query(
        "SELECT COUNT(*) FROM users WHERE needs_accommodation = true AND id != $1",
        [req.user.id]
      );
      if (parseInt(countRes.rows[0].count) >= 200) {
        return res.status(400).json({ error: "Limite de 200 vagas de alojamento atingido." });
      }
    }

    await pool.query(
      "UPDATE users SET needs_accommodation = $1 WHERE id = $2",
      [!!needs_accommodation, req.user.id]
    );

    res.json({ message: "Opção de alojamento atualizada.", needs_accommodation: !!needs_accommodation });
  } catch (err) {
    console.error("Erro ao atualizar alojamento:", err);
    res.status(500).json({ error: "Erro ao atualizar opção de alojamento" });
  }
});

// Contagem pública de vagas de alojamento
router.get("/accommodation/count", async (req, res) => {
  try {
    const countRes = await pool.query(
      "SELECT COUNT(*) FROM users WHERE needs_accommodation = true"
    );
    const count = parseInt(countRes.rows[0].count);
    res.json({ count, limit: 200, remaining: Math.max(0, 200 - count) });
  } catch (err) {
    console.error("Erro ao buscar contagem de alojamento:", err);
    res.status(500).json({ error: "Erro ao buscar contagem" });
  }
});

export default router;
