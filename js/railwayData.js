const dataIntegration = {
    mode: "SIMULATION",
    backend: { connected: false, lastCheck: null },
    endpoints: {
        railRadar: window.LIVE_DATA_URL || "http://127.0.0.1:5000/live-data",
        governmentTimetable: "",
        weather: "",
        machineLearning: window.ML_SERVICE_URL || "http://127.0.0.1:5000"
    },
    apiKeys: {
        railRadar: window.LIVE_DATA_URL || "http://127.0.0.1:5000/live-data",
        governmentTimetable: "",
        weather: ""
    },
    lastSuccessfulUpdate: null,
    lastError: null
};

async function requestNormalizedData(source, options = {}) {
    const endpoint = dataIntegration.endpoints[source];

    if (!endpoint) {
        return { ok: false, fallback: true, reason: "Endpoint not configured" };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeout || 8000);

    try {
        const response = await fetch(endpoint, {
            signal: controller.signal,
            headers: { Accept: "application/json" }
        });

        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }

        dataIntegration.lastSuccessfulUpdate = new Date();
        dataIntegration.lastError = null;
        return { ok: true, data: await response.json() };
    } catch (error) {
        dataIntegration.lastError = error.message;
        return { ok: false, fallback: true, reason: error.message };
    } finally {
        clearTimeout(timeout);
    }
}

async function checkBackendHealth(options = {}) {
    const endpoint = dataIntegration.endpoints.machineLearning;
    if (!endpoint) return { ok: false, error: "Backend endpoint is not configured" };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeout || 2500);
    try {
        const response = await fetch(`${endpoint.replace(/\/$/, "")}/health`, { signal: controller.signal, headers: { Accept: "application/json" } });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || !body.ok) throw new Error(body.error || `Health check failed (${response.status})`);
        dataIntegration.backend.connected = true;
        dataIntegration.backend.lastCheck = new Date();
        dataIntegration.lastError = null;
        return body;
    } catch (error) {
        dataIntegration.backend.connected = false;
        dataIntegration.backend.lastCheck = new Date();
        dataIntegration.lastError = error.message;
        return { ok: false, error: error.message };
    } finally { clearTimeout(timeout); }
}

const railwayState = {
    stations: {
        NDLS: { code: "NDLS", name: "New Delhi", platforms: 16, x: 7 },
        MTJ:  { code: "MTJ",  name: "Mathura Jn", platforms: 5,  x: 50 },
        AGC:  { code: "AGC",  name: "Agra Cantt.", platforms: 6,  x: 93 }
    },

    topology: {
        sections: {
            T1: { id:"T1", name:"Up Main", from:"NDLS", to:"AGC", direction:"forward", speedLimit:120 },
            T2: { id:"T2", name:"Down Main", from:"AGC", to:"NDLS", direction:"reverse", speedLimit:120 },
            T3: { id:"T3", name:"Loop / Overtake", from:"NDLS", to:"AGC", direction:"forward", speedLimit:80 },
            T4: { id:"T4", name:"Loop / Return", from:"AGC", to:"NDLS", direction:"reverse", speedLimit:80 }
        },
        stations: ["NDLS","MTJ","AGC"],
        crossovers: [
            { id:"X1", station:"MTJ", from:"T1", to:"T3" },
            { id:"X2", station:"MTJ", from:"T3", to:"T1" },
            { id:"X3", station:"MTJ", from:"T2", to:"T4" },
            { id:"X4", station:"MTJ", from:"T4", to:"T2" }
        ],
        blocks: {
            "T1-NM": { track:"T1", from:0, to:50 },
            "T1-MA": { track:"T1", from:50, to:100 },
            "T2-AM": { track:"T2", from:0, to:50 },
            "T2-MN": { track:"T2", from:50, to:100 },
            "T3-NM": { track:"T3", from:0, to:50 },
            "T3-MA": { track:"T3", from:50, to:100 },
            "T4-AM": { track:"T4", from:0, to:50 },
            "T4-MN": { track:"T4", from:50, to:100 }
        }
    },

    tracks: {
        T1: { id:"T1", status:"free", occupiedBy:[], occupied:false },
        T2: { id:"T2", status:"free", occupiedBy:[], occupied:false },
        T3: { id:"T3", status:"free", occupiedBy:[], occupied:false },
        T4: { id:"T4", status:"free", occupiedBy:[], occupied:false }
    },

    trains: {
        "12951": { number:"12951", name:"Rajdhani Express", type:"Express", priority:"HIGH", currentStation:"NDLS", nextStation:"MTJ", speed:82, delay:12, track:"T1", direction:"forward", status:"RUNNING", position:24, simulationSpeed:82, heldUntil:0 },
        "54821": { number:"54821", name:"Freight", type:"Freight", priority:"LOW", currentStation:"MTJ", nextStation:"AGC", speed:45, delay:3, track:"T1", direction:"forward", status:"RUNNING", position:61, simulationSpeed:45, heldUntil:0 },
        "12007": { number:"12007", name:"Shatabdi Express", type:"Express", priority:"HIGH", currentStation:"NDLS", nextStation:"MTJ", speed:78, delay:8, track:"T2", direction:"reverse", status:"RUNNING", position:37, simulationSpeed:78, heldUntil:0 },
        "64315": { number:"64315", name:"Passenger", type:"Passenger", priority:"MEDIUM", currentStation:"MTJ", nextStation:"NDLS", speed:55, delay:2, track:"T2", direction:"reverse", status:"RUNNING", position:70, simulationSpeed:55, heldUntil:0 },
        "12424": { number:"12424", name:"Dibrugarh Rajdhani", type:"Express", priority:"HIGH", currentStation:"AGC", nextStation:"MTJ", speed:78, delay:5, track:"T3", direction:"reverse", status:"RUNNING", position:82, simulationSpeed:78, heldUntil:0 },
        "12138": { number:"12138", name:"Punjab Mail", type:"Express", priority:"MEDIUM", currentStation:"NDLS", nextStation:"MTJ", speed:65, delay:4, track:"T3", direction:"forward", status:"RUNNING", position:18, simulationSpeed:65, heldUntil:0 }
    },

    signals: {
        S1:{id:"S1", state:"green"}, S2:{id:"S2", state:"red"}, S3:{id:"S3", state:"green"}, S4:{id:"S4", state:"yellow"}
    },
    conflicts: [],
    lastRecommendation: null,
    simulation: { running:true, speedMultiplier:10 }
};
