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

const box: React.CSSProperties = {
  display: "block", width: "100%", padding: "10px 12px", margin: "6px 0 16px",
  background: "#0f172a", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 8,
};
const btn: React.CSSProperties = {
  padding: "12px 20px", borderRadius: 10, border: "none", background: "#e11d48",
  color: "white", fontWeight: 800, fontSize: 16, cursor: "pointer", width: "100%",
};

export default function Home() {
  const router = useRouter();
  const [rc, setRc] = useState<File | null>(null);
  const [service, setService] = useState<FileList | null>(null);
  const [insurance, setInsurance] = useState<FileList | null>(null);
  const [claim, setClaim] = useState("");
  const [owners, setOwners] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function run() {
    try {
      setBusy("Reading documents…");
      const extraction: Extraction = { rc: null, service_book: null, insurance: [] };

      if (rc) {
        const f = await extractOne(rc, "rc", "rc");
        if (f) extraction.rc = f;
      }
      if (service && service.length) {
        setBusy("Reading service records…");
        const entries: ServiceEntry[] = [];
        let vehicle: ServiceBook["vehicle"] | undefined = undefined;
        for (let i = 0; i < service.length; i++) {
          const f = await extractOne(service[i], "service_book", `service_book_p${i + 1}`);
          if (f?.entries) entries.push(...f.entries);
          if (f?.vehicle && !vehicle) vehicle = f.vehicle;
        }
        extraction.service_book = { document_type: "service_book", vehicle, entries };
      }
      if (insurance && insurance.length) {
        setBusy("Reading insurance…");
        for (let i = 0; i < insurance.length; i++) {
          const f = await extractOne(insurance[i], "insurance", `insurance_${i + 1}`);
          if (f) extraction.insurance.push(f);
        }
      }

      setBusy("Checking for inconsistencies…");
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
      alert("Something went wrong: " + String(e));
    }
  }

  return (
    <main
      style={{
        maxWidth: 560, margin: "0 auto", padding: "40px 24px", color: "#e2e8f0",
        background: "#020617", minHeight: "100vh", fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ fontSize: 13, letterSpacing: 2, opacity: 0.6, textTransform: "uppercase" }}>PaperTrail</div>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: "4px 0 6px" }}>Verify a used car&apos;s history</h1>
      <p style={{ opacity: 0.7, marginTop: 0, marginBottom: 24 }}>
        Upload the car&apos;s papers. We build its timeline and flag what doesn&apos;t add up — before you pay.
      </p>

      <label>RC book</label>
      <input style={box} type="file" accept="image/*" onChange={(e) => setRc(e.target.files?.[0] ?? null)} />

      <label>Service book pages</label>
      <input style={box} type="file" accept="image/*" multiple onChange={(e) => setService(e.target.files)} />

      <label>Insurance (optional)</label>
      <input style={box} type="file" accept="image/*" multiple onChange={(e) => setInsurance(e.target.files)} />

      <label>Seller&apos;s claim</label>
      <textarea style={{ ...box, minHeight: 60 }} placeholder="e.g. Single owner, no accidents, full service history" value={claim} onChange={(e) => setClaim(e.target.value)} />

      <label>How many owners did the seller claim?</label>
      <input style={box} type="number" min={1} placeholder="1" value={owners} onChange={(e) => setOwners(e.target.value)} />

      {busy ? (
        <div style={{ ...btn, background: "#334155", textAlign: "center" }}>{busy}</div>
      ) : (
        <button style={btn} onClick={run}>CHECK CAR</button>
      )}

      <p style={{ opacity: 0.5, fontSize: 13, marginTop: 16, textAlign: "center" }}>
        No login. Nothing saved. One car, one check.
      </p>
    </main>
  );
}
