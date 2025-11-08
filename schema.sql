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
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
CREATE TABLE IF NOT EXISTS refresh_metadata (
    id INT PRIMARY KEY DEFAULT 1,
    last_refreshed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (id = 1)
);
INSERT IGNORE INTO refresh_metadata (id)
VALUES (1);