const bcrypt = require('bcryptjs');
const pool = require('../config/db.js');

exports.createUser = async (req, res) => {
  console.log('--- ROTA POST /api/users ACIONADA ---');
  console.log('Dados recebidos do formulário:', req.body);

  const { nome, sobrenome, login, password, ...outrosCampos } = req.body;

  if (!nome || !login || !password) {
    console.log('VALIDAÇÃO FALHOU: Campos obrigatórios ausentes.');
    return res.status(400).json({ message: 'Nome, login e senha são obrigatórios.' });
  }

  try {
    console.log('Iniciando criptografia da senha...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    console.log('Senha criptografada com sucesso.');

    const sql = `
      INSERT INTO user (nome, sobre, login, passwd, perfil, statu, criado) 
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `;
    const values = [nome, sobrenome, login, hashedPassword, 'user', 'ativo'];

    console.log('Executando query no banco de dados...');
    const [result] = await pool.query(sql, values);
    
    console.log('Usuário inserido com sucesso! ID:', result.insertId);

    res.status(201).json({ message: 'Usuário criado com sucesso!', userId: result.insertId });

  } catch (error) {
    console.error('ERRO CATASTRÓFICO NO BLOCO TRY-CATCH:', error);
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