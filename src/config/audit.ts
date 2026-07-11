import type { ScanMode, Severity } from "@/types/audit";

/**
 * Limits chosen for Cloudflare Workers Free. Each audit is split across several
 * Worker invocations so CPU and subrequest budgets stay predictable.
 */
export const SCAN_LIMITS: Record<ScanMode, { maxPages: number; maxLinks: number; maxDepth: number; timeoutMs: number }> = {
  quick: { maxPages: 1, maxLinks: 10, maxDepth: 0, timeoutMs: 8_000 },
  standard: { maxPages: 3, maxLinks: 18, maxDepth: 2, timeoutMs: 9_000 },
  extended: { maxPages: 5, maxLinks: 25, maxDepth: 3, timeoutMs: 10_000 },
};

export const SCORE_DEDUCTIONS: Record<Severity, number> = {
  critical: 20,
  high: 10,
  medium: 5,
  low: 2,
  informational: 0,
};

export const CATEGORY_LABELS = {
  performance: "Performance",
  ux: "Gebruikservaring",
  seo: "SEO",
  security: "Beveiliging",
} as const;

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  informational: 4,
};

export const AUDIT_PHASES = [
  "URL valideren",
  "Website bereiken",
  "Pagina’s verzamelen",
  "Performance controleren",
  "Gebruikservaring controleren",
  "SEO controleren",
  "Beveiliging controleren",
  "Scores berekenen",
  "AI-samenvatting genereren",
  "Rapport voorbereiden",
] as const;

export const USER_AGENT = "WEBCHECK/2.0 (+https://github.com/WebCheckFree/webcheckfree.github.io; passive public website audit)";
