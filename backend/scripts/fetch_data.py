"""Download the Elexon BMRS data the app needs and save a compact snapshot.

Scope: purchase decisions made during January 2026, i.e. delivery days
2026-01-02 .. 2026-02-01. We pull a little extra on both sides so every
forecast horizon up to 48h has data, plus ~2 weeks of December
# history for the rolling bias correction.

Usage:  python backend/scripts/fetch_data.py
"""
import json
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

BASE = "https://data.elexon.co.uk/bmrs/api/v1/datasets"
OUT = Path(__file__).resolve().parents[1] / "data" / "snapshot.json"

ACTUAL_FROM, ACTUAL_TO = "2025-12-20", "2026-02-02"
FORECAST_FROM = datetime(2025, 12, 17, tzinfo=timezone.utc)
FORECAST_TO = datetime(2026, 2, 2, tzinfo=timezone.utc)


def get(url: str) -> list:
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.load(r)


def fetch_actuals() -> list:
    rows = get(f"{BASE}/FUELHH/stream?settlementDateFrom={ACTUAL_FROM}"
               f"&settlementDateTo={ACTUAL_TO}&fuelType=WIND")
    return sorted({(r["startTime"], r["generation"]) for r in rows if r["fuelType"] == "WIND"})


def fetch_forecasts() -> list:
    rows, t = [], FORECAST_FROM
    while t < FORECAST_TO:  # chunk by week to keep responses small
        end = min(t + timedelta(days=7), FORECAST_TO)
        rows += get(f"{BASE}/WINDFOR/stream?publishDateTimeFrom={t:%Y-%m-%dT%H:%M:%SZ}"
                    f"&publishDateTimeTo={end:%Y-%m-%dT%H:%M:%SZ}")
        t = end
    return sorted({(r["publishTime"], r["startTime"], r["generation"]) for r in rows})


if __name__ == "__main__":
    actuals, forecasts = fetch_actuals(), fetch_forecasts()
    OUT.write_text(json.dumps({
        "source": "Elexon BMRS FUELHH (fuelType=WIND) and WINDFOR stream endpoints",
        "fetchedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "actuals": actuals,      # [startTime, MW]
        "forecasts": forecasts,  # [publishTime, startTime, MW]
    }, separators=(",", ":")))
    print(f"{len(actuals)} actuals, {len(forecasts)} forecast rows -> {OUT}")
