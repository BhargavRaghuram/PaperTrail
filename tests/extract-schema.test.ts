import { describe, it, expect } from "vitest";
import { assembleReport } from "@/lib/report";
import type { Extraction, SellerClaim } from "@/lib/contracts";

// Guards that a hand-built extraction of the shape the /api/extract route returns
// feeds the engine without throwing, so extraction and engine stay compatible.
describe("extraction shape feeds the engine", () => {
  it("assembles a report from a minimal merged extraction", () => {
    const extraction: Extraction = {
      rc: {
        document_type: "rc", source: "rc", registration_number: "KA99AB1234",
        registration_date: "2018-05-10", chassis_number: "ABC123", owner_serial: 1,
        confidence: "high", low_confidence_fields: [],
      },
      service_book: {
        document_type: "service_book",
        vehicle: { registration_number: "KA99AB1234", chassis_number: "ABC123", source: "service_book_p1" },
        entries: [
          { date: "2019-01-01", odometer_km: 10000, source: "service_book_p1", confidence: "high", low_confidence_fields: [] },
          { date: "2020-01-01", odometer_km: 22000, source: "service_book_p1", confidence: "high", low_confidence_fields: [] },
        ],
      },
      insurance: [],
    };
    const seller: SellerClaim = { claimed_owners: 1 };
    const r = assembleReport(extraction, seller);
    expect(r.timeline[0].type).toBe("registration");
    expect(Array.isArray(r.flags)).toBe(true);
    expect(r.car.reg_number).toBe("KA99AB1234");
  });
});
