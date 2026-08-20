const trains = [
  {
    id: "12951",
    number: "12951",
    name: "Rajdhani Express",
    type: "Express",
    priority: "high",
    status: "delayed",
    delay: 12,
    currentStation: "Mathura Jn",
    destination: "Agra Cantt",
    direction: "forward",
  },

  {
    id: "54821",
    number: "54821",
    name: "Freight",
    type: "Freight",
    priority: "low",
    status: "running",
    delay: 4,
    currentStation: "Mathura Jn",
    destination: "Agra Cantt",
    direction: "forward",
  },

  {
    id: "64315",
    number: "64315",
    name: "Passenger Express",
    type: "Passenger",
    priority: "medium",
    status: "delayed",
    delay: 2,
    currentStation: "Mathura Jn",
    destination: "Agra Cantt",
    direction: "forward",
  },
];

module.exports = trains;
