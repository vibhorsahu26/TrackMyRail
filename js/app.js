/* =========================================================
   TRACKMYRAIL
   Phase 1 — Dashboard Prototype
========================================================= */


/* =========================================================
   MOCK APPLICATION STATE
========================================================= */

const appState = {

    system: {
        online: true,
        lastUpdate: new Date()
    },

    section: {
        name: "NDLS–AGRA",
        totalTrains: 6,
        onTime: 2,
        delayed: 4,
        averageDelay: 7.2,
        throughput: 18,
        trackUsage: 82
    },

    trains: [

        {
            number: "12951",
            name: "Rajdhani Express",
            route: "NDLS → BCT",
            delay: 12,
            speed: 82,
            nextStop: "Mathura Jn",
            eta: "10:35",
            priority: "HIGH",
            priorityClass: "high"
        },

        {
            number: "54821",
            name: "Freight",
            route: "NDLS → Agra Cantt.",
            delay: 3,
            speed: 45,
            nextStop: "Agra Cantt.",
            eta: "10:28",
            priority: "LOW",
            priorityClass: "low"
        },

        {
            number: "12007",
            name: "Shatabdi Express",
            route: "NDLS → Jhansi",
            delay: 8,
            speed: 78,
            nextStop: "Bharatpur",
            eta: "10:40",
            priority: "HIGH",
            priorityClass: "high"
        },

        {
            number: "64315",
            name: "Passenger",
            route: "Mathura → NDLS",
            delay: 2,
            speed: 55,
            nextStop: "Farah",
            eta: "10:30",
            priority: "MEDIUM",
            priorityClass: "medium"
        },

        {
            number: "12424",
            name: "Dibrugarh Rajdhani",
            route: "Dibrugarh → NDLS",
            delay: 5,
            speed: 78,
            nextStop: "Kanpur Central",
            eta: "11:05",
            priority: "HIGH",
            priorityClass: "high"
        },

        {
            number: "12138",
            name: "Punjab Mail",
            route: "Lucknow → Prayagraj",
            delay: 4,
            speed: 65,
            nextStop: "Prayagraj Jn",
            eta: "11:12",
            priority: "MEDIUM",
            priorityClass: "medium"
        }

    ],

    conflict: {

        active: true,

        trains: [
            "12951",
            "54821"
        ],

        section: "Mathura Jn – Platform 2",

        timeToConflict: 8,

        recommendation: {
            proceed: "12951",
            hold: "54821",
            holdAt: "Mathura Jn",
            holdDuration: 6
        },

        impact: {
            before: 31,
            after: 14,
            reduction: 17,
            percentage: 54
        }

    }

};


/* =========================================================
   DOM
========================================================= */

const trainList = document.getElementById("trainList");

const currentTimeElement =
    document.getElementById("currentTime");

const currentDateElement =
    document.getElementById("currentDate");


/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    initializeIcons();

    renderTrains();

    initializeClock();

    initializeInteractions();

    initializeRailway();

});


/* =========================================================
   LUCIDE
========================================================= */

function initializeIcons() {

    if (window.lucide) {
        lucide.createIcons();
    }

}


/* =========================================================
   TRAIN RENDERING
========================================================= */

function renderTrains() {

    trainList.innerHTML = "";

    appState.trains.forEach(train => {

        const card = createTrainCard(train);

        trainList.appendChild(card);

    });

    initializeIcons();

}


/* =========================================================
   TRAIN CARD
========================================================= */

function createTrainCard(train) {

    const article = document.createElement("article");

    article.className =
        `train-card ${train.priorityClass}`;

    article.dataset.trainNumber = train.number;


    const delayClass =
        train.delay >= 8
            ? "delay-danger"
            : train.delay >= 3
                ? "delay-warning"
                : "delay-normal";


    article.innerHTML = `

        <div class="train-top">

            <div class="train-name-wrapper">

                <div class="train-icon">

                    <i data-lucide="train-front"></i>

                </div>

                <div>

                    <div class="train-number">
                        ${train.number}
                    </div>

                    <div class="train-name">
                        ${train.name}
                    </div>

                </div>

            </div>

            <span class="priority ${train.priorityClass}">
                ${train.priority}
            </span>

        </div>


        <div class="train-route">
            ${train.route}
        </div>


        <div class="train-stats">

            <div class="train-stat">

                <span>Delay</span>

                <strong class="${delayClass}">
                    +${train.delay} min
                </strong>

            </div>


            <div class="train-stat">

                <span>Speed</span>

                <strong>
                    ${train.speed} km/h
                </strong>

            </div>


            <div class="train-stat">

                <span>Next Stop</span>

                <strong>
                    ${train.nextStop}
                </strong>

                <small>
                    ETA ${train.eta}
                </small>

            </div>

        </div>

    `;


    article.addEventListener("click", () => {

        selectTrain(train.number);

    });


    return article;

}


/* =========================================================
   TRAIN SELECTION
========================================================= */

function selectTrain(trainNumber) {

    const train =
        appState.trains.find(
            item => item.number === trainNumber
        );

    if (!train) {
        return;
    }

    console.log(
        "Selected train:",
        train
    );

    highlightRailTrain(trainNumber);

}


/* =========================================================
   MAP TRAIN SELECTION
========================================================= */

function highlightRailTrain(trainNumber) {

    document
        .querySelectorAll(".rail-train")
        .forEach(train => {

            train.style.filter = "";

        });


    const selectedTrain =
        document.querySelector(
            `.rail-train[data-train="${trainNumber}"]`
        );

    if (!selectedTrain) {
        return;
    }


    selectedTrain.style.filter =
        "drop-shadow(0 0 12px rgba(36,124,255,0.9))";

}


/* =========================================================
   CLOCK
========================================================= */

function initializeClock() {

    updateClock();

    setInterval(updateClock, 1000);

}


function updateClock() {

    const now = new Date();


    const time = now.toLocaleTimeString(
        "en-IN",
        {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false
        }
    );


    const date = now.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );


    currentTimeElement.textContent = time;

    currentDateElement.textContent = date;

}


/* =========================================================
   INTERACTIONS
========================================================= */

function initializeInteractions() {


    /* Accept recommendation */

    const acceptButton =
        document.querySelector(".accept-button");


    acceptButton.addEventListener(
        "click",
        () => {

            acceptRecommendation();

        }
    );


    /* Simulation */

    const simulateButton =
        document.querySelector(".simulate-button");


    simulateButton.addEventListener(
        "click",
        () => {

            runSimulation();

        }
    );


    /* Override */

    const overrideButton =
        document.querySelector(".override-button");


    overrideButton.addEventListener(
        "click",
        () => {

            overrideRecommendation();

        }
    );


    /* Navigation */

    document
        .querySelectorAll(".nav-item")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    document
                        .querySelectorAll(".nav-item")
                        .forEach(item => {

                            item.classList.remove(
                                "active"
                            );

                        });


                    button.classList.add("active");

                }
            );

        });

}


/* =========================================================
   ACCEPT RECOMMENDATION
========================================================= */

function acceptRecommendation() {

    console.log(
        "Recommendation accepted"
    );

    const recommendation =
        document.querySelector(".recommendation");


    recommendation.style.borderColor =
        "rgba(36,208,111,0.8)";


    setTimeout(() => {

        recommendation.style.borderColor =
            "";

    }, 1200);


    showSystemMessage(
        "Decision accepted — 12951 proceeding, 54821 held."
    );

}


/* =========================================================
   SIMULATION
========================================================= */

function runSimulation() {

    console.log(
        "Running scenario simulation..."
    );


    showSystemMessage(
        "Simulation started: 12951 proceeds first."
    );

}


/* =========================================================
   OVERRIDE
========================================================= */

function overrideRecommendation() {

    const reason = prompt(
        "Enter controller override reason:"
    );


    if (!reason) {
        return;
    }


    console.log(
        "Controller override:",
        reason
    );


    showSystemMessage(
        "Recommendation overridden. Reason recorded."
    );

}


/* =========================================================
   SYSTEM MESSAGE
========================================================= */

function showSystemMessage(message) {

    const notification =
        document.createElement("div");


    notification.textContent = message;


    notification.style.position =
        "fixed";

    notification.style.right =
        "20px";

    notification.style.bottom =
        "85px";

    notification.style.zIndex =
        "9999";

    notification.style.padding =
        "12px 18px";

    notification.style.border =
        "1px solid rgba(36,208,111,0.4)";

    notification.style.borderRadius =
        "6px";

    notification.style.background =
        "#101d2a";

    notification.style.color =
        "#dce5ee";

    notification.style.fontSize =
        "12px";


    document.body.appendChild(
        notification
    );


    setTimeout(() => {

        notification.remove();

    }, 3000);

}


/* =========================================================
   MOCK LIVE UPDATE
   TEMPORARY
========================================================= */

function simulateLiveUpdate() {

    const randomTrain =
        appState.trains[
        Math.floor(
            Math.random() *
            appState.trains.length
        )
        ];


    randomTrain.speed =
        Math.max(
            20,
            randomTrain.speed +
            Math.floor(
                Math.random() * 11
            ) - 5
        );


    renderTrains();

}


/*
    TEMPORARILY simulate changing railway data.

    Later this function will be replaced by:

        Socket.IO
             ↓
        backend state
             ↓
        normalized railway data
             ↓
        UI update
*/


setInterval(
    simulateLiveUpdate,
    10000
);