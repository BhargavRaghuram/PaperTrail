"""Run: pytest reference/  (from the dataset root)
Checks the reference rules engine against every scenario. Swap `engine` for your own
timeline/reconciliation module to use this as your regression suite."""
import json, pathlib, pytest
import engine

ROOT = pathlib.Path(__file__).resolve().parent.parent
FIX = json.loads((ROOT / "fixtures/all_scenarios.json").read_text())

@pytest.mark.parametrize("sc", FIX, ids=[s["id"] for s in FIX])
def test_rules(sc):
    tl = engine.build_timeline(sc["extraction"])
    flags = engine.reconcile(sc["extraction"], tl, sc["seller_claim"])
    assert sorted({f["rule"] for f in flags}) == sc["expected_rules"]
    assert len(engine.unreadable_notices(sc["extraction"])) == sc["expected_unreadable"]

@pytest.mark.parametrize("sc", FIX, ids=[s["id"] for s in FIX])
def test_timeline_sorted(sc):
    tl = engine.build_timeline(sc["extraction"])
    assert [e["date"] for e in tl] == sorted(e["date"] for e in tl)
