const pool = require("../db/database");
const axios = require("axios");
const generateSummaryImage = require("../generate_img");

const refreshCountries = async (req, res) => {
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
};

module.exports = { refreshCountries };
