const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController.js'); 


router.post('/login', authController.login);
router.post('/verify-2fa', authController.verify2FA);

router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);


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

router.post('/force-reset-password', authController.forceResetPassword);
module.exports = router;