// routes/tickets.js
const express = require('express');
const router = express.Router();
const pool = require('../config/db.js');
const requireLogin = require('../middleware/requireLogin.js'); // Importa nosso "segurança"

// ROTA: GET /api/tickets/cards-info
// AGORA PROTEGIDA e INTELIGENTE
router.get('/cards-info', requireLogin, async (req, res) => {
  try {

    const userId = req.session.user.id;

  
    const sql = `
      SELECT
        COUNT(*) AS total,
        COUNT(CASE WHEN statu = 'aberto' THEN 1 END) AS abertos,
        COUNT(CASE WHEN statu = 'resolvido' THEN 1 END) AS resolvidos,
        COUNT(CASE WHEN statu = 'aprovacao' THEN 1 END) AS aprovacao,
        COUNT(CASE WHEN statu = 'encerrado' THEN 1 END) AS encerrados
      FROM tickets
      WHERE user_id = ?  -- <-- SUA SUGESTÃO EM AÇÃO!
    `;
    
    const [rows] = await pool.query(sql, [userId]);
    res.json(rows[0]);

  } catch (error) {
    console.error('Erro ao buscar informações dos cards:', error);
    res.status(500).json({ erro: 'Erro ao consultar o banco de dados' });
  }
});

module.exports = router;