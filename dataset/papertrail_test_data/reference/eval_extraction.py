"""Score your Claude Vision extraction against ground truth.
Usage: python reference/eval_extraction.py <scenario_id> <your_extraction.json>
Compares service entries (date + odometer_km), RC key fields and insurance periods."""
import json, sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
sid, mine = sys.argv[1], json.load(open(sys.argv[2]))
gt = json.load(open(ROOT / f"scenarios/{sid}/expected/extraction.json"))
score, total, misses = 0, 0, []
def chk(label, a, b):
    global score, total
    total += 1
    if a == b: score += 1
    else: misses.append(f"{label}: expected {a!r}, got {b!r}")
for k in ["registration_number", "registration_date", "chassis_number", "owner_serial"]:
    a, b = gt["rc"][k], (mine.get("rc") or {}).get(k)
    if k in ("registration_number", "chassis_number") and a and b: a, b = a.replace(" ", "").upper(), b.replace(" ", "").upper()
    chk(f"rc.{k}", a, b)
g_e = gt["service_book"]["entries"]; m_e = (mine.get("service_book") or {}).get("entries", [])
m_by = {}
for e in m_e: m_by.setdefault(e.get("date"), []).append(e)
for e in g_e:
    cand = m_by.get(e["date"], [])
    got = cand.pop(0) if cand else {}
    chk(f"service[{e['date']}].date", e["date"], got.get("date"))
    if "odometer_km" in e.get("low_confidence_fields", []):
        ok = got.get("odometer_km") is None or "odometer_km" in got.get("low_confidence_fields", [])
        chk(f"service[{e['date']}].odometer_km should be low-confidence (NOT guessed)", True, ok)
    else:
        chk(f"service[{e['date']}].odometer_km", e["odometer_km"], got.get("odometer_km"))
for i, p in enumerate(gt["insurance"]):
    got = (mine.get("insurance") or [{}] * 99)[i] if i < len(mine.get("insurance") or []) else {}
    chk(f"insurance[{i}].period", (p["period_start"], p["period_end"]), (got.get("period_start"), got.get("period_end")))
print(f"{sid}: {score}/{total} fields correct ({100*score/max(total,1):.0f}%)")
for m in misses: print("  ✗", m)
