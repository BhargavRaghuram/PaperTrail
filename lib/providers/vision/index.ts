import type { VisionProvider } from "./types";
import { openaiVision } from "./openai";
import { claudeVision } from "./claude";

export * from "./types";

const PROVIDERS: Record<string, VisionProvider> = {
  openai: openaiVision,
  claude: claudeVision,
};

const selected = (process.env.VISION_PROVIDER ?? "openai").trim().toLowerCase();
export const visionProvider: VisionProvider = PROVIDERS[selected] ?? openaiVision;
