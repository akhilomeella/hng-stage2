# Country Currency & Exchange API

A RESTful API that fetches country data and exchange rates from external APIs, computes estimated GDP, caches the data in MySQL, and provides CRUD operations with image summary generation.

---

## Features

- Fetch and cache country data from [Rest Countries API](https://restcountries.com/v2/all?fields=name,capital,region,population,flag,currencies)
- Fetch exchange rates from [Open Exchange Rate API](https://open.er-api.com/v6/latest/USD)
- Compute `estimated_gdp = population × random(1000–2000) ÷ exchange_rate`
- Store all countries in MySQL (cache)
- Supports CRUD operations:
  - `POST /countries/refresh` → Refresh and cache new country data
  - `GET /countries` → Get all countries (with filters & sorting)
  - `GET /countries/:name` → Get a country by name
  - `DELETE /countries/:name` → Delete a country
  - `GET /status` → Get total countries and last refresh timestamp
  - `GET /countries/image` → Serve generated summary image
- Generates an image (`cache/summary.png`) after every refresh with:
  - Total number of countries
  - Top 5 countries by estimated GDP
  - Last refresh timestamp

---

## Tech Stack

- **Backend Framework:** Node.js + Express
- **Database:** MySQL
