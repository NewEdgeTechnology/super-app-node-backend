module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log(`🔌 New client connected: ${socket.id}`);

    // 🔐 Personal Room Join
    socket.on("joinPersonalRoom", (userId) => {
      const roomId = `user_${userId}`;
      socket.join(roomId);
      console.log(`📥 Socket ${socket.id} joined personal room: ${roomId}`);
    });

    // 🚕 Driver Room Join (e.g., passenger joining driver's room)
    socket.on("joinDriverRoom", (driverUserId) => {
      const roomId = `driver_${driverUserId}`;
      socket.join(roomId);
      console.log(`📥 Socket ${socket.id} joined driver room: ${roomId}`);
    });

    // 🌐 Generic Room Join
    socket.on("joinRoom", (roomId) => {
      socket.join(roomId);
      console.log(`📥 Socket ${socket.id} joined room: ${roomId}`);
    });

    // 🆕 Ride Request Event
    socket.on("rideRequested", (data) => {
      const { rider_id, driver_id, ride_id, pickup_address } = data;
      const driverRoom = `driver_${driver_id}`;
      console.log(
        `📤 [RIDE REQUESTED] Rider ${rider_id} → Driver ${driver_id}`
      );
      console.log(`📍 Pickup Address: ${pickup_address}`);
      console.log(`📦 Emitting to Room: ${driverRoom}`);

      io.to(driverRoom).emit("newRideRequest", {
        ride_id,
        rider_id,
        pickup_address,
        message: "You have a new ride request!",
      });
    });

    // ✅ Accept Ride Event
    socket.on("rideAccepted", (data) => {
      const { driver_id, rider_id, ride_id } = data;
      const riderRoom = `user_${rider_id}`;
      console.log(
        `✅ [RIDE ACCEPTED] Driver ${driver_id} accepted Ride ${ride_id}`
      );
      console.log(`📦 Notifying Rider in Room: ${riderRoom}`);

      io.to(riderRoom).emit("rideAccepted", {
        ride_id,
        driver_id,
        message: "Your ride has been accepted!",
      });
    });

    // ❌ Disconnect
    socket.on("disconnect", () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
    });
  });
};
