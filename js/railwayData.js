/* =========================================================
   TRACKMYRAIL
   PHASE 2 — RAILWAY DATA MODEL
========================================================= */

const railwayState = {

    section: {
        id: "NDLS-AGC",
        name: "New Delhi - Agra",
        distance: 195
    },


    stations: [

        {
            id: "NDLS",
            code: "NDLS",
            name: "New Delhi",
            position: 8,
            platforms: 16
        },

        {
            id: "MTJ",
            code: "MTJ",
            name: "Mathura Junction",
            position: 52,
            platforms: 10
        },

        {
            id: "AGC",
            code: "AGC",
            name: "Agra Cantt",
            position: 92,
            platforms: 6
        }

    ],


    tracks: [

        {
            id: "T1",
            name: "UP MAIN",
            occupied: true,
            direction: "DOWN"
        },

        {
            id: "T2",
            name: "DOWN MAIN",
            occupied: false,
            direction: "DOWN"
        },

        {
            id: "T3",
            name: "LOOP",
            occupied: false,
            direction: "BOTH"
        }

    ],


    signals: [

        {
            id: "S1",
            position: 20,
            state: "GREEN"
        },

        {
            id: "S2",
            position: 48,
            state: "RED"
        },

        {
            id: "S3",
            position: 68,
            state: "GREEN"
        },

        {
            id: "S4",
            position: 88,
            state: "YELLOW"
        }

    ],


    trains: [

        {
            id: "12951",

            name: "Rajdhani Express",

            type: "Express",

            priority: "HIGH",

            position: 32,

            speed: 82,

            delay: 12,

            status: "RUNNING",

            direction: "DOWN",

            nextStation: "Mathura Junction"

        },


        {
            id: "54821",

            name: "Freight",

            type: "Freight",

            priority: "LOW",

            position: 57,

            speed: 0,

            delay: 3,

            status: "HOLD",

            direction: "DOWN",

            nextStation: "Agra Cantt"

        },


        {
            id: "12007",

            name: "Shatabdi Express",

            type: "Express",

            priority: "HIGH",

            position: 43,

            speed: 78,

            delay: 8,

            status: "RUNNING",

            direction: "DOWN",

            nextStation: "Mathura Junction"

        }

    ]

};