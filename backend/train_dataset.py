from __future__ import annotations

import json
import sys
from pathlib import Path

from ml_service import train_models

DEFAULT_DATASET = Path(__file__).resolve().parents[1] / "trackmyrail_dataset.json"


def load_records(path: Path) -> list[dict]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    records = payload.get("records", payload) if isinstance(payload, dict) else payload
    if not isinstance(records, list):
        raise ValueError("Dataset must be a JSON array or an object containing a records array")

    normalized = []
    for record in records:
        row = dict(record)
        row.setdefault("conflict_occurred", 0)
        row.setdefault("weather_risk", 0)
        row.setdefault("hour", 0)
        if row.get("target_delay_minutes") is None:
            row["target_delay_minutes"] = row.get("delay_minutes", 0)
        normalized.append(row)
    return normalized


def main() -> None:
    dataset_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DATASET
    records = load_records(dataset_path)
    status = train_models(records)
    print(json.dumps({"dataset": str(dataset_path), **status}, indent=2))


if __name__ == "__main__":
    main()
