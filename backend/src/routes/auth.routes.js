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
      "SELECT id, name, email, photo FROM users WHERE id = $1",
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

export default router;
