"use client";
import { Printer } from "./icons";

export function QuestionSheet({
  questions,
  carLabel,
}: {
  questions: { rule: string; question: string }[];
  carLabel?: string;
}) {
  return (
    <div>
      <button type="button" className="no-print btn btn-primary" onClick={() => window.print()} style={{ marginBottom: 18 }}>
        <Printer width={16} height={16} /> Print this sheet
      </button>

      <div data-print="sheet" className="card" style={{ padding: "24px 24px 12px" }}>
        <p className="no-print" style={{ margin: "0 0 16px", color: "var(--ink-2)", fontSize: 14, maxWidth: "56ch" }}>
          Ask these before you pay. Each one is tied to something the documents could not explain.
        </p>
        {carLabel && (
          <p className="eyebrow" style={{ margin: "0 0 14px" }}>{carLabel}</p>
        )}
        <ol style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
          {questions.map((q, i) => (
            <li key={i} style={{
              display: "flex", gap: 14, alignItems: "baseline",
              padding: "13px 0", borderTop: i === 0 ? "none" : "1px solid var(--hair)",
            }}>
              <span aria-hidden className="tnum mono" style={{ flex: "none", fontSize: 14, fontWeight: 600, color: "var(--iris-deep)", width: 22 }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span style={{ lineHeight: 1.5, fontSize: 15 }}>{q.question}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
