"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Extraction, ServiceBook, ServiceEntry } from "@/lib/contracts";

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

const field: React.CSSProperties = { marginBottom: 22 };
const labelStyle: React.CSSProperties = { display: "block", fontWeight: 600, fontSize: 14.5, marginBottom: 2 };
const helpStyle: React.CSSProperties = { color: "var(--ink-3)", fontSize: 13, margin: "0 0 8px" };
const inputStyle: React.CSSProperties = {
  display: "block", width: "100%", padding: "11px 12px", fontSize: 14,
  background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--hair-strong)",
  borderRadius: 10, fontFamily: "var(--font-body)",
};

export default function Home() {
  const router = useRouter();
  const [rc, setRc] = useState<File | null>(null);
  const [service, setService] = useState<FileList | null>(null);
  const [insurance, setInsurance] = useState<FileList | null>(null);
  const [claim, setClaim] = useState("");
  const [owners, setOwners] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    try {
      setBusy("Reading the RC…");
      const extraction: Extraction = { rc: null, service_book: null, insurance: [] };

      if (rc) {
        const f = await extractOne(rc, "rc", "rc");
        if (f) extraction.rc = f;
      }
      if (service && service.length) {
        setBusy("Reading the service book…");
        const entries: ServiceEntry[] = [];
        let vehicle: ServiceBook["vehicle"] | undefined;
        for (let i = 0; i < service.length; i++) {
          const f = await extractOne(service[i], "service_book", `service_book_p${i + 1}`);
          if (f?.entries) entries.push(...f.entries);
          if (f?.vehicle && !vehicle) vehicle = f.vehicle;
        }
        extraction.service_book = { document_type: "service_book", vehicle, entries };
      }
      if (insurance && insurance.length) {
        setBusy("Reading the insurance…");
        for (let i = 0; i < insurance.length; i++) {
          const f = await extractOne(insurance[i], "insurance", `insurance_${i + 1}`);
          if (f) extraction.insurance.push(f);
        }
      }

      setBusy("Reconstructing the timeline…");
      const seller_claim = { claimed_owners: owners ? Number(owners) : null, raw_text: claim };
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ extraction, seller_claim }),
      });
      const report = await res.json();
      sessionStorage.setItem("papertrail_report", JSON.stringify(report));
      router.push("/report");
    } catch (e) {
      setBusy(null);
      setError("Something went wrong reading the documents. Please try again.");
      console.error(e);
    }
  }

  const canSubmit = !!rc && !busy;

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "clamp(32px, 6vw, 64px) 22px 80px" }}>
      <div style={{ fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--ink-3)" }}>
        PaperTrail
      </div>
      <h1 style={{ fontSize: "clamp(34px, 7vw, 52px)", margin: "10px 0 8px", letterSpacing: "-0.02em" }}>
        Verify a used car&apos;s history
      </h1>
      <p style={{ color: "var(--ink-2)", margin: "0 0 32px", maxWidth: "48ch", fontSize: 16 }}>
        Photograph the car&apos;s papers. We rebuild its timeline and surface what doesn&apos;t add up —
        before any money changes hands.
      </p>

      <div style={field}>
        <label htmlFor="rc" style={labelStyle}>RC book</label>
        <p style={helpStyle}>Registration certificate — front and back if you have them.</p>
        <input id="rc" style={inputStyle} type="file" accept="image/*" onChange={(e) => setRc(e.target.files?.[0] ?? null)} />
      </div>

      <div style={field}>
        <label htmlFor="svc" style={labelStyle}>Service book pages</label>
        <p style={helpStyle}>As many stamped pages as you can — this is where the story lives.</p>
        <input id="svc" style={inputStyle} type="file" accept="image/*" multiple onChange={(e) => setService(e.target.files)} />
      </div>

      <div style={field}>
        <label htmlFor="ins" style={labelStyle}>Insurance <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>· optional</span></label>
        <p style={helpStyle}>The policy schedule pages, if the seller has them.</p>
        <input id="ins" style={inputStyle} type="file" accept="image/*" multiple onChange={(e) => setInsurance(e.target.files)} />
      </div>

      <div style={field}>
        <label htmlFor="claim" style={labelStyle}>What did the seller tell you?</label>
        <p style={helpStyle}>In their words — we check it against the papers.</p>
        <textarea id="claim" style={{ ...inputStyle, minHeight: 64, resize: "vertical" }} placeholder="e.g. Single owner, no accidents, full service history" value={claim} onChange={(e) => setClaim(e.target.value)} />
      </div>

      <div style={field}>
        <label htmlFor="own" style={labelStyle}>How many owners did they claim?</label>
        <input id="own" style={inputStyle} type="number" min={1} placeholder="1" value={owners} onChange={(e) => setOwners(e.target.value)} />
      </div>

      {error && (
        <p role="alert" style={{ color: "var(--danger)", fontSize: 14, marginBottom: 12 }}>{error}</p>
      )}

      <button
        type="button"
        onClick={run}
        disabled={!canSubmit}
        aria-busy={!!busy}
        style={{
          width: "100%", padding: "15px 20px", borderRadius: 12, border: "none",
          background: canSubmit ? "var(--ink)" : "var(--hair-strong)",
          color: canSubmit ? "var(--paper)" : "var(--ink-3)",
          fontWeight: 700, fontSize: 16, fontFamily: "var(--font-body)",
          cursor: canSubmit ? "pointer" : "not-allowed", transition: "background 160ms ease",
        }}
      >
        {busy ?? "Check this car"}
      </button>
      {!rc && !busy && (
        <p style={{ color: "var(--ink-3)", fontSize: 13, marginTop: 10, textAlign: "center" }}>Add the RC to begin.</p>
      )}
      <p style={{ color: "var(--ink-3)", fontSize: 13, marginTop: 18, textAlign: "center" }}>
        No login. Nothing saved. One car, one check.
      </p>
    </main>
  );
}
