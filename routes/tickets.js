const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const requireLogin = require('../middleware/requireLogin');
const multer = require('multer');

// --- Configuração do Multer para Upload de Arquivos ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/'); 
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// --- Rotas para buscar as opções dos seletores (dropdowns) ---
router.get('/options/areas', requireLogin, ticketController.getAreas);
router.get('/options/alertas', requireLogin, ticketController.getAlertas);
router.get('/options/grupos', requireLogin, ticketController.getGrupos);
router.get('/options/tipos-solicitacao', requireLogin, ticketController.getTiposSolicitacao);

// --- Rotas para funcionalidades principais de tickets ---
router.get('/cards-info', requireLogin, ticketController.getCardInfo);
router.get('/', requireLogin, ticketController.getAllTickets);
router.post('/', requireLogin, upload.single('anexo'), ticketController.createTicket);
router.delete('/:id', requireLogin, ticketController.deleteTicket);

// --- Rotas com parâmetros (devem vir por último) ---
router.get('/:id', requireLogin, ticketController.getTicketById);
router.put('/:id', requireLogin, upload.single('anexo'), ticketController.updateTicket);
module.exports = router;    