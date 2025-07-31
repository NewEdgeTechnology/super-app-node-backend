const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
require("dotenv").config();

const rideTypeRoutes = require("./routes/rideTypeRoute");
const riderRequestRoutes = require("./routes/riderRequestRoute");
const popularLocationRoute = require("./routes/popularLocationRoute");

const initRideTables = require("./models/initModel");
const connectMongo = require("./config/mongo");
const warmupRideTypesIfNeeded = require("./scripts/warmupRideTypes");

const redis = require("./config/redis");
const db = require("./config/db");

const app = express();
const PORT = process.env.PORT || 7000;

// Setup CORS
const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: false,
};
app.use(cors(corsOptions));
app.use(express.json());

// Logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// API routes
app.use("/api", popularLocationRoute);
app.use("/api/ridetypes", rideTypeRoutes);
app.use("/api/rides", riderRequestRoutes);

// Create HTTP + Socket Server
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://127.0.0.1:5501",
    methods: ["GET", "POST"],
  },
});

// Make io accessible via app.locals
app.locals.io = io;

// Load custom socket handlers from socket/index.js
require("./socket")(io); // this looks for socket/index.js and passes io

// Main Startup Function
async function startServer() {
  try {
    await connectMongo(); // Connect to MongoDB
    await initRideTables(); // Setup MySQL tables if not exist
    await warmupRideTypesIfNeeded(); // Warm up ride types if needed

    server.listen(PORT, () => {
      console.log(`🚀 Server API running at: http://localhost:${PORT}`);
      console.log(`📡 Socket.IO server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
