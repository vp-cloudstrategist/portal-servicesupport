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
      return res.status(200).json({ message: 'Se um usuário com este email existir, um link de recuperação será enviado.' });
    }
    const user = rows[0];

    const token = crypto.randomBytes(32).toString('hex');

    const deleteSql = 'DELETE FROM password_resets WHERE email = ?';
    await pool.query(deleteSql, [user.login]);

    const insertSql = 'INSERT INTO password_resets (email, token) VALUES (?, ?)';
    await pool.query(insertSql, [user.login, token]);

    const resetLink = `http://localhost:3000/reset-password?token=${token}`;

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false, 
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Suporte Nexxt Cloud" <${process.env.EMAIL_FROM}>`,
      to: user.login,
      subject: 'Recuperação de Senha',
      html: `
        <p>Olá ${user.nome},</p>
        <p>Você solicitou a recuperação de senha. Clique no link abaixo para criar uma nova senha:</p>
        <a href="${resetLink}">Redefinir Senha</a>
        <p>Este link é válido por 1 hora.</p>
      `
    });
    
    res.status(200).json({ message: 'Se um usuário com este email existir, um link de recuperação será enviado.' });

  } catch (error) {
    console.error('Erro no forgotPassword:', error);
    res.status(500).json({ message: 'Erro interno no servidor.' });
  }
};
exports.resetPassword = async (req, res) => {
    const { token, password } = req.body;

    if (!token || !password) {
        return res.status(400).json({ message: 'Token e nova senha são obrigatórios.' });
    }

    try {
        const sql = `
            SELECT * FROM password_resets 
            WHERE token = ? AND criado_em >= NOW() - INTERVAL 1 HOUR
        `;
        const [rows] = await pool.query(sql, [token]);

        if (rows.length === 0) {
            return res.status(400).json({ message: 'Token inválido ou expirado.' });
        }
        const resetRequest = rows[0];

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const updateUserSql = 'UPDATE user SET passwd = ? WHERE login = ?';
        await pool.query(updateUserSql, [hashedPassword, resetRequest.email]);

        const deleteTokenSql = 'DELETE FROM password_resets WHERE email = ?';
        await pool.query(deleteTokenSql, [resetRequest.email]);

        res.status(200).json({ message: 'Senha redefinida com sucesso!' });

    } catch (error) {
        console.error('Erro no resetPassword:', error);
        res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};
