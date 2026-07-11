import { z } from "zod";
import { findingSchema } from "./finding";

export const scanModeSchema = z.enum(["quick", "standard", "extended"]);
export const deviceSchema = z.enum(["mobile", "desktop"]);
export const auditStatusSchema = z.enum(["pending", "running", "completed", "partial", "failed"]);
export const aiStatusSchema = z.enum(["disabled", "not-requested", "pending", "completed", "unavailable", "failed", "rate-limited"]);

export const scoreDetailSchema = z.object({
  score: z.number().int().min(0).max(100),
  label: z.string(),
  deductions: z.array(z.object({
    findingId: z.string(),
    points: z.number().nonnegative(),
    reason: z.string(),
  })),
});

export const pageResultSchema = z.object({
  requestedUrl: z.string().url(),
  finalUrl: z.string().url(),
  statusCode: z.number().int(),
  contentType: z.string(),
  responseTimeMs: z.number().nonnegative(),
  redirectCount: z.number().int().nonnegative(),
  title: z.string().nullable(),
  metaDescription: z.string().nullable(),
  canonical: z.string().nullable(),
  h1: z.array(z.string()),
  indexable: z.boolean(),
  wordCount: z.number().int().nonnegative(),
});

export const metricsSchema = z.object({
  source: z.enum(["pagespeed", "deterministic", "mixed"]),
  fieldDataAvailable: z.boolean(),
  lcpMs: z.number().nonnegative().optional(),
  cls: z.number().nonnegative().optional(),
  inpMs: z.number().nonnegative().optional(),
  fcpMs: z.number().nonnegative().optional(),
  speedIndexMs: z.number().nonnegative().optional(),
  totalBlockingTimeMs: z.number().nonnegative().optional(),
  performanceScore: z.number().min(0).max(100).optional(),
  pageWeightBytes: z.number().int().nonnegative().optional(),
  resourceCount: z.number().int().nonnegative().optional(),
  ttfbMs: z.number().nonnegative().optional(),
  notes: z.array(z.string()).default([]),
});

export const aiSummarySchema = z.object({
  executiveSummary: z.string(),
  topPriorities: z.array(z.object({ title: z.string(), rationale: z.string(), acceptanceCriterion: z.string() })).max(10),
  quickWins: z.array(z.string()).max(10),
  mediumTermImprovements: z.array(z.string()).max(10),
  implementationPlan: z.array(z.object({ step: z.number().int().positive(), action: z.string(), why: z.string(), verification: z.string() })).max(12),
  limitations: z.array(z.string()),
  disclaimer: z.string(),
});

export const auditSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  id: z.string().uuid(),
  requestedUrl: z.string(),
  normalizedUrl: z.string().url(),
  finalUrl: z.string().url(),
  domain: z.string(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  status: auditStatusSchema,
  scanMode: scanModeSchema,
  devices: z.array(deviceSchema).min(1),
  pagesScanned: z.number().int().nonnegative(),
  linksChecked: z.number().int().nonnegative(),
  skippedUrls: z.array(z.object({ url: z.string(), reason: z.string() })),
  aiEnabled: z.boolean(),
  aiStatus: aiStatusSchema,
  aiSummary: aiSummarySchema.optional(),
  scores: z.object({
    performance: scoreDetailSchema,
    ux: scoreDetailSchema,
    seo: scoreDetailSchema,
    security: scoreDetailSchema,
    overall: z.number().int().min(0).max(100),
    overallLabel: z.string(),
  }),
  metrics: z.record(z.string(), metricsSchema),
  findings: z.array(findingSchema),
  pages: z.array(pageResultSchema),
  limitations: z.array(z.string()),
  metadata: z.object({
    auditDurationMs: z.number().int().nonnegative(),
    userAgent: z.string(),
    pageSpeedUsed: z.boolean(),
    storageAdapter: z.string(),
    summarySource: z.enum(["rules", "workers-ai"]),
    aiAvailable: z.boolean(),
    executionModel: z.literal("cloudflare-step-machine"),
  }),
});
