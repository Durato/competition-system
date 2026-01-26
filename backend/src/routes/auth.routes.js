import { Router } from "express";
import { register, login } from "../controllers/auth.controller.js";
import multer from "multer";
import path from "path";

const router = Router();

// Configuração do Multer (Upload)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

router.post("/register", upload.single("photo"), register);
router.post("/login", login);

export default router;
