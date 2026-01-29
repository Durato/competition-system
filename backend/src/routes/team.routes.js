import { Router } from "express";
import pool from "../db/pool.js";
import { auth } from "../middleware/auth.js";
import multer from "multer";
import DatauriParser from "datauri/parser.js";
import path from "path";
import cloudinary from "../config/cloudinary.js";

const router = Router();

// Configuração do Multer (Upload)
// Agora usa memoryStorage para processar o arquivo em memória antes de enviar para o Cloudinary
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- CRIAR EQUIPE ---
router.post("/", auth, upload.single("photo"), async (req, res) => {
  const { name, institution } = req.body;
  const leader_id = req.user.id;
  let photoUrl = null;

  if (!name) return res.status(400).json({ error: "Nome da equipe Ã© obrigatÃ³rio" });

  try {
    if (req.file) {
      try {
        const parser = new DatauriParser();
        const fileExtension = path.extname(req.file.originalname).toString();
        const fileDataUri = parser.format(fileExtension, req.file.buffer);
        const result = await cloudinary.uploader.upload(fileDataUri.content, {
          folder: "competition_system/teams",
        });
        photoUrl = result.secure_url;
      } catch (uploadErr) {
        console.error("ERRO UPLOAD CLOUDINARY:", uploadErr);
        // Continua sem foto se upload falhar
      }
    }

    const result = await pool.query(
      "INSERT INTO teams (name, leader_id, institution, photo) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, leader_id, institution, photoUrl]
    );

    // Adiciona lÃ­der como membro tambÃ©m
    await pool.query(
      "INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'leader')",
      [result.rows[0].id, leader_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("ERRO CRIAR EQUIPE:", err);
    res.status(500).json({ error: "Erro ao criar equipe" });
  }
});

// --- LISTAR TODAS AS EQUIPES (PÚBLICO) ---
router.get("/public", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, photo, institution FROM teams ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error("ERRO LISTAR EQUIPES PÚBLICAS:", err);
    res.status(500).json({ error: "Erro ao listar equipes" });
  }
});

// --- LISTAR EQUIPES DO USUÃRIO ---
router.get("/", auth, async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT t.id, t.name, (t.leader_id = $1) as is_leader
       FROM teams t
       JOIN team_members tm ON tm.team_id = t.id
       WHERE tm.user_id = $1`,
      [userId]
    );

    res.json(result.rows); // retorna [] se nÃ£o tiver equipes
  } catch (err) {
    console.error("ERRO LISTAR EQUIPES:", err);
    res.status(500).json({ error: "Erro ao listar equipes" });
  }
});

// --- ADICIONAR MEMBRO ---
router.post("/:id/members", auth, async (req, res) => {
  const { email } = req.body;
  const teamId = req.params.id;
  const userId = req.user.id;

  try {
    // 1. Verificar se a equipe existe e se o usuário logado é o líder
    const teamRes = await pool.query("SELECT leader_id FROM teams WHERE id = $1", [teamId]);
    
    if (teamRes.rowCount === 0) return res.status(404).json({ error: "Equipe não encontrada" });
    if (teamRes.rows[0].leader_id !== userId) {
      return res.status(403).json({ error: "Apenas o líder pode adicionar membros" });
    }

    // 2. Buscar o usuário pelo email
    const userRes = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (userRes.rowCount === 0) return res.status(404).json({ error: "Usuário não encontrado" });
    
    const newMemberId = userRes.rows[0].id;

    // 3. Verificar se já é membro
    const checkMember = await pool.query(
      "SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2",
      [teamId, newMemberId]
    );
    if (checkMember.rowCount > 0) {
      return res.status(400).json({ error: "Usuário já faz parte da equipe" });
    }

    // 4. Inserir na tabela
    await pool.query(
      "INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'member')",
      [teamId, newMemberId]
    );

    res.json({ message: "Membro adicionado com sucesso!" });
  } catch (err) {
    console.error("ERRO ADD MEMBRO:", err);
    res.status(500).json({ error: "Erro ao adicionar membro" });
  }
});

// --- REMOVER MEMBRO ---
router.delete("/:teamId/members/:memberId", auth, async (req, res) => {
  const { teamId, memberId } = req.params;
  const userId = req.user.id;

  try {
    // 1. Verificar se a equipe existe e se o usuário logado é o líder
    const teamRes = await pool.query("SELECT leader_id FROM teams WHERE id = $1", [teamId]);

    if (teamRes.rowCount === 0) {
      return res.status(404).json({ error: "Equipe não encontrada" });
    }

    if (teamRes.rows[0].leader_id !== userId) {
      return res.status(403).json({ error: "Apenas o líder pode remover membros" });
    }

    // 2. Verificar se o membro a ser removido é o próprio líder
    if (memberId === userId) {
      return res.status(400).json({ error: "O líder não pode se remover da equipe" });
    }

    // 3. Verificar se o membro já pagou
    const memberCheck = await pool.query(
      "SELECT is_paid FROM team_members WHERE team_id = $1 AND user_id = $2",
      [teamId, memberId]
    );

    if (memberCheck.rowCount === 0) {
      return res.status(404).json({ error: "Membro não encontrado na equipe" });
    }

    if (memberCheck.rows[0].is_paid) {
      return res.status(400).json({ error: "Não é possível remover membros que já pagaram a inscrição" });
    }

    // 4. Remover o membro
    await pool.query(
      "DELETE FROM team_members WHERE team_id = $1 AND user_id = $2",
      [teamId, memberId]
    );

    console.log(`[Team] Membro ${memberId} removido da equipe ${teamId} pelo líder ${userId}`);
    res.json({ message: "Membro removido com sucesso!" });

  } catch (err) {
    console.error("ERRO REMOVER MEMBRO:", err);
    res.status(500).json({ error: "Erro ao remover membro" });
  }
});

// --- LISTAR MEMBROS ---
router.get("/:id/members", auth, async (req, res) => {
  const teamId = req.params.id;
  const result = await pool.query(
    "SELECT u.id, u.name, u.photo, tm.role, tm.is_paid FROM team_members tm JOIN users u ON u.id = tm.user_id WHERE tm.team_id = $1",
    [teamId]
  );
  res.json(result.rows);
});

// --- LISTAR ROBÔS DA EQUIPE ---
router.get("/:id/robots", auth, async (req, res) => {
  const teamId = req.params.id;
  try {
    const result = await pool.query(
      `SELECT r.id, r.name, r.photo, r.is_paid, c.name as category 
       FROM robots r 
       JOIN categories c ON r.category_id = c.id 
       WHERE r.team_id = $1`,
      [teamId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("ERRO LISTAR ROBÔS:", err);
    res.status(500).json({ error: "Erro ao listar robôs" });
  }
});

export default router;