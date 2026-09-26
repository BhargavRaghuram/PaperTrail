"use client";

export function QuestionSheet({ questions }: { questions: { rule: string; question: string }[] }) {
  return (
    <div>
      <button
        onClick={() => window.print()}
        style={{
          padding: "8px 16px",
          borderRadius: 8,
          marginBottom: 12,
          border: "1px solid #334155",
          background: "#1e293b",
          color: "#e2e8f0",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        Print / Share
      </button>
      <ol style={{ paddingLeft: 20, margin: 0 }}>
        {questions.map((q, i) => (
          <li key={i} style={{ margin: "10px 0", lineHeight: 1.5 }}>
            {q.question}
          </li>
        ))}
      </ol>
    </div>
  );
}
