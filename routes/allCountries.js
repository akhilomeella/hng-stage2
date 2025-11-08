const router = require("express").Router();
const {
  getAllCountries,
  getSummary,
  specificCountry,
  deleteCountry,
  getStatus,
} = require("../controllers/allController");

// GET /countries
router.get("/", getAllCountries);

// GET /countries/image
router.get("/image", getSummary);

// GET /countries/:name
router.get("/:name", specificCountry);

// DELETE /countries/:name
router.delete("/:name", deleteCountry);

// GET /status
router.get("/status", getStatus);

module.exports = router;
