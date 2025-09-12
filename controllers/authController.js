const bcrypt = require('bcryptjs');
const pool = require('../config/db.js');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

exports.login = async (req, res) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({ message: 'Login e senha são obrigatórios.' });
    }

    const [rows] = await pool.query('SELECT * FROM user WHERE login = ?', [login]);
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwd);

    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    req.session.user = {
      id: user.id,
      nome: user.nome,
      login: user.login,
      sobrenome: user.sobre,
      perfil: user.perfil
    };

    res.status(200).json({ message: 'Login bem-sucedido!' });

  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ message: 'Erro interno no servidor.' });
  }
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM user WHERE login = ?', [email]);
    if (rows.length === 0) {
      return res.status(200).json({ message: 'Se um usuário com este email existir, um link será enviado.' });
    }
    const user = rows[0];

    const emailBase64 = Buffer.from(user.login).toString('base64');
    const resetLink = `https://service.nexxtcloud.app/reset-password?user=${emailBase64}`;

    //Template de email
    const emailHtml = `
      <div style="background-color:#ffffff; padding:30px; text-align:center;">
        <img src="https://support.nexxtcloud.app/app/logo.png" alt="Nexxt Cloud" width="200">
      </div>
      <div style="font-family: 'Space Grotesk', sans-serif; font-size:14px; color:#333; background-color:#ffffff; padding:20px; max-width:700px; margin:0 auto; border-radius:8px; box-shadow:0 4px 8px rgba(0,0,0,0.05); text-align:center; line-height:1.5;">
        <h2 style="color:#0c1231;">Recuperação de Senha</h2>
        <p>Olá <strong>${user.nome}</strong>,</p>
        <p>Recebemos o seu pedido para redefinição da senha de acesso ao <strong>Portal Nexxt Cloud Support</strong>.</p>
        <p>Se você não fez esta solicitação, ignore este e-mail.</p>
        <div style="margin:30px 0;">
          <a href="${resetLink}" style="background-color:#2979FF; color:#fff; padding:14px 28px; text-decoration:none; border-radius:6px; font-weight:bold; font-size:15px; display:inline-block;">Redefinir minha senha</a>
        </div>
        <p style="margin-bottom:20px;">Caso o botão acima não funcione, copie e cole o link abaixo em seu navegador:</p>
        <p style="word-break: break-all; color:#2979FF; margin-bottom:30px;">${resetLink}</p>
        <p style="margin-top:60px; margin-bottom:30px;">Atenciosamente, <br><strong>Equipe Nexxt Cloud</strong></p>
      </div>
      <div style="background-color:#ffffff; padding:20px; text-align:center; font-size:12px; color:#000000; font-family: 'Space Grotesk', Arial, sans-serif;">
        Nexxt Cloud © 2025 • Todos os direitos reservados
      </div>
    `;

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false, 
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });

    await transporter.sendMail({
      from: `"Suporte Nexxt Cloud" <${process.env.EMAIL_FROM}>`,
      to: user.login,
      subject: 'Recuperação de Senha',
      html: emailHtml // Usando nosso novo template HTML
    });
    
    res.status(200).json({ message: 'Se um usuário com este email existir, um link será enviado.' });
  } catch (error) {
    console.error('Erro no forgotPassword:', error);
    res.status(500).json({ message: 'Erro interno no servidor.' });
  }
};

exports.resetPassword = async (req, res) => {
    const { user: emailBase64, password } = req.body;
    if (!emailBase64 || !password) {
        return res.status(400).json({ message: 'Informações inválidas.' });
    }
    try {
        const email = Buffer.from(emailBase64, 'base64').toString('ascii');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        await pool.query('UPDATE user SET passwd = ? WHERE login = ?', [hashedPassword, email]);
        res.status(200).json({ message: 'Senha redefinida com sucesso!' });
    } catch (error) {
        console.error('Erro no resetPassword:', error);
        res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};