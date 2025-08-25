const express = require('express');
const app = express();
const port = 3000;

const pool = require('./config/db.js');

app.get('/tickets', async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM tickets");
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar tickets:', error);
    res.status(500).send('Erro no servidor');
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});

const pool = require('.db.js');

app.get('/api/cards-info', async (req, res) =>{
    try{
        const sql = `
        SELECT
        COUNT(*) AS total,
        COUNT(CASE WHEN statu = 'aberto' THEN 1 END) AS abertos,
        COUNT(CASE WHEN statu = 'resolvido' THEN 1 END) AS resolvidos,
        COUNT(CASE WHEN statu = 'aprovacao' THEN 1 END) AS aprovacao,
        COUNT(CASE WHEN statu = 'encerrado' THEN 1 END) AS encerrados
        FROM tickets
        `;
        const[rows] = await pool.query(sql);
        res.json(rows[0]);
    }catch(error){
        console.error("Erro ao buscar informações dos cards:", error);
        res.status(500).json({erro: "Erro ao consultar banco de dados"});
    }
});