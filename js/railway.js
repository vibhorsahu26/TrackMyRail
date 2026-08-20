/* =========================================================
   TRACKMYRAIL
   PHASE 2 — RAILWAY CONTROLLER
========================================================= */


let selectedTrain = null;


/* =========================================================
   INITIALIZE
========================================================= */

function initializeRailway() {

    renderStations();

    renderSignals();

    renderTrains();

    updateTrackStatus();

    initializeRailwayInteractions();

}


/* =========================================================
   STATIONS
========================================================= */

function renderStations() {

    railwayState.stations.forEach(station => {

        const stationElement =
            document.querySelector(
                `[data-station="${station.id}"]`
            );

        if (!stationElement) return;


        stationElement.addEventListener(
            "click",
            () => {

                showRailwayObject({

                    type: "STATION",

                    title:
                        `${station.code} — ${station.name}`,

                    description:
                        `${station.platforms} platforms`

                });

            }
        );

    });

}


/* =========================================================
   SIGNALS
========================================================= */

function renderSignals() {

    railwayState.signals.forEach(signal => {

        const element =
            document.querySelector(
                `[data-signal="${signal.id}"]`
            );

        if (!element) return;


        element.classList.remove(
            "green",
            "red",
            "yellow"
        );


        element.classList.add(
            signal.state.toLowerCase()
        );


        element.title =
            `${signal.id} — ${signal.state}`;

    });

}


/* =========================================================
   TRAINS
========================================================= */

function renderTrains() {

    railwayState.trains.forEach(train => {

        const trainElement =
            document.querySelector(
                `[data-train="${train.id}"]`
            );

        if (!trainElement) return;


        /*
            Position is represented as a
            percentage along the section.
        */

        trainElement.style.left =
            `${train.position}%`;


        /*
            Status classes
        */

        trainElement.classList.toggle(
            "train-running",
            train.status === "RUNNING"
        );


        trainElement.classList.toggle(
            "train-hold",
            train.status === "HOLD"
        );


        /*
            Click interaction
        */

        trainElement.onclick =
            () => {

                selectTrain(
                    train.id
                );

            };

    });

}


/* =========================================================
   SELECT TRAIN
========================================================= */

function selectTrain(trainId) {

    const train =
        railwayState.trains.find(
            train =>
                train.id === trainId
        );


    if (!train) return;


    selectedTrain =
        train;


    document
        .querySelectorAll(
            "[data-train]"
        )
        .forEach(element => {

            element.classList.remove(
                "selected-train"
            );

        });


    const element =
        document.querySelector(
            `[data-train="${trainId}"]`
        );


    if (element) {

        element.classList.add(
            "selected-train"
        );

    }


    showRailwayObject({

        type: "TRAIN",

        title:
            `${train.id} — ${train.name}`,

        description: `
        
            <div class="railway-detail">

                <span>Status</span>

                <strong>
                    ${train.status}
                </strong>

            </div>


            <div class="railway-detail">

                <span>Speed</span>

                <strong>
                    ${train.speed} km/h
                </strong>

            </div>


            <div class="railway-detail">

                <span>Delay</span>

                <strong>
                    +${train.delay} min
                </strong>

            </div>


            <div class="railway-detail">

                <span>Next Station</span>

                <strong>
                    ${train.nextStation}
                </strong>

            </div>

        `

    });

}


/* =========================================================
   OBJECT INFORMATION
========================================================= */

function showRailwayObject(object) {

    const panel =
        document.getElementById(
            "railwayObjectPanel"
        );


    if (!panel) return;


    panel.innerHTML = `

        <div class="object-panel-header">

            <span>
                ${object.type}
            </span>

            <button
                id="closeRailwayObject"
                aria-label="Close"
            >
                ×
            </button>

        </div>


        <h3>
            ${object.title}
        </h3>


        <div class="object-panel-content">

            ${object.description}

        </div>

    `;


    panel.classList.add(
        "visible"
    );


    const closeButton =
        document.getElementById(
            "closeRailwayObject"
        );


    if (closeButton) {

        closeButton.onclick =
            () => {

                panel.classList.remove(
                    "visible"
                );

            };

    }

}


/* =========================================================
   TRACK STATUS
========================================================= */

function updateTrackStatus() {

    railwayState.tracks.forEach(track => {

        const element =
            document.querySelector(
                `[data-track="${track.id}"]`
            );

        if (!element) return;


        element.classList.toggle(
            "occupied",
            track.occupied
        );


        element.classList.toggle(
            "free",
            !track.occupied
        );

    });

}


/* =========================================================
   BASIC SIMULATION
========================================================= */

function startRailwaySimulation() {

    setInterval(() => {

        railwayState.trains.forEach(
            train => {

                if (
                    train.status !== "RUNNING"
                ) {
                    return;
                }


                /*
                    Small movement only.

                    This is NOT real train tracking.
                    It is UI simulation.
                */

                train.position += 0.15;


                if (
                    train.position > 95
                ) {

                    train.position = 10;

                }

            }
        );


        renderTrains();

    }, 1000);

}


/* =========================================================
   INTERACTIONS
========================================================= */

function initializeRailwayInteractions() {

    document
        .querySelectorAll(
            "[data-train]"
        )
        .forEach(element => {

            element.addEventListener(
                "mouseenter",
                () => {

                    element.classList.add(
                        "train-hover"
                    );

                }
            );


            element.addEventListener(
                "mouseleave",
                () => {

                    element.classList.remove(
                        "train-hover"
                    );

                }
            );

        });

}