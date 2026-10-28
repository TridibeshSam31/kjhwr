"""Print the headline numbers used in docs/ANALYSIS.md.  Usage: python backend/scripts/explore.py"""
import sys
from datetime import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.analysis import accuracy_report  # noqa: E402
from app.data import load  # noqa: E402

ds = load()
for gate in (time(9, 20), time(11, 0), time(16, 0)):
    r = accuracy_report(ds, gate)
    o = r["overall"]
    print(f"gate {gate}: n={o['n']} MAE={o['mae']:.0f} RMSE={o['rmse']:.0f} bias={o['bias']:.0f} "
          f"nMAE={o['nmae']:.1%} P10={o['p10']:.0f} P90={o['p90']:.0f} "
          f"worst shortfall={o['maxShortfall']:.0f} lead={r['leadRange']}")

r = accuracy_report(ds, time(9, 20))
print("\nlead(h)  n   MAE   bias   P10    P90")
for x in r["byLead"]:
    print(f"{x['leadFrom']:>3}-{x['leadTo']:<3} {x['n']:>4} {x['mae']:>5.0f} {x['bias']:>6.0f} "
          f"{x['p10']:>6.0f} {x['p90']:>6.0f}")
print("\nworst days:", [(d["day"], round(d["mae"])) for d in sorted(r["byDay"], key=lambda d: -d["mae"])[:5]])
print("best days:", [(d["day"], round(d["mae"])) for d in sorted(r["byDay"], key=lambda d: d["mae"])[:3]])
print("by hour MAE:", [round(h["mae"]) for h in r["byHour"]])
