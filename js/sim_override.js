/*
 * TrackMyRail – final simple traffic engine
 *
 * Goals:
 * - 2–4 trains active at any time
 * - balanced traffic on both main tracks
 * - frequent, calculated junction/following conflicts
 * - trains enter from outside the section and permanently leave it
 * - no two trains may overlap on the same physical route/junction
 * - AI can HOLD or SLOW a train instead of always stopping it
 * - Simulation mode is paused by default
 * - Live mode uses the same random traffic engine, seeded/updated by backend data
 */
(function () {
  'use strict';

  const MAX_TRAINS = 6;
  const MIN_TRAINS = 3;
  const DEFAULT_SPEED = 10;
  const SAFE_GAP = 10;            // visual units on a main track
  const JUNCTION_GAP = 18;
  const SPAWN_MIN = 1.6;
  const SPAWN_MAX = 3.6;

  const MAP = {
    upperY: 36,
    lowerY: 66,
    j1X: 68,
    j2X: 32,
    left: 4,
    right: 96
  };

  const TRAIN_TEMPLATES = [
    { number:'12951', name:'Rajdhani Express', type:'Express', priority:'HIGH', speed:82 },
    { number:'54821', name:'Freight', type:'Freight', priority:'LOW', speed:46 },
    { number:'12007', name:'Shatabdi Express', type:'Express', priority:'HIGH', speed:80 },
    { number:'64315', name:'Passenger', type:'Passenger', priority:'MEDIUM', speed:55 },
    { number:'12424', name:'Dibrugarh Rajdhani', type:'Express', priority:'HIGH', speed:78 },
    { number:'12138', name:'Punjab Mail', type:'Express', priority:'MEDIUM', speed:65 }
  ];

  let running = false;
  let liveMode = false;
  let frame = null;
  let lastTs = 0;
  let spawnClock = 0;
  let nextSpawn = 3.8;
  let completed = 0;
  let rng = (Date.now() ^ 0x85ebca6b) >>> 0;
  let initialized = false;
  let activeDecision = null;
  let lastDecisionKey = '';
  let resolvedDecisionKey = '';
  let previewTimer = null;
  let liveSeeded = false;
  let pendingLivePayload = null;
  let scheduledEntries = [];
  let departureLogs = [];
  let selectedWhatIf = 'AI_RECOMMENDED';
  let conflictSlowdownActive = false;
  let preConflictSpeed = DEFAULT_SPEED;
  let requestedSpeedMultiplier = DEFAULT_SPEED;

  const railway = () => (typeof railwayState !== 'undefined' ? railwayState : null);
  const app = () => window.appState || null;

  function safeUiCall(name, ...args) {
    try {
      const fn = window[name];
      return typeof fn === 'function' ? fn(...args) : undefined;
    } catch (_) {
      return undefined;
    }
  }

  window.safeUiCall = safeUiCall;

  function random() {
    rng ^= rng << 13;
    rng ^= rng >>> 17;
    rng ^= rng << 5;
    rng >>>= 0;
    return rng / 4294967296;
  }

  function pick(list) {
    return list[Math.floor(random() * list.length)];
  }

  function weightedTrack() {
    const r = random();
    if (r < 0.34) return 'T1';
    if (r < 0.68) return 'T2';
    if (r < 0.83) return 'B1';
    return 'B2';
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function setConflictSlowdown(active) {
    const s = railway();
    if (!s?.simulation) return;
    if (active) {
      if (!conflictSlowdownActive) {
        preConflictSpeed = Number(s.simulation.speedMultiplier || requestedSpeedMultiplier || DEFAULT_SPEED);
        conflictSlowdownActive = true;
      }
      s.simulation.speedMultiplier = 0.5;
      s.simulation.autoSlowedForConflict = true;
    } else if (conflictSlowdownActive) {
      conflictSlowdownActive = false;
      s.simulation.speedMultiplier = Number(requestedSpeedMultiplier || preConflictSpeed || DEFAULT_SPEED);
      s.simulation.autoSlowedForConflict = false;
    }
    document.querySelectorAll('.speed-button').forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.speed) === Number(s.simulation.speedMultiplier));
      btn.classList.toggle('auto-conflict-speed', Boolean(s.simulation.autoSlowedForConflict) && Number(btn.dataset.speed) === 0.5);
    });
    const label = document.querySelector('.simulation-speed .speed-auto-note');
    if (label) label.textContent = active ? 'AUTO-SLOW' : '';
  }

  function trains() {
    const s = railway();
    if (!s) return [];
    if (!s.trains || Array.isArray(s.trains)) {
      const source = Array.isArray(s.trains) ? s.trains : [];
      s.trains = Object.fromEntries(source.map(t => [String(t.number || t.id), t]));
    }
    return Object.values(s.trains);
  }

  function trainMap() {
    const s = railway();
    if (!s) return {};
    if (!s.trains || Array.isArray(s.trains)) {
      const source = Array.isArray(s.trains) ? s.trains : [];
      s.trains = Object.fromEntries(source.map(t => [String(t.number || t.id), t]));
    }
    return s.trains;
  }

  function priorityScore(t) {
    const p = { HIGH:3, MEDIUM:2, LOW:1 }[String(t?.priority || 'MEDIUM').toUpperCase()] || 1;
    return p * 40 + Number(t?.delay || 0) * 4 + Number(t?.predictedDelay || 0);
  }

  function nominalSpeed(t) {
    return Math.max(25, Number(t?.speed || t?.simulationSpeed || 55));
  }

  function baseNumber(t) {
    return String(t?.baseNumber || t?.number || '').split('-')[0];
  }

  function createTrain(track, position, template = null) {
    const tpl = template || pick(TRAIN_TEMPLATES);
    const reverse = track === 'T2' || track === 'B2';
    return {
      number: String(tpl.number),
      baseNumber: String(tpl.number),
      id: tpl.number,
      name: tpl.name,
      type: tpl.type,
      priority: tpl.priority,
      priorityClass: String(tpl.priority).toLowerCase(),
      route: reverse ? 'NDLS ← AGRA' : 'NDLS → AGRA',
      currentStation: reverse ? 'AGC' : 'NDLS',
      nextStation: 'MTJ',
      delay: Math.floor(random() * 8),
      predictedDelay: Math.floor(random() * 6),
      speed: tpl.speed,
      simulationSpeed: tpl.speed,
      cruiseSpeed: tpl.speed,
      targetSpeed: tpl.speed,
      slowUntil: 0,
      heldUntil: 0,
      track,
      direction: reverse ? 'reverse' : 'forward',
      position,
      status: 'RUNNING',
      aiState: '',
      spawnedAt: Date.now()
    };
  }

  function routePoint(t) {
    const p = clamp(Number(t.position || 0), -20, 120);
    const u = p / 100;

    if (t.track === 'T1') {
      return { x: MAP.left + (MAP.right - MAP.left) * u, y: MAP.upperY };
    }
    if (t.track === 'T2') {
      return { x: MAP.right - (MAP.right - MAP.left) * u, y: MAP.lowerY };
    }

    if (t.track === 'B1') {
      const bx = MAP.j1X + 10;
      const by = 8;
      const jx = MAP.j1X;
      const jy = MAP.upperY;
      const s = clamp(u, -0.2, 1.2);
      return {
        x: bx + (jx - bx) * s,
        y: by + (jy - by) * s - 4.0 * Math.sin(Math.PI * clamp(s, 0, 1))
      };
    }

    const bx = MAP.j2X - 10;
    const by = 92;
    const jx = MAP.j2X;
    const jy = MAP.lowerY;
    const s = clamp(u, -0.2, 1.2);
    return {
      x: bx + (jx - bx) * s,
      y: by + (jy - by) * s + 4.0 * Math.sin(Math.PI * clamp(s, 0, 1))
    };
  }

  function joinPosition(track) {
    if (track === 'T1') return ((MAP.j1X - MAP.left) / (MAP.right - MAP.left)) * 100;
    return ((MAP.right - MAP.j2X) / (MAP.right - MAP.left)) * 100;
  }

  function branchJoin(track) {
    return track === 'B1' ? joinPosition('T1') : joinPosition('T2');
  }

  function distanceToJoin(t) {
    if (t.track === 'B1') return Math.max(0, 100 - Number(t.position));
    if (t.track === 'B2') return Math.max(0, Number(t.position) - 100);
    if (t.track === 'T1') return Math.abs(Number(t.position) - joinPosition('T1'));
    if (t.track === 'T2') return Math.abs(Number(t.position) - joinPosition('T2'));
    return 999;
  }

  function sameTrackDistance(a, b) {
    return Math.abs(Number(a.position) - Number(b.position));
  }

  function aheadOf(a, b) {
    if (a.direction === 'forward') return Number(b.position) > Number(a.position);
    return Number(b.position) < Number(a.position);
  }

  function safeSpawn(candidate) {
    return !trains().some(other => {
      if (other.track === candidate.track) {
        return sameTrackDistance(other, candidate) < 18;
      }
      if ((candidate.track === 'B1' && other.track === 'T1') || (candidate.track === 'T1' && other.track === 'B1')) {
        return distanceToJoin(candidate) < 30 && distanceToJoin(other) < 18;
      }
      if ((candidate.track === 'B2' && other.track === 'T2') || (candidate.track === 'T2' && other.track === 'B2')) {
        return distanceToJoin(candidate) < 30 && distanceToJoin(other) < 18;
      }
      return false;
    });
  }

  function activeBaseNumbers() {
    return new Set(trains().map(t => baseNumber(t)));
  }

  function reservedBaseNumbers() {
    return new Set(scheduledEntries.map(entry => baseNumber(entry.train)));
  }

  function pickAvailableTemplate(preferred = null) {
    const used = new Set([...activeBaseNumbers(), ...reservedBaseNumbers()]);
    if (preferred && !used.has(String(preferred.number))) return preferred;
    const available = TRAIN_TEMPLATES.filter(t => !used.has(String(t.number)));
    return pick(available.length ? available : TRAIN_TEMPLATES);
  }

  function logDeparture(train, reason = 'Completed section') {
    departureLogs.unshift({
      number: baseNumber(train),
      name: train.name,
      route: train.route,
      priority: train.priority,
      delay: Math.round(Number(train.delay || 0)),
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      reason
    });
    departureLogs = departureLogs.slice(0, 7);
    renderDepartureLogs();
  }

  function addTrain(track, position, template = null) {
    const tpl = pickAvailableTemplate(template);
    if (activeBaseNumbers().has(String(tpl.number))) return false;
    const t = createTrain(track, position, tpl);
    if (!safeSpawn(t)) return false;
    trainMap()[t.number] = t;
    return true;
  }

  function resetTraffic(source = 'SIMULATION') {
    const s = railway();
    if (!s) return;
    s.trains = {};
    completed = 0;
    spawnClock = 0;
    nextSpawn = 3.2 + random() * 1.8;
    activeDecision = null;
    lastDecisionKey = '';
    resolvedDecisionKey = '';
    scheduledEntries = [];
    departureLogs = [];
    selectedWhatIf = 'AI_RECOMMENDED';

    // Deliberately conflict-prone traffic plan for demos: close following pairs
    // plus simultaneous junction approaches on both main lines. Entries still
    // arrive from the correct ends with staggered timing.
    const plan = [
      { delay: 0.0, track: 'T1', position: 14 },
      { delay: 1.2 + random() * 0.6, track: 'T1', position: 34 },
      { delay: 2.4 + random() * 0.5, track: 'T2', position: 84 },
      { delay: 3.4 + random() * 0.6, track: 'B2', position: 108 },
      { delay: 4.8 + random() * 0.8, track: 'B1', position: 90 },
      { delay: 6.0 + random() * 0.8, track: 'T2', position: 101 }
    ];

    const initialCount = Math.min(MAX_TRAINS, 4 + (random() < 0.68 ? 1 : 0) + (random() < 0.52 ? 1 : 0));
    plan.slice(0, initialCount).forEach(entry => {
      const tpl = pickAvailableTemplate();
      const direction = entry.track === 'T2' || entry.track === 'B2' ? 'reverse' : 'forward';
      const train = createTrain(entry.track, entry.position, tpl);
      train.direction = direction;
      train.spawnAt = Date.now() + Math.round(entry.delay * 1000);
      train.status = entry.delay > 0 ? 'INBOUND' : 'RUNNING';
      train.visible = entry.delay <= 0;
      scheduledEntries.push({ train, readyAt: train.spawnAt });
    });

    // Make the first train visible immediately; the others enter from the edges later.
    releaseScheduledEntries(true);

    liveSeeded = source === 'LIVE';
    s.conflicts = detectConflicts();
    s.lastRecommendation = null;
    renderDepartureLogs();
    syncSidebar();
    updateMetrics();
    updateWhatIfAnalysis();
  }

  function releaseScheduledEntries(forceFirst = false) {
    const now = Date.now();
    if (!scheduledEntries.length) return;
    const ready = scheduledEntries.filter(entry => forceFirst ? entry.readyAt <= now || !trains().length : entry.readyAt <= now);
    ready.forEach(entry => {
      if (trains().length >= MAX_TRAINS) return;
      const t = entry.train;
      t.status = 'RUNNING';
      t.visible = true;
      t.spawnedAt = now;
      if (!safeSpawn(t)) return;
      if (!trainMap()[t.number]) trainMap()[t.number] = t;
      scheduledEntries = scheduledEntries.filter(item => item !== entry);
    });
  }

  function spawnReplacement() {
    if (trains().length + scheduledEntries.length >= MAX_TRAINS) return false;
    const candidates = [
      ['T1', -10 - random() * 2],
      ['T1', -6 - random() * 2],
      ['T2', 110 + random() * 2],
      ['T2', 106 + random() * 2],
      ['B1', 106 + random() * 2],
      ['B2', 110 + random() * 2]
    ];
    for (let i = 0; i < candidates.length * 2; i++) {
      const [track, pos] = candidates[Math.floor(random() * candidates.length)];
      const tpl = pickAvailableTemplate();
      const train = createTrain(track, pos, tpl);
      train.spawnAt = Date.now() + Math.round((1.5 + random() * 2.8) * 1000);
      train.status = 'INBOUND';
      train.visible = false;
      scheduledEntries.push({ train, readyAt: train.spawnAt });
      return true;
    }
    return false;
  }

  function completeTrain(t) {
    delete trainMap()[t.number];
    completed += 1;
    logDeparture(t, 'Departed section');
    activeDecision = activeDecision && [activeDecision.proceedTrain, activeDecision.holdTrain].includes(t.number) ? null : activeDecision;
    lastDecisionKey = '';
    resolvedDecisionKey = '';
    // Keep the section populated without respawning the same train number.
    while (trains().length + scheduledEntries.length < MIN_TRAINS) spawnReplacement();
  }

  function releaseTemporaryControls() {
    const now = Date.now();
    trains().forEach(t => {
      if (t.status === 'HOLD' && t.heldUntil && now >= t.heldUntil) {
        t.status = 'RUNNING';
        t.heldUntil = 0;
        t.simulationSpeed = t.cruiseSpeed || t.speed;
        t.targetSpeed = t.cruiseSpeed || t.speed;
        t.aiState = '';
      }
      if (t.aiState === 'SLOW' && t.slowUntil && now >= t.slowUntil) {
        t.aiState = '';
        t.slowUntil = 0;
        t.targetSpeed = t.cruiseSpeed || t.speed;
        t.simulationSpeed = t.cruiseSpeed || t.speed;
      }
    });
  }

  function junctionConflict(a, b) {
    if ((a.track === 'B1' && b.track === 'T1') || (a.track === 'T1' && b.track === 'B1')) {
      return distanceToJoin(a) < JUNCTION_GAP + 8 && distanceToJoin(b) < JUNCTION_GAP + 8;
    }
    if ((a.track === 'B2' && b.track === 'T2') || (a.track === 'T2' && b.track === 'B2')) {
      return distanceToJoin(a) < JUNCTION_GAP + 8 && distanceToJoin(b) < JUNCTION_GAP + 8;
    }
    return false;
  }

  function detectConflicts() {
    const all = trains();
    const conflicts = [];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        let kind = null;
        let distance = 999;

        if (a.track === b.track) {
          const gap = sameTrackDistance(a, b);
          distance = gap;
          if (a.direction === b.direction && gap < 24) {
            kind = 'FOLLOWING';
          } else if (a.direction !== b.direction && gap < 38) {
            kind = 'HEAD_ON';
          }
        } else if (junctionConflict(a, b)) {
          kind = 'JUNCTION';
          distance = Math.max(distanceToJoin(a), distanceToJoin(b));
        }

        if (kind) {
          conflicts.push({
            trainA: a.number,
            trainB: b.number,
            track: kind === 'JUNCTION' ? (a.track === 'B1' || b.track === 'B1' ? 'J1' : 'J2') : a.track,
            kind,
            distance,
            severity: kind === 'HEAD_ON' ? 'HIGH' : 'MEDIUM',
            timeToConflict: Math.max(0.5, Math.min(12, distance / 4.5))
          });
        }
      }
    }
    return conflicts.sort((a, b) => a.distance - b.distance);
  }

  function localDecision(conflict) {
    const a = trainMap()[conflict.trainA];
    const b = trainMap()[conflict.trainB];
    if (!a || !b) return null;

    let proceed = a;
    let secondary = b;
    let slowTrain = null;

    if (conflict.kind === 'FOLLOWING') {
      const lead = aheadOf(a, b) ? b : a;
      const trail = lead === a ? b : a;
      proceed = lead;
      secondary = trail;
      slowTrain = trail;
    } else {
      if (priorityScore(b) > priorityScore(a)) {
        proceed = b;
        secondary = a;
      }
      // Prefer slowing rather than stopping when there is enough room.
      const gap = Number(conflict.distance || 0);
      const speedGap = Math.abs(nominalSpeed(proceed) - nominalSpeed(secondary));
      if (gap > 9 && (conflict.kind === 'JUNCTION' || speedGap < 24)) {
        slowTrain = priorityScore(proceed) >= priorityScore(secondary) ? secondary : proceed;
      }
    }

    if (conflict.kind === 'HEAD_ON' || Number(conflict.distance) < 8) slowTrain = null;

    const action = slowTrain ? 'SLOW_AND_PROCEED' : 'PROCEED_AND_HOLD';
    const slowSpeed = slowTrain ? Math.max(24, Math.round(Math.min(nominalSpeed(slowTrain) * 0.58, nominalSpeed(proceed) * 0.78))) : null;

    return {
      action,
      proceedTrain: proceed.number,
      holdTrain: secondary.number,
      slowTrain: slowTrain?.number || null,
      targetSpeedKmh: slowSpeed,
      durationSeconds: slowTrain ? Math.max(3, Math.min(7, Math.round(5 + random() * 2))) : Math.max(2, Math.min(6, Math.round(conflict.timeToConflict + 1))),
      estimatedHold: Math.max(2, Math.min(6, Math.round(conflict.timeToConflict + 1))),
      confidence: 0.78 + random() * 0.18,
      source: 'LOCAL_AI',
      status: 'PENDING',
      conflict
    };
  }

  function generateDecision() {
    const s = railway();
    if (!s) return null;
    const conflicts = detectConflicts();
    s.conflicts = conflicts;
    const conflict = conflicts[0];

    if (!conflict) {
      activeDecision = null;
      s.lastRecommendation = null;
      setConflictSlowdown(false);
      updateDecisionPanel();
      return null;
    }

    const key = `${conflict.kind}|${conflict.trainA}|${conflict.trainB}`;
    if (resolvedDecisionKey === key && activeDecision && activeDecision.status !== 'PENDING') {
      updateDecisionPanel();
      return activeDecision;
    }
    if (!activeDecision || activeDecision.status !== 'PENDING' || key !== lastDecisionKey || !trainMap()[activeDecision.proceedTrain] || !trainMap()[activeDecision.holdTrain]) {
      activeDecision = localDecision(conflict);
      lastDecisionKey = key;
      s.lastRecommendation = activeDecision;
      requestBackendDecision(conflict);
    }
    if (activeDecision?.status === 'PENDING') setConflictSlowdown(true);
    updateDecisionPanel();
    return activeDecision;
  }

  async function requestBackendDecision(conflict) {
    if (typeof window.reoptimizeTraffic !== 'function') return;
    try {
      const response = await window.reoptimizeTraffic('junction_conflict');
      const rec = response?.recommendation;
      if (!rec?.proceed_train) return;
      if (!trainMap()[rec.proceed_train]) return;
      if (rec.hold_train && !trainMap()[rec.hold_train]) return;

      const hold = rec.hold_train || (rec.proceed_train === conflict.trainA ? conflict.trainB : conflict.trainA);
      const isSlow = rec.action === 'SLOW_AND_PROCEED' || Boolean(rec.slow_train);
      activeDecision = {
        ...(activeDecision || localDecision(conflict)),
        action: isSlow ? 'SLOW_AND_PROCEED' : 'PROCEED_AND_HOLD',
        proceedTrain: rec.proceed_train,
        holdTrain: hold,
        slowTrain: rec.slow_train || (isSlow ? hold : null),
        targetSpeedKmh: Number(rec.target_speed_kmh || rec.slow_speed_kmh || activeDecision?.targetSpeedKmh || 0) || null,
        durationSeconds: Number(rec.duration_seconds || activeDecision?.durationSeconds || 4),
        estimatedHold: Number(rec.hold_minutes || activeDecision?.estimatedHold || 3),
        confidence: Number(response?.predictions?.[0]?.confidence || activeDecision?.confidence || 0.84),
        source: response?.prediction_source || 'BACKEND_ML',
        conflict,
        status: 'PENDING'
      };
      const s = railway();
      if (s) s.lastRecommendation = activeDecision;
      updateDecisionPanel();
      drawTrains();
    } catch (_) {
      // Browser AI remains active when backend/ML is unavailable.
    }
  }

  function applyDecision(decision, mode = 'accept') {
    if (!decision) return false;
    const proceed = trainMap()[decision.proceedTrain];
    const secondary = trainMap()[decision.holdTrain];
    if (!proceed || !secondary) return false;

    proceed.status = 'RUNNING';
    proceed.simulationSpeed = proceed.cruiseSpeed || proceed.speed;
    proceed.targetSpeed = proceed.cruiseSpeed || proceed.speed;
    proceed.heldUntil = 0;
    if (decision.action === 'SLOW_AND_PROCEED' && decision.slowTrain && trainMap()[decision.slowTrain]) {
      const slow = trainMap()[decision.slowTrain];
      slow.status = 'RUNNING';
      slow.aiState = 'SLOW';
      slow.targetSpeed = Number(decision.targetSpeedKmh || Math.max(24, Math.round(nominalSpeed(slow) * 0.58)));
      slow.simulationSpeed = slow.targetSpeed;
      slow.slowUntil = Date.now() + Number(decision.durationSeconds || 4) * 1000;
    } else if (mode === 'override') {
      secondary.status = 'RUNNING';
      secondary.aiState = 'OVERRIDE';
      secondary.simulationSpeed = secondary.cruiseSpeed || secondary.speed;
      secondary.targetSpeed = secondary.cruiseSpeed || secondary.speed;
      secondary.heldUntil = 0;
    } else {
      secondary.status = 'HOLD';
      secondary.aiState = 'HOLD';
      secondary.simulationSpeed = 0;
      secondary.heldUntil = Date.now() + Number(decision.durationSeconds || decision.estimatedHold || 3) * 1000;
    }

    activeDecision = { ...decision, status: mode === 'override' ? 'OVERRIDDEN' : mode === 'simulate' ? 'SIMULATED' : 'ACCEPTED' };
    resolvedDecisionKey = mode === 'simulate' ? '' : lastDecisionKey;
    setConflictSlowdown(false);
    const s = railway();
    if (s) {
      s.lastRecommendation = activeDecision;
      s.conflicts = detectConflicts();
    }
    updateDecisionPanel();
    drawTrains();
    syncSidebar();
    safeUiCall('showSystemMessage', decision.action === 'SLOW_AND_PROCEED'
      ? `AI applied: ${baseNumber(trainMap()[decision.slowTrain])} reduced to ${decision.targetSpeedKmh} km/h.`
      : `AI accepted: ${baseNumber(proceed)} passes first.`);
    return true;
  }

  function acceptDecision() {
    const d = activeDecision || generateDecision();
    if (!d) return safeUiCall('showSystemMessage', 'No active AI conflict.');
    applyDecision(d, 'accept');
  }

  function simulateDecision() {
    const d = activeDecision || generateDecision();
    if (!d || previewTimer) return;
    const snapshot = JSON.parse(JSON.stringify(trainMap()));
    applyDecision(d, 'simulate');
    previewTimer = setTimeout(() => {
      const s = railway();
      s.trains = JSON.parse(JSON.stringify(snapshot));
      activeDecision = null;
      lastDecisionKey = '';
      generateDecision();
      drawTrains();
      syncSidebar();
      previewTimer = null;
      safeUiCall('showSystemMessage', 'AI preview cleared.');
    }, 2500);
  }

  function overrideDecision() {
    const d = activeDecision || generateDecision();
    if (!d) return;
    applyDecision(d, 'override');
  }

  function safetyLimitedMovement(train, rawMovement) {
    const all = trains();
    let allowed = Math.max(0, rawMovement);
    const current = Number(train.position);
    const direction = train.direction === 'forward' ? 1 : -1;

    // Same-track block protection. This is the hard safety layer: AI can
    // slow/hold trains, but the physics engine will never let them overlap.
    const same = all
      .filter(other => other.number !== train.number && other.track === train.track && aheadOf(train, other))
      .map(other => ({ other, gap: Math.abs(Number(other.position) - current) }))
      .filter(item => item.gap >= 0)
      .sort((a, b) => a.gap - b.gap)[0];

    if (same) {
      const gapAvailable = same.gap - SAFE_GAP;
      if (gapAvailable <= 0) return 0;
      allowed = Math.min(allowed, gapAvailable);
    }

    // A branch must never enter an occupied junction.
    if (train.track === 'B1' || train.track === 'B2') {
      const join = branchJoin(train.track);
      if (Number(train.position) + direction * allowed >= join - 2) {
        const mainTrack = train.track === 'B1' ? 'T1' : 'T2';
        const blocker = all.find(other => other.track === mainTrack && distanceToJoin(other) < 14);
        if (blocker) allowed = Math.max(0, (join - Number(train.position) - 3) * direction);
      }
    }

    // Mainline train approaching a branch conflict must also respect the
    // reserved junction, unless this train is the accepted AI priority train.
    const pending = activeDecision;
    if (pending && pending.status === 'PENDING') {
      const belongs = pending.proceedTrain === train.number;
      const conflicting = pending.conflict && [pending.conflict.trainA, pending.conflict.trainB].includes(train.number);
      if (conflicting && !belongs && (train.track === 'T1' || train.track === 'T2')) {
        const join = joinPosition(train.track);
        const distance = Math.abs(Number(train.position) - join);
        if (distance < 10 && !(pending.action === 'SLOW_AND_PROCEED' && pending.slowTrain === train.number)) {
          allowed = Math.min(allowed, Math.max(0, distance - 3));
        }
      }
    }

    return Math.max(0, allowed);
  }

  function advanceTrain(train, dt) {
    if (train.status === 'HOLD') return;
    const simMultiplier = Number(railway()?.simulation?.speedMultiplier || DEFAULT_SPEED);
    const base = Math.max(20, Number(train.simulationSpeed || train.speed || 50));
    const raw = dt * simMultiplier * (base / 55) * 8.0;
    const movement = safetyLimitedMovement(train, raw);

    train.position += (train.direction === 'forward' ? movement : -movement);

    // Branch trains merge into their corresponding main track only when the
    // junction is clear. Otherwise they wait at the entry of the junction.
    if (train.track === 'B1' && train.position >= 100) {
      const blocker = trains().find(other => other.number !== train.number && other.track === 'T1' && Math.abs(Number(other.position) - joinPosition('T1')) < 14);
      if (blocker) {
        train.position = 98.5;
        train.simulationSpeed = 0;
        return;
      }
      train.track = 'T1';
      train.position = joinPosition('T1') + 1.5;
      train.direction = 'forward';
      train.simulationSpeed = train.targetSpeed || train.cruiseSpeed || train.speed;
    }

    if (train.track === 'B2' && train.position <= 100) {
      const blocker = trains().find(other => other.number !== train.number && other.track === 'T2' && Math.abs(Number(other.position) - joinPosition('T2')) < 14);
      if (blocker) {
        train.position = 101.5;
        train.simulationSpeed = 0;
        return;
      }
      train.track = 'T2';
      train.position = joinPosition('T2') - 1.5;
      train.direction = 'reverse';
      train.simulationSpeed = train.targetSpeed || train.cruiseSpeed || train.speed;
    }

    if (train.track === 'B1' && train.position >= 111) completeTrain(train);
    else if (train.track === 'B2' && train.position <= -11) completeTrain(train);
    else if ((train.track === 'T1' || train.track === 'T2') && (train.position >= 108 || train.position <= -8)) completeTrain(train);
  }

  function maybeSpawn(dt) {
    releaseScheduledEntries();
    spawnClock += dt;
    const totalKnown = trains().length + scheduledEntries.length;
    if (spawnClock < nextSpawn || totalKnown >= MAX_TRAINS) return;
    spawnClock = 0;
    nextSpawn = SPAWN_MIN + random() * (SPAWN_MAX - SPAWN_MIN);
    spawnReplacement();
  }

  function drawTrains() {
    const container = document.querySelector('.railway-container');
    if (!container) return;
    const activeIds = new Set(trains().map(t => String(t.number)));
    container.querySelectorAll('.simple-train-marker').forEach(el => {
      if (!activeIds.has(String(el.dataset.trainId))) el.remove();
    });

    trains().forEach(t => {
      let el = container.querySelector(`.simple-train-marker[data-train-id="${CSS.escape(String(t.number))}"]`);
      if (!el) {
        el = document.createElement('div');
        el.className = 'simple-train-marker';
        el.dataset.trainId = String(t.number);
        el.setAttribute('role', 'button');
        el.tabIndex = 0;
        container.appendChild(el);
        el.addEventListener('click', () => safeUiCall('selectTrain', t.number));
      }

      const p = routePoint(t);
      el.style.left = `${p.x}%`;
      el.style.top = `${p.y}%`;
      el.classList.toggle('hold', t.status === 'HOLD');
      el.classList.toggle('conflict', (railway()?.conflicts || []).some(c => c.trainA === t.number || c.trainB === t.number));
      el.classList.toggle('slow', t.aiState === 'SLOW');
      el.classList.toggle('reverse', t.direction === 'reverse');

      const tag = t.aiState === 'GO' ? 'AI GO' : t.aiState === 'HOLD' ? 'AI HOLD' : t.aiState === 'SLOW' ? 'AI SLOW' : t.aiState === 'OVERRIDE' ? 'AI OVERRIDE' : '';
      el.innerHTML = `
        <span class="simple-train-label">${baseNumber(t)}</span>
        <span class="simple-train-body"><span class="simple-train-arrow">${t.direction === 'reverse' ? '←' : '→'}</span></span>
        ${tag ? `<span class="simple-ai-pill ${t.aiState.toLowerCase()}" data-state="${t.aiState.toLowerCase()}">${tag}</span>` : ''}
      `;
      el.title = `${baseNumber(t)} — ${t.name} — ${t.status}${t.aiState ? ` — ${tag}` : ''}`;
    });
  }

  function buildMap() {
    const container = document.querySelector('.railway-container');
    if (!container) return;
    container.classList.add('simple-road-map');

    container.querySelectorAll('.station,.station-line,.track,.junction,.platform,.signal,.conflict-marker,.topology-svg,.simple-topology-svg,.simple-main-svg,.rail-train,.simple-train-marker,.simple-road-svg').forEach(el => el.remove());

    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.classList.add('simple-road-svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    const add = (tag, attrs, text) => {
      const el = document.createElementNS(ns, tag);
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      if (text) el.textContent = text;
      svg.appendChild(el);
      return el;
    };

    add('path', { d:`M ${MAP.left} ${MAP.upperY} L ${MAP.right} ${MAP.upperY}`, class:'map-road-casing' });
    add('path', { d:`M ${MAP.left} ${MAP.upperY} L ${MAP.right} ${MAP.upperY}`, class:'map-road-core' });
    add('path', { d:`M ${MAP.right} ${MAP.lowerY} L ${MAP.left} ${MAP.lowerY}`, class:'map-road-casing' });
    add('path', { d:`M ${MAP.right} ${MAP.lowerY} L ${MAP.left} ${MAP.lowerY}`, class:'map-road-core' });

    // Small, map-like curved feeder roads.
    add('path', { d:`M ${MAP.j1X + 10} 6 C ${MAP.j1X + 6} 14, ${MAP.j1X + 4} 27, ${MAP.j1X} ${MAP.upperY}`, class:'map-branch-casing' });
    add('path', { d:`M ${MAP.j1X + 10} 6 C ${MAP.j1X + 6} 14, ${MAP.j1X + 4} 27, ${MAP.j1X} ${MAP.upperY}`, class:'map-branch-core' });
    add('path', { d:`M ${MAP.j2X - 10} 94 C ${MAP.j2X - 6} 86, ${MAP.j2X - 4} 75, ${MAP.j2X} ${MAP.lowerY}`, class:'map-branch-casing' });
    add('path', { d:`M ${MAP.j2X - 10} 94 C ${MAP.j2X - 6} 86, ${MAP.j2X - 4} 75, ${MAP.j2X} ${MAP.lowerY}`, class:'map-branch-core' });

    [['NDLS',7,'New Delhi'],['MTR',50,'Mathura Jn'],['AGC',93,'Agra Cantt.']].forEach(([code,x,name]) => {
      add('circle',{cx:x,cy:51,r:1.6,class:'map-station-dot'});
      add('text',{x,y:17,'text-anchor':'middle',class:'map-station-code'},code);
      add('text',{x,y:21,'text-anchor':'middle',class:'map-station-name'},name);
      add('line',{x1:x,y1:24,x2:x,y2:78,class:'map-station-line'});
    });
    add('circle',{cx:MAP.j1X,cy:MAP.upperY,r:1.8,class:'map-junction-dot'});
    add('circle',{cx:MAP.j2X,cy:MAP.lowerY,r:1.8,class:'map-junction-dot'});
    add('text',{x:MAP.j1X+2.5,y:MAP.upperY-2,class:'map-junction-label'},'J1');
    add('text',{x:MAP.j2X-2.5,y:MAP.lowerY+5,'text-anchor':'end',class:'map-junction-label'},'J2');
    add('text',{x:5,y:MAP.upperY-6,class:'map-track-label'},'UP MAIN');
    add('text',{x:95,y:MAP.upperY-6,'text-anchor':'end',class:'map-track-sub'},'NDLS → AGRA');
    add('text',{x:5,y:MAP.lowerY-6,class:'map-track-label'},'DOWN MAIN');
    add('text',{x:95,y:MAP.lowerY-6,'text-anchor':'end',class:'map-track-sub'},'NDLS ← AGRA');
    add('text',{x:50,y:95,'text-anchor':'middle',class:'map-note'},'2 MAIN TRACKS  •  RANDOM TRAFFIC  •  AI ORDERS JUNCTIONS  •  TRAINS DEPART');

    container.prepend(svg);
  }

  function renderDepartureLogs() {
    const host = document.getElementById('trainDepartureLogs');
    if (!host) return;
    if (!departureLogs.length) {
      host.innerHTML = '<div class="train-log-empty">No completed trains yet. Departures will appear here.</div>';
      return;
    }
    host.innerHTML = departureLogs.map(log => `
      <div class="train-log-row">
        <span class="train-log-time">${log.time}</span>
        <strong>${log.number}</strong>
        <span>${log.name}</span>
        <span>${log.route}</span>
        <span class="train-log-delay ${log.delay > 5 ? 'late' : ''}">${log.delay > 0 ? `+${log.delay}m` : 'On time'}</span>
      </div>`).join('');
  }

  function scenarioFromDecision(id) {
    const d = activeDecision;
    if (!d?.conflict) return null;
    const a = trainMap()[d.conflict.trainA];
    const b = trainMap()[d.conflict.trainB];
    if (!a || !b) return null;
    if (id === 'AI_RECOMMENDED') return d;
    if (id === 'OTHER_FIRST') {
      const alternate = d.proceedTrain === a.number ? b : a;
      const hold = alternate.number === a.number ? b : a;
      return { ...d, action:'PROCEED_AND_HOLD', proceedTrain:alternate.number, holdTrain:hold.number, slowTrain:null, status:'PENDING', source:'WHAT_IF' };
    }
    if (id === 'SLOW_APPROACH') {
      const slow = d.holdTrain && trainMap()[d.holdTrain] ? trainMap()[d.holdTrain] : b;
      const proceed = slow.number === a.number ? b : a;
      return { ...d, action:'SLOW_AND_PROCEED', proceedTrain:proceed.number, holdTrain:slow.number, slowTrain:slow.number, targetSpeedKmh:Math.max(28, Math.round(nominalSpeed(slow) * 0.55)), durationSeconds:5, status:'PENDING', source:'WHAT_IF' };
    }
    if (id === 'HOLD_BOTH') {
      return { ...d, action:'HOLD_BOTH', proceedTrain:a.number, holdTrain:b.number, slowTrain:null, durationSeconds:4, status:'PENDING', source:'WHAT_IF' };
    }
    return null;
  }

  function scenarioTitle(id, d) {
    const a = d?.conflict?.trainA || 'Train A';
    const b = d?.conflict?.trainB || 'Train B';
    return {
      AI_RECOMMENDED:`AI recommendation: ${d?.proceedTrain || a} first`,
      OTHER_FIRST:`Let ${d?.holdTrain || b} pass first`,
      SLOW_APPROACH:`Slow ${d?.holdTrain || b} instead of stopping`,
      HOLD_BOTH:`Hold both trains briefly`
    }[id] || id;
  }

  function updateWhatIfAnalysis() {
    const d = activeDecision;
    const title = document.getElementById('selectedScenarioText');
    document.querySelectorAll('.scenario-card').forEach(card => {
      const id = card.dataset.scenario;
      card.classList.toggle('selected', id === selectedWhatIf);
      const heading = card.querySelector('.scenario-header strong');
      if (heading) heading.textContent = scenarioTitle(id, d);
      const badge = card.querySelector('.scenario-header span');
      if (badge) badge.textContent = id === 'AI_RECOMMENDED' ? 'RECOMMENDED' : 'ALTERNATIVE';
      card.classList.toggle('recommended', id === 'AI_RECOMMENDED');
      card.classList.toggle('disabled', !d);
    });
    if (title) title.textContent = d?.conflict ? scenarioTitle(selectedWhatIf, d) : 'Waiting for a conflict';

    const setStats = (id, delayId, conflictsId, stopsId) => {
      const scen = scenarioFromDecision(id);
      const delay = scen ? Math.round((Number(d.conflict.timeToConflict || 3) + (id === 'HOLD_BOTH' ? 5 : id === 'OTHER_FIRST' ? 7 : id === 'SLOW_APPROACH' ? 2 : 1)) * 2) : 0;
      const el1=document.getElementById(delayId), el2=document.getElementById(conflictsId), el3=document.getElementById(stopsId);
      if (el1) el1.textContent = `${delay} min`;
      if (el2) el2.textContent = scen ? (id === 'HOLD_BOTH' ? 0 : 1) : 0;
      if (el3) el3.textContent = scen ? (id === 'HOLD_BOTH' ? 2 : id === 'SLOW_APPROACH' ? 0 : 1) : 0;
    };
    setStats('AI_RECOMMENDED','scenario1Delay','scenario1Conflicts','scenario1Stops');
    setStats('OTHER_FIRST','scenario2Delay','scenario2Conflicts','scenario2Stops');
    setStats('SLOW_APPROACH','scenario3Delay','scenario3Conflicts','scenario3Stops');
    setStats('HOLD_BOTH','scenario4Delay','scenario4Conflicts','scenario4Stops');
  }

  function initializeWhatIfAnalysis() {
    document.querySelectorAll('.scenario-card').forEach(card => {
      card.addEventListener('click', () => {
        if (!activeDecision?.conflict) return;
        selectedWhatIf = card.dataset.scenario;
        updateWhatIfAnalysis();
      });
    });
    const apply = document.getElementById('applyScenarioButton');
    if (apply) {
      apply.onclick = () => {
        const scenario = scenarioFromDecision(selectedWhatIf);
        if (!scenario) return safeUiCall('showSystemMessage','No active conflict to apply a what-if scenario.');
        if (scenario.action === 'HOLD_BOTH') {
          const a=trainMap()[scenario.proceedTrain], b=trainMap()[scenario.holdTrain];
          if (a) { a.status='HOLD'; a.aiState='HOLD'; a.simulationSpeed=0; a.heldUntil=Date.now()+4000; }
          if (b) { b.status='HOLD'; b.aiState='HOLD'; b.simulationSpeed=0; b.heldUntil=Date.now()+4000; }
          activeDecision={...scenario,status:'ACCEPTED'};
          resolvedDecisionKey = lastDecisionKey;
          setConflictSlowdown(false);
        } else {
          applyDecision(scenario,'accept');
        }
        drawTrains(); syncSidebar(); updateWhatIfAnalysis();
        safeUiCall('showSystemMessage',`Applied what-if: ${scenarioTitle(selectedWhatIf, activeDecision)}.`);
      };
    }
    updateWhatIfAnalysis();
  }

  function updateMetrics() {
    const active = trains();
    const total = document.getElementById('totalTrainsValue') || document.querySelector('.metrics-grid .metric-card:nth-child(1) strong');
    const delayed = document.getElementById('delayedTrainsValue');
    const throughput = document.getElementById('throughputValue');
    if (total) total.textContent = String(active.length);
    if (delayed) delayed.textContent = String(active.filter(t => Number(t.delay || 0) > 5).length);
    if (throughput) throughput.textContent = `${completed} departed`;
  }

  function syncSidebar() {
    const state = app();
    if (!state) return;
    state.trains = trains().map(t => ({
      number: baseNumber(t),
      name: t.name,
      route: t.route,
      delay: Number(t.delay || 0),
      speed: Math.round(Number(t.simulationSpeed || t.speed || 0)),
      nextStop: 'Mathura Jn',
      eta: '—',
      priority: t.priority,
      priorityClass: String(t.priority || 'MEDIUM').toLowerCase(),
      status: t.status
    }));
    state.section.totalTrains = state.trains.length;
    state.section.delayed = state.trains.filter(t => Number(t.delay || 0) > 5).length;
    state.section.onTime = state.trains.length - state.section.delayed;
    safeUiCall('renderTrains');
  }

  function updateStatus() {
    const text = document.getElementById('simulationStatusText');
    if (text) text.textContent = running ? (liveMode ? 'Live running' : 'Running') : 'Paused';
    const start = document.getElementById('simulationStartButton');
    const pause = document.getElementById('simulationPauseButton');
    if (start) start.classList.toggle('active', running);
    if (pause) pause.classList.toggle('active', !running);
  }

  function updateDecisionPanel() {
    const d = activeDecision;
    const a = document.getElementById('conflictTrainA');
    const b = document.getElementById('conflictTrainB');
    const an = document.getElementById('conflictTrainAName');
    const bn = document.getElementById('conflictTrainBName');
    const alert = document.getElementById('conflictAlertText');
    const action = document.getElementById('recommendedAction');
    const hold = document.getElementById('holdRecommendation');
    const est = document.getElementById('estimatedHold');
    const reasons = document.getElementById('decisionReasons');

    if (!d || !d.conflict) {
      if (alert) alert.textContent = 'AI TRAFFIC MONITORING';
      if (a) a.textContent = '—';
      if (b) b.textContent = '—';
      if (an) an.textContent = 'No conflict';
      if (bn) bn.textContent = 'Monitoring';
      if (action) action.textContent = 'Traffic is separated';
      if (hold) hold.textContent = 'AI is watching all blocks';
      if (est) est.textContent = '';
      if (reasons) reasons.innerHTML = '<li>Safety layer keeps trains from occupying the same space.</li><li>ML evaluates priority, delay and conflict risk.</li>';
      updateWhatIfAnalysis();
      return;
    }

    const ta = trainMap()[d.conflict.trainA];
    const tb = trainMap()[d.conflict.trainB];
    const slow = d.slowTrain ? trainMap()[d.slowTrain] : null;
    const proceed = trainMap()[d.proceedTrain];
    if (a) a.textContent = baseNumber(ta) || d.conflict.trainA;
    if (b) b.textContent = baseNumber(tb) || d.conflict.trainB;
    if (an) an.textContent = ta?.name || 'Train';
    if (bn) bn.textContent = tb?.name || 'Train';
    if (alert) alert.textContent = d.action === 'SLOW_AND_PROCEED' ? 'AI SPEED ADJUSTMENT' : 'AI JUNCTION CONFLICT';

    if (d.action === 'SLOW_AND_PROCEED') {
      if (action) action.textContent = `Slow ${baseNumber(slow) || d.slowTrain} to ${d.targetSpeedKmh} km/h`;
      if (hold) hold.textContent = `Allow ${baseNumber(proceed) || d.proceedTrain} to keep priority`;
      if (est) est.textContent = `Speed reduction: ${Math.max(3, Number(d.durationSeconds || 4))} sec · ML confidence ${Math.round(Number(d.confidence || .84) * 100)}%`;
    } else {
      if (action) action.textContent = `Allow ${baseNumber(proceed) || d.proceedTrain} to pass first`;
      if (hold) hold.textContent = `Hold ${baseNumber(trainMap()[d.holdTrain]) || d.holdTrain} before ${d.conflict.track}`;
      if (est) est.textContent = `Estimated hold: ${Math.max(1, Math.round(d.durationSeconds || d.estimatedHold || 3))} sec · ML confidence ${Math.round(Number(d.confidence || .84) * 100)}%`;
    }

    updateWhatIfAnalysis();
    if (reasons) reasons.innerHTML =
      `${conflictSlowdownActive ? '<li><strong>Auto-slow:</strong> simulation reduced to 0.5× while this conflict awaits a decision.</li>' : ''}` +
      (d.action === 'SLOW_AND_PROCEED'
        ? `<li>ML sees enough separation to reduce speed instead of stopping.</li><li><strong>${baseNumber(slow) || d.slowTrain}</strong> stays moving at a controlled speed.</li><li>Hard safety rules prevent overlap even if the ML recommendation is late.</li>`
        : `<li>ML favors <strong>${baseNumber(proceed) || d.proceedTrain}</strong> using priority + predicted delay.</li><li>Only one train can claim the junction at a time.</li><li>Hard safety rules prevent overlap on every track.</li>`);
  }

  function bindControls() {
    const replace = (selector, handler) => {
      document.querySelectorAll(selector).forEach(old => {
        const fresh = old.cloneNode(true);
        old.replaceWith(fresh);
        fresh.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); handler(ev); });
      });
    };

    replace('#simulationStartButton', start);
    replace('#simulationPauseButton', stop);
    replace('#simulationResetButton', reset);
    replace('.accept-button', acceptDecision);
    replace('.simulate-button', simulateDecision);
    replace('.override-button', overrideDecision);

    initializeWhatIfAnalysis();

    document.querySelectorAll('.speed-button').forEach(old => {
      const fresh = old.cloneNode(true);
      old.replaceWith(fresh);
      fresh.addEventListener('click', ev => {
        ev.preventDefault();
        const speed = Number(fresh.dataset.speed || 10);
        const s = railway();
        requestedSpeedMultiplier = speed;
        if (s?.simulation) {
          if (conflictSlowdownActive) {
            s.simulation.speedMultiplier = 0.5;
            safeUiCall('showSystemMessage', `Conflict active: simulation held at 0.5× until a decision is made.`);
          } else {
            s.simulation.speedMultiplier = speed;
          }
        }
        document.querySelectorAll('.speed-button').forEach(btn => btn.classList.toggle('active', Number(btn.dataset.speed) === Number(s?.simulation?.speedMultiplier || speed)));
        safeUiCall('showSystemMessage', conflictSlowdownActive ? `Requested ${speed}×; auto-slow remains at 0.5×` : `Simulation speed set to ${speed}×`);
      });
    });
    const s = railway();
    requestedSpeedMultiplier = DEFAULT_SPEED;
    if (s?.simulation) s.simulation.speedMultiplier = DEFAULT_SPEED;
    document.querySelectorAll('.speed-button').forEach(btn => btn.classList.toggle('active', Number(btn.dataset.speed) === DEFAULT_SPEED));
  }

  function tick(ts) {
    if (!running) return;
    if (!lastTs) lastTs = ts;
    const dt = Math.min(0.08, Math.max(0, (ts - lastTs) / 1000));
    lastTs = ts;

    releaseTemporaryControls();
    maybeSpawn(dt * Number(railway()?.simulation?.speedMultiplier || DEFAULT_SPEED) / DEFAULT_SPEED);
    [...trains()].forEach(t => advanceTrain(t, dt));

    const s = railway();
    if (s) s.conflicts = detectConflicts();

    if (!activeDecision || activeDecision.status !== 'PENDING' || !trainMap()[activeDecision.proceedTrain] || !trainMap()[activeDecision.holdTrain]) {
      generateDecision();
    }

    drawTrains();
    syncSidebar();
    updateMetrics();
    updateStatus();
    frame = requestAnimationFrame(tick);
  }

  function start() {
    if (running) return;
    running = true;
    lastTs = 0;
    const s = railway();
    if (s?.simulation) s.simulation.running = true;
    updateStatus();
    safeUiCall('showSystemMessage', liveMode ? 'Live traffic engine running.' : 'Simulation running.');
    frame = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    if (frame) cancelAnimationFrame(frame);
    frame = null;
    lastTs = 0;
    const s = railway();
    if (s?.simulation) s.simulation.running = false;
    updateStatus();
  }

  function reset() {
    stop();
    resetTraffic(liveMode ? 'LIVE' : 'SIMULATION');
    generateDecision();
    buildMap();
    drawTrains();
    updateMetrics();
    updateStatus();
  }

  async function seedFromLivePayload(payload) {
    if (!payload || !Array.isArray(payload.trains)) return false;
    if (!liveMode) {
      pendingLivePayload = payload;
      return true;
    }

    // First live response seeds a new random traffic state. Later responses
    // only refresh delay/speed metadata so the trains are not reset/looped.
    if (!liveSeeded || trains().length === 0) {
      resetTraffic('LIVE');
      const incoming = [...payload.trains];
      // Map live feed metadata onto the random positions/tracks.
      trains().forEach((t, index) => {
        const src = incoming[index % incoming.length];
        if (!src) return;
        // Keep the engine-assigned unique train number stable so live refreshes
        // never create duplicate train identities while a train is still active.
        t.name = src.name || t.name;
        t.priority = src.priority || t.priority;
        t.priorityClass = String(t.priority).toLowerCase();
        t.speed = Number(src.speed || t.speed);
        t.cruiseSpeed = t.speed;
        t.simulationSpeed = t.speed;
        t.delay = Number(src.delay || t.delay);
      });
      liveSeeded = true;
      syncSidebar();
      drawTrains();
      updateDecisionPanel();
      return true;
    }

    const incoming = payload.trains;
    trains().forEach((t, index) => {
      const src = incoming[index % incoming.length];
      if (!src) return;
      t.delay = Number(src.delay ?? t.delay);
      const incomingSpeed = Number(src.speed || t.speed);
      if (t.aiState !== 'SLOW' && t.status !== 'HOLD') {
        t.speed = incomingSpeed;
        t.cruiseSpeed = incomingSpeed;
        t.simulationSpeed = incomingSpeed;
      }
    });
    syncSidebar();
    return true;
  }

  function setTrackMode(mode) {
    const next = String(mode || 'SIMULATION').toUpperCase();
    liveMode = next === 'LIVE';
    if (liveMode) {
      stop();
      resetTraffic('LIVE');
      liveSeeded = false;
      pendingLivePayload = null;
      start();
    } else {
      stop();
      resetTraffic('SIMULATION');
      liveSeeded = false;
      updateStatus();
      drawTrains();
      syncSidebar();
      generateDecision();
    }
  }

  function renderUtilityPage(page) {
    const panel = document.getElementById('utilityPagePanel');
    const title = document.getElementById('utilityPageTitle');
    const subtitle = document.getElementById('utilityPageSubtitle');
    const content = document.getElementById('utilityPageContent');
    if (!panel || !title || !content) return;
    const active = trains();
    const conflicts = railway()?.conflicts || [];
    const set = (t, sub, html) => { title.textContent = t; if (subtitle) subtitle.textContent = sub; content.innerHTML = html; };
    if (page === 'trains') {
      set('TRAINS', 'Current traffic in this section', active.length
        ? active.map(t => `<div class="utility-card"><h3>${baseNumber(t)} · ${t.name}</h3><p>${t.route} · ${t.status}</p><div class="utility-metric">${Math.round(t.speed || t.cruiseSpeed || 0)} km/h</div><span class="utility-pill">${t.aiState ? `AI ${t.aiState}` : 'RUNNING'}</span></div>`).join('')
        : '<div class="utility-card"><h3>No active trains</h3><p>Start the simulation or switch to Live mode to populate this view.</p></div>');
    } else if (page === 'section') {
      set('SECTION VIEW', 'NDLS ↔ AGRA traffic map', `<div class="utility-card"><h3>UP MAIN</h3><p>NDLS → AGRA</p><div class="utility-metric">${active.filter(t=>t.track==='T1').length} trains</div></div><div class="utility-card"><h3>DOWN MAIN</h3><p>NDLS ← AGRA</p><div class="utility-metric">${active.filter(t=>t.track==='T2').length} trains</div></div><div class="utility-card"><h3>Junctions</h3><p>J1 / J2 are protected by the same conflict engine as the main simulation.</p><div class="utility-metric">${conflicts.length}</div><span class="utility-pill">${conflicts.length ? 'CONFLICT WATCH' : 'CLEAR'}</span></div>`);
    } else if (page === 'schedule') {
      set('SCHEDULE', 'Next section movements', `<div class="utility-card"><h3>Live operating order</h3><table class="utility-table"><tr><th>Train</th><th>Priority</th><th>Status</th></tr>${active.slice(0,6).map(t=>`<tr><td>${baseNumber(t)}</td><td>${t.priority}</td><td>${t.status}</td></tr>`).join('')}</table><button class="utility-action" onclick="window.showSystemMessage && window.showSystemMessage('Schedule is synced with the live simulation order.')">Refresh Order</button></div>`);
    } else if (page === 'disruptions') {
      set('DISRUPTIONS', 'Operational issues and AI interventions', `<div class="utility-card"><h3>Active conflicts</h3><div class="utility-metric">${conflicts.length}</div><p>${conflicts.length ? 'AI decision support is active. The main dashboard has the decision controls.' : 'No unresolved conflicts right now.'}</p></div><div class="utility-card"><h3>Safety layer</h3><p>Hard separation rules prevent physical overlap even when traffic is dense.</p><span class="utility-pill">ENFORCED</span></div>`);
    } else if (page === 'reports') {
      const logs = departureLogs.slice(0,7);
      set('REPORTS', 'Recent performance snapshot', `<div class="utility-card"><h3>Section throughput</h3><div class="utility-metric">${completed}</div><p>Trains completed since the last reset.</p></div><div class="utility-card"><h3>Recent departures</h3><p>${logs.length ? logs.map(l=>`${l.number} · ${l.delay > 0 ? '+'+l.delay+'m' : 'On time'}`).join('<br>') : 'No completed trains yet.'}</p></div><div class="utility-card"><h3>AI state</h3><p>${activeDecision?.status === 'PENDING' ? 'Decision pending' : 'Monitoring traffic'}</p></div>`);
    }
    panel.hidden = false;
  }

  function hideUtilityPages() {
    const panel = document.getElementById('utilityPagePanel');
    if (panel) panel.hidden = true;
  }

  function initializeSimpleRailway() {
    const s = railway();
    if (!s || initialized) return;
    initialized = true;
    // Keep What-If Analysis visually close to the simulation and AI decision area.
    const whatIf = document.querySelector('.what-if-panel');
    const aiPanel = document.querySelector('.ai-panel');
    if (whatIf && aiPanel && whatIf.nextElementSibling !== aiPanel) {
      aiPanel.parentNode.insertBefore(whatIf, aiPanel);
    }
    s.simulation = s.simulation || { running:false, speedMultiplier:DEFAULT_SPEED };
    s.simulation.running = false;
    s.simulation.speedMultiplier = DEFAULT_SPEED;
    s.tracks = {
      T1:{id:'T1',name:'UP MAIN',status:'free',occupiedBy:[]},
      T2:{id:'T2',name:'DOWN MAIN',status:'free',occupiedBy:[]},
      B1:{id:'B1',name:'J1 BRANCH',status:'free',occupiedBy:[]},
      B2:{id:'B2',name:'J2 BRANCH',status:'free',occupiedBy:[]}
    };
    buildMap();
    resetTraffic('SIMULATION');
    generateDecision();
    bindControls();
    drawTrains();
    syncSidebar();
    updateMetrics();
    updateStatus();
    renderDepartureLogs();
    updateDecisionPanel();
  }

  window.initializeSimpleRailway = initializeSimpleRailway;
  window.startTrainSimulation = start;
  window.stopTrainSimulation = stop;
  window.resetTrainSimulation = reset;
  window.acceptConflictDecision = acceptDecision;
  window.simulateDecision = simulateDecision;
  window.overrideRecommendation = overrideDecision;
  window.initializeSimulationControls = bindControls;
  window.initializeDecisionControls = bindControls;
  window.updateTopologyVisuals = () => { buildMap(); drawTrains(); updateDecisionPanel(); };
  window.ensureMapElements = buildMap;
  window.ensureRailTrainElements = drawTrains;
  window.detectDynamicConflicts = detectConflicts;
  window.generateConflictDecision = generateDecision;
  window.applyDecisionToSimulation = applyDecision;
  window.setTrackMode = setTrackMode;
  window.syncLiveFeed = seedFromLivePayload;
  window.renderUtilityPage = renderUtilityPage;
  window.hideUtilityPages = hideUtilityPages;

  if (typeof window.initializeIcons !== 'function') {
    window.initializeIcons = function () {
      try { if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons(); } catch (_) {}
    };
  }
})();
