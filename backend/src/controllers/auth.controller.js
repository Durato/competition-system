import pool from "../db/pool.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendPasswordResetEmail } from "../config/mailer.js";

export async function register(req, res) {
  const { name, email, password, birthdate, phone, cpf, needs_accommodation } = req.body;
  const photo = req.photoUrl || null;

  if (!name || !email || !password || !birthdate || !phone || !cpf) {
    return res.status(400).json({ error: "Preencha todos os campos" });
  }

  try {
    const exists = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (exists.rowCount > 0) {
      return res.status(400).json({ error: "Email já cadastrado" });
    }

    const cpfExists = await pool.query(
      "SELECT id FROM users WHERE cpf = $1",
      [cpf]
    );

    if (cpfExists.rowCount > 0) {
      return res.status(400).json({ error: "CPF já cadastrado" });
    }

    // Verificar limite de alojamento (200 vagas)
    const wantsAccommodation = needs_accommodation === 'true' || needs_accommodation === true;
    if (wantsAccommodation) {
      const accommodationCount = await pool.query(
        "SELECT COUNT(*) FROM users WHERE needs_accommodation = true"
      );
      if (parseInt(accommodationCount.rows[0].count) >= 200) {
        return res.status(400).json({ error: "Limite de 200 vagas de alojamento atingido." });
      }
    }

    const hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      "INSERT INTO users (name, email, password_hash, birthdate, phone, photo, cpf, needs_accommodation) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, name, email",
      [name, email, hash, birthdate, phone, photo, cpf, wantsAccommodation]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("ERRO REGISTER:", err);
    res.status(500).json({ error: "Erro interno no servidor" });
  }
}

export async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Informe email e senha" });
  }

  try {
    const result = await pool.query(
      "SELECT id, name, email, password_hash FROM users WHERE email = $1",
      [email]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ error: "Usuário não encontrado" });
    }

    const user = result.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);

    if (!ok) {
      return res.status(401).json({ error: "Senha inválida" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (err) {
    console.error("ERRO LOGIN:", err);
    res.status(500).json({ error: "Erro no login" });
  }
}

export async function forgotPassword(req, res) {
  const { email } = req.body;

  console.log("[ForgotPassword] Requisição recebida para email:", email);

  if (!email) {
    return res.status(400).json({ error: "Informe o email" });
  }

  try {
    // Verifica se o usuário existe
    console.log("[ForgotPassword] Buscando usuário no banco...");
    const result = await pool.query(
      "SELECT id, email FROM users WHERE email = $1",
      [email]
    );

    if (result.rowCount === 0) {
      console.log("[ForgotPassword] Email não encontrado no banco");
      // Por segurança, não revela se o email existe ou não
      return res.json({ message: "Se o email existir, um link de recuperação será enviado." });
    }

    const user = result.rows[0];
    console.log("[ForgotPassword] Usuário encontrado:", user.id);

    // Gera token aleatório
    const resetToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 3600000); // 1 hora
    console.log("[ForgotPassword] Token gerado, expira em:", expiresAt);

    // Salva o token no banco
    console.log("[ForgotPassword] Salvando token no banco...");
    await pool.query(
      "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)",
      [user.id, resetToken, expiresAt]
    );
    console.log("[ForgotPassword] Token salvo com sucesso");

    // Envia email
    console.log("[ForgotPassword] Tentando enviar email para:", user.email);
    const emailSent = await sendPasswordResetEmail(user.email, resetToken);

    if (!emailSent) {
      console.error("[ForgotPassword] Falha ao enviar email");
      return res.status(500).json({ error: "Erro ao enviar email. Tente novamente mais tarde." });
    }

    console.log("[ForgotPassword] Email enviado com sucesso!");
    res.json({ message: "Se o email existir, um link de recuperação será enviado." });
  } catch (err) {
    console.error("[ForgotPassword] ERRO:", err);
    console.error("[ForgotPassword] Stack trace:", err.stack);
    res.status(500).json({ error: "Erro ao processar solicitação" });
  }
}

export async function resetPassword(req, res) {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: "Token e nova senha são obrigatórios" });
  }

  // Valida força da senha
  if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return res.status(400).json({ error: "Senha fraca: Mínimo 8 caracteres, com letras e números." });
  }

  try {
    // Busca o token válido
    const tokenResult = await pool.query(
      "SELECT user_id, expires_at, used FROM password_reset_tokens WHERE token = $1",
      [token]
    );

    if (tokenResult.rowCount === 0) {
      return res.status(400).json({ error: "Token inválido" });
    }

    const tokenData = tokenResult.rows[0];

    // Verifica se já foi usado
    if (tokenData.used) {
      return res.status(400).json({ error: "Token já utilizado" });
    }

    // Verifica se expirou
    if (new Date() > new Date(tokenData.expires_at)) {
      return res.status(400).json({ error: "Token expirado" });
    }

    // Hash da nova senha
    const hash = await bcrypt.hash(newPassword, 10);

    // Atualiza a senha do usuário
    await pool.query(
      "UPDATE users SET password_hash = $1 WHERE id = $2",
      [hash, tokenData.user_id]
    );

    // Marca o token como usado
    await pool.query(
      "UPDATE password_reset_tokens SET used = true WHERE token = $1",
      [token]
    );

    res.json({ message: "Senha redefinida com sucesso!" });
  } catch (err) {
    console.error("ERRO RESET PASSWORD:", err);
    res.status(500).json({ error: "Erro ao redefinir senha" });
  }
}
