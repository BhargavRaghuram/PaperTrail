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
      <button
        type="button"
        className="no-print"
        onClick={() => window.print()}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "9px 16px", marginBottom: 18, cursor: "pointer",
          background: "var(--ink)", color: "var(--paper)", border: "none",
          borderRadius: 999, fontWeight: 600, fontSize: 14, fontFamily: "var(--font-body)",
        }}
      >
        <Printer width={16} height={16} /> Print this sheet
      </button>

      <div data-print="sheet">
        <p className="no-print" style={{ margin: "0 0 14px", color: "var(--ink-3)", fontSize: 14, maxWidth: "56ch" }}>
          Ask these before you pay. Each one is tied to something the documents could not explain.
        </p>
        {carLabel && (
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--ink-2)" }} className="tnum">
            {carLabel}
          </p>
        )}
        <ol style={{ margin: 0, paddingLeft: 0, listStyle: "none", counterReset: "q" }}>
          {questions.map((q, i) => (
            <li
              key={i}
              style={{
                counterIncrement: "q",
                display: "flex", gap: 14, alignItems: "baseline",
                padding: "12px 0", borderTop: i === 0 ? "none" : "1px solid var(--hair)",
              }}
            >
              <span
                aria-hidden
                className="tnum"
                style={{ flex: "none", fontFamily: "var(--font-display)", fontSize: 22, color: "var(--danger)", lineHeight: 1, width: 24 }}
              >
                {i + 1}
              </span>
              <span style={{ lineHeight: 1.5 }}>{q.question}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
