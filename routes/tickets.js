const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const requireLogin = require('../middleware/requireLogin');
const multer = require('multer');
const requireAdmin = require('../middleware/requireAdmin');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// A função requireAdminOrSupport foi removida, pois agora usaremos requireAdmin.

router.get('/options/areas', requireLogin, ticketController.getAreas);
router.get('/options/prioridades', requireLogin, ticketController.getPrioridades);
router.get('/options/areas/:areaId/grupos', requireLogin, ticketController.getGruposByArea);
router.get('/options/areas/:areaId/alertas', requireLogin, ticketController.getAlertasByArea);
router.get('/options/areas/:areaId/tipos', requireLogin, ticketController.getTiposByArea);
router.get('/options/areas/:areaId/prioridades', requireLogin, ticketController.getPrioridadesByArea);


// --- Rotas de criação e exclusão ---
router.post('/options/areas', requireAdmin, ticketController.createArea);
router.delete('/options/areas/:id', requireAdmin, ticketController.deleteArea);

router.post('/options/areas/:areaId/grupos', requireAdmin, ticketController.createGrupo);
router.delete('/options/grupos/:id', requireAdmin, ticketController.deleteGrupo);

router.post('/options/areas/:areaId/alertas', requireAdmin, ticketController.createAlerta);
router.delete('/options/alertas/:id', requireAdmin, ticketController.deleteAlerta);

router.post('/options/areas/:areaId/tipos', requireAdmin, ticketController.createTipo);
router.delete('/options/tipos/:id', requireAdmin, ticketController.deleteTipo);

router.post('/options/areas/:areaId/prioridades', requireAdmin, ticketController.createPrioridade);
router.delete('/options/prioridades/:id', requireAdmin, ticketController.deletePrioridade);


// --- Rota para Exportação ---
router.get('/export', requireLogin, ticketController.exportTickets);

// --- Rotas para funcionalidades principais de tickets ---
router.get('/cards-info', requireLogin, ticketController.getCardInfo);
router.get('/', requireLogin, ticketController.getAllTickets);
router.post('/', requireLogin, upload.single('anexo'), ticketController.createTicket);
router.delete('/:id', requireAdmin, ticketController.deleteTicket);

// --- Rotas com parâmetros (devem vir por último) ---
router.get('/:id', requireLogin, ticketController.getTicketById);
router.put('/:id', requireLogin, upload.single('anexo'), ticketController.updateTicket);

// --- Rotas para Comentários ---
router.get('/:id/comments', requireLogin, ticketController.getCommentsByTicketId);
router.post('/:id/comments', requireLogin, ticketController.createComment);

module.exports = router;