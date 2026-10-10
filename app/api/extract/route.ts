import { NextRequest, NextResponse } from "next/server";
import { visionProvider } from "@/lib/providers/vision";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { base64, mediaType, docType, stem } = await req.json();
    const fragment = await visionProvider.extract({ base64, mediaType, docType, stem });
    return NextResponse.json({ fragment, provider: visionProvider.name });
  } catch (e) {
    return NextResponse.json({ fragment: null, error: String(e) }, { status: 200 });
  }
}
