import Anthropic from "@anthropic-ai/sdk";
import type { ExtractParams, VisionProvider } from "./types";
import { EXTRACTION_SYSTEM_PROMPT } from "./prompt";

const MODEL = "claude-opus-4-8";

function getClient() {
  const key = (process.env.CLAUDE_API ?? "").trim();
  if (!key) throw new Error("CLAUDE_API missing");
  return new Anthropic({ apiKey: key });
}

async function extract({ base64, mediaType, docType, stem }: ExtractParams) {
  const client = getClient();
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: (mediaType ?? "image/jpeg") as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: base64,
            },
          },
          { type: "text", text: `document_type: ${docType}. stem: ${stem}. Extract now.` },
        ],
      },
    ],
  });
  const block = msg.content.find((c) => c.type === "text");
  const text = block && block.type === "text" ? block.text : "{}";
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  return JSON.parse(cleaned);
}

export const claudeVision: VisionProvider = { name: "claude", extract };
