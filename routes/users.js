const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController.js');
const requireLogin = require('../middleware/requireLogin'); 

router.post('/', userController.createUser);

router.get('/me', requireLogin, userController.getCurrentUser);

router.put('/me', requireLogin, userController.updateCurrentUser);

module.exports = router;