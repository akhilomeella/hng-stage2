const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const pool = require("./database");
const refreshRouter = require("./routes/refreshCountries");
const allRouter = require("./routes/allCountries");

const app = express();
app.use(express.json());

// POST route to refresh countries
app.use("/api/v1", refreshRouter);

// GET routes for all countries
app.use("/api/v1/countries", allRouter);

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
