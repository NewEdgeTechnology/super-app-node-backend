const express = require("express");
const router = express.Router();
const rideRequestController = require("../controllers/riderRequestController");
const { rideRequestLimiter } = require("../middleware/rateLimiter");
router.post("/request", rideRequestLimiter, rideRequestController.requestRide);
router.get("/:request_id", rideRequestController.getRiderRequestById);
module.exports = router;
