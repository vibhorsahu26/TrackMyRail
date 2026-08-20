const railwayState = {

    trains: {
        "12951": {
            number: "12951",
            name: "Rajdhani Express",
            type: "Express",
            priority: "HIGH",

            currentStation: "NDLS",
            nextStation: "MTJ",

            speed: 82,
            delay: 12,

            track: "T1",
            direction: "forward",

            status: "running"
        },

        "54821": {
            number: "54821",
            name: "Freight",
            type: "Freight",
            priority: "LOW",

            currentStation: "MTJ",
            nextStation: "AGC",

            speed: 45,
            delay: 3,

            track: "T1",
            direction: "reverse",

            status: "running"
        }
    },


    stations: {

        "NDLS": {
            code: "NDLS",
            name: "New Delhi",
            platforms: 16
        },

        "MTJ": {
            code: "MTJ",
            name: "Mathura Jn",
            platforms: 5
        },

        "AGC": {
            code: "AGC",
            name: "Agra Cantt.",
            platforms: 6
        }

    },


    tracks: {

        "T1": {
            id: "T1",
            status: "occupied",
            occupiedBy: ["12951", "54821"]
        },

        "T2": {
            id: "T2",
            status: "free",
            occupiedBy: []
        },

        "T3": {
            id: "T3",
            status: "free",
            occupiedBy: []
        }

    },


    signals: {

        "S1": {
            id: "S1",
            state: "green"
        },

        "S2": {
            id: "S2",
            state: "red"
        },

        "S3": {
            id: "S3",
            state: "green"
        },

        "S4": {
            id: "S4",
            state: "yellow"
        }

    },


    conflicts: []

};