const bcrypt = require('bcryptjs');
const pool = require('../config/db.js');

exports.createUser = async (req, res) => {
  console.log('Dados recebidos do formulário para criar usuário:', req.body);
  const { 
    nome, sobrenome, apelido, telefone, empresa, 
    grupo_solucionador, login, password, timezone, idioma, foto 
  } = req.body;
  if (!nome || !login || !password) {
    return res.status(400).json({ message: 'Nome, login e senha são obrigatórios.' });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const sql = `
      INSERT INTO user 
      (nome, sobre, apeli, telef, empre, gsoluc, login, passwd, tzone, idioma, foto, perfil, statu, criado) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    const values = [
      nome, 
      sobrenome, 
      apelido || null,
      telefone || null,
      empresa || null,
      grupo_solucionador || null,
      login, 
      hashedPassword, 
      timezone || null,
      idioma || null,
      foto,
      'user', 
      'ativo'
    ];

    await pool.query(sql, values);

    res.status(201).json({ message: 'Usuário criado com sucesso!' });

  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({ message: 'Erro interno no servidor ao criar usuário.' });
  }
};

exports.getCurrentUser = async (req, res) => {
  const login = req.session.user.login;

  if (!login) {
    return res.status(401).json({ message: 'Usuário não autenticado.' });
  }

  try {
    const sql = `
      SELECT login, nome, sobre as sobrenome, apeli as apelido, telef as telefone, empre as empresa, gsoluc as grupo_solucionador, tzone as timezone, idioma 
      FROM user WHERE login = ?
    `;
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


exports.updateCurrentUser = async (req, res) => {
  const login_atual = req.session.user.login;
  const { nome, sobrenome, apelido, telefone, empresa, grupo_solucionador, timezone, idioma, email: newLogin } = req.body;

  try {
    const sql = `
      UPDATE user SET nome = ?, sobre = ?, apeli = ?, telef = ?, empre = ?, gsoluc = ?, tzone = ?, idioma = ?, login = ? 
      WHERE login = ?
    `;
    const values = [nome, sobrenome, apelido, telefone, empresa, grupo_solucionador, timezone, idioma, newLogin, login_atual];
    
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