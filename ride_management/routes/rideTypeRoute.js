const express = require("express");
const router = express.Router();
const rideTypeController = require("../controllers/rideTypeController");

// Create new ride type
router.post("/", rideTypeController.createRideType);

// Update ride type by id
router.put("/:id", rideTypeController.updateRideType);

// Get all ride types
router.get("/", rideTypeController.getAllRideTypes);

// Get one ride type by id
router.get("/:id", rideTypeController.getRideTypeById);

module.exports = router;
