import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false, // true para porta 465, false para outras portas
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendPasswordResetEmail(email, resetToken) {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password.html?token=${resetToken}`;

  console.log("[Mailer] Configuração de email:");
  console.log("  - HOST:", process.env.EMAIL_HOST);
  console.log("  - PORT:", process.env.EMAIL_PORT);
  console.log("  - USER:", process.env.EMAIL_USER);
  console.log("  - FROM:", process.env.EMAIL_FROM);
  console.log("  - Reset URL:", resetUrl);

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Recuperação de Senha - Technovação",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Recuperação de Senha</h2>
        <p>Você solicitou a recuperação de senha para sua conta no Technovação.</p>
        <p>Clique no link abaixo para redefinir sua senha:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">
          Redefinir Senha
        </a>
        <p style="color: #666; font-size: 14px;">Este link expira em 1 hora.</p>
        <p style="color: #666; font-size: 14px;">Se você não solicitou esta recuperação, ignore este email.</p>
      </div>
    `,
  };

  try {
    console.log("[Mailer] Enviando email para:", email);
    const info = await transporter.sendMail(mailOptions);
    console.log("[Mailer] Email enviado com sucesso! ID:", info.messageId);
    return true;
  } catch (error) {
    console.error("[Mailer] ERRO ao enviar email:", error);
    console.error("[Mailer] Código do erro:", error.code);
    console.error("[Mailer] Mensagem:", error.message);
    return false;
  }
}

export default transporter;
