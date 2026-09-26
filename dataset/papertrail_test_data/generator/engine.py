"""Reference (deterministic) Timeline Builder + Reconciliation rules for PaperTrail.
Used to derive expected outputs for every scenario. Mirror of the MVP rules in the plan."""
from datetime import date, timedelta
import re

JUMP_KM_PER_DAY = 150
GAP_DAYS = 365          # flag only if STRICTLY greater
GAP_KM = 15000          # flag only if STRICTLY greater
MIN_DATED_SERVICE = 2

QUESTION_TEMPLATES = {
    "odometer_regression": "Can you explain why the recorded mileage went down between {a} and {b}?",
    "implausible_mileage_jump": "The car appears to have covered {km:,} km in {days} days between {a} and {b}. Can you explain this usage?",
    "service_gap": "What happened during the gap in service history between {a} and {b}?",
    "insurance_lapse": "Why was the car uninsured between {a} and {b}? Was it involved in any incident during that period?",
    "ownership_mismatch": "The RC shows this is owner no. {rc}. Can you clarify how many previous owners the car has had?",
    "missing_service_history": "Can you share any service invoices or job cards, since the service book has fewer than 2 dated entries?",
    "document_identity_mismatch": "The {field} on the {doc} does not match the RC. Is this document for the same car?",
}

def norm_id(s): return re.sub(r"[^A-Z0-9]", "", (s or "").upper())
def D(s): return date.fromisoformat(s) if s else None

def usable(entry, field):
    return entry.get(field) is not None and field not in entry.get("low_confidence_fields", [])

def build_timeline(ext):
    ev = []
    rc = ext.get("rc")
    if rc and rc.get("registration_date"):
        ev.append(dict(date=rc["registration_date"], type="registration", odometer_km=0,
                       source=rc["source"], note="Odometer assumed 0 at first registration (new vehicle)"))
    sb = ext.get("service_book")
    if sb:
        for e in sb["entries"]:
            if not usable(e, "date"): continue
            ev.append(dict(date=e["date"], type="service", service_type=e.get("service_type"),
                           odometer_km=e["odometer_km"] if usable(e, "odometer_km") else None,
                           source=e["source"], note=e.get("notes")))
    for p in ext.get("insurance", []):
        ev.append(dict(date=p["period_start"], type="insurance_start", policy_number=p["policy_number"], source=p["source"]))
        ev.append(dict(date=p["period_end"], type="insurance_end", policy_number=p["policy_number"], source=p["source"]))
    order = {"registration":0, "insurance_start":1, "service":2, "insurance_end":3}
    ev.sort(key=lambda x: (x["date"], order[x["type"]], x.get("odometer_km") or 0))
    return ev

def reconcile(ext, timeline, seller):
    flags = []
    readings = [e for e in timeline if e.get("odometer_km") is not None]
    for a, b in zip(readings, readings[1:]):
        days = (D(b["date"]) - D(a["date"])).days
        diff = b["odometer_km"] - a["odometer_km"]
        if diff < 0:
            f = dict(rule="odometer_regression", severity="high", entries=[a["date"], b["date"]],
                     values_km=[a["odometer_km"], b["odometer_km"]], sources=[a["source"], b["source"]],
                     explanation=f"Mileage decreased from {a['odometer_km']:,} km to {b['odometer_km']:,} km between two dated records.")
            if b.get("note"): f["context"] = b["note"]
            flags.append(f)
        elif diff / max(days, 1) > JUMP_KM_PER_DAY:
            flags.append(dict(rule="implausible_mileage_jump", severity="medium", entries=[a["date"], b["date"]],
                              values_km=[a["odometer_km"], b["odometer_km"]], days=days,
                              km_per_day=round(diff / max(days, 1), 1),
                              explanation=f"{diff:,} km in {days} days (~{diff/max(days,1):.0f} km/day) exceeds the {JUMP_KM_PER_DAY} km/day threshold."))
    services = [e for e in timeline if e["type"] == "service"]
    for a, b in zip(services, services[1:]):
        days = (D(b["date"]) - D(a["date"])).days
        km = (b["odometer_km"] - a["odometer_km"]) if (a["odometer_km"] is not None and b["odometer_km"] is not None) else None
        reasons = []
        if days > GAP_DAYS: reasons.append(f"{days} days (> {GAP_DAYS})")
        if km is not None and km > GAP_KM: reasons.append(f"{km:,} km (> {GAP_KM:,})")
        if reasons:
            flags.append(dict(rule="service_gap", severity="medium", entries=[a["date"], b["date"]],
                              gap_days=days, gap_km=km, explanation="Gap between services: " + " and ".join(reasons) + "."))
    pol = sorted(ext.get("insurance", []), key=lambda p: p["period_start"])
    for a, b in zip(pol, pol[1:]):
        gap = (D(b["period_start"]) - D(a["period_end"])).days - 1
        if gap > 0:
            flags.append(dict(rule="insurance_lapse", severity="medium", entries=[a["period_end"], b["period_start"]],
                              uninsured_days=gap, policies=[a["policy_number"], b["policy_number"]],
                              explanation=f"No insurance cover for {gap} days between consecutive policies."))
    rc = ext.get("rc")
    if rc and seller.get("claimed_owners") is not None and rc.get("owner_serial") is not None \
       and rc["owner_serial"] != seller["claimed_owners"]:
        flags.append(dict(rule="ownership_mismatch", severity="high", rc_owner_serial=rc["owner_serial"],
                          seller_claimed_owners=seller["claimed_owners"],
                          explanation=f"RC owner serial number is {rc['owner_serial']} but the seller claims {seller['claimed_owners']} owner(s)."))
    if len(services) < MIN_DATED_SERVICE:
        flags.append(dict(rule="missing_service_history", severity="low", dated_entries=len(services),
                          explanation="No maintenance record available — treat as unverified."))
    if rc:
        for doc in [ext.get("service_book")] + ext.get("insurance", []):
            if not doc: continue
            for fld in ["registration_number", "chassis_number"]:
                v = doc.get(fld) if "vehicle" not in doc else doc["vehicle"].get(fld)
                if v and norm_id(v) != norm_id(rc[fld]):
                    flags.append(dict(rule="document_identity_mismatch", severity="high", field=fld,
                                      document=doc["source"] if "source" in doc else doc["document_type"],
                                      rc_value=rc[fld], document_value=v,
                                      explanation=f"{fld} on {doc['document_type']} ({v}) does not match RC ({rc[fld]})."))
    return flags

def unreadable_notices(ext):
    out = []
    sb = ext.get("service_book")
    for e in (sb or {}).get("entries", []):
        for f in e.get("low_confidence_fields", []):
            out.append(dict(source=e["source"], field=f, message=f"{e['source']} contains an unreadable {f.replace('_',' ')}. Please retake the photo."))
    return out

def questions(flags):
    qs, seen = [], set()
    for f in flags:
        r = f["rule"]
        if r == "document_identity_mismatch":
            key = (r, f["document"])
            q = QUESTION_TEMPLATES[r].format(field=f["field"].replace("_", " "), doc=f["document"])
        elif r == "ownership_mismatch":
            key = (r,); q = QUESTION_TEMPLATES[r].format(rc=f["rc_owner_serial"])
        elif r == "missing_service_history":
            key = (r,); q = QUESTION_TEMPLATES[r]
        elif r == "implausible_mileage_jump":
            key = (r, *f["entries"]); q = QUESTION_TEMPLATES[r].format(km=f["values_km"][1]-f["values_km"][0], days=f["days"], a=f["entries"][0], b=f["entries"][1])
        else:
            key = (r, *f["entries"]); q = QUESTION_TEMPLATES[r].format(a=f["entries"][0], b=f["entries"][1])
        if key in seen: continue
        seen.add(key); qs.append(dict(rule=r, question=q))
    return qs
