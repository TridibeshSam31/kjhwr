"""Loads the Elexon snapshot into simple in-memory indexes (read-only after startup)."""
import bisect
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

SNAPSHOT = Path(__file__).resolve().parents[1] / "data" / "snapshot.json"


def parse(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


@dataclass
class Dataset:
    actuals: dict    # startTime -> MW (30-min resolution)
    forecasts: dict  # startTime -> [(publishTime, MW)] sorted by publishTime
    fetched_at: str

    def actual(self, t: datetime):
        return self.actuals.get(t)

    def latest_forecast(self, target: datetime, published_by: datetime):
        """Most recent forecast for `target` whose publishTime <= `published_by`.

        This is the no-look-ahead rule: only what was actually available at that moment.
        """
        runs = self.forecasts.get(target)
        if not runs:
            return None
        i = bisect.bisect_right(runs, (published_by, float("inf")))
        return runs[i - 1] if i else None


def build(raw: dict) -> Dataset:
    actuals = {parse(t): float(g) for t, g in raw["actuals"]}
    forecasts: dict = {}
    for pub, start, g in raw["forecasts"]:
        p, s = parse(pub), parse(start)
        if p <= s:  # keep genuine forecasts only (published before the target time)
            forecasts.setdefault(s, []).append((p, float(g)))
    for runs in forecasts.values():
        runs.sort()
    return Dataset(actuals, forecasts, raw.get("fetchedAt", ""))


@lru_cache(maxsize=1)
def load(path: Path = SNAPSHOT) -> Dataset:
    return build(json.loads(path.read_text(encoding="utf-8")))
