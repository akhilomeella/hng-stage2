const express = require("express");
const mysql = require("mysql2/promise");
const axios = require("axios");
const { createCanvas } = require("canvas");
const fs = require("fs").promises;
const files = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();
app.use(express.json());

// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "countries_db",
  ssl: {
    ca: files.readFileSync("ca.pem"),
  },
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Initialize database
async function initDatabase() {
  const connection = await pool.getConnection();
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS countries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        capital VARCHAR(255),
        region VARCHAR(100),
        population BIGINT NOT NULL,
        currency_code VARCHAR(10),
        exchange_rate DECIMAL(20, 6),
        estimated_gdp DECIMAL(30, 2),
        flag_url TEXT,
        last_refreshed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_name (name),
        INDEX idx_region (region),
        INDEX idx_currency (currency_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS refresh_metadata (
        id INT PRIMARY KEY DEFAULT 1,
        last_refreshed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CHECK (id = 1)
      )
    `);

    await connection.query(`
      INSERT IGNORE INTO refresh_metadata (id) VALUES (1)
    `);

    console.log("Database initialized successfully");
  } finally {
    connection.release();
  }
}

// Generate summary image
async function generateSummaryImage(stats) {
  const width = 800;
  const height = 600;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, width, height);

  // Title
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 32px Arial";
  ctx.fillText("Country Data Summary", 50, 60);

  // Total countries
  ctx.font = "24px Arial";
  ctx.fillStyle = "#00d9ff";
  ctx.fillText(`Total Countries: ${stats.total}`, 50, 120);

  // Last refreshed
  ctx.fillStyle = "#ffffff";
  ctx.font = "18px Arial";
  ctx.fillText(`Last Refreshed: ${stats.timestamp}`, 50, 160);

  // Top 5 countries by GDP
  ctx.fillStyle = "#00ff88";
  ctx.font = "bold 24px Arial";
  ctx.fillText("Top 5 Countries by Estimated GDP", 50, 220);

  ctx.fillStyle = "#ffffff";
  ctx.font = "18px Arial";
  let y = 260;
  stats.topCountries.forEach((country, index) => {
    const gdp = country.estimated_gdp
      ? `$${(country.estimated_gdp / 1e9).toFixed(2)}B`
      : "N/A";
    ctx.fillText(`${index + 1}. ${country.name} - ${gdp}`, 70, y);
    y += 40;
  });

  // Save image
  const cacheDir = path.join(__dirname, "cache");
  await fs.mkdir(cacheDir, { recursive: true });
  const buffer = canvas.toBuffer("image/png");
  await fs.writeFile(path.join(cacheDir, "summary.png"), buffer);
}

// POST /countries/refresh
app.post("/countries/refresh", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    // Fetch countries data
    const countriesResponse = await axios.get(
      "https://restcountries.com/v2/all?fields=name,capital,region,population,flag,currencies",
      { timeout: 10000 }
    );

    // Fetch exchange rates
    const ratesResponse = await axios.get(
      "https://open.er-api.com/v6/latest/USD",
      { timeout: 10000 }
    );

    const countries = countriesResponse.data;
    const exchangeRates = ratesResponse.data.rates;

    await connection.beginTransaction();

    for (const country of countries) {
      let currencyCode = null;
      let exchangeRate = null;
      let estimatedGdp = 0;

      // Handle currency
      if (country.currencies && country.currencies.length > 0) {
        currencyCode = country.currencies[0].code;

        if (currencyCode && exchangeRates[currencyCode]) {
          exchangeRate = exchangeRates[currencyCode];
          const randomMultiplier = Math.random() * (2000 - 1000) + 1000;
          estimatedGdp = (country.population * randomMultiplier) / exchangeRate;
        } else if (currencyCode) {
          // Currency code exists but not in exchange rates
          exchangeRate = null;
          estimatedGdp = null;
        }
      }

      // Upsert country
      await connection.query(
        `
        INSERT INTO countries (
          name, capital, region, population, currency_code, 
          exchange_rate, estimated_gdp, flag_url, last_refreshed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          capital = VALUES(capital),
          region = VALUES(region),
          population = VALUES(population),
          currency_code = VALUES(currency_code),
          exchange_rate = VALUES(exchange_rate),
          estimated_gdp = VALUES(estimated_gdp),
          flag_url = VALUES(flag_url),
          last_refreshed_at = NOW()
      `,
        [
          country.name,
          country.capital || null,
          country.region || null,
          country.population,
          currencyCode,
          exchangeRate,
          estimatedGdp,
          country.flag || null,
        ]
      );
    }

    // Update refresh metadata
    await connection.query(`
      UPDATE refresh_metadata SET last_refreshed_at = NOW() WHERE id = 1
    `);

    await connection.commit();

    // Generate summary image
    const [topCountries] = await connection.query(`
      SELECT name, estimated_gdp 
      FROM countries 
      WHERE estimated_gdp IS NOT NULL
      ORDER BY estimated_gdp DESC 
      LIMIT 5
    `);

    const [countResult] = await connection.query(`
      SELECT COUNT(*) as total FROM countries
    `);

    const [metaResult] = await connection.query(`
      SELECT last_refreshed_at FROM refresh_metadata WHERE id = 1
    `);

    await generateSummaryImage({
      total: countResult[0].total,
      timestamp: metaResult[0].last_refreshed_at.toISOString(),
      topCountries: topCountries,
    });

    res.json({
      message: "Countries data refreshed successfully",
      total_countries: countResult[0].total,
    });
  } catch (error) {
    await connection.rollback();

    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      return res.status(503).json({
        error: "External data source unavailable",
        details: `Could not fetch data from ${
          error.config?.url || "external API"
        }`,
      });
    }

    if (error.response) {
      return res.status(503).json({
        error: "External data source unavailable",
        details: `Could not fetch data from ${
          error.config?.url || "external API"
        }`,
      });
    }

    console.error("Refresh error:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    connection.release();
  }
});

// GET /countries
app.get("/countries", async (req, res) => {
  try {
    const { region, currency, sort } = req.query;

    let query = "SELECT * FROM countries WHERE 1=1";
    const params = [];

    if (region) {
      query += " AND region = ?";
      params.push(region);
    }

    if (currency) {
      query += " AND currency_code = ?";
      params.push(currency);
    }

    if (sort === "gdp_desc") {
      query += " ORDER BY estimated_gdp DESC";
    } else if (sort === "gdp_asc") {
      query += " ORDER BY estimated_gdp ASC";
    } else {
      query += " ORDER BY name ASC";
    }

    const [countries] = await pool.query(query, params);

    res.json(countries);
  } catch (error) {
    console.error("Get countries error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /countries/image
app.get("/countries/image", async (req, res) => {
  try {
    const imagePath = path.join(__dirname, "cache", "summary.png");
    await fs.access(imagePath);
    res.sendFile(imagePath);
  } catch (error) {
    res.status(404).json({ error: "Summary image not found" });
  }
});

// GET /countries/:name
app.get("/countries/:name", async (req, res) => {
  try {
    const [countries] = await pool.query(
      "SELECT * FROM countries WHERE LOWER(name) = LOWER(?)",
      [req.params.name]
    );

    if (countries.length === 0) {
      return res.status(404).json({ error: "Country not found" });
    }

    res.json(countries[0]);
  } catch (error) {
    console.error("Get country error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /countries/:name
app.delete("/countries/:name", async (req, res) => {
  try {
    const [result] = await pool.query(
      "DELETE FROM countries WHERE LOWER(name) = LOWER(?)",
      [req.params.name]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Country not found" });
    }

    res.json({ message: "Country deleted successfully" });
  } catch (error) {
    console.error("Delete country error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /status
app.get("/status", async (req, res) => {
  try {
    const [countResult] = await pool.query(
      "SELECT COUNT(*) as total FROM countries"
    );

    const [metaResult] = await pool.query(
      "SELECT last_refreshed_at FROM refresh_metadata WHERE id = 1"
    );

    res.json({
      total_countries: countResult[0].total,
      last_refreshed_at: metaResult[0].last_refreshed_at,
    });
  } catch (error) {
    console.error("Status error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Start server
const PORT = process.env.PORT || 3000;

initDatabase()
  .then(() => console.log("Database connected"))
  .catch((err) => {
    console.error("Database init failed, continuing startup:", err.message);
  })
  .finally(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  });
