const express = require("express");

const trainRoutes = require("./routes/trainRoutes");

const app = express();

const PORT = 5000;

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(express.json());

// =====================================================
// API ROUTES
// =====================================================

app.use("/api/trains", trainRoutes);

// =====================================================
// ROOT ROUTE
// =====================================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "TrackMyRail Backend is running",
  });
});

// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "online",
    service: "TrackMyRail Backend",
  });
});

// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, () => {
  console.log(`TrackMyRail backend running on http://localhost:${PORT}`);
});
