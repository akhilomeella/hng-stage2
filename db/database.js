const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
const files = require("fs");
dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST ?? "localhost",
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME ?? "countries_db",
  ssl: {
    ca: Buffer.from(process.env.CA_CERT, "base64").toString("utf-8"),
  },
  port: Number(process.env.DB_PORT ?? 3306),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

process.on("SIGTERM", async () => {
  console.log("SIGTERM: draining...");
  try {
    await pool.end();
  } finally {
    process.exit(0);
  }
});

module.exports = pool;
