// config/db.js (VERSÃO DE TESTE FINAL - HARDCODED)
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: "localhost",
  user: "appservice",
  password: ")O9i8u7y6t5r4",
  database: "service",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

pool.getConnection()
  .then(conn => {
    console.log('✅✅✅ CONEXÃO HARDCODED BEM-SUCEDIDA!');
    conn.release(); 
  })
  .catch(err => {
    console.error('❌❌❌ FALHA NA CONEXÃO HARDCODED:', err.message);
  });

module.exports = pool;