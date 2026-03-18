const mysql = require('mysql2/promise');

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const tablePrefix = process.env.WP_DB_PREFIX || 'wp_';

const pool = mysql.createPool({
  host: required('DB_HOST'),
  port: Number(process.env.DB_PORT || 3306),
  user: required('DB_USER'),
  password: required('DB_PASSWORD'),
  database: required('DB_NAME'),
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
  queueLimit: 0,
  charset: 'utf8mb4_unicode_ci'
});

async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

module.exports = {
  pool,
  query,
  tablePrefix
};
