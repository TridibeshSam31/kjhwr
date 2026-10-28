"""Unit tests on a tiny synthetic dataset, so expected values can be checked by hand."""
from datetime import date, datetime, time, timezone

from app import analysis as an
from app.data import build

UTC = timezone.utc


def ds_with(forecasts, actuals):
    return build({"actuals": actuals, "forecasts": forecasts, "fetchedAt": "test"})


def test_latest_forecast_respects_publish_time():
    ds = ds_with(
        forecasts=[
            ["2026-01-14T07:30:00Z", "2026-01-15T12:00:00Z", 1000],
            ["2026-01-14T09:30:00Z", "2026-01-15T12:00:00Z", 2000],  # after 09:20 gate
        ],
        actuals=[],
    )
    target = datetime(2026, 1, 15, 12, tzinfo=UTC)
    cutoff = an.gate_closure(date(2026, 1, 15), time(9, 20))
    assert ds.latest_forecast(target, cutoff)[1] == 1000
    # Exactly at the publish time counts as available
    assert ds.latest_forecast(target, datetime(2026, 1, 14, 9, 30, tzinfo=UTC))[1] == 2000
    assert ds.latest_forecast(target, datetime(2026, 1, 14, 7, 0, tzinfo=UTC)) is None


def test_forecasts_published_after_target_are_dropped():
    ds = ds_with(forecasts=[["2026-01-15T13:00:00Z", "2026-01-15T12:00:00Z", 5]], actuals=[])
    assert ds.forecasts == {}


def test_gate_closure_is_uk_local_time_on_previous_day():
    assert an.gate_closure(date(2026, 1, 15), time(9, 20)) == datetime(2026, 1, 14, 9, 20, tzinfo=UTC)
    # British Summer Time: 09:20 BST is 08:20 UTC
    assert an.gate_closure(date(2026, 7, 15), time(9, 20)) == datetime(2026, 7, 14, 8, 20, tzinfo=UTC)


def test_day_slots_handle_dst_change():
    assert len(an.day_slots(date(2026, 1, 15), 30)) == 48
    assert len(an.day_slots(date(2026, 3, 29), 30)) == 46  # clocks go forward
    assert len(an.day_slots(date(2026, 10, 25), 30)) == 50  # clocks go back


def test_summarise_sign_convention():
    s = an.summarise([(900, 1000), (1100, 1000)])
    assert s["bias"] == 0 and s["mae"] == 100
    s = an.summarise([(800, 1000)])
    assert s["bias"] == -200  # negative = wind below forecast = shortfall
    assert s["maxShortfall"] == -200


def test_quantile_interpolates():
    assert an.quantile([0, 10], 0.5) == 5
    assert an.quantile([], 0.5) is None


def test_correction_factor_uses_only_finished_days():
    day = date(2026, 1, 20)
    rows_f, rows_a = [], []
    for d, ratio in ((date(2026, 1, 18), 0.5), (date(2026, 1, 19), 99.0)):  # D-2 and D-1
        cutoff = an.gate_closure(d, time(9, 20))
        for t in an.day_slots(d, 60):
            rows_f.append([cutoff.strftime("%Y-%m-%dT%H:%M:%SZ"), t.strftime("%Y-%m-%dT%H:%M:%SZ"), 1000])
            rows_a.append([t.strftime("%Y-%m-%dT%H:%M:%SZ"), 1000 * ratio])
    ds = ds_with(rows_f, rows_a)
    # D-1 is not finished at gate closure, so its (absurd) ratio must be ignored.
    assert an.correction_factor(ds, day, time(9, 20)) == 0.5


def test_error_band_ignores_later_days():
    def rows(days_and_ratios):
        f, a = [], []
        for d, ratio in days_and_ratios:
            cutoff = an.gate_closure(d, time(9, 20)).strftime("%Y-%m-%dT%H:%M:%SZ")
            for t in an.day_slots(d, 60):
                ts = t.strftime("%Y-%m-%dT%H:%M:%SZ")
                f.append([cutoff, ts, 1000])
                a.append([ts, 1000 * ratio])
        return f, a

    day = date(2026, 1, 20)
    past = [(date(2026, 1, 18), 0.8)]
    base = an.error_band(ds_with(*rows(past)), time(9, 20), day)
    # Adding a wildly wrong *later* day must not change the band for `day`.
    later = an.error_band(ds_with(*rows(past + [(date(2026, 1, 25), 5.0)])), time(9, 20), day)
    assert base == later == (-200, -200)
