import { NextRequest, NextResponse } from "next/server";
import { assembleReport } from "@/lib/report";
import { enrichReport } from "@/lib/scrapers/enrich";
import type { SellerClaim } from "@/lib/contracts";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { extraction, seller_claim } = await req.json();
  const seller: SellerClaim = seller_claim ?? { claimed_owners: null };
  const report = assembleReport(extraction ?? { rc: null, service_book: null, insurance: [] }, seller);
  const enriched = await enrichReport(report); // moat: cross-check vs public record, challans, price
  return NextResponse.json(enriched);
}
