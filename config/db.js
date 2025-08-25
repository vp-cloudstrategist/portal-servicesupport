
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'admin',
  password: 'Metro#123',
  database: 'support',
  waitForConnections: true,
  connectionLimit: 10, 
  queueLimit: 0
});

pool.getConnection()
  .then(conn => {
    console.log(' Conexão com o banco de dados bem-sucedida!');
    conn.release(); 
  })
  .catch(err => {
    console.error(' Erro na conexão com o banco de dados:', err);
  });

module.exports = pool;