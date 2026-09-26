import { NextRequest, NextResponse } from "next/server";
import { assembleReport } from "@/lib/report";
import type { SellerClaim } from "@/lib/contracts";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { extraction, seller_claim } = await req.json();
  const seller: SellerClaim = seller_claim ?? { claimed_owners: null };
  return NextResponse.json(assembleReport(extraction ?? { rc: null, service_book: null, insurance: [] }, seller));
}
