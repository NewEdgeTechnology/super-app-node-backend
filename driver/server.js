const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const cors = require("cors"); // add this

const connectMongo = require("./config/mongo");
const { checkAndCreateTables } = require("./models/initModel");

const registrationRoutes = require("./routes/registrationRoute");
const authRoutes = require("./routes/authRoute");
const deviceRoutes = require("./routes/deviceRoute");
const driverRoutes = require("./routes/driverRoute");
const forgotPasswordRoute = require("./routes/forgotPasswordRoute");
const profileRoutes = require("./routes/profileRoute");

dotenv.config();
const app = express();

app.use(cors({ origin: "*" })); // Allow CORS for all origins
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

connectMongo();
checkAndCreateTables();

app.use("/api/auth", authRoutes);
app.use("/api", registrationRoutes);
app.use("/api", deviceRoutes);
app.use("/api/driver", driverRoutes);
app.use("/api/forgotpassword", forgotPasswordRoute);
app.use("/api/profile", profileRoutes);

app.get("/", (req, res) => {
  res.send("🚗 Ride App Backend Running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
