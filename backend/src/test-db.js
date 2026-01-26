require('dotenv').config();
const pool = require('./db/pool');

(async () => {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('Conectado! Hora do banco:', res.rows[0]);
    process.exit(0);
  } catch (err) {
    console.error('Erro ao conectar:', err);
    process.exit(1);
  }
})();
