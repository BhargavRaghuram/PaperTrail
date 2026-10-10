import type { ExtractParams, VisionProvider } from "./types";
import { EXTRACTION_SYSTEM_PROMPT } from "./prompt";

const MODEL = "gpt-4o-mini";

async function extract({ base64, mediaType, docType, stem }: ExtractParams) {
  const key = (process.env.OPENAI_API_KEY ?? "").trim();
  if (!key) throw new Error("OPENAI_API_KEY missing");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mediaType ?? "image/jpeg"};base64,${base64}` } },
            { type: "text", text: `document_type: ${docType}. stem: ${stem}. Extract now.` },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const text = json.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(text);
}

export const openaiVision: VisionProvider = { name: "openai", extract };
