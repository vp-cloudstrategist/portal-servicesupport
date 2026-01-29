const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const requireLogin = require('../middleware/requireLogin');
const requireAdmin = require('../middleware/requireAdmin'); 


router.post('/', requireLogin, userController.createUser);
router.get('/', requireLogin, userController.getAllUsers);
router.get('/:id', requireLogin, userController.getUserById);
router.delete('/:id', requireLogin, userController.deleteUser); 

router.put('/:id', requireLogin, requireAdmin, userController.updateUser); 

router.get('/me', requireLogin, userController.getCurrentUser);
router.put('/me', requireLogin, userController.updateCurrentUser);

module.exports = router;