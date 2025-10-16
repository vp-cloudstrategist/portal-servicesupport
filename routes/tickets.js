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
const requireAdminOrSupport = (req, res, next) => {
    const user = req.session.user;
    if (user && (user.perfil === 'admin' || user.perfil === 'support')) {
        return next();
    }
    return res.status(403).json({ message: 'Acesso negado. Permissão insuficiente.' });
};

router.get('/options/areas', requireLogin, ticketController.getAreas);
router.get('/options/prioridades', requireLogin, ticketController.getPrioridades);
router.get('/options/areas/:areaId/grupos', requireLogin, ticketController.getGruposByArea);
router.get('/options/areas/:areaId/alertas', requireLogin, ticketController.getAlertasByArea);
router.get('/options/areas/:areaId/tipos', requireLogin, ticketController.getTiposByArea);
router.get('/options/areas/:areaId/prioridades', requireLogin, ticketController.getPrioridadesByArea);


router.post('/options/areas', requireAdminOrSupport, ticketController.createArea);
router.delete('/options/areas/:id', requireAdminOrSupport, ticketController.deleteArea);

router.post('/options/areas/:areaId/grupos', requireAdminOrSupport, ticketController.createGrupo);
router.delete('/options/grupos/:id', requireAdminOrSupport, ticketController.deleteGrupo);

router.post('/options/areas/:areaId/alertas', requireAdminOrSupport, ticketController.createAlerta);
router.delete('/options/alertas/:id', requireAdminOrSupport, ticketController.deleteAlerta);

router.post('/options/areas/:areaId/tipos', requireAdminOrSupport, ticketController.createTipo);
router.delete('/options/tipos/:id', requireAdminOrSupport, ticketController.deleteTipo);

router.post('/options/areas/:areaId/prioridades', requireAdminOrSupport, ticketController.createPrioridade);
router.delete('/options/prioridades/:id', requireAdminOrSupport, ticketController.deletePrioridade);


// --- Rota para Exportação ---
router.get('/export', requireLogin, ticketController.exportTickets);

// --- Rotas para funcionalidades principais de tickets ---
router.get('/cards-info', requireLogin, ticketController.getCardInfo);
router.get('/', requireLogin, ticketController.getAllTickets);
router.post('/', requireLogin, upload.single('anexo'), ticketController.createTicket);
router.delete('/:id', requireLogin, ticketController.deleteTicket);

// --- Rotas com parâmetros (devem vir por último) ---
router.get('/:id', requireLogin, ticketController.getTicketById);
router.put('/:id', requireLogin, upload.single('anexo'), ticketController.updateTicket);

// --- Rotas para Comentários ---
router.get('/:id/comments', requireLogin, ticketController.getCommentsByTicketId);
router.post('/:id/comments', requireLogin, ticketController.createComment);

module.exports = router;