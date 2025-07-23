const Joi = require("joi");
const db = require("../config/db");
const rideRequestModel = require("../models/rideRequestModel");
const Driver = require("../models/driverModel");
const redis = require("../config/redis");

exports.requestRide = async (req, res) => {
  const io = req.app.locals.io;

  try {
    console.log("▶️ Incoming ride request payload");

    // Validate input
    const schema = Joi.object({
      rider_id: Joi.number().required(),
      pickup_lat: Joi.number().required(),
      pickup_lng: Joi.number().required(),
      dropoff_lat: Joi.number().required(),
      dropoff_lng: Joi.number().required(),
      pickup_address: Joi.string().required(),
      dropoff_address: Joi.string().required(),
      ride_type: Joi.string()
        .valid("standard", "premium", "group", "economy")
        .required(),
      payment_method: Joi.string().valid("cash", "card", "grabpay").required(),
      distance_meters: Joi.number().required(),
      duration_seconds: Joi.number().required(),
      socketId: Joi.string().optional(),
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      console.log("❌ Validation error:", error.details[0].message);
      return res.status(400).json({ error: error.details[0].message });
    }

    const {
      rider_id,
      pickup_lat,
      pickup_lng,
      dropoff_lat,
      dropoff_lng,
      pickup_address,
      dropoff_address,
      ride_type,
      payment_method,
      distance_meters,
      duration_seconds,
      socketId,
    } = value;

    // Get ride types from Redis or DB
    let rideTypes = [];
    try {
      const cachedRideTypes = await redis.get("ride_types");
      if (cachedRideTypes) {
        rideTypes = JSON.parse(cachedRideTypes);
        console.log("✅ ride_types fetched from Redis");
      } else {
        const [rows] = await db.query("SELECT * FROM ride_types");
        rideTypes = rows;
        await redis.set("ride_types", JSON.stringify(rows), "EX", 3600);
      }
    } catch (redisErr) {
      console.error("❌ Redis error:", redisErr.message);
      const [rows] = await db.query("SELECT * FROM ride_types");
      rideTypes = rows;
    }

    // Find matching ride type
    const rideType = rideTypes.find((type) => type.name === ride_type);
    if (!rideType) {
      return res.status(400).json({ error: "Invalid ride type selected" });
    }

    const fare_estimate =
      rideType.base_fare +
      Math.round((distance_meters / 1000) * rideType.per_km) +
      Math.round((duration_seconds / 60) * rideType.per_min);

    console.log("💰 Fare estimate (cents):", fare_estimate);

    const ride_request_id = await rideRequestModel.createRideRequest({
      rider_id,
      ride_type_id: rideType.ride_type_id,
      fare_estimate,
      pickup_lat,
      pickup_lng,
      dropoff_lat,
      dropoff_lng,
      pickup_address,
      dropoff_address,
    });

    console.log("✅ Ride request saved with ID:", ride_request_id);

    await rideRequestModel.createPayment({
      ride_request_id,
      amount_cents: fare_estimate,
      method: payment_method,
    });

    console.log("✅ Payment record created");

    try {
      if (dropoff_address) {
        await redis.zincrby("popular:dropoff_locations", 1, dropoff_address);
        const ttl = await redis.ttl("popular:dropoff_locations");
        if (ttl === -1) {
          await redis.expire("popular:dropoff_locations", 86400);
        }
        console.log("📍 Dropoff location tracked in Redis");
      }
    } catch (dropoffErr) {
      console.warn("⚠️ Could not save dropoff to Redis:", dropoffErr.message);
    }

    // 🔍 Get device_id from user_devices
    let device_id = null;
    try {
      const [rows] = await db.query(
        "SELECT device_id FROM user_devices WHERE user_id = ?",
        [rider_id]
      );
      if (rows.length > 0) {
        device_id = rows[0].device_id;
        console.log("📱 Fetched device_id:", device_id);
      }
    } catch (deviceErr) {
      console.warn("⚠️ Failed to fetch device_id:", deviceErr.message);
    }

    const onlineDriversCount = await Driver.countDocuments({ is_online: true });

    if (onlineDriversCount === 0) {
      const noDriverPayload = {
        message: "Ride request created but no drivers currently online",
        request_id: ride_request_id,
        fare_estimate,
        nearest_driver: null,
      };

      io.emit("ride_request_broadcast", {
        response: noDriverPayload,
        request: req.body,
        device_id,
      });

      return res.status(201).json(noDriverPayload);
    }

    // Search for drivers within 5 km radius
    const maxRadius = 5000;
    let radius = 1000;
    let nearestDriver = null;

    while (radius <= maxRadius && !nearestDriver) {
      nearestDriver = await Driver.findOne({
        is_online: true,
        current_location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [pickup_lng, pickup_lat],
            },
            $maxDistance: radius,
          },
        },
      }).lean();

      if (!nearestDriver) {
        radius += 1000;
      }
    }

    if (!nearestDriver) {
      const noDriverPayload = {
        message: "No drivers available now, please try again later",
        request_id: ride_request_id,
        fare_estimate,
        nearest_driver: null,
      };

      io.emit("ride_request_broadcast", {
        response: noDriverPayload,
        request: req.body,
        device_id,
      });

      return res.status(200).json(noDriverPayload);
    }

    console.log("🚗 Nearest driver:", nearestDriver.user_id);

    const responsePayload = {
      message: "Ride request and payment created successfully",
      request_id: ride_request_id,
      fare_estimate,
      nearest_driver: nearestDriver,
    };

    const broadcastPayload = {
      response: responsePayload,
      request: req.body,
      device_id,
    };

    if (socketId && io.sockets.sockets.get(socketId)) {
      const senderSocket = io.sockets.sockets.get(socketId);
      senderSocket.broadcast.emit("ride_request_broadcast", broadcastPayload);
    } else {
      io.emit("ride_request_broadcast", broadcastPayload);
    }

    return res.status(201).json(responsePayload);
  } catch (err) {
    console.error("🔥 Error in ride request:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.getRiderRequestById = async (req, res) => {
  const { request_id } = req.params;

  try {
    const request = await rideRequestModel.getRiderRequestById(request_id);

    if (!request) {
      return res.status(404).json({ message: "Ride request not found" });
    }

    res.status(200).json(request);
  } catch (error) {
    console.error("Error fetching ride request:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
