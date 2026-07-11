import { z } from "zod";

export const categorySchema = z.enum(["performance", "ux", "seo", "security"]);
export const severitySchema = z.enum(["critical", "high", "medium", "low", "informational"]);
export const confidenceSchema = z.enum(["confirmed", "likely", "manual-review-required"]);
export const sourceSchema = z.enum([
  "html",
  "response-header",
  "pagespeed",
  "lighthouse",
  "robots",
  "sitemap",
  "link-checker",
  "heuristic",
  "workers-ai",
  "tls",
]);

export const findingSchema = z.object({
  id: z.string().min(1),
  category: categorySchema,
  subcategory: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  evidence: z.string().min(1),
  affectedUrl: z.string().url(),
  affectedUrls: z.array(z.string().url()).min(1).optional(),
  occurrenceCount: z.number().int().positive().optional(),
  affectedElement: z.string().optional(),
  severity: severitySchema,
  confidence: confidenceSchema,
  source: sourceSchema,
  recommendation: z.string().min(1),
  technicalImplementation: z.string().min(1),
  estimatedEffort: z.enum(["klein", "gemiddeld", "groot"]),
  acceptanceCriterion: z.string().min(1),
  references: z.array(z.string()).default([]),
  measuredValue: z.union([z.string(), z.number()]).optional(),
  targetValue: z.union([z.string(), z.number()]).optional(),
});

export type FindingInput = z.input<typeof findingSchema>;
