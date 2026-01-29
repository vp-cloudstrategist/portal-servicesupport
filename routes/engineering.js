const express = require('express');
const router = express.Router();
const engineeringController = require('../controllers/engineeringController');
const requireLogin = require('../middleware/requireLogin'); 
const requireEngineering = require('../middleware/requireEngineering'); 

const upload = require('../config/multerConfig.js'); 

router.get('/tickets', requireLogin, engineeringController.getDashboardTickets);

router.post('/create', requireLogin, upload.single('anexo'), engineeringController.createTicket);

router.put('/ticket/:id', requireLogin, requireEngineering, upload.single('anexo'), engineeringController.updateTicketStatus);

router.get('/catalog-options', requireLogin, engineeringController.getCatalogOptions);

router.get('/users/engineers', requireLogin, engineeringController.getEngineersList);

module.exports = router;