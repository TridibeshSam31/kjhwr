"""HTTP API. Thin layer: validates query params, delegates to app.analysis.

Serves JSON only; the UI is served by nginx (Docker) or the Vercel CDN."""
from datetime import date, time
from functools import lru_cache

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.gzip import GZipMiddleware

from . import analysis as an
from .data import load

app = FastAPI(title="Wind Day-Ahead Monitor API", version="1.0.0")
app.add_middleware(GZipMiddleware, minimum_size=1000)


def parse_gate(gate: str) -> time:
    try:
        return time.fromisoformat(gate)
    except ValueError:
        raise HTTPException(422, "gate must be HH:MM (UK local time)")


def parse_day(day: str) -> date:
    try:
        d = date.fromisoformat(day)
    except ValueError:
        raise HTTPException(422, "day must be YYYY-MM-DD")
    if not an.FIRST_DELIVERY_DAY <= d <= an.LAST_DELIVERY_DAY:
        raise HTTPException(404, f"day outside {an.FIRST_DELIVERY_DAY}..{an.LAST_DELIVERY_DAY}")
    return d


@lru_cache(maxsize=64)  # dataset is immutable, so responses can be memoised
def cached_report(gate: time, corrected: bool) -> dict:
    return an.accuracy_report(load(), gate, corrected)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/meta")
def meta():
    return {
        "deliveryDays": [d.isoformat() for d in an.delivery_days()],
        "defaultGate": an.DEFAULT_GATE_CLOSURE.strftime("%H:%M"),
        "correctionWindowDays": an.CORRECTION_WINDOW_DAYS,
        "dataFetchedAt": load().fetched_at,
        "source": "Elexon BMRS: FUELHH (fuelType=WIND) and WINDFOR",
    }


@app.get("/api/day")
def day(day: str, gate: str = "09:20", corrected: bool = False):
    return an.day_view(load(), parse_day(day), parse_gate(gate), corrected)


@app.get("/api/horizon")
def horizon(day: str, hours: float = Query(24, ge=0, le=48)):
    return an.horizon_view(load(), parse_day(day), hours)


@app.get("/api/accuracy")
def accuracy(gate: str = "09:20", corrected: bool = False):
    return cached_report(parse_gate(gate), corrected)

