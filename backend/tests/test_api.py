"""Smoke tests against the real January 2026 snapshot."""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_meta_lists_january_decision_days():
    m = client.get("/api/meta").json()
    assert m["deliveryDays"][0] == "2026-01-02"
    assert m["deliveryDays"][-1] == "2026-02-01"


def test_day_view_has_full_day_and_no_lookahead():
    d = client.get("/api/day", params={"day": "2026-01-15"}).json()
    assert len(d["actual"]) == 48 and len(d["hourly"]) == 24
    assert all(p <= d["gateClosure"] for p in d["forecastPublished"])
    assert d["band"]["p10"] < d["band"]["p90"]


def test_correction_reduces_error_over_january():
    raw = client.get("/api/accuracy").json()["overall"]
    cor = client.get("/api/accuracy", params={"corrected": "true"}).json()["overall"]
    assert raw["n"] == cor["n"] == 31 * 24
    assert cor["mae"] < raw["mae"]


def test_horizon_view():
    h = client.get("/api/horizon", params={"day": "2026-01-15", "hours": 4}).json()
    assert len(h["hourly"]) == 24
    assert all(r["published"] <= r["time"] for r in h["hourly"] if r["published"])


def test_bad_input_is_rejected():
    assert client.get("/api/day", params={"day": "2025-06-01"}).status_code == 404
    assert client.get("/api/day", params={"day": "2026-01-15", "gate": "25:99"}).status_code == 422
    assert client.get("/api/horizon", params={"day": "2026-01-15", "hours": 99}).status_code == 422
