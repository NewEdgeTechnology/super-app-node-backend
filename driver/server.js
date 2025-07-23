const express = require("express");
const dotenv = require("dotenv");
const connectMongo = require("./config/mongo");
const { checkAndCreateTables } = require("./models/initModel");

const registrationRoutes = require("./routes/registrationRoute");
const authRoutes = require("./routes/authRoute");
const deviceRoutes = require("./routes/deviceRoute");
const driverRoutes = require("./routes/driverRoute");

dotenv.config();
const app = express();
app.use(express.json());

// Connect MongoDB
connectMongo();

// Create MySQL tables (not including drivers table)
checkAndCreateTables();

// Routes
app.use("/api/auth", authRoutes);
app.use("/api", registrationRoutes);
app.use("/api", deviceRoutes);
app.use("/api/driver", driverRoutes);
app.get("/", (req, res) => {
  res.send("🚗 Ride App Backend Running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
