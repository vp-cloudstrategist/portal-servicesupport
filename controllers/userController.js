const bcrypt = require('bcryptjs');
const pool = require('../config/db.js');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Função para CRIAR um usuário (COM SENHA ALEATÓRIA)
exports.createUser = async (req, res) => {
  const { perfil, nome, sobrenome, login, telefone, empresa } = req.body;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!login || !emailRegex.test(login)) {
      return res.status(400).json({ message: 'Formato de e-mail inválido.' });
  }

  if (!perfil || !nome || !sobrenome || !login) {
    return res.status(400).json({ message: 'Todos os campos do formulário selecionado são obrigatórios.' });
  }
  if (perfil === 'user' && (!telefone || !empresa)) {
    return res.status(400).json({ message: 'Para Usuário Cliente, os campos Telefone e Empresa também são obrigatórios.'});
  }
  
  try {
    const senhaTemporaria = crypto.randomBytes(8).toString('hex') + 'A1!';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(senhaTemporaria, salt);
    
    const sql = `
      INSERT INTO user (perfil, nome, sobre, login, passwd, telef, empre, statu, criado) 
      VALUES (?, ?, ?, ?, ?, ?, ?, 'novo', NOW())
    `;
    const values = [perfil, nome, sobrenome, login, hashedPassword, telefone || null, empresa || null];
    await pool.query(sql, values);

    const emailHtml = `
        <div style="font-family: Arial, sans-serif; text-align:center; max-width:600px; margin:auto; border:1px solid #ddd;">
            <div style="background-color:#f8f8f8; padding:20px;">
                <img src="https://support.nexxtcloud.app/app/logo.png" alt="Nexxt Cloud" style="width:150px;">
            </div>
            <div style="padding:30px; line-height:1.5;">
                <h2 style="color:#0c1231;">Bem-vindo ao Portal de Suporte</h2>
                <p>Olá <strong>${nome}</strong>,</p>
                <p>Uma conta foi criada para você em nosso portal. Use as seguintes credenciais para seu primeiro acesso:</p>
                <p style="margin-top:20px;"><strong>Login:</strong> ${login}</p>
                <p><strong>Senha Temporária:</strong> <span style="font-weight:bold; font-size:18px; color: #d9534f;">${senhaTemporaria}</span></p>
                <p style="margin-top:20px;">Por segurança, você será solicitado a criar uma nova senha pessoal após o login.</p>
            </div>
        </div>
    `;
    const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST, port: process.env.EMAIL_PORT, secure: false, 
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });
    await transporter.sendMail({
        from: `"Suporte Nexxt Cloud" <${process.env.EMAIL_FROM}>`,
        to: login,
        subject: 'Bem-vindo ao Portal de Suporte Nexxt Cloud',
        html: emailHtml
    });

    res.status(201).json({ message: `Usuário '${nome}' criado com sucesso! Um email com a senha temporária foi enviado.` });

  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: 'Este email de login já está em uso.' });
    }
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({ message: 'Erro interno no servidor.' });
  }
};

// --- Funções existentes (sem alterações) ---
exports.getCurrentUser = async (req, res) => {
  const login = req.session.user.login;
  if (!login) {
    return res.status(401).json({ message: 'Usuário não autenticado.' });
  }
  try {
    const sql = `SELECT login, nome, sobre as sobrenome, telef as telefone, empre as empresa, perfil FROM user WHERE login = ?`;
    const [rows] = await pool.query(sql, [login]);
    if (rows.length > 0) { res.status(200).json(rows[0]); } 
    else { res.status(404).json({ message: 'Usuário não encontrado.' }); }
  } catch (error) {
    console.error('Erro ao carregar dados do usuário:', error);
    res.status(500).json({ message: 'Erro no servidor ao carregar dados.' });
  }
};
exports.updateCurrentUser = async (req, res) => {
  const login_atual = req.session.user.login;
  const { nome, sobrenome, telefone, empresa, email: newLogin } = req.body;
  try {
    const sql = `UPDATE user SET nome = ?, sobre = ?, telef = ?, empre = ?, login = ? WHERE login = ?`;
    const values = [nome, sobrenome, telefone, empresa, newLogin, login_atual];
    await pool.query(sql, values);
    req.session.user.login = newLogin;
    req.session.user.nome = nome;
    req.session.user.sobrenome = sobrenome;
    res.status(200).json({ message: 'Dados atualizados com sucesso!' });
  } catch (error) {
    console.error('Erro ao atualizar dados:', error);
    res.status(500).json({ message: 'Erro no servidor ao atualizar dados.' });
  }
};
exports.getAllUsers = async (req, res) => {
    try {
        const [users] = await pool.query('SELECT id, nome, sobre, login, perfil, statu FROM user');
        res.status(200).json(users);
    } catch (error) {
        console.error('Erro ao listar usuários:', error);
        res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};
exports.updateUserById = async (req, res) => {
    const { id } = req.params;
    const { nome, sobrenome, perfil } = req.body;
    try {
        const sql = `UPDATE user SET nome = ?, sobre = ?, perfil = ? WHERE id = ?`;
        await pool.query(sql, [nome, sobrenome, perfil, id]);
        res.status(200).json({ message: 'Usuário atualizado com sucesso pelo administrador!' });
    } catch (error) {
        console.error('Erro ao atualizar usuário (Admin):', error);
        res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};