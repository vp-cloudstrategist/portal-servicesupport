require('dotenv').config({ override: true });
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

pool.getConnection()
  .then(conn => {
    console.log('Conexão com o banco de dados bem-sucedida!');
    conn.release(); 
  })
  .catch(err => {
    console.error('Erro na conexão com o banco de dados:', err.message);
  });

module.exports = pool;