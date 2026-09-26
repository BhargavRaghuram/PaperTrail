import { NextRequest, NextResponse } from "next/server";
import { getClient, MODEL } from "@/lib/claude";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM = `You extract structured facts from a photo of ONE Indian used-car document.
Return ONLY minified JSON — no prose, no markdown fences.

Rules:
- Never guess. If a value is unreadable/uncertain, set it to null AND add the field name to "low_confidence_fields".
- Dates MUST be ISO "YYYY-MM-DD". Indian documents use DD/MM/YYYY order — convert carefully.
- Set every "source" to the provided stem.
- Odometer readings are integers in km (strip "km", commas, and "k" suffix e.g. 34.2k -> 34200).

Shape by document type:
- rc: {"document_type":"rc","source":STEM,"registration_number":str,"registration_date":isoOrNull,"chassis_number":str,"engine_number":str,"owner_name":str,"owner_serial":intOrNull,"maker":str,"model":str,"fuel":str,"confidence":"high"|"medium"|"low","low_confidence_fields":[]}
- service_book: {"document_type":"service_book","vehicle":{"registration_number":strOrNull,"chassis_number":strOrNull,"source":STEM},"entries":[{"date":iso,"odometer_km":intOrNull,"service_type":strOrNull,"dealer":strOrNull,"source":STEM,"confidence":"high"|"medium"|"low","low_confidence_fields":[],"notes":strOrNull}]}
- insurance: {"document_type":"insurance","source":STEM,"policy_number":str,"insurer":str,"registration_number":str,"chassis_number":str,"period_start":iso,"period_end":iso,"ncb_percent":intOrNull,"previous_policy_number":strOrNull,"confidence":"high"|"medium"|"low","low_confidence_fields":[]}

Return exactly the object for the requested document type.`;

export async function POST(req: NextRequest) {
  try {
    const { base64, mediaType, docType, stem } = await req.json();
    const client = getClient();
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType ?? "image/jpeg", data: base64 } },
            { type: "text", text: `document_type: ${docType}. stem: ${stem}. Extract now.` },
          ],
        },
      ],
    });
    const text = msg.content.find((c) => c.type === "text")?.type === "text"
      ? (msg.content.find((c) => c.type === "text") as { text: string }).text
      : "{}";
    const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const fragment = JSON.parse(cleaned);
    return NextResponse.json({ fragment });
  } catch (e) {
    return NextResponse.json({ fragment: null, error: String(e) }, { status: 200 });
  }
}
