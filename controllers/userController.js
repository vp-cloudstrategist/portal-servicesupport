const bcrypt = require('bcryptjs');
const pool = require('../config/db.js');

// Função para CRIAR um usuário (Admin)
exports.createUser = async (req, res) => {
  const { perfil, nome, sobrenome, login, password, telefone, empresa } = req.body;

  // Validação principal agora inclui sobrenome
  if (!perfil || !nome || !sobrenome || !login || !password) {
    return res.status(400).json({ message: 'Nome, sobrenome, login e senha são obrigatórios.' });
  }
  if (perfil === 'user' && (!telefone || !empresa)) {
    return res.status(400).json({ message: 'Para Usuário Cliente, os campos Telefone e Empresa também são obrigatórios.'});
  }
  
  // Validações de formato
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(login)) {
    return res.status(400).json({ message: 'Formato de email inválido.' });
  }
  
  const senhaRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
  if (!senhaRegex.test(password)) {
    return res.status(400).json({ message: 'A senha não atende aos requisitos mínimos de segurança.' });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const sql = `
      INSERT INTO user (perfil, nome, sobre, login, passwd, telef, empre, statu, criado) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    const values = [perfil, nome, sobrenome, login, hashedPassword, telefone || null, empresa || null, 'ativo'];

    await pool.query(sql, values);
    res.status(201).json({ message: `Usuário do tipo '${perfil}' criado com sucesso!` });

  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: 'Este email de login já está em uso.' });
    }
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({ message: 'Erro interno no servidor.' });
  }
};

// Função para o próprio usuário BUSCAR seus dados
exports.getCurrentUser = async (req, res) => {
  const login = req.session.user.login;
  if (!login) {
    return res.status(401).json({ message: 'Usuário não autenticado.' });
  }
  try {
    const sql = `SELECT login, nome, sobre as sobrenome, telef as telefone, empre as empresa, perfil FROM user WHERE login = ?`;
    const [rows] = await pool.query(sql, [login]);
    if (rows.length > 0) {
      res.status(200).json(rows[0]);
    } else {
      res.status(404).json({ message: 'Usuário não encontrado.' });
    }
  } catch (error) {
    console.error('Erro ao carregar dados do usuário:', error);
    res.status(500).json({ message: 'Erro no servidor ao carregar dados.' });
  }
};

// Função para o próprio usuário ATUALIZAR seus dados
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

// Função para o Admin LISTAR TODOS os usuários
exports.getAllUsers = async (req, res) => {
    try {
        const [users] = await pool.query('SELECT id, nome, sobre, login, perfil, statu FROM user');
        res.status(200).json(users);
    } catch (error) {
        console.error('Erro ao listar usuários:', error);
        res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};

// Função para o Admin ATUALIZAR QUALQUER usuário pelo ID
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