
// Safe icon refresh helper: never allow missing Lucide initialization to break the simulator.
if (typeof window !== "undefined" && typeof window.initializeIcons !== "function") {
    window.initializeIcons = function initializeIconsSafe() {
        if (window.lucide && typeof window.lucide.createIcons === "function") {
            window.lucide.createIcons();
        }
    };
}

function refreshRailwayIcons() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
        window.lucide.createIcons();
    }
}

let activeDecision = null;

let selectedTrain = null;


/* =========================================================
   INITIALIZE
========================================================= */

function initializeRailway() {

    renderStations();

    renderSignals();

    renderTrains();

    // renderTracks();

    updateTrackOccupancy();

    updateTrackUsage();

    updateTrackVisuals();

    // renderTracks();

    updateTrackStatus();

    updateAIDecisionUI();

    updateWhatIfUI();

    initializeScenarioSelection();

    initializeScenarioActions();

    initializeRailwayInteractions();

    initializeSimulationControls();

    startTrainSimulation();

    railwayState.conflicts = [];

    updateDynamicConflicts();

    updateDynamicConflictUI();

    initializeDecisionControls();
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
// ============================================================
// PHASE 6.4 — TRACK OCCUPANCY
// ============================================================

function updateTrackOccupancy() {

    if (!railwayState || !railwayState.trains) {
        return;
    }

    // Reset all tracks
    if (railwayState.tracks) {

        Object.values(railwayState.tracks).forEach(track => {
            track.occupied = false;
            track.occupiedBy = null;
        });

    }

    // Check every train
    Object.values(railwayState.trains).forEach(train => {

        if (!train.track) {
            return;
        }

        const track =
            railwayState.tracks[train.track];

        if (!track) {
            return;
        }

        track.occupied = true;
        track.occupiedBy = train.number;

    });

}
// ============================================================
// PHASE 6.5 — DYNAMIC SIGNAL LOGIC
// ============================================================

// ============================================================
// PHASE 6.5b — TOPOLOGY-AWARE SIGNAL LOGIC
// ============================================================

function updateSignalStates() {

    if (!railwayState || !railwayState.tracks) {
        return;
    }


    /*
     * Signal topology
     *
     * signal-1 protects T1
     * signal-2 protects T2
     * signal-3 protects T3
     * signal-4 is an approach signal for T3
     *
     * nextTrack tells the signal what block comes after
     * the protected block.
     */

    const signalTopology = {

        "signal-1": {
            track: "T1",
            nextTrack: "T2"
        },

        "signal-2": {
            track: "T2",
            nextTrack: "T3"
        },

        "signal-3": {
            track: "T3",
            nextTrack: null
        },

        "signal-4": {
            track: "T3",
            nextTrack: null
        }

    };


    Object.entries(signalTopology).forEach(
        ([signalId, topology]) => {

            const currentTrack =
                railwayState.tracks[
                topology.track
                ];


            if (!currentTrack) {
                return;
            }


            const nextTrack =
                topology.nextTrack
                    ? railwayState.tracks[
                    topology.nextTrack
                    ]
                    : null;


            let signalState = "green";


            // ------------------------------------------------
            // CURRENT BLOCK OCCUPIED
            // ------------------------------------------------

            if (currentTrack.occupied) {

                signalState = "red";

            }


            // ------------------------------------------------
            // CURRENT BLOCK FREE
            // BUT NEXT BLOCK OCCUPIED
            // ------------------------------------------------

            else if (
                nextTrack &&
                nextTrack.occupied
            ) {

                signalState = "yellow";

            }


            // ------------------------------------------------
            // BOTH BLOCKS CLEAR
            // ------------------------------------------------

            else {

                signalState = "green";

            }


            updateSignalElement(
                signalId,
                signalState
            );

        }
    );

}
function updateSignalElement(
    signalId,
    state
) {

    const signal =
        document.querySelector(
            `.${signalId}`
        );

    if (!signal) {
        return;
    }


    // Remove previous state
    signal.classList.remove(
        "green",
        "yellow",
        "red"
    );


    // Apply new state
    signal.classList.add(
        state
    );


    // Accessibility / debugging
    signal.dataset.state =
        state;

}
// ============================================================
// PHASE 6.6 — DYNAMIC CONFLICT DETECTION
// ============================================================

function detectDynamicConflicts() {

    if (!railwayState || !railwayState.trains) {
        return [];
    }

    const trains = Object.values(
        railwayState.trains
    );

    const conflicts = [];


    // --------------------------------------------------------
    // Compare every train against every other train
    // --------------------------------------------------------

    for (let i = 0; i < trains.length; i++) {

        for (let j = i + 1; j < trains.length; j++) {

            const trainA = trains[i];
            const trainB = trains[j];


            // Ignore stopped trains
            if (
                trainA.status === "STOPPED" ||
                trainB.status === "STOPPED"
            ) {
                continue;
            }


            // Ignore trains without position data
            if (
                typeof trainA.position !== "number" ||
                typeof trainB.position !== "number"
            ) {
                continue;
            }


            // ------------------------------------------------
            // Determine whether trains are approaching each
            // other.
            // ------------------------------------------------

            const oppositeDirection =
                trainA.direction &&
                trainB.direction &&
                trainA.direction !== trainB.direction;


            if (!oppositeDirection) {
                continue;
            }


            // ------------------------------------------------
            // Distance between trains
            // ------------------------------------------------

            const distance =
                Math.abs(
                    trainA.position -
                    trainB.position
                );


            // Ignore trains that are far apart
            if (distance > 15) {
                continue;
            }


            // ------------------------------------------------
            // Estimate time to conflict
            // ------------------------------------------------

            const speedA =
                Number(trainA.speed) || 0;

            const speedB =
                Number(trainB.speed) || 0;


            const combinedSpeed =
                speedA + speedB;


            let timeToConflict = Infinity;


            if (combinedSpeed > 0) {

                timeToConflict =
                    distance /
                    combinedSpeed *
                    60;

            }


            // ------------------------------------------------
            // Determine severity
            // ------------------------------------------------

            let severity = "LOW";


            if (timeToConflict <= 3) {

                severity = "HIGH";

            }
            else if (timeToConflict <= 7) {

                severity = "MEDIUM";

            }


            conflicts.push({

                trainA: trainA.number || trainA.id,

                trainB: trainB.number || trainB.id,

                distance:
                    Number(distance.toFixed(2)),

                timeToConflict:
                    Number(
                        timeToConflict.toFixed(2)
                    ),

                severity,

                detectedAt:
                    new Date().toISOString()

            });

        }
    }


    return conflicts;

}
function updateDynamicConflicts() {

    const conflicts =
        detectDynamicConflicts();


    railwayState.conflicts =
        conflicts;


    return conflicts;

}
function updateTrackVisuals() {

    if (!railwayState || !railwayState.tracks) {
        return;
    }

    Object.values(railwayState.tracks).forEach(track => {

        const trackElement =
            document.querySelector(
                `[data-track="${track.id}"]`
            );

        if (!trackElement) {
            return;
        }

        const occupiedElement =
            trackElement.querySelector(
                ".track-occupied"
            );

        const freeElement =
            trackElement.querySelector(
                ".track-free"
            );


        // Track occupied
        if (track.occupied) {

            if (occupiedElement) {
                occupiedElement.style.display = "block";
            }

            if (freeElement) {
                freeElement.style.display = "none";
            }

        }

        // Track free
        else {

            if (occupiedElement) {
                occupiedElement.style.display = "none";
            }

            if (freeElement) {
                freeElement.style.display = "block";
            }

        }

    });

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

    window.reoptimizeTraffic?.("scenario_applied");

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

    window.reoptimizeTraffic?.("scenario_applied");


    console.log(
        "Scenario applied successfully."
    );

}

// ============================================================
// PHASE 6.1 — REAL-TIME TRAIN SIMULATION
// ============================================================

let simulationRunning = false;
let simulationFrame = null;
let lastSimulationTime = null;

let simulationSpeedMultiplier = 10;


// ------------------------------------------------------------
// Start simulation
// ------------------------------------------------------------

function legacyStartTrainSimulation() {

    if (simulationRunning) {
        return;
    }

    simulationRunning = true;
    lastSimulationTime = performance.now();

    console.log("Train simulation started.");

    simulationFrame =
        requestAnimationFrame(simulationLoop);
}


// ------------------------------------------------------------
// Stop simulation
// ------------------------------------------------------------

function legacyStopTrainSimulation() {

    simulationRunning = false;

    if (simulationFrame) {

        cancelAnimationFrame(
            simulationFrame
        );

        simulationFrame = null;
    }

    lastSimulationTime = null;

    console.log("Train simulation stopped.");
}


// ------------------------------------------------------------
// Main simulation loop
// ------------------------------------------------------------

function legacySimulationLoop(currentTime) {

    if (!simulationRunning) {
        return;
    }

    const realDeltaTime =
        (currentTime - lastSimulationTime) / 1000;

    const deltaTime =
        realDeltaTime * simulationSpeedMultiplier;

    lastSimulationTime = currentTime;

    legacyUpdateTrainPositions(deltaTime);

    updateTrackOccupancy();

    updateTrackUsage();

    updateSignalStates();

    updateDynamicConflicts();

    updateDynamicConflictUI();

    generateConflictDecision();

    updateTrainVisualPositions();

    updateTrackVisuals();

    simulationFrame =
        requestAnimationFrame(simulationLoop);
}


// ------------------------------------------------------------
// Update train positions
// ------------------------------------------------------------

function legacyUpdateTrainPositions(deltaTime) {

    if (
        !railwayState ||
        !railwayState.trains
    ) {
        return;
    }


    Object.values(
        railwayState.trains
    ).forEach(train => {

        // ----------------------------------------
        // Train is stopped / held
        // ----------------------------------------

        if (
            train.status === "hold" ||
            train.status === "stopped"
        ) {
            return;
        }


        // ----------------------------------------
        // Speed
        // ----------------------------------------

        const speed =
            Number(
                train.simulationSpeed ??
                train.speed ??
                0
            );


        if (speed <= 0) {
            return;
        }


        // ----------------------------------------
        // Convert km/h to normalized
        // section movement.
        //
        // This is simulation speed, NOT
        // real railway distance.
        // ----------------------------------------

        const movement =
            (speed / 3600) *
            deltaTime *
            0.8;


        // ----------------------------------------
        // Forward train
        // ----------------------------------------

        if (
            train.direction === "forward"
        ) {

            train.position += movement;

        }


        // ----------------------------------------
        // Reverse train
        // ----------------------------------------

        else if (
            train.direction === "reverse"
        ) {

            train.position -= movement;

        }


        // ----------------------------------------
        // Keep position inside section
        // ----------------------------------------

        train.position =
            Math.max(
                0,
                Math.min(
                    100,
                    train.position
                )
            );

    });


}

function updateTrainVisualPositions() {

    if (!railwayState || !railwayState.trains) {
        return;
    }

    Object.values(railwayState.trains).forEach(train => {

        const trainElement = document.querySelector(
            `.rail-train[data-train="${train.number}"]`
        );

        if (!trainElement) {
            return;
        }

        const position = Math.max(
            0,
            Math.min(
                100,
                Number(train.position) || 0
            )
        );

        trainElement.style.left = `${position}%`;

        trainElement.classList.toggle(
            "train-held",
            train.status === "hold" ||
            train.status === "stopped"
        );

    });
}

// ============================================================
// PHASE 6.2 — VISUAL TRAIN MOVEMENT
// ============================================================

function updateTrainVisualPositions() {

    if (
        !railwayState ||
        !railwayState.trains
    ) {
        return;
    }


    Object.values(
        railwayState.trains
    ).forEach(train => {

        const trainElement =
            document.querySelector(
                `.rail-train[data-train="${train.number}"]`
            );


        if (!trainElement) {
            return;
        }


        // ----------------------------------------
        // Convert simulation position to CSS %
        // ----------------------------------------

        const position =
            Math.max(
                0,
                Math.min(
                    100,
                    Number(train.position) || 0
                )
            );


        trainElement.style.left =
            `${position}%`;


        // ----------------------------------------
        // Visual state
        // ----------------------------------------

        trainElement.classList.toggle(
            "train-held",
            train.status === "hold" ||
            train.status === "stopped"
        );

    });

}
function updateTrackUsage() {

    if (
        !railwayState ||
        !railwayState.tracks
    ) {
        return;
    }

    const tracks =
        Object.values(
            railwayState.tracks
        );

    if (tracks.length === 0) {
        return;
    }

    const occupiedTracks =
        tracks.filter(
            track => track.occupied
        ).length;

    const usage =
        Math.round(
            (occupiedTracks / tracks.length) * 100
        );

    const usageElement =
        document.getElementById(
            "trackUsageValue"
        );

    if (usageElement) {

        usageElement.textContent =
            `${usage}%`;

    }

}

// ============================================================
// SIMULATION CONTROLS
// ============================================================

function updateSimulationStatus() {

    const statusText =
        document.getElementById(
            "simulationStatusText"
        );

    const statusContainer =
        document.querySelector(
            ".simulation-status"
        );


    if (!statusText || !statusContainer) {
        return;
    }


    if (simulationRunning) {

        statusText.textContent =
            "Running";

        statusContainer.classList.remove(
            "paused"
        );

    } else {

        statusText.textContent =
            "Paused";

        statusContainer.classList.add(
            "paused"
        );

    }

}
function initializeSimulationControls() {

    const startButton =
        document.getElementById(
            "simulationStartButton"
        );

    const pauseButton =
        document.getElementById(
            "simulationPauseButton"
        );

    const resetButton =
        document.getElementById(
            "simulationResetButton"
        );


    // --------------------------------------------
    // START
    // --------------------------------------------

    if (startButton) {

        startButton.addEventListener(
            "click",
            () => {

                startTrainSimulation();

                updateSimulationStatus();

            }
        );

    }


    // --------------------------------------------
    // PAUSE
    // --------------------------------------------

    if (pauseButton) {

        pauseButton.addEventListener(
            "click",
            () => {

                stopTrainSimulation();

                updateSimulationStatus();

            }
        );

    }


    // --------------------------------------------
    // RESET
    // --------------------------------------------

    if (resetButton) {

        resetButton.addEventListener(
            "click",
            resetTrainSimulation
        );

    }


    // --------------------------------------------
    // SPEED
    // --------------------------------------------

    const speedButtons =
        document.querySelectorAll(
            ".speed-button"
        );


    speedButtons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const speed =
                    Number(
                        button.dataset.speed
                    );


                if (!speed) {
                    return;
                }


                simulationSpeedMultiplier =
                    speed;


                speedButtons.forEach(
                    item => {

                        item.classList.remove(
                            "active"
                        );

                    }
                );


                button.classList.add(
                    "active"
                );


                console.log(
                    `Simulation speed: ${speed}x`
                );

            }
        );

    });


    updateSimulationStatus();

}
function stopTrainSimulation() {
    simulationRunning = false;
    if (simulationFrame) cancelAnimationFrame(simulationFrame);
    simulationFrame = null;
    lastSimulationTime = null;
    if (typeof railwayState !== "undefined" && railwayState.simulation) railwayState.simulation.running = false;
    console.log("Train simulation paused.");
}

function resetTrainSimulation() {

    const train12951 =
        railwayState.trains["12951"];

    const train54821 =
        railwayState.trains["54821"];


    if (train12951) {

        train12951.position = 25;

        train12951.status = "running";

    }


    if (train54821) {

        train54821.position = 65;

        train54821.status = "running";

    }


    updateTrainVisualPositions();


    console.log(
        "Train simulation reset."
    );

}
function updateDynamicConflictUI() {

    const conflicts =
        railwayState.conflicts || [];


    const conflictAlert =
        document.querySelector(
            ".conflict-alert"
        );


    const conflictMarker =
        document.querySelector(
            ".conflict-marker"
        );


    // --------------------------------------------------------
    // No conflict
    // --------------------------------------------------------

    if (conflicts.length === 0) {

        if (conflictAlert) {

            conflictAlert.classList.remove(
                "active"
            );

        }


        if (conflictMarker) {

            conflictMarker.style.display =
                "none";

        }


        return;

    }


    // --------------------------------------------------------
    // Conflict exists
    // --------------------------------------------------------

    const highestSeverity =
        getHighestConflictSeverity(
            conflicts
        );


    if (conflictAlert) {

        conflictAlert.classList.add(
            "active"
        );

        conflictAlert.dataset.severity =
            highestSeverity;

    }


    if (conflictMarker) {

        conflictMarker.style.display =
            "flex";

        conflictMarker.dataset.severity =
            highestSeverity;

    }

}
function getHighestConflictSeverity(
    conflicts
) {

    const priority = {

        HIGH: 3,
        MEDIUM: 2,
        LOW: 1

    };


    let highest =
        "LOW";


    conflicts.forEach(conflict => {

        if (
            priority[conflict.severity] >
            priority[highest]
        ) {

            highest =
                conflict.severity;

        }

    });


    return highest;

}
function generateConflictDecision() {

    const conflicts =
        railwayState.conflicts || [];

    // No conflict
    if (conflicts.length === 0) {

        activeDecision = null;

        return null;
    }

    // Pick the most serious conflict
    const conflict =
        [...conflicts].sort((a, b) => {

            const priority = {
                HIGH: 3,
                MEDIUM: 2,
                LOW: 1
            };

            return (
                priority[b.severity] -
                priority[a.severity]
            );

        })[0];


    const trainA =
        railwayState.trains[conflict.trainA];

    const trainB =
        railwayState.trains[conflict.trainB];


    if (!trainA || !trainB) {
        return null;
    }


    // --------------------------------------------------------
    // Determine priority
    // --------------------------------------------------------

    const priorityValue = {
        HIGH: 3,
        MEDIUM: 2,
        LOW: 1
    };


    const trainAPriority =
        priorityValue[trainA.priority] || 1;

    const trainBPriority =
        priorityValue[trainB.priority] || 1;


    let proceedTrain;
    let holdTrain;


    if (trainAPriority >= trainBPriority) {

        proceedTrain = trainA;
        holdTrain = trainB;

    } else {

        proceedTrain = trainB;
        holdTrain = trainA;

    }


    activeDecision = {

        type: "HOLD_TRAIN",

        conflict,

        proceedTrain:
            proceedTrain.number ||
            proceedTrain.id,

        holdTrain:
            holdTrain.number ||
            holdTrain.id,

        holdStation:
            holdTrain.nextStation ||
            "Mathura Jn",

        estimatedHold:
            Math.max(
                3,
                Math.ceil(
                    conflict.timeToConflict
                )
            ),

        status: "PENDING"

    };


    return activeDecision;
}
function acceptConflictDecision() {

    if (!activeDecision) {

        console.warn(
            "No active conflict decision."
        );

        return;

    }


    const holdTrain =
        railwayState.trains[
            activeDecision.holdTrain
        ];


    if (!holdTrain) {

        console.error(
            "Hold train not found:",
            activeDecision.holdTrain
        );

        return;

    }


    // Hold the train
    holdTrain.status = "STOPPED";


    // Store controller action
    activeDecision.status = "ACCEPTED";


    console.log(
        `Decision accepted: Train ${activeDecision.holdTrain} held.`
    );


    // Recalculate railway state
    updateTrackOccupancy();

    updateTrackUsage();

    updateSignalStates();

    updateDynamicConflicts();

    updateDynamicConflictUI();


    // Generate next decision if necessary
    generateConflictDecision();

}
function initializeDecisionControls() {

    const acceptButton =
        document.querySelector(
            ".accept-button"
        );


    if (!acceptButton) {
        return;
    }


    acceptButton.addEventListener(
        "click",
        acceptConflictDecision
    );

}
/* ============================================================
   TRACKMYRAIL — FUNCTIONAL TOPOLOGY SIMULATION UPGRADE
   Replaces free-floating train movement with block-aware routing.
============================================================ */

const MAP_TRACK_Y = { T1: 138, T2: 218, T3: 292, T4: 350 };
const MAP_X = { NDLS: 7, MTJ: 50, AGC: 93 };

function allRailTrains() {
    return Object.values(railwayState.trains || {});
}

function trackBusy(trackId, exceptTrain = null) {
    return allRailTrains().some(t => t.number !== exceptTrain && t.track === trackId && !["STOPPED", "HOLD", "stopPED"].includes(String(t.status).toUpperCase()));
}

function getAlternateTrack(train) {
    const candidates = train.direction === "reverse" ? ["T4", "T2"] : ["T3", "T1"];
    return candidates.find(track => track !== train.track && !trackBusy(track, train.number)) || null;
}

function ensureMapElements() {
    const container = document.querySelector(".railway-container");
    if (!container) return null;
    container.classList.add("topology-map");

    let svg = container.querySelector(".topology-svg");
    if (!svg) {
        svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.classList.add("topology-svg");
        svg.setAttribute("viewBox", "0 0 100 415");
        svg.setAttribute("preserveAspectRatio", "none");
        container.prepend(svg);
    }

    container.querySelectorAll(".track, .junction, .station-line").forEach(el => el.style.display = "none");

    svg.innerHTML = "";
    const ns = "http://www.w3.org/2000/svg";
    const mk = (name, attrs, parent = svg) => {
        const el = document.createElementNS(ns, name);
        Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k, v));
        parent.appendChild(el);
        return el;
    };

    // Main lines + loop lines. The vertical position is intentionally uneven so
    // the reader can see a real multi-track railway rather than four flat rows.
    const lines = [
        {id:"T1", y:132, label:"UP MAIN"},
        {id:"T2", y:202, label:"DOWN MAIN"},
        {id:"T3", y:272, label:"LOOP / OVERTAKE"},
        {id:"T4", y:342, label:"LOOP / RETURN"}
    ];
    lines.forEach(({id,y}) => {
        const path = mk("path", { d:`M 6 ${y} H 38 Q 50 ${y} 62 ${y} H 94`, class:"topology-rail", "data-topology-track":id });
        path.dataset.topologyTrack = id;
        mk("path", { d:`M 6 ${y+5} H 94`, class:"topology-rail-inner" });
        for (let x = 7; x <= 93; x += 3) mk("line", {x1:x,x2:x,y1:y-5,y2:y+9,class:"topology-sleeper"});
        mk("text", {x:9,y:y-10,class:"topology-track-label"}).textContent = lines.find(l=>l.id===id).label;
    });

    // Two diamond crossover areas around Mathura. These are real visual junctions.
    const crossings = [
        {from:"T1",to:"T3",y1:132,y2:272,off:-8},
        {from:"T2",to:"T4",y1:202,y2:342,off:8}
    ];
    crossings.forEach(c => {
        mk("path", {d:`M 43 ${c.y1} C 47 ${c.y1+18} 53 ${c.y2-18} 57 ${c.y2}`, class:"topology-crossover"});
        mk("path", {d:`M 43 ${c.y2} C 47 ${c.y2-18} 53 ${c.y1+18} 57 ${c.y1}`, class:"topology-crossover secondary"});
        mk("circle", {cx:50,cy:(c.y1+c.y2)/2,r:8,class:"topology-junction-ring"});
    });

    // Overpass: T3 briefly rises above the main corridor before returning.
    mk("path", {d:`M 34 272 Q 42 232 50 232 Q 58 232 66 272`, class:"topology-overpass"});
    mk("path", {d:`M 34 277 Q 42 237 50 237 Q 58 237 66 277`, class:"topology-overpass-rail"});
    mk("text", {x:50,y:218,"text-anchor":"middle",class:"topology-overpass-label"}).textContent = "FLYOVER / PASSING LOOP";
    mk("line", {x1:35,x2:35,y1:262,y2:286,class:"topology-overpass-support"});
    mk("line", {x1:65,x2:65,y1:262,y2:286,class:"topology-overpass-support"});

    // Station throat / platform tracks.
    ["NDLS","MTJ","AGC"].forEach(code => {
        const x = MAP_X[code];
        mk("line", {x1:x,x2:x,y1:82,y2:382,class:"topology-station-line"});
        mk("rect", {x:x-5,y:74,width:10,height:10,rx:2,class:"topology-station-node"});
        mk("text", {x:x,y:64,"text-anchor":"middle",class:"topology-station-label"}).textContent = code;
    });

    // Block markers: easy to understand occupancy zones.
    [25,50,75].forEach(x => mk("line", {x1:x,x2:x,y1:100,y2:366,class:"topology-block-line"}));

    // Direction arrows and a small legend.
    [132,202,272,342].forEach(y => {
        [18,32,68,82].forEach(x => mk("path", {d:`M ${x} ${y} l 4 -3 v 6 z`, class:"topology-direction"}));
    });

    return container;
}

function ensureRailTrainElements() {
    const container = ensureMapElements();
    if (!container) return;
    const existing = new Set();
    container.querySelectorAll(".rail-train").forEach(el => existing.add(el.dataset.train));

    allRailTrains().forEach(train => {
        let el = container.querySelector(`.rail-train[data-train="${train.number}"]`);
        if (!el) {
            el = document.createElement("div");
            el.className = "rail-train";
            el.dataset.train = train.number;
            el.tabIndex = 0;
            el.setAttribute("role", "button");
            el.innerHTML = `<div class="train-label">${train.number}</div><i data-lucide="train-front"></i><div class="train-direction"></div><span class="train-ai-tag"></span>`;
            container.appendChild(el);
            el.onclick = () => selectTrain(train.number);
        }
        el.dataset.track = train.track;
        el.title = `${train.number} · ${train.name} · ${train.track} · ${train.status}`;
        el.classList.toggle("train-held", ["STOPPED","HOLD"].includes(String(train.status).toUpperCase()));
        el.querySelector(".train-direction")?.classList.toggle("reverse", train.direction === "reverse");
    });
    if (iconsNeedRefresh) refreshRailwayIcons();
}

function updateTopologyVisuals() {
    const container = ensureMapElements();
    if (!container) return;
    ensureRailTrainElements();

    const occupiedTracks = new Set(allRailTrains().filter(t => !["STOPPED","HOLD"].includes(String(t.status).toUpperCase())).map(t => t.track));
    container.querySelectorAll("[data-topology-track]").forEach(path => {
        const track = path.dataset.topologyTrack;
        path.classList.toggle("occupied", occupiedTracks.has(track));
        path.classList.toggle("block-hot", railwayState.conflicts?.some(c => c.track === track));
    });

    allRailTrains().forEach(train => {
        const el = container.querySelector(`.rail-train[data-train="${train.number}"]`);
        if (!el) return;
        const p = Math.max(0, Math.min(100, Number(train.position) || 0));
        const physicalP = train.direction === "reverse" ? 100 - p : p;
        const x = MAP_X.NDLS + ((MAP_X.AGC - MAP_X.NDLS) * physicalP / 100);
        const y = MAP_TRACK_Y[train.track] ?? MAP_TRACK_Y.T1;
        el.style.left = `calc(${x}% - 22px)`;
        el.style.top = `${y - 21}px`;
        el.style.transform = train.direction === "reverse" ? "scaleX(-1)" : "none";
        el.classList.toggle("train-held", train.status === "STOPPED" || train.status === "HOLD");
        el.classList.toggle("train-ai-controlled", railwayState.lastRecommendation?.proceedTrain === train.number || railwayState.lastRecommendation?.holdTrain === train.number);
        const aiTag = el.querySelector(".train-ai-tag");
        if (aiTag) aiTag.textContent = railwayState.lastRecommendation?.proceedTrain === train.number ? "AI GO" : railwayState.lastRecommendation?.holdTrain === train.number ? (train.track !== railwayState.lastRecommendation?.conflict?.track ? "AI REROUTE" : "AI HOLD") : "";
    });
}

function advanceTrainAlongRoute(train, deltaTime) {
    const status = String(train.status || "RUNNING").toUpperCase();
    if (["STOPPED", "HOLD"].includes(status)) return;

    const speed = Math.max(0, Number(train.simulationSpeed ?? train.speed ?? 0));
    if (!speed) return;

    const maxSpeed = Number(railwayState.topology.sections[train.track]?.speedLimit || 120);
    const speedFactor = Math.min(1.15, speed / maxSpeed);
    let movement = (speedFactor * 3.6 * deltaTime * (railwayState.simulation.speedMultiplier || 1));

    // Block occupancy / following-distance protection.
    const sameTrack = allRailTrains().filter(other => other.number !== train.number && other.track === train.track);
    for (const other of sameTrack) {
        const signedGap = train.direction === "forward" ? other.position - train.position : train.position - other.position;
        if (signedGap > 0 && signedGap < 9) movement = Math.min(movement, Math.max(0, signedGap - 5));
    }

    // Stop at a red signal near the station throat.
    const red = Object.values(railwayState.signals).some(s => String(s.state).toLowerCase() === "red");
    if (red && train.position > 43 && train.position < 57) movement *= 0.15;

    train.position += train.direction === "reverse" ? -movement : movement;

    if (train.position >= 100 || train.position <= 0) {
        train.position = train.direction === "reverse" ? 100 : 0;
        const nextTrack = train.direction === "forward" ? getAlternateTrack(train) : getAlternateTrack(train);
        if (nextTrack) train.track = nextTrack;
        train.delay = Math.max(0, Number(train.delay || 0) - 1);
    }
}

function updateTrainPositions(deltaTime) {
    allRailTrains().forEach(train => advanceTrainAlongRoute(train, deltaTime));
}

function detectDynamicConflicts() {
    const trains = allRailTrains().filter(t => !["STOPPED","HOLD"].includes(String(t.status).toUpperCase()));
    const conflicts = [];
    for (let i = 0; i < trains.length; i++) {
        for (let j = i + 1; j < trains.length; j++) {
            const a = trains[i], b = trains[j];
            const sameTrack = a.track === b.track;
            const opposing = a.direction !== b.direction;
            const gap = Math.abs(Number(a.position) - Number(b.position));
            const crossoverConflict = a.track !== b.track && Math.abs(Number(a.position) - 50) < 7 && Math.abs(Number(b.position) - 50) < 7;
            if ((sameTrack && opposing && gap < 24) || crossoverConflict) {
                conflicts.push({
                    trainA:a.number, trainB:b.number, track:sameTrack ? a.track : `${a.track}/${b.track}`,
                    distance:Number(gap.toFixed(1)), timeToConflict:Number(Math.max(0.5, gap / Math.max(1, Number(a.speed)+Number(b.speed)) * 60).toFixed(1)),
                    severity: gap < 8 ? "HIGH" : gap < 15 ? "MEDIUM" : "LOW", detectedAt:new Date().toISOString()
                });
            }
        }
    }
    return conflicts;
}

function generateConflictDecision() {
    const conflicts = railwayState.conflicts || [];
    if (!conflicts.length) { activeDecision = null; return null; }
    const conflict = [...conflicts].sort((a,b) => ({HIGH:3,MEDIUM:2,LOW:1}[b.severity] - ({HIGH:3,MEDIUM:2,LOW:1}[a.severity])))[0];
    const a = railwayState.trains[conflict.trainA], b = railwayState.trains[conflict.trainB];
    if (!a || !b) return null;
    const score = t => ({HIGH:3,MEDIUM:2,LOW:1}[t.priority] || 1) * 10 + Number(t.delay || 0);
    const proceed = score(a) >= score(b) ? a : b;
    const hold = proceed.number === a.number ? b : a;
    const alternate = getAlternateTrack(hold);
    activeDecision = {
        type: alternate ? "REROUTE_AND_HOLD" : "HOLD_TRAIN",
        conflict, proceedTrain:proceed.number, holdTrain:hold.number,
        alternateTrack:alternate, holdStation:hold.nextStation || "MTJ",
        estimatedHold:Math.max(2, Math.ceil(conflict.timeToConflict || 2)), status:"PENDING"
    };
    return activeDecision;
}

function applyDecisionToSimulation(decision, mode = "accept") {
    if (!decision) return;
    const holdTrain = railwayState.trains[decision.holdTrain];
    const proceedTrain = railwayState.trains[decision.proceedTrain];
    if (!holdTrain || !proceedTrain) return;

    if (decision.alternateTrack && decision.type === "REROUTE_AND_HOLD") {
        holdTrain.track = decision.alternateTrack;
        holdTrain.status = "RUNNING";
        holdTrain.delay = Number(holdTrain.delay || 0) + 2;
    } else {
        holdTrain.status = "STOPPED";
        holdTrain.heldUntil = Date.now() + decision.estimatedHold * 1000;
        holdTrain.speed = 0;
        holdTrain.simulationSpeed = 0;
    }
    proceedTrain.status = "RUNNING";
    proceedTrain.simulationSpeed = Math.max(20, Number(proceedTrain.speed || 60));
    railwayState.signals.S1.state = "green";
    railwayState.signals.S2.state = holdTrain.track === "T2" ? "red" : "yellow";
    decision.status = mode === "simulate" ? "SIMULATED" : "ACCEPTED";
    railwayState.lastRecommendation = decision;
    updateTrackOccupancy();
    updateTrackUsage();
    updateSignalStates();
    updateDynamicConflicts();
    updateDynamicConflictUI();
    updateAIDecisionUI();
    updateTopologyVisuals();
}

let lastAutoDecisionAt = 0;
function autoExecuteRecommendation() {
    const now = Date.now();
    if (!activeDecision || activeDecision.status !== "PENDING") return;
    if (now - lastAutoDecisionAt < 12000) return;
    const conflict = activeDecision.conflict;
    if (!conflict || Number(conflict.distance) > 12) return;
    applyDecisionToSimulation(activeDecision, "ml-auto");
    lastAutoDecisionAt = now;
    const banner = document.getElementById("aiActionBanner");
    if (banner) {
        banner.textContent = `AI applied: ${activeDecision.proceedTrain} proceed${activeDecision.alternateTrack ? ` · ${activeDecision.holdTrain} → ${activeDecision.alternateTrack}` : ` · ${activeDecision.holdTrain} held`}`;
        banner.classList.add("visible");
        setTimeout(() => banner.classList.remove("visible"), 5000);
    }
}

function releaseExpiredHolds() {
    allRailTrains().forEach(train => {
        if (train.status === "STOPPED" && train.heldUntil && Date.now() >= train.heldUntil) {
            train.status = "RUNNING";
            train.simulationSpeed = Math.max(25, Number(train.speed || 45));
            train.heldUntil = 0;
        }
    });
}

function startTrainSimulation() {
    if (simulationRunning) return;
    simulationRunning = true;
    railwayState.simulation.running = true;
    railwayState.simulation.speedMultiplier = Number(simulationSpeedMultiplier) || 10;
    lastSimulationTime = performance.now();
    const loop = now => {
        if (!simulationRunning) return;
        const realDt = Math.min(0.05, Math.max(0, (now - (lastSimulationTime || now)) / 1000));
        lastSimulationTime = now;
        const dt = realDt * (Number(railwayState.simulation.speedMultiplier) || 1);
        releaseExpiredHolds();
        allRailTrains().forEach(train => advanceTrainAlongRoute(train, dt));
        updateTrackOccupancy();
        railwayState.conflicts = detectDynamicConflicts();
        generateConflictDecision();
        autoExecuteRecommendation();
        updateSignalStates();
        updateTrackUsage();
        updateDynamicConflictUI();
        updateAIDecisionUI();
        updateTrainVisualPositions();
        updateTopologyVisuals();
        simulationFrame = requestAnimationFrame(loop);
    };
    simulationFrame = requestAnimationFrame(loop);
}

function initializeRailway() {
    renderStations();
    renderSignals();
    ensureMapElements();
    ensureRailTrainElements();
    updateTrackOccupancy();
    updateTrackUsage();
    railwayState.conflicts = detectDynamicConflicts();
    generateConflictDecision();
    updateSignalStates();
    updateDynamicConflictUI();
    updateAIDecisionUI();
    initializeScenarioSelection();
    initializeScenarioActions();
    initializeRailwayInteractions();
    initializeSimulationControls();
    initializeDecisionControls();
    updateTopologyVisuals();
    startTrainSimulation();
}

function acceptConflictDecision() {
    if (!activeDecision) return showSystemMessage("No active AI decision is available.");
    applyDecisionToSimulation(activeDecision, "accept");
    showSystemMessage(activeDecision.alternateTrack
        ? `${activeDecision.holdTrain} rerouted to ${activeDecision.alternateTrack}; ${activeDecision.proceedTrain} given priority.`
        : `${activeDecision.holdTrain} held for ${activeDecision.estimatedHold} minutes; ${activeDecision.proceedTrain} given priority.`);
}

function simulateDecision() {
    if (!activeDecision) return showSystemMessage("No conflict is available to simulate.");
    const snapshot = JSON.parse(JSON.stringify(railwayState.trains));
    applyDecisionToSimulation(activeDecision, "simulate");
    showSystemMessage("AI decision simulated on the live topology.");
    setTimeout(() => {
        railwayState.trains = snapshot;
        updateTrackOccupancy();
        railwayState.conflicts = detectDynamicConflicts();
        generateConflictDecision();
        updateTopologyVisuals();
        updateDynamicConflictUI();
        updateAIDecisionUI();
        showSystemMessage("Simulation preview cleared; live state restored.");
    }, 3500);
}

function overrideRecommendation() {
    const trainId = activeDecision?.holdTrain;
    if (!trainId) return;
    const train = railwayState.trains[trainId];
    train.status = "RUNNING";
    train.track = getAlternateTrack(train) || train.track;
    train.simulationSpeed = Math.max(30, Number(train.speed || 50));
    showSystemMessage(`Controller override: ${trainId} released and routed on ${train.track}.`);
    updateTrackOccupancy();
    railwayState.conflicts = detectDynamicConflicts();
    generateConflictDecision();
    updateTopologyVisuals();
    updateAIDecisionUI();
}

function initializeDecisionControls() {
    document.querySelector(".accept-button")?.addEventListener("click", acceptConflictDecision);
    document.querySelector(".simulate-button")?.addEventListener("click", simulateDecision);
    document.querySelector(".override-button")?.addEventListener("click", overrideRecommendation);
}

// Keep the AI panel synchronized with the actionable decision object.
function updateAIDecisionUI() {
    const decision = activeDecision || generateConflictDecision();
    const alert = document.getElementById("conflictAlert");
    const alertText = document.getElementById("conflictAlertText");
    const action = document.getElementById("recommendedAction");
    const hold = document.getElementById("holdRecommendation");
    const estimated = document.getElementById("estimatedHold");
    const reasons = document.getElementById("decisionReasons");
    const a = document.getElementById("conflictTrainA");
    const b = document.getElementById("conflictTrainB");
    const an = document.getElementById("conflictTrainAName");
    const bn = document.getElementById("conflictTrainBName");

    if (!decision) {
        alert?.classList.remove("active");
        if (alertText) alertText.textContent = "NO ACTIVE CONFLICT";
        if (action) action.textContent = "No action required";
        if (hold) hold.textContent = "All trains can continue normally";
        if (estimated) estimated.textContent = "No hold required";
        if (reasons) reasons.innerHTML = `<li><i data-lucide="circle-check"></i>No conflicting train movement detected</li><li><i data-lucide="circle-check"></i>Block allocation is currently safe</li>`;
        refreshRailwayIcons();
        return;
    }

    const trainA = railwayState.trains[decision.conflict?.trainA || decision.proceedTrain];
    const trainB = railwayState.trains[decision.conflict?.trainB || decision.holdTrain];
    if (!trainA || !trainB) return;

    alert?.classList.add("active");
    if (alertText) alertText.textContent = `${decision.conflict?.severity || "AI"} CONFLICT DETECTED`;
    if (a) a.textContent = trainA.number;
    if (b) b.textContent = trainB.number;
    if (an) an.textContent = trainA.name;
    if (bn) bn.textContent = trainB.name;

    if (decision.alternateTrack) {
        if (action) action.textContent = `Allow ${decision.proceedTrain} to proceed and reroute ${decision.holdTrain}`;
        if (hold) hold.textContent = `Move ${decision.holdTrain} to ${decision.alternateTrack} via Mathura crossover`;
        if (estimated) estimated.textContent = `Estimated delay impact: +${decision.estimatedHold} min`;
    } else {
        if (action) action.textContent = `Allow ${decision.proceedTrain} to proceed`;
        if (hold) hold.textContent = `Hold ${decision.holdTrain} at ${decision.holdStation || "station throat"}`;
        if (estimated) estimated.textContent = `Estimated hold: ${decision.estimatedHold} minutes`;
    }

    if (reasons) {
        reasons.innerHTML = `
            <li><i data-lucide="brain-circuit"></i>Priority and predicted delay favor <strong>${decision.proceedTrain}</strong></li>
            <li><i data-lucide="route"></i>${decision.alternateTrack ? `Available crossover capacity on ${decision.alternateTrack} removes the conflict.` : "No free alternate loop is available, so the lower-priority train is held."}</li>
            <li><i data-lucide="shield-check"></i>Signals and occupied blocks update after the decision is applied</li>
        `;
    }
    refreshRailwayIcons();
}

function updateSignalStates() {
    const tracks = railwayState.tracks || {};
    const conflicts = railwayState.conflicts || [];
    const busy = track => tracks[track]?.occupied;
    railwayState.signals.S1.state = busy("T1") ? "yellow" : "green";
    railwayState.signals.S2.state = busy("T2") || conflicts.some(c => String(c.track).includes("T2")) ? "red" : "green";
    railwayState.signals.S3.state = conflicts.some(c => String(c.track).includes("T3")) ? "red" : "green";
    railwayState.signals.S4.state = conflicts.some(c => String(c.track).includes("T4")) ? "red" : "yellow";
    renderSignals();
}




/* ============================================================
   FINAL OPERATIONAL SECTION SIMULATION
   - Two straight main tracks
   - Two simple junctions that merge into the main lines
   - Trains enter from the edges and leave the screen
   - New trains spawn only after previous trains complete
   - Calculated randomness creates realistic traffic patterns
   - ML/KNN + backend recommendation decides junction order
============================================================ */

const SIM_LAYOUT = {
    T1: { y: 132, name: "UP MAIN", direction: "forward", entrySide: "left" },
    T2: { y: 238, name: "DOWN MAIN", direction: "reverse", entrySide: "right" },
    B1: { x1: 38, y1: 132, x2: 50, y2: 238, name: "JUNCTION A", target: "T2", mergeX: 50, direction: "reverse" },
    B2: { x1: 62, y1: 238, x2: 74, y2: 132, name: "JUNCTION B", target: "T1", mergeX: 74, direction: "forward" }
};

const SIM_STATIONS = [
    { code: "NDLS", name: "New Delhi", x: 5 },
    { code: "MTJ", name: "Mathura Jn", x: 50 },
    { code: "AGC", name: "Agra Cantt.", x: 95 }
];

const SIM_TEMPLATES = [
    { number: "12951", name: "Rajdhani Express", type: "Express", priority: "HIGH", speed: 92 },
    { number: "12007", name: "Shatabdi Express", type: "Express", priority: "HIGH", speed: 86 },
    { number: "12424", name: "Dibrugarh Rajdhani", type: "Express", priority: "HIGH", speed: 88 },
    { number: "12138", name: "Punjab Mail", type: "Express", priority: "MEDIUM", speed: 72 },
    { number: "64315", name: "Passenger", type: "Passenger", priority: "MEDIUM", speed: 58 },
    { number: "54821", name: "Freight", type: "Freight", priority: "LOW", speed: 48 },
    { number: "12807", name: "Vishakhapatnam SF", type: "Express", priority: "MEDIUM", speed: 78 },
    { number: "12627", name: "Karnataka Express", type: "Express", priority: "HIGH", speed: 90 },
    { number: "19024", name: "FZR MMCT Janta", type: "Passenger", priority: "LOW", speed: 52 }
];

const simpleTrafficState = {
    rng: 0x7f4a7c15,
    nextRun: 1,
    spawnClock: 0,
    nextSpawnIn: 8,
    completed: 0,
    pendingRespawns: [],
    lastRecommendationSignature: "",
    lastBackendAsk: 0
};

function simRandom() {
    // Deterministic pseudo-randomness: varied, but repeatable for demos/tests.
    let x = simpleTrafficState.rng >>> 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    simpleTrafficState.rng = x >>> 0;
    return (x >>> 0) / 4294967296;
}

function simChoice(list) {
    return list[Math.floor(simRandom() * list.length)];
}

function simClamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
}

function simRouteType() {
    const r = simRandom();
    if (r < 0.33) return "T1";
    if (r < 0.66) return "T2";
    if (r < 0.82) return "B1";
    if (r < 0.96) return "B2";
    return simRandom() < 0.5 ? "T1" : "T2";
}

function simPriorityScore(train) {
    const p = { HIGH: 3, MEDIUM: 2, LOW: 1 }[train.priority] || 1;
    const predicted = Number(train.predictedDelay || train.delay || 0);
    return p * 25 + Number(train.delay || 0) * 2 - predicted;
}

function simTrackOccupiedBy(track) {
    return allRailTrains().filter(t => t.track === track && t.status !== "COMPLETED");
}

function simSpatialPoint(train) {
    const p = Number(train.position) || 0;
    if (train.track === "T1") return { x: p, y: SIM_LAYOUT.T1.y };
    if (train.track === "T2") return { x: 100 - p, y: SIM_LAYOUT.T2.y };
    if (train.track === "B1") {
        const t = simClamp(p / 100, 0, 1);
        return {
            x: SIM_LAYOUT.B1.x1 + (SIM_LAYOUT.B1.x2 - SIM_LAYOUT.B1.x1) * t,
            y: SIM_LAYOUT.B1.y1 + (SIM_LAYOUT.B1.y2 - SIM_LAYOUT.B1.y1) * t
        };
    }
    if (train.track === "B2") {
        const t = simClamp(p / 100, 0, 1);
        return {
            x: SIM_LAYOUT.B2.x1 + (SIM_LAYOUT.B2.x2 - SIM_LAYOUT.B2.x1) * t,
            y: SIM_LAYOUT.B2.y1 + (SIM_LAYOUT.B2.y2 - SIM_LAYOUT.B2.y1) * t
        };
    }
    return { x: 50, y: SIM_LAYOUT.T1.y };
}

function simDistanceToJunction(train) {
    if (train.track === "B1") return Math.abs(100 - Number(train.position || 0));
    if (train.track === "B2") return Math.abs(100 - Number(train.position || 0));
    if (train.track === "T1") return Math.abs(Number(train.position || 0) - 74);
    if (train.track === "T2") return Math.abs(Number(train.position || 0) - 50);
    return Infinity;
}

function simIsStopped(train) {
    return ["STOPPED", "HOLD", "COMPLETED", "DEPARTED"].includes(String(train?.status || "").toUpperCase());
}

function simNameForRun(template) {
    const suffix = String(simpleTrafficState.nextRun++).padStart(2, "0");
    return `${template.number}-${suffix}`;
}

function simMakeTrain(route, forcedPosition = null, forcedTemplate = null) {
    const template = forcedTemplate || simChoice(SIM_TEMPLATES);
    const routeDirection = SIM_LAYOUT[route]?.direction || "forward";
    let position = forcedPosition;

    if (position === null) {
        if (route === "T1" || route === "T2") position = route === "T1" ? -12 : 112;
        else position = 0;
    }

    const delay = Math.floor(simRandom() * 10);
    const train = {
        number: simNameForRun(template),
        baseNumber: template.number,
        name: template.name,
        type: template.type,
        priority: template.priority,
        currentStation: route === "T1" ? "NDLS" : route === "T2" ? "AGC" : "Junction",
        nextStation: route === "T1" ? "AGC" : route === "T2" ? "NDLS" : (route === "B1" ? "NDLS" : "AGC"),
        speed: template.speed,
        delay,
        track: route,
        direction: routeDirection,
        status: "RUNNING",
        position,
        simulationSpeed: template.speed,
        heldUntil: 0,
        spawnTime: Date.now(),
        runState: "ACTIVE",
        waitingAtJunction: false,
        mlRecommended: false
    };
    return train;
}

function simSafeMainSpawn(route, maxAttempts = 18) {
    const desired = route === "T1" ? -12 : 112;
    for (let i = 0; i < maxAttempts; i++) {
        const candidate = simMakeTrain(route, desired);
        const mainTrains = simTrackOccupiedBy(route);
        const tooSoon = mainTrains.some(t => {
            const front = Number(t.position);
            return route === "T1" ? front < 15 : front > 85;
        });
        if (!tooSoon) return candidate;
    }
    return simMakeTrain(route, desired);
}

function simBuildTraffic() {
    railwayState.trains = {};

    // Two initial trains are deliberately placed near the junctions so the ML
    // has a meaningful right-of-way decision immediately.
    const starter = [
        simMakeTrain("T1", 58, SIM_TEMPLATES[0]),
        simMakeTrain("B2", 62, SIM_TEMPLATES[4]),
        simMakeTrain("T2", 48, SIM_TEMPLATES[5]),
        simMakeTrain("B1", 66, SIM_TEMPLATES[2]),
        simMakeTrain("T1", 24, SIM_TEMPLATES[1]),
        simMakeTrain("T2", 78, SIM_TEMPLATES[3])
    ];

    // Calculated randomness adjusts the starting positions without letting the
    // opening screen become unreadably crowded.
    starter.forEach((train, i) => {
        if (i >= 2) train.position += Math.round((simRandom() - 0.5) * 10);
        railwayState.trains[train.number] = train;
    });

    simpleTrafficState.spawnClock = 0;
    simpleTrafficState.nextSpawnIn = 7 + simRandom() * 7;
    simpleTrafficState.completed = 0;
    simpleTrafficState.pendingRespawns = [];
}

function simRegisterRespawnDelay() {
    simpleTrafficState.nextSpawnIn = 5 + simRandom() * 9;
}

function simSpawnReplacement() {
    const route = simRouteType();
    const train = simSafeMainSpawn(route === "B1" || route === "B2" ? (simRandom() < 0.5 ? "T1" : "T2") : route);
    // Occasionally spawn a junction train instead of a main-line arrival.
    if (route === "B1") {
        const b = simMakeTrain("B1", 0);
        railwayState.trains[b.number] = b;
        return;
    }
    if (route === "B2") {
        const b = simMakeTrain("B2", 0);
        railwayState.trains[b.number] = b;
        return;
    }
    railwayState.trains[train.number] = train;
}

function simCompleteTrain(train) {
    train.status = "COMPLETED";
    train.runState = "DEPARTED";
    train.departedAt = Date.now();
    simpleTrafficState.completed += 1;
    delete railwayState.trains[train.number];
    simRegisterRespawnDelay();
}

function ensureMapElements() {
    const container = document.querySelector(".railway-container");
    if (!container) return null;
    container.classList.add("simple-railway-map", "junction-corridor-map");

    container.querySelectorAll(".station, .station-line, .track, .junction, .platform, .signal, .conflict-marker").forEach(el => {
        el.style.display = "none";
    });

    let svg = container.querySelector(".simple-topology-svg");
    if (!svg) {
        svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.classList.add("simple-topology-svg");
        container.prepend(svg);
    }

    svg.setAttribute("viewBox", "0 0 100 330");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.innerHTML = "";

    const ns = "http://www.w3.org/2000/svg";
    const mk = (tag, attrs = {}) => {
        const el = document.createElementNS(ns, tag);
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
        svg.appendChild(el);
        return el;
    };

    const drawRail = (y, label, subtitle) => {
        mk("line", { x1: 2, y1: y, x2: 98, y2: y, class: "corridor-main-line", "data-topology-track": label === "UP MAIN" ? "T1" : "T2" });
        mk("line", { x1: 2, y1: y + 5, x2: 98, y2: y + 5, class: "corridor-inner-rail" });
        for (let x = 3; x <= 97; x += 3.2) mk("line", { x1: x, x2: x, y1: y - 6, y2: y + 10, class: "corridor-sleeper" });
        for (const x of [25, 50, 75]) mk("line", { x1: x, x2: x, y1: y - 8, y2: y + 11, class: "corridor-block" });
        const t = mk("text", { x: 3, y: y - 13, class: "corridor-track-label" }); t.textContent = label;
        const st = mk("text", { x: 97, y: y - 13, "text-anchor": "end", class: "corridor-track-subtitle" }); st.textContent = subtitle;
    };

    drawRail(SIM_LAYOUT.T1.y, "UP MAIN", "NDLS → AGRA");
    drawRail(SIM_LAYOUT.T2.y, "DOWN MAIN", "AGRA → NDLS");

    // Junction A: branch from UP MAIN down into DOWN MAIN.
    mk("path", {
        d: `M ${SIM_LAYOUT.B1.x1} ${SIM_LAYOUT.B1.y1} L ${SIM_LAYOUT.B1.x2} ${SIM_LAYOUT.B1.y2}`,
        class: "corridor-junction corridor-junction-a"
    });

    // Junction B: branch from DOWN MAIN up into UP MAIN.
    mk("path", {
        d: `M ${SIM_LAYOUT.B2.x1} ${SIM_LAYOUT.B2.y1} L ${SIM_LAYOUT.B2.x2} ${SIM_LAYOUT.B2.y2}`,
        class: "corridor-junction corridor-junction-b"
    });

    // Junction nodes / signals.
    [
        { x: 38, y: SIM_LAYOUT.T1.y, label: "J1" },
        { x: 50, y: SIM_LAYOUT.T2.y, label: "J2" },
        { x: 62, y: SIM_LAYOUT.T2.y, label: "J3" },
        { x: 74, y: SIM_LAYOUT.T1.y, label: "J4" }
    ].forEach(j => {
        mk("circle", { cx: j.x, cy: j.y + 2, r: 2.2, class: "corridor-junction-node" });
        const txt = mk("text", { x: j.x, y: j.y - 9, "text-anchor": "middle", class: "corridor-junction-label" }); txt.textContent = j.label;
    });

    SIM_STATIONS.forEach(st => {
        mk("line", { x1: st.x, x2: st.x, y1: 45, y2: 305, class: "corridor-station-line" });
        const code = mk("text", { x: st.x, y: 35, "text-anchor": "middle", class: "corridor-station-code" }); code.textContent = st.code;
        const name = mk("text", { x: st.x, y: 47, "text-anchor": "middle", class: "corridor-station-name" }); name.textContent = st.name;
    });

    const header = mk("text", { x: 50, y: 18, "text-anchor": "middle", class: "corridor-header" });
    header.textContent = "LIVE CORRIDOR  •  TRAINS ENTER → PASS → DEPART";

    const footer = mk("text", { x: 50, y: 315, "text-anchor": "middle", class: "corridor-footer" });
    footer.textContent = "Junctions are controlled by the AI right-of-way decision";

    return container;
}

function ensureRailTrainElements() {
    const container = ensureMapElements();
    if (!container) return;

    const activeNumbers = new Set(allRailTrains().map(t => String(t.number)));

    container.querySelectorAll(".rail-train[data-simulated-train]").forEach(el => {
        if (!activeNumbers.has(String(el.dataset.train))) el.remove();
    });

    allRailTrains().forEach(train => {
        let el = container.querySelector(`.rail-train[data-train="${CSS.escape(String(train.number))}"]`);
        if (!el) {
            el = document.createElement("div");
            el.className = "rail-train simulated-train";
            el.dataset.train = String(train.number);
            el.dataset.simulatedTrain = "1";
            el.tabIndex = 0;
            el.setAttribute("role", "button");
            el.addEventListener("click", () => selectTrain(train.number));
            container.appendChild(el);
        }
        if (el.dataset.simpleMarkup !== "1") {
            el.innerHTML = `
                <div class="train-label">${train.baseNumber || train.number}</div>
                <div class="train-body"><i data-lucide="train-front"></i></div>
                <span class="train-ai-tag"></span>
            `;
            el.dataset.simpleMarkup = "1";
        }
        el.classList.toggle("train-held", simIsStopped(train));
        el.classList.toggle("reverse-running", train.direction === "reverse");
        el.classList.toggle("train-branch", train.track.startsWith("B"));
        el.title = `${train.baseNumber || train.number} · ${train.name} · ${train.track} · ${train.status}`;
    });
    refreshRailwayIcons();
}

function updateTrackOccupancy() {
    Object.values(railwayState.tracks || {}).forEach(track => {
        track.occupied = false;
        track.occupiedBy = [];
    });
    allRailTrains().forEach(train => {
        if (!railwayState.tracks[train.track]) return;
        railwayState.tracks[train.track].occupied = true;
        railwayState.tracks[train.track].occupiedBy.push(train.number);
    });
}

function updateTopologyVisuals() {
    const container = ensureMapElements();
    if (!container) return;
    ensureRailTrainElements();

    const decision = activeDecision || null;

    container.querySelectorAll("[data-topology-track]").forEach(path => {
        const track = path.dataset.topologyTrack;
        const busy = allRailTrains().some(t => t.track === track && !simIsStopped(t));
        const hot = (railwayState.conflicts || []).some(c => String(c.track).includes(track));
        path.classList.toggle("occupied", busy);
        path.classList.toggle("block-hot", hot);
    });

    allRailTrains().forEach(train => {
        const el = container.querySelector(`.rail-train[data-train="${CSS.escape(String(train.number))}"]`);
        if (!el) return;
        const pt = simSpatialPoint(train);
        const x = pt.x;
        const y = pt.y;
        el.style.left = `calc(${x}% - 28px)`;
        el.style.top = `${(y / 330) * 100}%`;
        el.style.transform = "none";
        el.classList.toggle("reverse-running", train.direction === "reverse");
        el.classList.toggle("train-held", simIsStopped(train));
        el.classList.toggle("train-ai-controlled", decision && (decision.proceedTrain === train.number || decision.holdTrain === train.number));
        const tag = el.querySelector(".train-ai-tag");
        if (tag) {
            if (decision?.proceedTrain === train.number) {
                tag.textContent = "AI GO";
                tag.dataset.state = "go";
            } else if (decision?.holdTrain === train.number) {
                tag.textContent = "AI HOLD";
                tag.dataset.state = "hold";
            } else {
                tag.textContent = "";
                tag.dataset.state = "";
            }
        }
    });
}

function simAdvanceMain(train, movement) {
    const others = allRailTrains().filter(o => o.number !== train.number && o.track === train.track && !simIsStopped(o));
    for (const other of others) {
        const gap = train.track === "T1"
            ? Number(other.position) - Number(train.position)
            : Number(train.position) - Number(other.position);
        if (gap > 0 && gap < 10) return Math.min(movement, Math.max(0, gap - 4));
    }
    return movement;
}

function simCanMerge(train, targetTrack, mergeX) {
    const nearby = allRailTrains().filter(other => other.number !== train.number && other.track === targetTrack && !simIsStopped(other));
    return !nearby.some(other => Math.abs(Number(other.position) - mergeX) < 12);
}

function advanceTrainAlongRoute(train, deltaTime) {
    if (simIsStopped(train)) return;

    const speed = Math.max(20, Number(train.simulationSpeed || train.speed || 50));
    const speedScale = Math.max(0.6, Math.min(1.15, speed / 70));
    const multiplier = Number(railwayState.simulation.speedMultiplier || 10);
    let movement = 7.0 * speedScale * deltaTime * multiplier;

    movement = Math.max(0.015, movement);

    if (train.track === "T1" || train.track === "T2") {
        movement = simAdvanceMain(train, movement);
        train.position += train.track === "T1" ? movement : -movement;

        // Main-line trains leave the screen. They do NOT wrap around.
        if (train.position > 106 || train.position < -6) {
            simCompleteTrain(train);
        }
        return;
    }

    // Branch trains travel toward their merge point.
    movement *= 0.9;
    train.position += movement;

    if (train.position >= 82 && train.status === "RUNNING") {
        const target = train.track === "B1" ? "T2" : "T1";
        const mergeX = train.track === "B1" ? 50 : 74;
        if (!simCanMerge(train, target, mergeX)) {
            train.status = "HOLD";
            train.heldUntil = Date.now() + 2500;
            train.simulationSpeed = 0;
            train.waitingAtJunction = true;
            return;
        }
    }

    if (train.position >= 100) {
        const target = train.track === "B1" ? "T2" : "T1";
        const mergeX = train.track === "B1" ? 50 : 74;
        train.track = target;
        train.position = mergeX;
        train.direction = target === "T1" ? "forward" : "reverse";
        train.waitingAtJunction = false;
        train.simulationSpeed = Math.max(40, Number(train.speed || 50));
        train.nextStation = target === "T1" ? "AGC" : "NDLS";
    }
}

function releaseExpiredHolds() {
    allRailTrains().forEach(train => {
        if ((train.status === "STOPPED" || train.status === "HOLD") && train.heldUntil && Date.now() >= train.heldUntil) {
            train.status = "RUNNING";
            train.heldUntil = 0;
            train.simulationSpeed = Math.max(40, Number(train.speed || 50));
            train.waitingAtJunction = false;
        }
    });
}

function simFindJunctionConflicts() {
    const trains = allRailTrains().filter(t => !simIsStopped(t));
    const conflicts = [];

    for (let i = 0; i < trains.length; i++) {
        for (let j = i + 1; j < trains.length; j++) {
            const a = trains[i], b = trains[j];
            const pa = simSpatialPoint(a), pb = simSpatialPoint(b);
            const physicalDistance = Math.hypot(pa.x - pb.x, (pa.y - pb.y) / 2);

            const oneBranch = a.track.startsWith("B"), otherBranch = b.track.startsWith("B");
            const branchConflict = oneBranch !== otherBranch && physicalDistance < 12;

            const sameMain = (a.track === b.track) && (a.track === "T1" || a.track === "T2") && Math.abs(Number(a.position) - Number(b.position)) < 12;

            if (branchConflict || sameMain) {
                const predictedA = window.mlModel?.predictTrain(a, { distanceRemaining: simDistanceToJunction(a), trackOccupancy: 0.8 })?.predictedDelay ?? a.delay;
                const predictedB = window.mlModel?.predictTrain(b, { distanceRemaining: simDistanceToJunction(b), trackOccupancy: 0.8 })?.predictedDelay ?? b.delay;
                a.predictedDelay = predictedA;
                b.predictedDelay = predictedB;
                const junction = branchConflict ? (a.track === "B1" || b.track === "B1" ? "J2" : "J4") : (a.track === "T1" ? "T1 BLOCK" : "T2 BLOCK");
                const rank = physicalDistance < 5 ? "HIGH" : physicalDistance < 9 ? "MEDIUM" : "LOW";
                conflicts.push({
                    trainA: a.number,
                    trainB: b.number,
                    track: branchConflict ? junction : a.track,
                    distance: Number(physicalDistance.toFixed(1)),
                    timeToConflict: Number(Math.max(1.5, physicalDistance / 5).toFixed(1)),
                    severity: rank,
                    type: branchConflict ? "JUNCTION" : "BLOCK",
                    detectedAt: new Date().toISOString()
                });
            }
        }
    }
    return conflicts;
}

function detectDynamicConflicts() {
    return simFindJunctionConflicts();
}

function generateConflictDecision() {
    const conflicts = railwayState.conflicts || [];
    if (!conflicts.length) {
        activeDecision = null;
        window.__trackmyrailDecision = null;
        return null;
    }

    const rank = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    const conflict = [...conflicts].sort((a, b) => rank[b.severity] - rank[a.severity])[0];
    const a = railwayState.trains[conflict.trainA];
    const b = railwayState.trains[conflict.trainB];
    if (!a || !b) return null;

    const mlA = window.mlModel?.predictTrain(a, { distanceRemaining: simDistanceToJunction(a), trackOccupancy: 0.8 });
    const mlB = window.mlModel?.predictTrain(b, { distanceRemaining: simDistanceToJunction(b), trackOccupancy: 0.8 });
    if (mlA) a.predictedDelay = mlA.predictedDelay;
    if (mlB) b.predictedDelay = mlB.predictedDelay;

    const conflictRisk = window.mlModel?.predictConflict(a, b, { distanceBetween: conflict.distance, trackOccupancy: 0.9 });

    const scoreA = simPriorityScore(a) + (a.track.startsWith("B") ? 0 : 2);
    const scoreB = simPriorityScore(b) + (b.track.startsWith("B") ? 0 : 2);
    const proceed = scoreA >= scoreB ? a : b;
    const hold = proceed.number === a.number ? b : a;

    activeDecision = {
        type: "JUNCTION_RIGHT_OF_WAY",
        conflict,
        proceedTrain: proceed.number,
        holdTrain: hold.number,
        holdStation: hold.track.startsWith("B") ? "junction approach" : "Mathura Jn",
        estimatedHold: Math.max(3, Math.ceil(conflict.timeToConflict * 1.2)),
        confidence: conflictRisk?.confidence || 0.84,
        conflictProbability: conflictRisk?.probability || 0.7,
        status: "PENDING",
        source: "ML/KNN right-of-way model"
    };

    window.__trackmyrailDecision = activeDecision;
    return activeDecision;
}

async function askBackendForJunctionDecision() {
    const now = Date.now();
    if (now - simpleTrafficState.lastBackendAsk < 6000) return;
    if (!(dataIntegration?.backend?.connected) || !window.reoptimizeTraffic) return;
    const conflict = (railwayState.conflicts || [])[0];
    if (!conflict) return;
    simpleTrafficState.lastBackendAsk = now;
    try {
        await window.reoptimizeTraffic("junction_conflict");
    } catch (_) {
        // Browser-side ML remains authoritative fallback.
    }
}

function applyDecisionToSimulation(decision, mode = "accept") {
    if (!decision) return false;
    const proceed = railwayState.trains[decision.proceedTrain];
    const hold = railwayState.trains[decision.holdTrain];
    if (!proceed || !hold) return false;

    const holdSeconds = Math.max(3, Number(decision.estimatedHold || 4));
    hold.status = "HOLD";
    hold.heldUntil = Date.now() + holdSeconds * 1000;
    hold.simulationSpeed = 0;
    hold.waitingAtJunction = hold.track.startsWith("B");

    proceed.status = "RUNNING";
    proceed.simulationSpeed = Math.max(45, Number(proceed.speed || 50));
    proceed.mlRecommended = true;

    decision.status = mode === "simulate" ? "SIMULATED" : "ACCEPTED";
    railwayState.lastRecommendation = { ...decision };
    window.__trackmyrailDecision = { ...decision };

    updateTrackOccupancy();
    railwayState.conflicts = detectDynamicConflicts();
    safeUiCall("updateDynamicConflictUI");
    safeUiCall("updateTrackUsage");
    updateTopologyVisuals();
    updateAIDecisionUI();

    const banner = document.getElementById("aiActionBanner");
    if (banner) {
        banner.textContent = `ML decision applied: ${proceed.baseNumber || proceed.number} passes first · ${hold.baseNumber || hold.number} held at the junction`;
        banner.classList.add("visible");
    }
    return true;
}

function updateAIDecisionUI() {
    const decision = activeDecision || generateConflictDecision();
    const alert = document.getElementById("conflictAlert");
    const alertText = document.getElementById("conflictAlertText");
    const action = document.getElementById("recommendedAction");
    const hold = document.getElementById("holdRecommendation");
    const estimated = document.getElementById("estimatedHold");
    const reasons = document.getElementById("decisionReasons");
    const aNode = document.getElementById("conflictTrainA");
    const bNode = document.getElementById("conflictTrainB");
    const an = document.getElementById("conflictTrainAName");
    const bn = document.getElementById("conflictTrainBName");

    if (!decision) {
        alert?.classList.remove("active");
        if (alertText) alertText.textContent = "NO ACTIVE JUNCTION CONFLICT";
        if (action) action.textContent = "No action required";
        if (hold) hold.textContent = "Trains can continue on their assigned route";
        if (estimated) estimated.textContent = "No hold required";
        if (reasons) reasons.innerHTML = `<li><i data-lucide="circle-check"></i>Main-line blocks are clear</li><li><i data-lucide="route"></i>Next junction is available</li>`;
        refreshRailwayIcons();
        return;
    }

    const a = railwayState.trains[decision.conflict?.trainA || decision.proceedTrain];
    const b = railwayState.trains[decision.conflict?.trainB || decision.holdTrain];
    if (!a || !b) return;

    alert?.classList.add("active");
    if (alertText) alertText.textContent = `${decision.conflict?.severity || "ML"} JUNCTION CONFLICT`;
    if (aNode) aNode.textContent = a.baseNumber || a.number;
    if (bNode) bNode.textContent = b.baseNumber || b.number;
    if (an) an.textContent = a.name;
    if (bn) bn.textContent = b.name;

    if (action) action.textContent = `Allow ${decision.proceedTrain} to pass first`;
    if (hold) hold.textContent = `Hold ${decision.holdTrain} before the junction`;
    if (estimated) estimated.textContent = `Estimated hold: ${decision.estimatedHold} sec · ML confidence ${(Number(decision.confidence || 0.84) * 100).toFixed(0)}%`;

    if (reasons) reasons.innerHTML = `
        <li><i data-lucide="brain-circuit"></i>ML favors <strong>${decision.proceedTrain}</strong> using priority + predicted delay</li>
        <li><i data-lucide="git-merge"></i>Junction ${decision.conflict?.track || "approach"} needs one train to pass first</li>
        <li><i data-lucide="shield-check"></i>Accepting the decision changes the live train movement</li>
    `;
    refreshRailwayIcons();
}

function updateSimpleSimulationClock() {
    const status = document.getElementById("simulationStatusText");
    if (status) status.textContent = simulationRunning ? "Running" : "Paused";
}

function updateSimpleTrafficMetrics() {
    const active = allRailTrains().length;
    const delayed = allRailTrains().filter(t => Number(t.delay || 0) > 5).length;
    const throughput = Math.max(0, Math.round((simpleTrafficState.completed / Math.max(1, (Date.now() - (simpleTrafficState.startedAt || Date.now())) / 60000))));
    const totalNode = document.querySelector(".metrics-grid .metric-card:nth-child(1) strong") || document.getElementById("totalTrainsValue");
    const delayedNode = document.getElementById("delayedTrainsValue");
    const throughputNode = document.getElementById("throughputValue");
    if (totalNode) totalNode.textContent = active;
    if (delayedNode) delayedNode.textContent = delayed;
    if (throughputNode) throughputNode.textContent = `${throughput} /min`;
}

function simSpawnCycle(dt) {
    simpleTrafficState.spawnClock += dt;
    if (simpleTrafficState.spawnClock < simpleTrafficState.nextSpawnIn) return;
    simpleTrafficState.spawnClock = 0;
    simSpawnReplacement();
    simRegisterRespawnDelay();
}

function startTrainSimulation() {
    if (simulationRunning) return;
    simulationRunning = true;
    railwayState.simulation.running = true;
    railwayState.simulation.speedMultiplier = Number(railwayState.simulation.speedMultiplier || 10);
    simpleTrafficState.startedAt = simpleTrafficState.startedAt || Date.now();
    let last = performance.now();
    updateSimpleSimulationClock();

    const loop = now => {
        if (!simulationRunning) return;
        const realDt = Math.min(0.08, Math.max(0, (now - last) / 1000));
        last = now;
        const simDt = realDt * Number(railwayState.simulation.speedMultiplier || 10);

        releaseExpiredHolds();
        simSpawnCycle(simDt);

        // Iterate over a snapshot: completed trains may remove themselves.
        [...allRailTrains()].forEach(train => advanceTrainAlongRoute(train, simDt));

        updateTrackOccupancy();
        railwayState.conflicts = detectDynamicConflicts();
        if (!activeDecision || activeDecision.status !== "ACCEPTED") generateConflictDecision();
        updateSimpleSimulationClock();
        updateSimpleTrafficMetrics();
        updateTopologyVisuals();
        safeUiCall("updateDynamicConflictUI");
        updateAIDecisionUI();

        const sig = railwayState.conflicts?.[0] ? `${railwayState.conflicts[0].trainA}|${railwayState.conflicts[0].trainB}|${railwayState.conflicts[0].track}` : "";
        if (sig && sig !== simpleTrafficState.lastRecommendationSignature) {
            simpleTrafficState.lastRecommendationSignature = sig;
            askBackendForJunctionDecision();
        }

        simulationFrame = requestAnimationFrame(loop);
    };
    simulationFrame = requestAnimationFrame(loop);
}

function stopTrainSimulation() {
    simulationRunning = false;
    railwayState.simulation.running = false;
    if (simulationFrame) cancelAnimationFrame(simulationFrame);
    simulationFrame = null;
    updateSimpleSimulationClock();
}

function resetTrainSimulation() {
    stopTrainSimulation();
    simBuildTraffic();
    activeDecision = null;
    window.__trackmyrailDecision = null;
    railwayState.lastRecommendation = null;
    railwayState.conflicts = detectDynamicConflicts();
    generateConflictDecision();
    updateTrackOccupancy();
    updateTopologyVisuals();
    updateAIDecisionUI();
    showSystemMessage("Traffic reset. New trains have been calculated and spawned.");
}

function initializeSimulationControls() {
    const replace = id => {
        const old = document.getElementById(id);
        if (!old) return null;
        const fresh = old.cloneNode(true);
        old.replaceWith(fresh);
        return fresh;
    };
    const start = replace("simulationStartButton");
    const pause = replace("simulationPauseButton");
    const reset = replace("simulationResetButton");
    start?.addEventListener("click", startTrainSimulation);
    pause?.addEventListener("click", stopTrainSimulation);
    reset?.addEventListener("click", resetTrainSimulation);

    document.querySelectorAll(".speed-button").forEach(btn => {
        const fresh = btn.cloneNode(true);
        btn.replaceWith(fresh);
    });
    document.querySelectorAll(".speed-button").forEach(btn => {
        btn.addEventListener("click", () => {
            const speed = Number(btn.dataset.speed);
            if (!speed) return;
            railwayState.simulation.speedMultiplier = speed;
            document.querySelectorAll(".speed-button").forEach(b => b.classList.toggle("active", Number(b.dataset.speed) === speed));
            showSystemMessage(`Simulation speed set to ${speed}×`);
        });
    });
    railwayState.simulation.speedMultiplier = 10;
    document.querySelectorAll(".speed-button").forEach(btn => btn.classList.toggle("active", Number(btn.dataset.speed) === 10));
    updateSimpleSimulationClock();
}

function acceptConflictDecision() {
    const decision = activeDecision || generateConflictDecision();
    if (!decision) {
        showSystemMessage("No active ML junction decision is available.");
        return;
    }
    if (applyDecisionToSimulation(decision, "accept")) {
        showSystemMessage(`ML decision accepted: ${decision.proceedTrain} passes first; ${decision.holdTrain} held.`);
    }
}

function simulateDecision() {
    const decision = activeDecision || generateConflictDecision();
    if (!decision) {
        showSystemMessage("No junction conflict is available to simulate.");
        return;
    }
    const snapshot = JSON.parse(JSON.stringify(railwayState.trains));
    const previous = { activeDecision: activeDecision ? { ...activeDecision } : null };
    if (applyDecisionToSimulation(decision, "simulate")) {
        showSystemMessage("ML decision preview is active.");
        setTimeout(() => {
            railwayState.trains = snapshot;
            activeDecision = previous.activeDecision;
            railwayState.conflicts = detectDynamicConflicts();
            updateTrackOccupancy();
            updateTopologyVisuals();
            updateAIDecisionUI();
            showSystemMessage("Preview cleared; traffic restored.");
        }, 3000);
    }
}

function overrideRecommendation() {
    const decision = activeDecision || generateConflictDecision();
    if (!decision) {
        showSystemMessage("No active ML recommendation.");
        return;
    }
    const hold = railwayState.trains[decision.holdTrain];
    if (!hold) return;
    hold.status = "RUNNING";
    hold.heldUntil = 0;
    hold.simulationSpeed = Math.max(35, Number(hold.speed || 45));
    activeDecision = null;
    window.__trackmyrailDecision = null;
    railwayState.conflicts = detectDynamicConflicts();
    generateConflictDecision();
    updateTopologyVisuals();
    updateAIDecisionUI();
    showSystemMessage(`Controller override: ${hold.number} released.`);
}

function initializeDecisionControls() {
    const bindings = [
        [".accept-button", acceptConflictDecision],
        [".simulate-button", simulateDecision],
        [".override-button", overrideRecommendation]
    ];
    bindings.forEach(([selector, handler]) => {
        const old = document.querySelector(selector);
        if (!old) return;
        const fresh = old.cloneNode(true);
        old.replaceWith(fresh);
        fresh.addEventListener("click", handler);
    });
}

function initializeSimpleRailway() {
    // Initialize the new route topology.
    railwayState.tracks = {
        T1: { id: "T1", name: "UP MAIN", occupied: false, occupiedBy: [] },
        T2: { id: "T2", name: "DOWN MAIN", occupied: false, occupiedBy: [] },
        B1: { id: "B1", name: "JUNCTION A", occupied: false, occupiedBy: [] },
        B2: { id: "B2", name: "JUNCTION B", occupied: false, occupiedBy: [] }
    };
    railwayState.signals = {
        S1: { id: "S1", state: "green" },
        S2: { id: "S2", state: "green" },
        S3: { id: "S3", state: "green" },
        S4: { id: "S4", state: "green" }
    };

    simBuildTraffic();
    simulationRunning = false;
    railwayState.simulation.running = false;
    railwayState.simulation.speedMultiplier = 10;
    simpleTrafficState.startedAt = Date.now();

    renderStations();
    ensureMapElements();
    ensureRailTrainElements();
    initializeSimulationControls();
    initializeDecisionControls();
    updateTrackOccupancy();
    railwayState.conflicts = detectDynamicConflicts();
    generateConflictDecision();
    updateTopologyVisuals();
    updateAIDecisionUI();
    updateSimpleSimulationClock();
}

window.initializeSimpleRailway = initializeSimpleRailway;
