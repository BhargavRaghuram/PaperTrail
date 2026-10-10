import { describe, it, expect } from "vitest";
import { parseRupeePrice, hostLabel } from "@/lib/scrapers/partPrice";

describe("parseRupeePrice", () => {
  it("parses a plain rupee figure from a snippet", () => {
    expect(parseRupeePrice("Timing belt replacement cost: ₹8,500 at authorised service center")).toBe(8500);
  });

  it("expands a k-suffixed figure (no space before the k)", () => {
    expect(parseRupeePrice("Battery available for ₹7k at most garages")).toBe(7000);
  });

  it("expands a lakh figure", () => {
    expect(parseRupeePrice("Turbocharger replacement can run up to ₹1.2 lakh")).toBe(120000);
  });

  it("does not mistake a unit like 'km' for the k-suffix", () => {
    expect(parseRupeePrice("Car has done ₹500 km this month on a full tank")).toBe(500);
  });

  it("takes the median across multiple matches to shrug off outliers", () => {
    expect(parseRupeePrice("Garage quotes ₹6,000 to ₹9,000, some list the whole car at ₹42,00,000")).toBe(9000);
  });

  it("returns null when nothing in a plausible part-price band is found", () => {
    expect(parseRupeePrice("No price mentioned here, just a car description")).toBeNull();
  });
});

describe("hostLabel", () => {
  it("turns a URL into a capitalized, www-stripped site name", () => {
    expect(hostLabel("https://www.boodmo.com/battery-price")).toBe("Boodmo");
    expect(hostLabel("https://carparts.co.in/item")).toBe("Carparts");
  });

  it("falls back to a generic label for an unparseable URL", () => {
    expect(hostLabel("not a url")).toBe("Web");
  });
});
