const bcrypt = require('bcryptjs');
const pool = require('../config/db.js');

exports.login = async (req, res) => {
  const { email: login, passwd } = req.body;

  if (!login || !passwd) {
    return res.status(400).json({ message: 'Login e senha são obrigatórios.' });
  }

  try {
    const [rows] = await pool.query('SELECT * FROM user WHERE login = ?', [login]);
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }
    
    const isMatch = await bcrypt.compare(passwd, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    req.session.user = {
      id: user.id,
      nome: user.nome,
      sobrenome: user.sobrenome, 
      perfil: user.perfil
    };

    res.status(200).json({ message: 'Login bem-sucedido!' });

  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ message: 'Erro interno no servidor.' });
  }
};