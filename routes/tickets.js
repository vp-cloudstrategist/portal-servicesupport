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

// Rotas para popular os dropdowns (GET)
router.get('/options/areas', requireLogin, ticketController.getAreas);
router.get('/options/prioridades', requireLogin, ticketController.getPrioridades);
router.get('/options/areas/:areaId/grupos', requireLogin, ticketController.getGruposByArea);
router.get('/options/areas/:areaId/alertas', requireLogin, ticketController.getAlertasByArea);
router.get('/options/areas/:areaId/tipos', requireLogin, ticketController.getTiposByArea);
router.get('/options/areas/:areaId/prioridades', requireLogin, ticketController.getPrioridadesByArea);
router.get('/options/status', requireLogin, ticketController.getStatus);


// --- Rotas de criação (POST), atualização (PUT) e exclusão (DELETE) de Opções ---

// Áreas
router.post('/options/areas', requireAdmin, ticketController.createArea);
router.delete('/options/areas/:id', requireAdmin, ticketController.deleteArea);

// Grupos
router.post('/options/areas/:areaId/grupos', requireAdmin, ticketController.createGrupo);
router.delete('/options/grupos/:id', requireAdmin, ticketController.deleteGrupo);

// Alertas
router.post('/options/areas/:areaId/alertas', requireAdmin, ticketController.createAlerta);
router.delete('/options/alertas/:id', requireAdmin, ticketController.deleteAlerta);
// ADICIONADA A ROTA DE ATUALIZAÇÃO (PUT)
router.put('/options/alertas/:id', requireAdmin, ticketController.updateAlerta);

// Tipos
router.post('/options/areas/:areaId/tipos', requireAdmin, ticketController.createTipo);
router.delete('/options/tipos/:id', requireAdmin, ticketController.deleteTipo);

// Prioridades
router.post('/options/areas/:areaId/prioridades', requireAdmin, ticketController.createPrioridade);
router.delete('/options/prioridades/:id', requireAdmin, ticketController.deletePrioridade);

// Status
router.post('/options/status', requireAdmin, ticketController.createStatus);
router.delete('/options/status/:id', requireAdmin, ticketController.deleteStatus);

// --- Outras rotas ---
router.get('/export', requireLogin, ticketController.exportTickets);
router.get('/cards-info', requireLogin, ticketController.getCardInfo);

// --- Rotas principais de tickets ---
router.get('/', requireLogin, ticketController.getAllTickets);
router.post('/', requireLogin, upload.single('anexo'), ticketController.createTicket);
router.delete('/:id', requireAdmin, ticketController.deleteTicket);
router.get('/:id', requireLogin, ticketController.getTicketById);
router.put('/:id', requireLogin, upload.single('anexo'), ticketController.updateTicket);

// --- Rotas para Comentários ---
router.get('/:id/comments', requireLogin, ticketController.getCommentsByTicketId);
router.post('/:id/comments', requireLogin, ticketController.createComment);

module.exports = router;