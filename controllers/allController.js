const pool = require("../db/database");
const path = require("path");
const fs = require("fs").promises;

// GET /countries
const getAllCountries = async (req, res) => {
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
};

// GET /countries/image
const getSummary = async (req, res) => {
  try {
    const imagePath = path.join(__dirname, "../summary.png");
    await fs.access(imagePath);
    res.sendFile(imagePath);
  } catch (error) {
    res.status(404).json({ error: "Summary image not found" });
  }
};

// GET /countries/:name
const specificCountry = async (req, res) => {
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
};

// DELETE /countries/:name
const deleteCountry = async (req, res) => {
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
};

// GET /status
const getStatus = async (req, res) => {
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
};

module.exports = {
  getAllCountries,
  getSummary,
  specificCountry,
  deleteCountry,
  getStatus,
};
