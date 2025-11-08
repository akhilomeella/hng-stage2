const router = require("express").Router();
const { refreshCountries } = require("../controllers/refreshController");

// POST /countries/refresh
router.post("/countries/refresh", refreshCountries);

module.exports = router;
