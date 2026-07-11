import { describe, expect, it } from "vitest";
import { calculateCategoryScore, calculateScores, scoreLabel } from "@/lib/audit/scoring";
import { deduplicateFindings } from "@/lib/audit/finding";
import { sampleFinding } from "./helpers";

describe("deterministische scoring", () => {
  it("gebruikt de Nederlandse scorelabels", () => {
    expect(scoreLabel(90)).toBe("Uitstekend");
    expect(scoreLabel(75)).toBe("Goed");
    expect(scoreLabel(60)).toBe("Redelijk");
    expect(scoreLabel(40)).toBe("Onvoldoende");
    expect(scoreLabel(39)).toBe("Kritiek");
  });
  it("trekt de juiste punten af", () => {
    const findings = [sampleFinding({ severity: "critical" }), sampleFinding({ category: "ux", subcategory: "forms", title: "Formulierlabel ontbreekt", severity: "high" })];
    expect(calculateCategoryScore(findings, "seo").score).toBe(80);
    expect(calculateCategoryScore(findings, "ux").score).toBe(90);
    expect(calculateScores(findings).overall).toBe(93);
  });
  it("begrenst aftrek per subcategorie", () => {
    const findings = Array.from({ length: 5 }, (_, index) => sampleFinding({ title: `Probleem ${index}`, evidence: `Bewijs ${index}`, severity: "high" }));
    expect(calculateCategoryScore(findings, "seo").score).toBe(80);
  });
  it("dedupliceert dezelfde hoofbevinding", () => {
    const low = sampleFinding({ severity: "low" });
    const high = { ...low, severity: "high" as const };
    expect(deduplicateFindings([low, high])).toEqual([high]);
  });
});
