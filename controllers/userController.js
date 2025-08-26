const bcrypt = require('bcryptjs');
const pool = require('../config/db.js');

exports.createUser = async (req, res) => {
  const { nome, sobrenome, apelido, telefone, empresa, grupo_solucionador, login, password, timezone, idioma } = req.body;

  if (!nome || !login || !password) {
    return res.status(400).json({ message: 'Nome, login e senha são obrigatórios.' });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const sql = `
      INSERT INTO user 
      (nome, sobre, apeli, telef, empre, gsoluc, login, password, tzone, idioma, perfil, statu, criado_em) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    const values = [nome, sobrenome, apelido, telefone, empresa, grupo_solucionador, login, hashedPassword, timezone, idioma, 'user', 'ativo'];

    const [result] = await pool.query(sql, values);

    res.status(201).json({ message: 'Usuário criado com sucesso!', userId: result.insertId, login: login, data: new Date().toLocaleString('pt-BR') });

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
      SELECT login, nome, sobrenome, apelido, telefone, empresa, grupo_solucionador, timezone, idioma 
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
      UPDATE user SET nome = ?, sobrenome = ?, apelido = ?, telefone = ?, empresa = ?, grupo_solucionador = ?, timezone = ?, idioma = ?, login = ? 
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