import { describe, expect, it } from "vitest";
import { buildRuleBasedSummary } from "@/worker/audit/summary";
import { auditToCsv } from "@/lib/export/csv";
import { auditToHtml } from "@/lib/export/html";
import { auditToJson } from "@/lib/export/json";
import { auditSchema, aiSummarySchema } from "@/schemas/audit";
import { sampleAudit, sampleFinding } from "./helpers";

describe("regelgebaseerde managementsamenvatting", () => {
  it("maakt prioriteiten uit feitelijke bevindingen", () => {
    const audit = sampleAudit({ findings: [sampleFinding({ severity: "high" })] });
    const summary = buildRuleBasedSummary(audit);
    expect(summary.executiveSummary).toContain("1 unieke aandachtspunten");
    expect(summary.topPriorities[0].title).toBe("Paginatitel ontbreekt");
    expect(summary.quickWins.length).toBe(1);
    expect(aiSummarySchema.safeParse(summary).success).toBe(true);
  });
  it("werkt ook zonder bevindingen", () => {
    const audit = sampleAudit({ findings: [] });
    const summary = buildRuleBasedSummary(audit);
    expect(summary.executiveSummary).toContain("geen concrete problemen");
    expect(summary.topPriorities).toEqual([]);
  });
});

describe("exports en schema", () => {
  it("valideert een volledig Cloudflare-auditrapport", () => {
    expect(auditSchema.safeParse(sampleAudit()).success).toBe(true);
  });
  it("exporteert versieerbare JSON", () => {
    const output = auditSchema.parse(JSON.parse(auditToJson(sampleAudit())) as unknown);
    expect(output.schemaVersion).toBe("1.0.0");
    expect(output.metadata.storageAdapter).toBe("cloudflare-d1");
  });
  it("exporteert Excel-compatibele CSV", () => {
    const output = auditToCsv(sampleAudit());
    expect(output.startsWith("\ufeff")).toBe(true);
    expect(output).toContain("Paginatitel ontbreekt");
  });
  it("exporteert zelfstandige print-HTML", () => {
    const output = auditToHtml(sampleAudit());
    expect(output).toContain("<!doctype html>");
    expect(output).toContain("Website-audit: example.com");
  });
});
