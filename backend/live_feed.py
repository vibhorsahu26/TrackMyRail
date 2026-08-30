from __future__ import annotations

import random
from datetime import datetime, timezone
from typing import Any

BASE_TRAINS = [
    {"number": "12951", "name": "Rajdhani Express", "route": "NDLS → AGRA", "priority": "HIGH", "speed": 82},
    {"number": "54821", "name": "Freight", "route": "NDLS → Agra Cantt.", "priority": "LOW", "speed": 46},
    {"number": "12007", "name": "Shatabdi Express", "route": "NDLS → Jhansi", "priority": "HIGH", "speed": 80},
    {"number": "64315", "name": "Passenger", "route": "Mathura → NDLS", "priority": "MEDIUM", "speed": 55},
    {"number": "12424", "name": "Dibrugarh Rajdhani", "route": "AGRA → NDLS", "priority": "HIGH", "speed": 78},
    {"number": "12138", "name": "Punjab Mail", "route": "NDLS → AGRA", "priority": "MEDIUM", "speed": 65},
]

TRACKS = ("T1", "T2", "B1", "B2")


def live_snapshot() -> dict[str, Any]:
    """Return a genuinely changing live-traffic snapshot.

    This is a local development feed, not a railway provider. Every request
    creates a new 3–6 train traffic sample instead of moving the same static
    six trains in a deterministic loop.
    """
    now = datetime.now(timezone.utc)
    rng = random.Random(f"{now.timestamp()}-{random.random()}")
    count = rng.randint(3, 6)
    selected = rng.sample(BASE_TRAINS, count)

    trains: list[dict[str, Any]] = []
    occupied: dict[str, list[str]] = {}

    attempts = 0
    while len(trains) < count and attempts < 80:
        attempts += 1
        base = selected[len(trains)]
        track = rng.choices(["T1", "T2", "B1", "B2"], weights=[30, 35, 15, 20], k=1)[0]
        direction = "reverse" if track in {"T2", "B2"} else "forward"
        position = rng.uniform(12, 88)
        if track in {"B1"}: position = rng.uniform(62, 88)
        if track in {"B2"}: position = rng.uniform(108, 114)

        # Basic live-feed spacing so the backend never emits overlapping trains.
        safe = True
        for existing in trains:
            if existing["track"] == track and abs(float(existing["position"]) - position) < 18:
                safe = False
                break
        if not safe:
            continue

        train = {
            **base,
            "delay": rng.randint(0, 12),
            "speed": max(25, int(base["speed"] + rng.randint(-8, 7))),
            "priorityClass": base["priority"].lower(),
            "currentStation": "NDLS" if direction == "forward" else "AGC",
            "nextStation": "MTJ",
            "track": track,
            "direction": direction,
            "status": "DELAYED" if rng.random() < 0.3 else "RUNNING",
            "position": round(position, 2),
        }
        trains.append(train)
        occupied.setdefault(track, []).append(train["number"])

    tracks = {
        track: {
            "id": track,
            "status": "occupied" if occupied.get(track) else "free",
            "occupiedBy": occupied.get(track, []),
        }
        for track in TRACKS
    }

    return {
        "ok": True,
        "source": "local-live-random-feed",
        "live": True,
        "session_id": f"live-{int(now.timestamp() * 1000)}",
        "updated_at": now.isoformat(),
        "trains": trains,
        "tracks": tracks,
        "topology": {
            "stations": ["NDLS", "MTJ", "AGC"],
            "sections": {
                "T1": {"from": "NDLS", "to": "AGC", "type": "UP_MAIN"},
                "T2": {"from": "AGC", "to": "NDLS", "type": "DOWN_MAIN"},
                "B1": {"from": "branch", "to": "T1", "type": "JUNCTION_1"},
                "B2": {"from": "branch", "to": "T2", "type": "JUNCTION_2"},
            },
            "crossover": "MTJ",
        },
        "summary": {
            "trainCount": len(trains),
            "delayedCount": sum(t["delay"] > 0 for t in trains),
            "trackUsage": round(sum(1 for value in tracks.values() if value["status"] == "occupied") / len(tracks) * 100),
        },
    }
