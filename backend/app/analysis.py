"""Forecast selection and accuracy statistics. Pure functions over a Dataset.

Conventions
- Times are UTC internally; delivery days and gate closure are UK local time.
- error = actual - forecast (MW). Negative => wind came in BELOW forecast,
  i.e. a shortfall the desk would have had to cover.
- Forecasts are hourly; each is compared with the actual half-hour that starts
  at the same time.
"""
import math
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from .data import Dataset, iso

UK = ZoneInfo("Europe/London")
UTC = ZoneInfo("UTC")

# Purchase decisions made in January 2026 => delivery days 2 Jan .. 1 Feb 2026.
FIRST_DELIVERY_DAY = date(2026, 1, 2)
LAST_DELIVERY_DAY = date(2026, 2, 1)
DEFAULT_GATE_CLOSURE = time(9, 20)  # assumption; configurable in the UI
CORRECTION_WINDOW_DAYS = 14


def delivery_days() -> list:
    n = (LAST_DELIVERY_DAY - FIRST_DELIVERY_DAY).days + 1
    return [FIRST_DELIVERY_DAY + timedelta(days=i) for i in range(n)]


def gate_closure(day: date, gate: time) -> datetime:
    """Decision moment for delivery `day`: `gate` UK time on the previous day."""
    return datetime.combine(day - timedelta(days=1), gate, tzinfo=UK).astimezone(UTC)


def day_slots(day: date, step_minutes: int) -> list:
    """UTC start times covering one UK-local delivery day (handles 23/25h DST days)."""
    start = datetime.combine(day, time(0), tzinfo=UK).astimezone(UTC)
    end = datetime.combine(day + timedelta(days=1), time(0), tzinfo=UK).astimezone(UTC)
    out, t = [], start
    while t < end:
        out.append(t)
        t += timedelta(minutes=step_minutes)
    return out


def quantile(xs: list, q: float):
    if not xs:
        return None
    s = sorted(xs)
    pos = (len(s) - 1) * q
    lo, hi = math.floor(pos), math.ceil(pos)
    return s[lo] + (s[hi] - s[lo]) * (pos - lo)


def summarise(pairs: list) -> dict:
    """Accuracy metrics for a list of (actual, forecast) pairs."""
    if not pairs:
        return {"n": 0}
    errs = [a - f for a, f in pairs]
    n = len(errs)
    mean_actual = sum(a for a, _ in pairs) / n
    mae = sum(abs(e) for e in errs) / n
    return {
        "n": n,
        "mae": mae,
        "rmse": math.sqrt(sum(e * e for e in errs) / n),
        "bias": sum(errs) / n,
        "nmae": mae / mean_actual if mean_actual else None,  # MAE as share of mean output
        "p10": quantile(errs, 0.10),
        "p50": quantile(errs, 0.50),
        "p90": quantile(errs, 0.90),
        "maxShortfall": min(errs),
        "maxSurplus": max(errs),
        "meanActual": mean_actual,
    }


def decision_pairs(ds: Dataset, gate: time, days=None, corrected=False) -> list:
    """Every (day, target, publishTime, actual, forecast) the desk would have used."""
    rows = []
    for d in days or delivery_days():
        cutoff = gate_closure(d, gate)
        k = correction_factor(ds, d, gate) if corrected else 1.0
        for t in day_slots(d, 60):
            fc, act = ds.latest_forecast(t, cutoff), ds.actual(t)
            if fc and act is not None:
                rows.append((d, t, fc[0], act, fc[1] * k))
    return rows


def correction_factor(ds: Dataset, day: date, gate: time) -> float:
    """Scale factor sum(actual)/sum(forecast) over the trailing window of finished days.

    Uses delivery days D-2 .. D-(N+1): their actuals are all published before gate
    closure on D-1, so the correction never uses information the desk did not have.
    """
    hist = decision_pairs(ds, gate, history_window(day))
    total_f = sum(f for *_, f in hist)
    return sum(a for *_, a, _ in hist) / total_f if total_f else 1.0


def history_window(day: date) -> list:
    """Delivery days D-2 .. D-(N+1): fully settled before gate closure on D-1."""
    return [day - timedelta(days=k) for k in range(2, CORRECTION_WINDOW_DAYS + 2)]


def error_band(ds: Dataset, gate: time, day: date, corrected=False) -> tuple:
    """Empirical P10/P90 of decision-time errors over the trailing history window.

    Past-only: uses the same D-2 .. D-(N+1) days as the correction, never later dates.
    This is a historical error range, not a validated predictive interval.
    """
    errs = [a - f for *_, a, f in decision_pairs(ds, gate, history_window(day), corrected)]
    return quantile(errs, 0.10), quantile(errs, 0.90)


def day_view(ds: Dataset, day: date, gate: time, corrected=False) -> dict:
    cutoff = gate_closure(day, gate)
    k = correction_factor(ds, day, gate) if corrected else 1.0
    lo, hi = error_band(ds, gate, day, corrected)
    hourly, pairs, used = [], [], set()
    for t in day_slots(day, 60):
        fc = ds.latest_forecast(t, cutoff)
        f = fc[1] * k if fc else None
        if fc:
            used.add(fc[0])
        a = ds.actual(t)
        if f is not None and a is not None:
            pairs.append((a, f))
        hourly.append({
            "time": iso(t),
            "forecast": f,
            "p10": max(f + lo, 0) if f is not None and lo is not None else None,
            "p90": f + hi if f is not None and hi is not None else None,
            "lead": (t - fc[0]).total_seconds() / 3600 if fc else None,
        })
    actual = [{"time": iso(t), "actual": ds.actual(t)} for t in day_slots(day, 30)]
    # Energy over the day (MWh): hourly forecast points x 1h; half-hour actuals x 0.5h.
    energy = {
        "forecast": sum(h["forecast"] for h in hourly if h["forecast"] is not None),
        "p10": sum(h["p10"] for h in hourly if h["p10"] is not None),
        "actual": sum(a["actual"] * 0.5 for a in actual if a["actual"] is not None),
    }
    return {
        "day": day.isoformat(),
        "gateClosure": iso(cutoff),
        "correctionFactor": k,
        "forecastPublished": [iso(p) for p in sorted(used)],
        "band": {"p10": lo, "p90": hi},
        "hourly": hourly,
        "actual": actual,
        "energyMWh": energy,
        "accuracy": summarise(pairs),
    }


def horizon_view(ds: Dataset, day: date, horizon_h: float) -> dict:
    """For each hour, the latest forecast published at least `horizon_h` hours earlier."""
    rows = []
    for t in day_slots(day, 60):
        fc = ds.latest_forecast(t, t - timedelta(hours=horizon_h))
        rows.append({"time": iso(t), "forecast": fc[1] if fc else None,
                     "published": iso(fc[0]) if fc else None})
    return {"day": day.isoformat(), "horizon": horizon_h, "hourly": rows}


def accuracy_report(ds: Dataset, gate: time, corrected=False) -> dict:
    rows = decision_pairs(ds, gate, corrected=corrected)
    overall = summarise([(a, f) for *_, a, f in rows])

    by_day = [{"day": d.isoformat(), **summarise([(a, f) for dd, _, _, a, f in rows if dd == d])}
              for d in delivery_days()]
    by_hour = [{"hour": h, **summarise([(a, f) for _, t, _, a, f in rows
                                        if t.astimezone(UK).hour == h])}
               for h in range(24)]  # UK local hour of delivery

    # Error histogram, 1 GW bins
    errs = [a - f for *_, a, f in rows]
    width = 1000
    hist: dict = {}
    for e in errs:
        b = math.floor(e / width) * width
        hist[b] = hist.get(b, 0) + 1
    histogram = [{"from": b, "to": b + width, "count": hist[b]} for b in sorted(hist)]

    # Accuracy vs lead time using *every* published forecast, not just the decision ones.
    days = set(delivery_days())
    buckets: dict = {}
    for t, runs in ds.forecasts.items():
        a = ds.actual(t)
        if a is None or t.astimezone(UK).date() not in days:
            continue
        for p, f in runs:
            lead = (t - p).total_seconds() / 3600
            if lead < 48:
                buckets.setdefault(int(lead // 3) * 3, []).append((a, f))
    by_lead = [{"leadFrom": k, "leadTo": k + 3, **summarise(v)} for k, v in sorted(buckets.items())]

    leads = [(t - p).total_seconds() / 3600 for _, t, p, _, _ in rows]
    return {
        "gateClosure": gate.strftime("%H:%M"),
        "corrected": corrected,
        "overall": overall,
        "leadRange": [min(leads), max(leads)] if leads else None,
        "byDay": by_day,
        "byHour": by_hour,
        "byLead": by_lead,
        "histogram": histogram,
    }
