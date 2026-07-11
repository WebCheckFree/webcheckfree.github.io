import { makeFinding } from "@/lib/audit/finding";
import type { Audit, Finding } from "@/types/audit";

export function sampleFinding(overrides: Partial<Finding> = {}): Finding {
  return makeFinding({
    category: "seo",
    subcategory: "title",
    title: "Paginatitel ontbreekt",
    description: "De pagina mist een titel.",
    evidence: "Geen title-tag gevonden.",
    affectedUrl: "https://example.com/",
    severity: "medium",
    confidence: "confirmed",
    source: "html",
    recommendation: "Voeg een unieke titel toe.",
    technicalImplementation: "Render een title-element in de documenthead.",
    estimatedEffort: "klein",
    acceptanceCriterion: "De pagina heeft één unieke en relevante title-tag.",
    ...overrides,
  });
}

export function sampleAudit(overrides: Partial<Audit> = {}): Audit {
  const finding = sampleFinding();
  return {
    schemaVersion: "1.0.0",
    id: "11111111-1111-4111-8111-111111111111",
    requestedUrl: "example.com",
    normalizedUrl: "https://example.com/",
    finalUrl: "https://example.com/",
    domain: "example.com",
    startedAt: "2026-07-11T10:00:00.000Z",
    completedAt: "2026-07-11T10:00:02.000Z",
    status: "completed",
    scanMode: "quick",
    devices: ["mobile"],
    pagesScanned: 1,
    linksChecked: 0,
    skippedUrls: [],
    aiEnabled: false,
    aiStatus: "not-requested",
    scores: {
      performance: { score: 100, label: "Uitstekend", deductions: [] },
      ux: { score: 100, label: "Uitstekend", deductions: [] },
      seo: { score: 95, label: "Uitstekend", deductions: [{ findingId: finding.id, points: 5, reason: "Paginatitel ontbreekt (medium)" }] },
      security: { score: 100, label: "Uitstekend", deductions: [] },
      overall: 99,
      overallLabel: "Uitstekend",
    },
    metrics: {},
    findings: [finding],
    pages: [{
      requestedUrl: "https://example.com/",
      finalUrl: "https://example.com/",
      statusCode: 200,
      contentType: "text/html",
      responseTimeMs: 120,
      redirectCount: 0,
      title: null,
      metaDescription: "Voorbeeldpagina",
      canonical: "https://example.com/",
      h1: ["Voorbeeld"],
      indexable: true,
      wordCount: 180,
    }],
    limitations: ["Handmatige controle vereist."],
    metadata: {
      auditDurationMs: 2000,
      userAgent: "WEBCHECK/2.0",
      pageSpeedUsed: false,
      storageAdapter: "cloudflare-d1",
      summarySource: "rules",
      aiAvailable: false,
      executionModel: "cloudflare-step-machine",
    },
    ...overrides,
  };
}
