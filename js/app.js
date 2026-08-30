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

    if (typeof initializeIcons === "function") initializeIcons();

    initializeClock();

    initializeInteractions();

    initializeDataControls();

    initializeSimpleRailway();

    renderTrains();

    initializeMLForecast();

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

    const visibleTrains = getVisibleTrains();

    visibleTrains.forEach(train => {

        const card = createTrainCard(train);

        trainList.appendChild(card);

    });

    if (typeof initializeIcons === "function") initializeIcons();

    const count = document.querySelector(".trains-panel h2 span");
    if (count) count.textContent = `(${visibleTrains.length})`;

    if (!visibleTrains.length) {
        trainList.innerHTML = '<div class="empty-state">No trains match the current filters.</div>';
    }

}

function getVisibleTrains() {
    const query = (document.getElementById("trainSearch")?.value || "").trim().toLowerCase();
    const status = document.getElementById("statusFilter")?.value || "ALL";
    const source = (typeof railwayState !== "undefined" && railwayState.trains && Object.keys(railwayState.trains).length)
        ? Object.values(railwayState.trains).map(t => ({
            number: t.baseNumber || t.number,
            name: t.name,
            route: t.route || (t.direction === "reverse" ? "AGRA → NDLS" : "NDLS → AGRA"),
            delay: Number(t.delay || 0),
            speed: Math.round(Number(t.speed || t.simulationSpeed || 0)),
            nextStop: t.nextStation || "Mathura Jn",
            eta: "—",
            priority: t.priority || "MEDIUM",
            priorityClass: String(t.priority || "MEDIUM").toLowerCase(),
            status: String(t.status || "RUNNING").toUpperCase()
        }))
        : appState.trains;

    return source.filter(train => {
        const matchesQuery = !query || `${train.number} ${train.name}`.toLowerCase().includes(query);
        const trainStatus = train.status || (train.delay > 0 ? "DELAYED" : "RUNNING");
        const matchesStatus = status === "ALL" || trainStatus === status;
        return matchesQuery && matchesStatus;
    });
}

function initializeDataControls() {
    ["trainSearch", "statusFilter"].forEach(id => {
        document.getElementById(id)?.addEventListener("input", renderTrains);
        document.getElementById(id)?.addEventListener("change", renderTrains);
    });

    document.querySelectorAll(".mode-button").forEach(button => {
        button.addEventListener("click", async () => {
            dataIntegration.mode = button.dataset.mode;
            document.querySelectorAll(".mode-button").forEach(item => item.classList.remove("active"));
            button.classList.add("active");

            // The simulation engine owns movement in both modes. Live mode
            // switches the engine to rolling, random arrivals rather than
            // replacing the same trains with a static snapshot.
            window.setTrackMode?.(dataIntegration.mode);

            if (dataIntegration.mode === "LIVE") {
                const health = await checkBackendHealth();
                if (!health.ok) {
                    updateDataStatus("Live backend offline · local live traffic active");
                    showSystemMessage(`Backend unavailable: ${health.error}. Live traffic continues locally and ML fallback remains active.`);
                } else {
                    await refreshData();
                    showSystemMessage("Live mode connected: rolling random traffic + ML decisions active.");
                }
            } else {
                updateDataStatus("Simulation data");
                showSystemMessage("Simulation mode active.");
            }
        });
    });

    document.getElementById("refreshDataButton")?.addEventListener("click", refreshData);
    updateDataStatus("Simulation data");
}

function applyLiveData(payload) {
    if (!payload || !Array.isArray(payload.trains)) return false;

    // In LIVE mode, let the rolling traffic engine own positions and arrivals.
    // Backend data becomes live metadata/seeding input instead of resetting the
    // same six trains every refresh.
    if (dataIntegration.mode === "LIVE" && typeof window.syncLiveFeed === "function") {
        return window.syncLiveFeed(payload) !== false;
    }

    appState.trains = payload.trains.map(train => ({
        ...train,
        priorityClass: train.priorityClass || String(train.priority || "MEDIUM").toLowerCase(),
        status: String(train.status || "RUNNING").toUpperCase()
    }));
    return true;
}

async function refreshData() {
    const refreshButton = document.getElementById("refreshDataButton");
    refreshButton?.classList.add("is-refreshing");

    const result = await requestNormalizedData("railRadar");
    if (!result.ok) {
        updateDataStatus(`Fallback data · ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`);
        showSystemMessage(`Live data unavailable: ${result.reason || "unknown error"}. Continuing with simulation data.`);
    } else if (applyLiveData(result.data)) {
        const timestamp = result.data.updated_at ? new Date(result.data.updated_at) : new Date();
        updateDataStatus(`Live data · ${timestamp.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`);
        appState.system.lastUpdate = timestamp;
        window.reoptimizeTraffic?.("live_data_refresh");
    } else {
        updateDataStatus("Live feed returned invalid data · simulation active");
        showSystemMessage("Live feed connected, but its response format is invalid. Continuing with simulation data.");
    }

    appState.system.lastUpdate = appState.system.lastUpdate || new Date();
    renderTrains();
    refreshButton?.classList.remove("is-refreshing");
    return result;
}

function updateDataStatus(message) {
    const freshness = document.getElementById("dataFreshness");
    const systemText = document.getElementById("systemStatusText");
    if (freshness) freshness.textContent = message;
    if (systemText) systemText.textContent = dataIntegration.mode === "LIVE" ? "Live mode" : "Simulation mode";
}

function initializeMLForecast() {
    if (!window.mlModel || typeof railwayState === "undefined") return;
    checkBackendHealth();
    window.reoptimizeTraffic?.("initial_state");
    setInterval(async () => {
        if (dataIntegration.mode === "LIVE") {
            const health = await checkBackendHealth({ timeout: 1800 });
            if (health.ok) await refreshData();
        }
        window.reoptimizeTraffic?.("periodic_state_update");
    }, 5000);
}


function updateMLForecast() {
    if (!window.mlModel || typeof railwayState === "undefined") return;

    const trains = Object.values(railwayState.trains);
    const express = trains.find(train => train.priority === "HIGH") || trains[0];
    const freight = trains.find(train => train.number !== express?.number) || trains[1];
    if (!express || !freight) return;

    const expressPrediction = mlModel.predictTrain(express, {
        distanceRemaining: Math.max(8, 100 - express.position),
        trackOccupancy: railwayState.tracks.T1?.occupied ? 0.9 : 0.3,
        weatherRisk: 0,
        hour: new Date().getHours()
    });
    const conflictPrediction = mlModel.predictConflict(express, freight, {
        distanceBetween: Math.abs(express.position - freight.position),
        trackOccupancy: railwayState.tracks.T1?.occupied ? 0.9 : 0.3,
        hour: new Date().getHours()
    });
    const status = mlModel.getStatus();

    const predictedDelay = document.getElementById("mlPredictedDelay");
    const conflictRisk = document.getElementById("mlConflictRisk");
    const confidence = document.getElementById("mlConfidence");
    const source = document.getElementById("mlModelSource");
    const note = document.getElementById("mlForecastNote");

    if (predictedDelay) predictedDelay.textContent = `${expressPrediction.predictedDelay} min`;
    if (conflictRisk) {
        conflictRisk.textContent = `${Math.round(conflictPrediction.probability * 100)}%`;
        conflictRisk.className = conflictPrediction.probability >= 0.65 ? "ml-risk-high" : "ml-risk-medium";
    }
    if (confidence) confidence.textContent = `${Math.round(expressPrediction.confidence * 100)}%`;
    if (source) source.textContent = `${status.source} · ${status.records} samples`;
    if (note) note.textContent = `${express.number} forecast from ${expressPrediction.nearestSamples} nearest traffic patterns. Controller approval remains required.`;
}

function applyBackendForecast(result) {
    const predictions = result?.predictions || [];
    const firstPrediction = predictions[0];
    const secondPrediction = predictions[1];
    if (!firstPrediction) return;

    const predictedDelay = document.getElementById("mlPredictedDelay");
    const conflictRisk = document.getElementById("mlConflictRisk");
    const confidence = document.getElementById("mlConfidence");
    const source = document.getElementById("mlModelSource");
    const note = document.getElementById("mlForecastNote");
    const risk = Number(secondPrediction?.conflict_probability || firstPrediction.conflict_probability || 0);

    if (predictedDelay) predictedDelay.textContent = `${firstPrediction.predicted_delay_minutes} min`;
    if (conflictRisk) {
        conflictRisk.textContent = `${Math.round(risk * 100)}%`;
        conflictRisk.className = risk >= 0.65 ? "ml-risk-high" : "ml-risk-medium";
    }
    if (confidence) confidence.textContent = `${Math.round(Number(firstPrediction.confidence || 0) * 100)}%`;
    if (source) source.textContent = "Python Random Forest · live service";
    if (note) note.textContent = `${predictions.length} trains re-evaluated after ${result.trigger || "state change"}. Controller approval remains required.`;

    const rec = result?.recommendation;
    if (rec?.proceed_train && typeof railwayState !== "undefined") {
        const proceed = railwayState.trains[rec.proceed_train];
        const hold = railwayState.trains[rec.hold_train];
        if (proceed && hold) {
            const isSlow = rec.action === "SLOW_AND_PROCEED" || Boolean(rec.slow_train);
            activeDecision = {
                type: isSlow ? "SLOW_AND_PROCEED" : (rec.alternate_track ? "REROUTE_AND_HOLD" : "HOLD_TRAIN"),
                action: isSlow ? "SLOW_AND_PROCEED" : "PROCEED_AND_HOLD",
                proceedTrain: rec.proceed_train,
                holdTrain: rec.hold_train,
                slowTrain: rec.slow_train || (isSlow ? rec.hold_train : null),
                targetSpeedKmh: Number(rec.target_speed_kmh || rec.slow_speed_kmh || 0) || null,
                durationSeconds: Number(rec.duration_seconds || 4),
                alternateTrack: rec.alternate_track || null,
                estimatedHold: Math.max(2, Number(rec.hold_minutes || 3)),
                holdStation: hold.nextStation || "MTJ",
                conflict: { trainA: rec.proceed_train, trainB: rec.hold_train, severity: "AI", timeToConflict: Number(rec.time_to_conflict || 3) },
                status: "PENDING"
            };
            updateAIDecisionUI();
        }
    }
}

window.reoptimizeTraffic = async function (trigger = "state_change") {
    if (typeof railwayState === "undefined") return;

    const trains = Object.values(railwayState.trains).map(train => ({
        number: train.number,
        priority: train.priority,
        delay_minutes: Number(train.delay) || 0,
        speed_kmh: Number(train.speed) || 0,
        distance_remaining_km: Math.max(1, 100 - (Number(train.position) || 0)),
        track_occupancy: railwayState.tracks?.[train.track]?.occupied ? 0.9 : 0.3,
        track: train.track,
        direction: train.direction,
        position: Number(train.position) || 0,
        priority_score: { HIGH: 1, MEDIUM: 0.6, LOW: 0.25 }[train.priority] || 0.6,
        weather_risk: 0,
        hour: new Date().getHours()
    }));

    const endpoint = dataIntegration.endpoints.machineLearning;
    if (!endpoint) {
        updateMLForecast();
        return { ok: true, source: "browser-fallback", trigger };
    }

    try {
        const response = await fetch(`${endpoint.replace(/\/$/, "")}/reoptimize`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ trigger, trains })
        });
        if (!response.ok) throw new Error(`ML service returned ${response.status}`);
        const result = await response.json();
        if (!result.ok) throw new Error(result.error || "ML service returned an invalid response");
        applyBackendForecast(result);
        return result;
    } catch (error) {
        updateMLForecast();
        showSystemMessage("ML service unavailable. Browser fallback remains active.");
        return { ok: false, source: "browser-fallback", error: error.message };
    }
};


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
            button.addEventListener("click", () => {
                document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
                button.classList.add("active");
                const page = button.dataset.nav || "dashboard";
                const historyPanel = document.getElementById("historyPanel");
                const utilityPanel = document.getElementById("utilityPagePanel");
                if (historyPanel) historyPanel.hidden = page !== "history";
                if (page === "history") {
                    if (typeof window.renderDepartureLogs === "function") window.renderDepartureLogs();
                    historyPanel?.scrollIntoView({ behavior: "smooth", block: "start" });
                    return;
                }
                if (["trains","section","schedule","disruptions","reports"].includes(page)) {
                    window.renderUtilityPage?.(page);
                    utilityPanel?.scrollIntoView({ behavior: "smooth", block: "start" });
                    return;
                }
                if (utilityPanel) utilityPanel.hidden = true;
                const target = page === "trains" ? document.querySelector('.trains-panel') : document.querySelector('.section-panel');
                if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
            });
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


setInterval(() => {
    // The simulation engine updates traffic. Do not mutate live trains here;
    // doing so would fight the rolling live simulation.
    if (dataIntegration.mode === "SIMULATION") renderTrains();
}, 10000);