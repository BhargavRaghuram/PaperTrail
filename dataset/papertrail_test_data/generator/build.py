import json, random, shutil, os, csv, sys
sys.path.insert(0, os.path.dirname(__file__))
from scenarios import SCENARIOS
from engine import build_timeline, reconcile, unreadable_notices, questions
from render import render_rc, render_service_page, render_insurance, photo

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "out")
shutil.rmtree(OUT, ignore_errors=True); os.makedirs(OUT)
manifest, fixtures = [], []

for sc in SCENARIOS:
    rng = random.Random(sc["id"])
    base = f"{OUT}/scenarios/{sc['id']}"; os.makedirs(f"{base}/images"); os.makedirs(f"{base}/expected")
    rc, book, aug = sc["rc"], sc["book"], sc.get("augment", {})
    def save(img, name, ops=()):
        p = f"{base}/images/{name}.jpg"; photo(img, rng, ops).save(p, quality=rng.randint(72, 86))
        manifest.append(dict(scenario=sc["id"], file=f"scenarios/{sc['id']}/images/{name}.jpg", doc_type=name.split("_p")[0].rstrip("0123456789_")))
    # --- RC
    save(render_rc(rc, rng), "rc")
    # --- service book
    rows = []
    for i, s in enumerate(sc["services"]):
        rows.append(dict(sr=i+1, date=s[0], km=s[1], type=s[2], dealer=s[3], extra=(s[4] if len(s) > 4 else {})))
    rpp = sc.get("rows_per_page", 5)
    chunks = [rows[i:i+rpp] for i in range(0, len(rows), rpp)]
    order = list(range(len(chunks)))
    if sc.get("page_order") == "reverse": order = order[::-1]
    entries = []
    for file_idx, booklet_idx in enumerate(order, start=1):
        name = f"service_book_p{file_idx}"
        ops = aug.get("service", []) + aug.get(f"service_p{file_idx}", [])
        save(render_service_page(booklet_idx+1, chunks[booklet_idx], book, rc, rng, booklet_idx == 0, sc.get("date_fmt","dmy")), name, ops)
        for r in chunks[booklet_idx]:
            ex = r["extra"]; e = dict(date=r["date"], odometer_km=r["km"], service_type=r["type"], dealer=r["dealer"],
                                      source=name, confidence="high", low_confidence_fields=[], notes=ex.get("note"))
            if ex.get("blot"):
                e.update(odometer_km=None, confidence="low", low_confidence_fields=["odometer_km"],
                         _eval_true_odometer_km=r["km"], notes="Odometer value obscured by ink blot")
            if r["date"] is None:
                e.update(confidence="medium", notes="Row stamped by dealer but date and odometer were never written")
            entries.append(e)
    entries.sort(key=lambda e: (e["date"] or "9999", e["odometer_km"] or 0))
    # --- insurance
    pols = sc["policies_fn"]()
    ins = []
    for i, p in enumerate(pols, start=1):
        if i > 1: p["prev"] = pols[i-2]["policy_number"]
        save(render_insurance(p, rc, rng), f"insurance_{i}")
        ins.append(dict(document_type="insurance", source=f"insurance_{i}", policy_number=p["policy_number"], insurer=p["insurer"],
                        registration_number=rc["reg"], chassis_number=rc["chassis"], insured_name=rc["owner"],
                        period_start=p["start"], period_end=p["end"], ncb_percent=p["ncb_percent"],
                        previous_policy_number=p.get("prev"), confidence="high", low_confidence_fields=[]))
    extraction = dict(
        rc=dict(document_type="rc", source="rc", registration_number=rc["reg"], registration_date=rc["reg_date"],
                chassis_number=rc["chassis"], engine_number=rc["engine"], owner_name=rc["owner"], owner_serial=rc["owner_serial"],
                maker=rc["maker"], model=rc["model"], fuel=rc["fuel"], colour=rc["colour"], month_year_of_mfg=rc["mfg"],
                financier=None if rc["financier"] == "None" else rc["financier"], confidence="high", low_confidence_fields=[]),
        service_book=dict(document_type="service_book", vehicle=dict(registration_number=book["reg"], chassis_number=book["chassis"],
                          date_of_sale=book["sale_date"], source="service_book_p" + str(order.index(0)+1)), entries=entries),
        insurance=ins)
    seller = dict(claimed_owners=sc["seller"]["claimed_owners"], raw_text=sc["seller"]["text"])
    tl = build_timeline(extraction); flags = reconcile(extraction, tl, seller)
    got = sorted({f["rule"] for f in flags}); want = sorted(set(sc["expected"]))
    assert got == want, f"{sc['id']}: engine {got} != declared {want}"
    out = dict(flags=flags, unreadable_notices=unreadable_notices(extraction), questions=questions(flags))
    J = lambda p, o: json.dump(o, open(p, "w"), indent=2, ensure_ascii=False)
    J(f"{base}/expected/extraction.json", extraction); J(f"{base}/expected/timeline.json", tl)
    J(f"{base}/expected/report.json", out); J(f"{base}/seller_claim.json", seller)
    open(f"{base}/README.md", "w").write(
        f"# {sc['id']}\n\n**{sc['title']}**\n\n{sc['purpose']}\n\nSeller's claim: \"{seller['raw_text']}\"\n\n"
        f"Expected rules fired: {', '.join(want) or 'none'}\n\nImages: {', '.join(sorted(os.listdir(base+'/images')))}\n")
    fixtures.append(dict(id=sc["id"], title=sc["title"], seller_claim=seller, extraction=extraction, expected_rules=want,
                         expected_unreadable=len(out["unreadable_notices"])))
    print(f"{sc['id']:35s} imgs={len(os.listdir(base+'/images'))} flags={got}")

os.makedirs(f"{OUT}/fixtures"); json.dump(fixtures, open(f"{OUT}/fixtures/all_scenarios.json", "w"), indent=2, ensure_ascii=False)
with open(f"{OUT}/manifest.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["scenario", "file", "doc_type"]); w.writeheader(); w.writerows(manifest)
os.makedirs(f"{OUT}/reference"); shutil.copy(os.path.dirname(__file__) + "/engine.py", f"{OUT}/reference/engine.py")
