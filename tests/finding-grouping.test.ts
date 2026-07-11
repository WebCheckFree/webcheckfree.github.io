import { describe, expect, it } from "vitest";
import { groupFindingsByRootCause } from "@/lib/audit/finding";
import { buildRuleBasedSummary } from "@/worker/audit/summary";
import { sampleAudit, sampleFinding } from "./helpers";

describe("gegroepeerde auditbevindingen", () => {
  it("combineert dezelfde hoofdoorzaak over meerdere pagina's", () => {
    const findings = [
      sampleFinding({ affectedUrl: "https://example.com/", severity: "medium", evidence: "Geen title-tag gevonden op de homepage." }),
      sampleFinding({ affectedUrl: "https://example.com/diensten", severity: "high", evidence: "Geen title-tag gevonden op de dienstenpagina." }),
    ];

    const grouped = groupFindingsByRootCause(findings);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].severity).toBe("high");
    expect(grouped[0].occurrenceCount).toBe(2);
    expect(grouped[0].affectedUrls).toEqual([
      "https://example.com/",
      "https://example.com/diensten",
    ]);
  });

  it("maakt unieke prioriteiten en implementatiestappen", () => {
    const findings = [
      sampleFinding({ affectedUrl: "https://example.com/", severity: "high" }),
      sampleFinding({ affectedUrl: "https://example.com/contact", severity: "high" }),
    ];
    const summary = buildRuleBasedSummary(sampleAudit({ findings }));

    expect(summary.executiveSummary).toContain("1 unieke aandachtspunten");
    expect(summary.topPriorities).toHaveLength(1);
    expect(summary.implementationPlan).toHaveLength(1);
    expect(summary.topPriorities[0].rationale).toContain("Getroffen pagina's: 2");
  });
});
