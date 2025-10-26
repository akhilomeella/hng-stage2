CREATE DATABASE IF NOT EXISTS country_cache;
USE country_cache;
CREATE TABLE IF NOT EXISTS countries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    capital VARCHAR(255),
    region VARCHAR(100),
    population BIGINT NOT NULL,
    currency_code VARCHAR(10),
    exchange_rate DOUBLE,
    estimated_gdp DOUBLE,
    flag_url VARCHAR(1024),
    last_refreshed_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
-- simple key-value table to store global last refresh timestamp
CREATE TABLE IF NOT EXISTS metadata (k VARCHAR(100) PRIMARY KEY, v VARCHAR(255));
-- seed metadata key
INSERT IGNORE INTO metadata (k, v)
VALUES ('last_refreshed_at', NULL);