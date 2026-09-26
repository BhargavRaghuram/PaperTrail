import extraction from "@/dataset/papertrail_test_data/scenarios/S13_multi_flag_demo/expected/extraction.json";
import seller from "@/dataset/papertrail_test_data/scenarios/S13_multi_flag_demo/seller_claim.json";
import { assembleReport } from "@/lib/report";
import type { Extraction, Report, SellerClaim } from "@/lib/contracts";

// Bundled at build time (no fs) so the deployed /report renders the hero even before any upload.
export const heroReport: Report = assembleReport(
  extraction as unknown as Extraction,
  seller as unknown as SellerClaim,
);
