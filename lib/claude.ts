import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-opus-4-8";

export function getClient() {
  const key = (process.env.CLAUDE_API ?? "").trim();
  if (!key) throw new Error("CLAUDE_API missing");
  return new Anthropic({ apiKey: key });
}
