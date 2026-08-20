const express = require("express");

const router = express.Router();

const trains = require("../data/trains");

// =====================================================
// GET ALL TRAINS
// GET /api/trains
// =====================================================

router.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    count: trains.length,
    trains: trains,
  });
});

// =====================================================
// GET SINGLE TRAIN
// GET /api/trains/:id
// =====================================================

router.get("/:id", (req, res) => {
  const trainId = req.params.id;

  const train = trains.find((train) => train.id === trainId);

  if (!train) {
    return res.status(404).json({
      success: false,
      message: "Train not found",
    });
  }

  res.status(200).json({
    success: true,
    train: train,
  });
});

module.exports = router;
