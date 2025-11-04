const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController.js');
const requireLogin = require('../middleware/requireLogin.js');
const requireAdmin = require('../middleware/requireAdmin.js');

// Rotas para o próprio usuário logado
router.get('/me', requireLogin, userController.getCurrentUser);
router.put('/me', requireLogin, userController.updateCurrentUser);

// Rotas de administração de usuários
router.post('/', requireLogin, userController.createUser);
router.get('/', requireLogin, userController.getAllUsers);
router.get('/:id', requireLogin, userController.getUserById);
router.put('/:id', requireLogin, userController.updateUserById);
router.delete('/:id', requireLogin, userController.deleteUser);



module.exports = router;