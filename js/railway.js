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

    // renderTracks();

    updateTrackStatus();

    updateAIDecisionUI();

    updateWhatIfUI();

    initializeScenarioSelection();

    initializeScenarioActions();

    initializeRailwayInteractions();

}


/* =========================================================
   STATIONS
========================================================= */

function renderStations() {

    Object.values(railwayState.stations).forEach(station => {

        const stationElement =
            document.querySelector(
                `[data-station="${station.code}"]`
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

     Object.values(railwayState.signals).forEach(signal => {

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

     Object.values(railwayState.tracks).forEach(track => {

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
function detectConflicts() {

    railwayState.conflicts = [];

    const trains = Object.values(railwayState.trains);

    for (let i = 0; i < trains.length; i++) {

        for (let j = i + 1; j < trains.length; j++) {

            const trainA = trains[i];
            const trainB = trains[j];


            // Same track
            const sameTrack =
                trainA.track === trainB.track;


            // Opposite directions
            const oppositeDirection =
                trainA.direction !== trainB.direction;


            if (sameTrack && oppositeDirection) {

                railwayState.conflicts.push({

                    trainA: trainA.number,
                    trainB: trainB.number,

                    track: trainA.track,

                    severity: "HIGH",

                    reason:
                        "Two trains are moving in opposite directions on the same track."

                });

            }

        }

    }


    return railwayState.conflicts;
}

function generateDecision() {

    const conflicts = detectConflicts();


    if (conflicts.length === 0) {

        return {
            status: "SAFE",
            message: "No active train conflicts detected."
        };

    }


    const conflict = conflicts[0];


    const trainA =
        railwayState.trains[conflict.trainA];

    const trainB =
        railwayState.trains[conflict.trainB];


    let proceedTrain;
    let holdTrain;


    /*
        Higher priority train gets preference.
    */

    if (trainA.priority === "HIGH") {

        proceedTrain = trainA;
        holdTrain = trainB;

    } else {

        proceedTrain = trainB;
        holdTrain = trainA;

    }


    return {

        status: "CONFLICT",

        proceedTrain: proceedTrain.number,

        holdTrain: holdTrain.number,

        reason: [

            `Higher priority of ${proceedTrain.number}`,

            `${proceedTrain.number} is delayed by ${proceedTrain.delay} min`,

            `Holding ${holdTrain.number} reduces total delay`,

            `Conflict detected on track ${conflict.track}`

        ]

    };

}
function simulateScenario(scenario) {

    const trains = Object.values(railwayState.trains);

    const train12951 = railwayState.trains["12951"];
    const train54821 = railwayState.trains["54821"];


    /*
     * Prototype simulation constants.
     *
     * These are NOT real railway operational values.
     * They represent the assumptions of our demo model.
     */

    const CROSSING_PENALTY = 16;
    const HOLD_BOTH_PENALTY = 7;


    let totalDelay = 0;
    let conflicts = 0;
    let stops = 0;


    // ============================================
    // SCENARIO 1
    // HIGH PRIORITY TRAIN FIRST
    // ============================================

    if (scenario === "12951_FIRST") {

        totalDelay =
            train12951.delay +
            train54821.delay;

        conflicts = 1;

        stops = 1;

    }


    // ============================================
    // SCENARIO 2
    // FREIGHT TRAIN FIRST
    // ============================================

    if (scenario === "54821_FIRST") {

        totalDelay =
            train12951.delay +
            train54821.delay +
            CROSSING_PENALTY;

        conflicts = 2;

        stops = 2;

    }


    // ============================================
    // SCENARIO 3
    // HOLD BOTH
    // ============================================

    if (scenario === "HOLD_BOTH") {

        totalDelay =
            Math.max(
                train12951.delay,
                train54821.delay
            ) +
            HOLD_BOTH_PENALTY;

        conflicts = 1;

        stops = 2;

    }


    return {

        scenario,

        totalDelay,

        conflicts,

        stops

    };

}
function calculateWhatIfAnalysis() {

    const scenarios = [

        simulateScenario("12951_FIRST"),

        simulateScenario("54821_FIRST"),

        simulateScenario("HOLD_BOTH")

    ];


    /*
     * Lowest total delay wins.
     */

    const recommended =
        scenarios.reduce(
            (best, current) =>
                current.totalDelay < best.totalDelay
                    ? current
                    : best
        );


    return {

        scenarios,

        recommended: recommended.scenario

    };

}
function updateWhatIfUI() {

    const analysis =
        calculateWhatIfAnalysis();


    const scenario1 =
        analysis.scenarios.find(
            scenario =>
                scenario.scenario === "12951_FIRST"
        );


    const scenario2 =
        analysis.scenarios.find(
            scenario =>
                scenario.scenario === "54821_FIRST"
        );


    const scenario3 =
        analysis.scenarios.find(
            scenario =>
                scenario.scenario === "HOLD_BOTH"
        );


    // ============================================
    // SCENARIO 1
    // ============================================

    document.getElementById(
        "scenario1Delay"
    ).textContent =
        `${scenario1.totalDelay} min`;


    document.getElementById(
        "scenario1Conflicts"
    ).textContent =
        scenario1.conflicts;


    document.getElementById(
        "scenario1Stops"
    ).textContent =
        scenario1.stops;


    // ============================================
    // SCENARIO 2
    // ============================================

    document.getElementById(
        "scenario2Delay"
    ).textContent =
        `${scenario2.totalDelay} min`;


    document.getElementById(
        "scenario2Conflicts"
    ).textContent =
        scenario2.conflicts;


    document.getElementById(
        "scenario2Stops"
    ).textContent =
        scenario2.stops;


    // ============================================
    // SCENARIO 3
    // ============================================

    document.getElementById(
        "scenario3Delay"
    ).textContent =
        `${scenario3.totalDelay} min`;


    document.getElementById(
        "scenario3Conflicts"
    ).textContent =
        scenario3.conflicts;


    document.getElementById(
        "scenario3Stops"
    ).textContent =
        scenario3.stops;


    // ============================================
    // UPDATE RECOMMENDATION BADGE
    // ============================================

    const badge =
        document.getElementById(
            "scenario1Badge"
        );


    if (
        analysis.recommended ===
        "12951_FIRST"
    ) {

        badge.textContent =
            "RECOMMENDED";

    } else {

        badge.textContent =
            "";

    }


    return analysis;

}
function updateAIDecisionUI() {

    const decision = generateDecision();

    const conflictAlert =
        document.getElementById("conflictAlert");

    const conflictAlertText =
        document.getElementById("conflictAlertText");

    const trainA =
        document.getElementById("conflictTrainA");

    const trainAName =
        document.getElementById("conflictTrainAName");

    const trainAPriority =
        document.getElementById("conflictTrainAPriority");

    const trainB =
        document.getElementById("conflictTrainB");

    const trainBName =
        document.getElementById("conflictTrainBName");

    const trainBPriority =
        document.getElementById("conflictTrainBPriority");

    const recommendedAction =
        document.getElementById("recommendedAction");

    const holdRecommendation =
        document.getElementById("holdRecommendation");

    const decisionReasons =
        document.getElementById("decisionReasons");


    // ============================================
    // NO CONFLICT
    // ============================================

    if (decision.status === "SAFE") {

        conflictAlert.classList.remove("active");

        conflictAlertText.textContent =
            "NO ACTIVE CONFLICT";

        recommendedAction.textContent =
            "No action required";

        holdRecommendation.textContent =
            "All trains can continue normally";

        document.getElementById(
            "estimatedHold"
        ).textContent = "No hold required";

        decisionReasons.innerHTML = `
            <li>
                <i data-lucide="circle-check"></i>
                No conflicting train movements detected
            </li>

            <li>
                <i data-lucide="circle-check"></i>
                Track allocation is currently safe
            </li>
        `;

        lucide.createIcons();

        return;
    }


    // ============================================
    // CONFLICT
    // ============================================

    conflictAlert.classList.add("active");

    conflictAlertText.textContent =
        "CONFLICT DETECTED";


    const train1 =
        railwayState.trains[decision.proceedTrain];

    const train2 =
        railwayState.trains[decision.holdTrain];


    // ============================================
    // TRAIN A
    // ============================================

    trainA.textContent =
        train1.number;

    trainAName.textContent =
        train1.name;

    trainAPriority.textContent =
        train1.priority;


    trainAPriority.className =
        `priority ${train1.priority.toLowerCase()}`;


    // ============================================
    // TRAIN B
    // ============================================

    trainB.textContent =
        train2.number;

    trainBName.textContent =
        train2.name;

    trainBPriority.textContent =
        train2.priority;


    trainBPriority.className =
        `priority ${train2.priority.toLowerCase()}`;


    // ============================================
    // RECOMMENDATION
    // ============================================

    recommendedAction.textContent =
        `Allow ${train1.number} to proceed`;


    holdRecommendation.textContent =
        `Hold ${train2.number} at ${train2.currentStation === "MTJ"
            ? "Mathura Jn"
            : train2.currentStation}`;


    // ============================================
    // ESTIMATED HOLD
    // ============================================

    const estimatedHoldMinutes =
        Math.max(
            3,
            Math.min(10, train1.delay - train2.delay)
        );


    document.getElementById(
        "estimatedHold"
    ).textContent =
        `Estimated hold: ${estimatedHoldMinutes} minutes`;


    // ============================================
    // DECISION REASONS
    // ============================================

    decisionReasons.innerHTML = "";


    decision.reason.forEach(reason => {

        const li =
            document.createElement("li");

        li.innerHTML = `
            <i data-lucide="circle-check"></i>
            ${reason}
        `;

        decisionReasons.appendChild(li);

    });


    // Re-render Lucide icons
    lucide.createIcons();

}

const decision = generateDecision();

console.log("Railway Conflict Analysis:");
console.log(decision);

updateAIDecisionUI();

let selectedScenario = "12951_FIRST";

function initializeScenarioSelection() {

    const scenarioCards =
        document.querySelectorAll(
            ".scenario-card"
        );

    const selectedScenarioText =
        document.getElementById(
            "selectedScenarioText"
        );


    scenarioCards.forEach(card => {

        card.addEventListener("click", () => {

            scenarioCards.forEach(item => {

                item.classList.remove(
                    "selected"
                );

            });


            card.classList.add("selected");


            selectedScenario =
                card.dataset.scenario;


            const title =
                card.querySelector(
                    ".scenario-header strong"
                );


            if (title) {

                selectedScenarioText.textContent =
                    title.textContent;

            }

        });

    });


    // Select first scenario initially

    const firstCard =
        document.querySelector(
            `[data-scenario="${selectedScenario}"]`
        );


    if (firstCard) {

        firstCard.classList.add(
            "selected"
        );

    }

}

function applySelectedScenario() {

    const scenario =
        selectedScenario;


    const train12951 =
        railwayState.trains["12951"];

    const train54821 =
        railwayState.trains["54821"];


    // ==========================================
    // 12951 FIRST
    // ==========================================

    if (scenario === "12951_FIRST") {

        train12951.status =
            "running";

        train54821.status =
            "hold";

        train54821.track =
            "T2";

        console.log(
            "Scenario applied: 12951 First"
        );

    }


    // ==========================================
    // 54821 FIRST
    // ==========================================

    if (scenario === "54821_FIRST") {

        train54821.status =
            "running";

        train12951.status =
            "hold";

        train12951.track =
            "T2";

        console.log(
            "Scenario applied: 54821 First"
        );

    }


    // ==========================================
    // HOLD BOTH
    // ==========================================

    if (scenario === "HOLD_BOTH") {

        train12951.status =
            "hold";

        train54821.status =
            "hold";

        console.log(
            "Scenario applied: Hold Both"
        );

    }


    /*
     * Recalculate everything after applying
     * the scenario.
     */

    updateTrainVisuals();

    updateAIDecisionUI();

    updateWhatIfUI();


    alert(
        `Scenario applied successfully: ${scenario}`
    );

}

function initializeScenarioActions() {

    const button =
        document.getElementById(
            "applyScenarioButton"
        );


    if (!button) return;


    button.addEventListener(
        "click",
        applySelectedScenario
    );

}

function applySelectedScenario() {

    const train12951 =
        railwayState.trains["12951"];

    const train54821 =
        railwayState.trains["54821"];


    if (selectedScenario === "12951_FIRST") {

        train12951.status = "running";
        train54821.status = "hold";
        train54821.track = "T2";

    }


    if (selectedScenario === "54821_FIRST") {

        train54821.status = "running";
        train12951.status = "hold";
        train12951.track = "T2";

    }


    if (selectedScenario === "HOLD_BOTH") {

        train12951.status = "hold";
        train54821.status = "hold";

    }


    renderTrains();

    updateAIDecisionUI();

    updateWhatIfUI();

}

// ============================================
// WHAT-IF SCENARIO ACTIONS
// ============================================

function initializeScenarioActions() {

    const scenarioCards =
        document.querySelectorAll(".scenario-card");

    const applyButton =
        document.getElementById("applyScenarioButton");

    const selectedScenarioText =
        document.getElementById("selectedScenarioText");


    // --------------------------------------------
    // Scenario card selection
    // --------------------------------------------

    scenarioCards.forEach(card => {

        card.addEventListener("click", () => {

            scenarioCards.forEach(item => {
                item.classList.remove("selected");
            });

            card.classList.add("selected");

            selectedScenario =
                card.dataset.scenario;

            const title =
                card.querySelector(
                    ".scenario-header strong"
                );

            if (title && selectedScenarioText) {

                selectedScenarioText.textContent =
                    title.textContent.trim();

            }

            console.log(
                "Selected scenario:",
                selectedScenario
            );

        });

    });


    // --------------------------------------------
    // Select first scenario initially
    // --------------------------------------------

    const firstCard =
        document.querySelector(
            `[data-scenario="${selectedScenario}"]`
        );

    if (firstCard) {

        firstCard.classList.add("selected");

    }


    // --------------------------------------------
    // Apply button
    // --------------------------------------------

    if (!applyButton) {

        console.error(
            "Apply Scenario button not found."
        );

        return;

    }


    applyButton.addEventListener(
        "click",
        applySelectedScenario
    );


    console.log(
        "Scenario actions initialized."
    );


}

function applySelectedScenario() {

    console.log(
        "Applying scenario:",
        selectedScenario
    );


    const train12951 =
        railwayState.trains["12951"];

    const train54821 =
        railwayState.trains["54821"];


    if (!train12951 || !train54821) {

        console.error(
            "Required trains not found in railwayState."
        );

        return;

    }


    // ==========================================
    // SCENARIO 1
    // ==========================================

    if (selectedScenario === "12951_FIRST") {

        train12951.status = "running";
        train54821.status = "hold";

        console.log(
            "12951 running | 54821 hold"
        );

    }


    // ==========================================
    // SCENARIO 2
    // ==========================================

    else if (selectedScenario === "54821_FIRST") {

        train12951.status = "hold";
        train54821.status = "running";

        console.log(
            "12951 hold | 54821 running"
        );

    }


    // ==========================================
    // SCENARIO 3
    // ==========================================

    else if (selectedScenario === "HOLD_BOTH") {

        train12951.status = "hold";
        train54821.status = "hold";

        console.log(
            "12951 hold | 54821 hold"
        );

    }


    // ==========================================
    // REDRAW UI
    // ==========================================

    renderTrains();

    updateAIDecisionUI();

    updateWhatIfUI();


    console.log(
        "Scenario applied successfully."
    );

}