import { describe, expect, it } from "vitest";
import { aiSummarySchema } from "@/schemas/audit";

describe("Workers AI structured output", () => {
  const valid = {
    executiveSummary: "Samenvatting",
    topPriorities: [{ title: "Titel", rationale: "Waarom", acceptanceCriterion: "Controle" }],
    quickWins: ["Quick win"],
    mediumTermImprovements: ["Verbetering"],
    implementationPlan: [{ step: 1, action: "Doe dit", why: "Omdat", verification: "Test" }],
    limitations: ["Beperking"],
    disclaimer: "Automatische analyse.",
  };
  it("accepteert geldige gestructureerde uitvoer", () => {
    expect(aiSummarySchema.parse(valid).implementationPlan[0].step).toBe(1);
  });
  it("weigert een onvolledige AI-respons", () => {
    expect(aiSummarySchema.safeParse({ executiveSummary: "Alleen tekst" }).success).toBe(false);
  });
  it("begrensd het aantal topprioriteiten", () => {
    expect(aiSummarySchema.safeParse({ ...valid, topPriorities: Array.from({ length: 11 }, () => valid.topPriorities[0]) }).success).toBe(false);
  });
});
