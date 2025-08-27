const bcrypt = require('bcryptjs');
const pool = require('../config/db.js');
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
