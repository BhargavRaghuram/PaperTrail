"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { Extraction, ServiceBook, ServiceEntry } from "@/lib/contracts";
import { ActivityLog, type LogLine } from "@/components/ActivityLog";

async function resizeToJpeg(file: File, maxEdge = 1280, q = 0.8): Promise<{ base64: string; mediaType: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  const dataUrl = canvas.toDataURL("image/jpeg", q);
  return { base64: dataUrl.split(",")[1], mediaType: "image/jpeg" };
}

async function extractOne(file: File, docType: string, stem: string) {
  const { base64, mediaType } = await resizeToJpeg(file);
  const res = await fetch("/api/extract", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ base64, mediaType, docType, stem }),
  });
  const { fragment } = await res.json();
  return fragment;
}

// "✗"/"✓" prefixes are the non-color signal for error/done — a red/green dot alone
// fails the "don't convey status by color alone" accessibility check (ui-ux-pro-max).
function describeFragment(docType: string, f: Record<string, any> | null): string {
  if (!f) return "✗ Could not read this page — skipped";
  if (docType === "rc") {
    const bits = [f.maker, f.model].filter(Boolean).join(" ");
    return `✓ ${bits || "RC read"}${f.owner_serial ? ` · owner ${f.owner_serial}` : ""}`;
  }
  if (docType === "service_book") {
    const n = f.entries?.length ?? 0;
    return `✓ ${n} service entr${n === 1 ? "y" : "ies"} found`;
  }
  if (docType === "insurance") {
    return `✓ ${f.insurer ?? "Policy"}${f.policy_number ? ` · ${f.policy_number}` : ""}`;
  }
  return "✓ Read";
}

function Field({ children, i }: { children: React.ReactNode; i: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={reduce ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.1 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
      style={{ marginBottom: 22 }}
    >
      {children}
    </motion.div>
  );
}

export default function Home() {
  const router = useRouter();
  const [rc, setRc] = useState<File | null>(null);
  const [service, setService] = useState<FileList | null>(null);
  const [insurance, setInsurance] = useState<FileList | null>(null);
  const [claim, setClaim] = useState("");
  const [owners, setOwners] = useState("");
  const [price, setPrice] = useState("");
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<LogLine[]>([]);
  const [error, setError] = useState<string | null>(null);

  function pushLine(id: string, text: string, status: LogLine["status"], kind?: LogLine["kind"]) {
    setLog((prev) => {
      const i = prev.findIndex((l) => l.id === id);
      const line: LogLine = { id, text, status, kind };
      if (i === -1) return [...prev, line];
      const copy = prev.slice();
      copy[i] = line;
      return copy;
    });
  }

  async function extractWithLog(file: File, docType: string, stem: string, id: string, label: string) {
    pushLine(id, `Reading ${label} with OpenAI vision…`, "active", "scan");
    const f = await extractOne(file, docType, stem);
    pushLine(id, describeFragment(docType, f), f ? "done" : "error", "scan");
    return f;
  }

  async function run() {
    setError(null);
    setLog([]);
    setRunning(true);
    try {
      const extraction: Extraction = { rc: null, service_book: null, insurance: [] };

      if (rc) {
        const f = await extractWithLog(rc, "rc", "rc", "rc", "the RC");
        if (f) extraction.rc = f;
      }
      if (service && service.length) {
        const entries: ServiceEntry[] = [];
        let vehicle: ServiceBook["vehicle"] | undefined;
        for (let i = 0; i < service.length; i++) {
          const f = await extractWithLog(service[i], "service_book", `service_book_p${i + 1}`, `svc-${i}`, `service book page ${i + 1}`);
          if (f?.entries) entries.push(...f.entries);
          if (f?.vehicle && !vehicle) vehicle = f.vehicle;
        }
        extraction.service_book = { document_type: "service_book", vehicle, entries };
      }
      if (insurance && insurance.length) {
        for (let i = 0; i < insurance.length; i++) {
          const f = await extractWithLog(insurance[i], "insurance", `insurance_${i + 1}`, `ins-${i}`, `insurance page ${i + 1}`);
          if (f) extraction.insurance.push(f);
        }
      }

      pushLine("verify", "Cross-checking the papers and searching SerpApi for market price & part costs…", "active", "search");
      const seller_claim = { claimed_owners: owners ? Number(owners) : null, raw_text: claim };
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ extraction, seller_claim, asking_price_inr: price ? Number(price) : null }),
      });
      const report = await res.json();
      const n = report.flags?.length ?? 0;
      const marketBit = report.market ? ` · market ₹${Math.round(report.market.low / 1000)}k–₹${Math.round(report.market.high / 1000)}k` : "";
      pushLine("verify", `✓ ${n} issue${n === 1 ? "" : "s"} found${marketBit}`, "done", "search");

      sessionStorage.setItem("papertrail_report", JSON.stringify(report));
      router.push("/report");
    } catch (e) {
      // Flip whichever line was mid-flight to error instead of leaving its pulse spinning forever —
      // we don't know which await threw, so resolve every still-"active" line, not just add a new one.
      setLog((prev) => prev.map((l) => (l.status === "active" ? { ...l, status: "error", text: "✗ Something went wrong — please try again." } : l)));
      setError("Something went wrong reading the documents. Please try again.");
      setRunning(false);
      console.error(e);
    }
  }

  const canSubmit = !!rc && !running;
  const reduce = useReducedMotion();

  const fileCount = (fl: FileList | null) => (fl && fl.length ? `${fl.length} page${fl.length > 1 ? "s" : ""} selected` : null);

  return (
    <main style={{ maxWidth: 580, margin: "0 auto", padding: "clamp(32px, 6vw, 72px) 22px 80px" }}>
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={reduce ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="eyebrow" style={{ letterSpacing: "0.24em" }}>
          <span className="iris-text" style={{ fontWeight: 600 }}>PaperTrail</span> · provenance check
        </div>
        <h1 style={{ fontSize: "clamp(32px, 7vw, 50px)", margin: "12px 0 10px", letterSpacing: "-0.04em", lineHeight: 1.04 }}>
          Verify a used car&apos;s history
        </h1>
        <p style={{ color: "var(--ink-2)", margin: "0 0 34px", maxWidth: "50ch", fontSize: 16, lineHeight: 1.5 }}>
          Photograph the car&apos;s papers. We rebuild its timeline and surface what doesn&apos;t add up —
          before any money changes hands.
        </p>
      </motion.div>

      <Field i={0}>
        <label htmlFor="rc" className="field-label">RC book</label>
        <p className="field-help">Registration certificate — front and back if you have them.</p>
        <input id="rc" className="input" type="file" accept="image/*" onChange={(e) => setRc(e.target.files?.[0] ?? null)} />
        {rc && <p className="eyebrow" style={{ marginTop: 7, color: "var(--ok)" }}>{rc.name}</p>}
      </Field>

      <Field i={1}>
        <label htmlFor="svc" className="field-label">Service book pages</label>
        <p className="field-help">As many stamped pages as you can — this is where the story lives.</p>
        <input id="svc" className="input" type="file" accept="image/*" multiple onChange={(e) => setService(e.target.files)} />
        {fileCount(service) && <p className="eyebrow" style={{ marginTop: 7, color: "var(--ok)" }}>{fileCount(service)}</p>}
      </Field>

      <Field i={2}>
        <label htmlFor="ins" className="field-label">Insurance <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>· optional</span></label>
        <p className="field-help">The policy schedule pages, if the seller has them.</p>
        <input id="ins" className="input" type="file" accept="image/*" multiple onChange={(e) => setInsurance(e.target.files)} />
        {fileCount(insurance) && <p className="eyebrow" style={{ marginTop: 7, color: "var(--ok)" }}>{fileCount(insurance)}</p>}
      </Field>

      <Field i={3}>
        <label htmlFor="claim" className="field-label">What did the seller tell you?</label>
        <p className="field-help">In their words — we check it against the papers.</p>
        <textarea id="claim" className="input" style={{ minHeight: 68, resize: "vertical" }} placeholder="e.g. Single owner, no accidents, full service history" value={claim} onChange={(e) => setClaim(e.target.value)} />
      </Field>

      <Field i={4}>
        <label htmlFor="own" className="field-label">How many owners did they claim?</label>
        <input id="own" className="input" type="number" min={1} placeholder="1" value={owners} onChange={(e) => setOwners(e.target.value)} />
      </Field>

      <Field i={5}>
        <label htmlFor="price" className="field-label">Asking price <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>· ₹</span></label>
        <p className="field-help">We compare it against similar cars on the market.</p>
        <input id="price" className="input" type="number" min={0} placeholder="e.g. 450000" value={price} onChange={(e) => setPrice(e.target.value)} />
      </Field>

      {error && (
        <p role="alert" style={{ color: "var(--danger)", fontSize: 14, marginBottom: 12 }}>{error}</p>
      )}

      <button type="button" onClick={run} disabled={!canSubmit} aria-busy={running}
        className="btn btn-primary" style={{ width: "100%", padding: "15px 20px", fontSize: 15.5 }}>
        {running ? (
          <>
            <motion.span aria-hidden
              style={{ width: 15, height: 15, borderRadius: "50%", border: "2px solid currentColor", borderTopColor: "transparent", display: "inline-block" }}
              animate={reduce ? undefined : { rotate: 360 }}
              transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }} />
            Checking…
          </>
        ) : "Check this car"}
      </button>

      <ActivityLog lines={log} />

      {!rc && !running && (
        <p style={{ color: "var(--ink-3)", fontSize: 13, marginTop: 10, textAlign: "center" }}>Add the RC to begin.</p>
      )}
      <p className="eyebrow" style={{ marginTop: 20, textAlign: "center", letterSpacing: "0.14em" }}>
        No login · nothing saved · one car, one check
      </p>
    </main>
  );
}
