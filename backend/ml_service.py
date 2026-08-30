from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import numpy as np

import joblib
import pandas as pd
from flask import Flask, jsonify, request

from live_feed import live_snapshot
from flask_cors import CORS
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models"
MODEL_DIR.mkdir(exist_ok=True)

FEATURES = [
    "delay_minutes",
    "speed_kmh",
    "distance_remaining_km",
    "track_occupancy",
    "priority_score",
    "weather_risk",
    "hour",
]
DELAY_TARGET = "target_delay_minutes"
CONFLICT_TARGET = "conflict_occurred"
PRIORITY_SCORES = {"HIGH": 1.0, "MEDIUM": 0.6, "LOW": 0.25}

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": os.getenv("FRONTEND_ORIGIN", "*")}})

models: dict[str, Any] = {
    "delay": None,
    "conflict": None,
    "trained_at": None,
    "records": 0,
    "metrics": {},
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def model_pipeline(estimator: Any) -> Pipeline:
    return Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("model", estimator),
        ]
    )


def normalize_records(records: list[dict[str, Any]]) -> pd.DataFrame:
    frame = pd.DataFrame(records).copy()
    aliases = {
        "delay": "delay_minutes",
        "speed": "speed_kmh",
        "distanceRemaining": "distance_remaining_km",
        "trackOccupancy": "track_occupancy",
        "priority": "priority_score",
        "weatherRisk": "weather_risk",
    }
    for source, target in aliases.items():
        if source in frame.columns and target not in frame.columns:
            frame.rename(columns={source: target}, inplace=True)

    if "priority_score" in frame:
        frame["priority_score"] = frame["priority_score"].apply(
            lambda value: PRIORITY_SCORES.get(str(value).upper(), value)
        )
    if "hour" not in frame:
        frame["hour"] = pd.Timestamp.now().hour

    missing = [feature for feature in FEATURES if feature not in frame]
    if missing:
        raise ValueError(f"Missing required features: {', '.join(missing)}")

    for feature in FEATURES + [DELAY_TARGET, CONFLICT_TARGET]:
        if feature in frame:
            frame[feature] = pd.to_numeric(frame[feature], errors="coerce")

    return frame


def train_models(records: list[dict[str, Any]]) -> dict[str, Any]:
    frame = normalize_records(records)
    delay_frame = frame.dropna(subset=[DELAY_TARGET])
    conflict_frame = frame.dropna(subset=[CONFLICT_TARGET])

    if len(frame) < 10:
        raise ValueError("At least 10 labeled records are required for training")
    if conflict_frame[CONFLICT_TARGET].nunique() < 2:
        raise ValueError("conflict_occurred must contain both 0 and 1 classes")

    delay_model = model_pipeline(
        RandomForestRegressor(
            n_estimators=200,
            random_state=42,
            min_samples_leaf=2,
            n_jobs=-1,
        )
    )
    conflict_model = model_pipeline(
        RandomForestClassifier(
            n_estimators=200,
            random_state=42,
            min_samples_leaf=2,
            class_weight="balanced",
            n_jobs=-1,
        )
    )
    delay_model.fit(delay_frame[FEATURES], delay_frame[DELAY_TARGET])
    conflict_model.fit(conflict_frame[FEATURES], conflict_frame[CONFLICT_TARGET].astype(int))

    models.update(
        {
            "delay": delay_model,
            "conflict": conflict_model,
            "trained_at": now_iso(),
            "records": len(frame),
            "metrics": {
                "delay_training_mae": round(
                    float(abs(delay_model.predict(delay_frame[FEATURES]) - delay_frame[DELAY_TARGET]).mean()), 3
                ),
                "conflict_training_accuracy": round(
                    float((conflict_model.predict(conflict_frame[FEATURES]) == conflict_frame[CONFLICT_TARGET]).mean()), 3
                ),
            },
        }
    )
    joblib.dump(models, MODEL_DIR / "trackmyrail_models.joblib")
    return model_status()


def model_status() -> dict[str, Any]:
    return {
        "ready": models["delay"] is not None and models["conflict"] is not None,
        "model": "Random Forest",
        "records": models["records"],
        "trained_at": models["trained_at"],
        "metrics": models["metrics"],
    }


def load_persisted_models() -> None:
    artifact_path = MODEL_DIR / "trackmyrail_models.joblib"
    if not artifact_path.exists():
        return

    persisted = joblib.load(artifact_path)
    if not isinstance(persisted, dict) or not persisted.get("delay") or not persisted.get("conflict"):
        return
    models.update(persisted)


def build_features(payload: dict[str, Any]) -> pd.DataFrame:
    frame = normalize_records([payload])
    return frame[FEATURES]


def predict(payload: dict[str, Any]) -> dict[str, Any]:
    if not model_status()["ready"]:
        raise RuntimeError("Models are not trained. Upload a dataset first.")

    features = build_features(payload)

    # Delay prediction: force the result into a 1-D array first
    delay_raw = np.asarray(
        models["delay"].predict(features)
    ).reshape(-1)

    if delay_raw.size == 0:
        raise ValueError("Delay model returned no prediction")

    delay = max(0, round(float(delay_raw[0]), 2))

    # Conflict probabilities
    probability_raw = np.asarray(
        models["conflict"].predict_proba(features)
    )

    if probability_raw.ndim == 1:
        probabilities = probability_raw
    else:
        probabilities = probability_raw[0]

    classes = np.asarray(
        models["conflict"].named_steps["model"].classes_
    ).reshape(-1)

    if 1 in classes:
        conflict_index = int(np.where(classes == 1)[0][0])
        conflict_probability = float(
            np.asarray(probabilities).reshape(-1)[conflict_index]
        )
    else:
        conflict_probability = 0.0

    confidence = float(
        np.max(np.asarray(probabilities).reshape(-1))
    )

    return {
        "predicted_delay_minutes": delay,
        "conflict_probability": round(conflict_probability, 4),
        "confidence": round(confidence, 4),
        "model": "Random Forest",
        "trained_at": models["trained_at"],
    }

def choose_recommendation(trains: list[dict[str, Any]], predictions: list[dict[str, Any]]) -> dict[str, Any]:
    if len(trains) < 2:
        return {"action": "NO_ACTION", "reason": "At least two trains are required"}

    def score(item: dict[str, Any], pred: dict[str, Any]) -> float:
        priority = PRIORITY_SCORES.get(str(item.get("priority", "MEDIUM")).upper(), 0.6)
        delay = float(pred.get("predicted_delay_minutes", item.get("delay_minutes", 0)) or 0)
        return priority * 10 + delay

    def is_same_track(a: dict[str, Any], b: dict[str, Any]) -> bool:
        return bool(a.get("track")) and a.get("track") == b.get("track")

    def is_junction_pair(a: dict[str, Any], b: dict[str, Any]) -> bool:
        pair = {str(a.get("track")), str(b.get("track"))}
        return pair in ({"B1", "T1"}, {"B2", "T2"})

    ranked = sorted(zip(trains, predictions), key=lambda pair: score(*pair), reverse=True)
    conflict_pair = None
    conflict_kind = None

    for i, (a, ap) in enumerate(zip(trains, predictions)):
        for b, bp in zip(trains[i + 1:], predictions[i + 1:]):
            if is_same_track(a, b):
                gap = abs(float(a.get("position", 0)) - float(b.get("position", 0)))
                opposing = a.get("direction") and b.get("direction") and a.get("direction") != b.get("direction")
                if (not opposing and gap < 18) or (opposing and gap < 31):
                    conflict_pair = (a, b, ap, bp)
                    conflict_kind = "HEAD_ON" if opposing else "FOLLOWING"
                    break
            elif is_junction_pair(a, b):
                da = float(a.get("position", 0))
                db = float(b.get("position", 0))
                # Branch trains live around the 65–100/100–115 approach; main
                # trains are considered to be in the junction approach near 35–75.
                if (a.get("track") in {"B1", "B2"} and da > 62) or (b.get("track") in {"B1", "B2"} and db > 62):
                    conflict_pair = (a, b, ap, bp)
                    conflict_kind = "JUNCTION"
                    break
        if conflict_pair:
            break

    if not conflict_pair:
        # When there is no physical conflict yet, let the model still make a
        # speed-management recommendation for the closest pair. This gives the
        # controller a useful ML action without inventing a collision.
        a, ap = ranked[0]
        b, bp = ranked[1]
        if is_same_track(a, b) and abs(float(a.get("position", 0)) - float(b.get("position", 0))) < 28:
            conflict_pair = (a, b, ap, bp)
            conflict_kind = "FOLLOWING"
        else:
            return {"action": "NO_ACTION", "reason": "No conflict or speed adjustment is currently required"}

    a, b, ap, bp = conflict_pair
    sa = score(a, ap)
    sb = score(b, bp)

    if conflict_kind == "FOLLOWING":
        # The train ahead gets priority; the trailing train can usually be
        # slowed rather than fully stopped.
        if float(a.get("position", 0)) > float(b.get("position", 0)):
            proceed, slow = a, b
        else:
            proceed, slow = b, a
        gap = abs(float(a.get("position", 0)) - float(b.get("position", 0)))
        target_speed = max(24, int(min(float(slow.get("speed", 50)) * 0.58, float(proceed.get("speed", 70)) * 0.82)))
        return {
            "action": "SLOW_AND_PROCEED",
            "proceed_train": proceed.get("number"),
            "hold_train": slow.get("number"),
            "slow_train": slow.get("number"),
            "target_speed_kmh": target_speed,
            "duration_seconds": max(3, min(7, int(round(4 + gap / 8)))),
            "hold_minutes": 0,
            "time_to_conflict": max(1.0, min(10.0, gap / 4.5)),
            "reason": "The lead train has priority on the occupied block; reducing the following train's speed preserves separation without a full stop.",
            "safety": "Hard spacing guard prevents overlap.",
        }

    proceed = a if sa >= sb else b
    other = b if proceed is a else a
    gap = abs(float(a.get("position", 0)) - float(b.get("position", 0)))
    risk = max(float(ap.get("conflict_probability", 0)), float(bp.get("conflict_probability", 0)))

    # Moderate junction risk: reduce speed and keep both trains moving.
    if conflict_kind == "JUNCTION" and gap > 10 and risk < 0.82:
        target_speed = max(24, int(min(float(other.get("speed", 50)) * 0.55, float(proceed.get("speed", 70)) * 0.78)))
        return {
            "action": "SLOW_AND_PROCEED",
            "proceed_train": proceed.get("number"),
            "hold_train": other.get("number"),
            "slow_train": other.get("number"),
            "target_speed_kmh": target_speed,
            "duration_seconds": 4,
            "hold_minutes": 0,
            "time_to_conflict": max(1.0, min(8.0, gap / 4.0)),
            "reason": "Moderate junction risk allows controlled speed reduction instead of a hard stop.",
            "safety": "Only one train may occupy the junction conflict zone; physical spacing guard remains active.",
        }

    return {
        "action": "PROCEED_AND_HOLD",
        "proceed_train": proceed.get("number"),
        "hold_train": other.get("number"),
        "slow_train": None,
        "target_speed_kmh": None,
        "duration_seconds": max(2, min(6, int(round(max(1.0, gap / 4.5) + 1)))),
        "hold_minutes": max(2, min(6, int(round(max(1.0, gap / 4.5) + 1)))),
        "time_to_conflict": max(0.5, min(8.0, gap / 4.0)),
        "reason": "Conflict risk is high; the higher-priority train gets the junction first and the other is held.",
        "safety": "Hard spacing guard prevents overlap.",
    }


@app.get("/health")
def health() -> Any:
    return jsonify({"ok": True, **model_status()})


@app.post("/train")
def train_endpoint() -> Any:
    payload = request.get_json(silent=True) or {}
    records = payload if isinstance(payload, list) else payload.get("records", [])
    try:
        return jsonify({"ok": True, **train_models(records)})
    except (ValueError, TypeError) as error:
        return jsonify({"ok": False, "error": str(error)}), 400


@app.post("/predict")
def predict_endpoint() -> Any:
    try:
        return jsonify({"ok": True, **predict(request.get_json(silent=True) or {})})
    except (RuntimeError, ValueError, TypeError) as error:
        return jsonify({"ok": False, "error": str(error)}), 400


@app.get("/live-data")
def live_data_endpoint() -> Any:
    return jsonify(live_snapshot())


@app.post("/reoptimize")
def reoptimize_endpoint() -> Any:
    payload = request.get_json(silent=True) or {}
    trains = payload.get("trains", [])
    try:
        try:
            predictions = [predict(train) for train in trains]
            prediction_source = "random_forest"
        except RuntimeError:
            # Keep the controller functional even before a model has been trained.
            predictions = []
            for train in trains:
                delay = max(0.0, float(train.get("delay_minutes", train.get("delay", 0)) or 0))
                speed = max(1.0, float(train.get("speed_kmh", train.get("speed", 0)) or 1))
                occupancy = float(train.get("track_occupancy", 0.3) or 0.3)
                risk = min(0.99, max(0.02, occupancy * 0.65 + (delay / 30.0) + (speed > 90) * 0.08))
                predictions.append({
                    "predicted_delay_minutes": round(delay + occupancy * 2, 2),
                    "conflict_probability": round(risk, 4),
                    "confidence": 0.55,
                    "model": "Heuristic fallback",
                    "trained_at": None,
                })
            prediction_source = "heuristic_fallback"
        return jsonify(
            {
                "ok": True,
                "prediction_source": prediction_source,
                "trigger": payload.get("trigger", "state_change"),
                "predictions": predictions,
                "recommendation": choose_recommendation(trains, predictions),
                "reoptimized_at": now_iso(),
            }
        )
    except (RuntimeError, ValueError, TypeError) as error:
        return jsonify({"ok": False, "error": str(error)}), 400


load_persisted_models()


if __name__ == "__main__":
    app.run(host=os.getenv("HOST", "0.0.0.0"), port=int(os.getenv("PORT", "5000")), debug=False)
