const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController.js'); 

router.post('/login', authController.login);

module.exports = router;
router.get('/session', (req, res) => {
  if (req.session.user) {
    res.status(200).json(req.session.user);
  } else {
    res.status(401).json({ message: 'Usuário não autenticado.' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ message: 'Não foi possível fazer logout.' });
    }
    res.clearCookie('connect.sid'); 
    return res.status(200).json({ message: 'Logout bem-sucedido.' });
  });
});

module.exports = router;