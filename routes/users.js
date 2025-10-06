const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController.js');
const requireLogin = require('../middleware/requireLogin.js');
const requireAdmin = require('../middleware/requireAdmin.js');

router.get('/me', requireLogin, userController.getCurrentUser);
router.put('/me', requireLogin, userController.updateCurrentUser);

router.post('/', requireLogin, userController.createUser);
router.get('/', requireLogin, userController.getAllUsers); 
router.get('/:id', requireLogin, userController.getUserById);
router.put('/:id', requireLogin, userController.updateUserById);

router.get('/me', requireLogin, userController.getCurrentUser);
router.put('/me', requireLogin, userController.updateCurrentUser);

module.exports = router;