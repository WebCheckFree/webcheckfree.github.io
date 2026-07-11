import type { z } from "zod";
import type { auditSchema, scanModeSchema, deviceSchema, aiSummarySchema } from "@/schemas/audit";
import type { findingSchema, categorySchema, severitySchema, confidenceSchema } from "@/schemas/finding";

export type Audit = z.infer<typeof auditSchema>;
export type Finding = z.infer<typeof findingSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Severity = z.infer<typeof severitySchema>;
export type Confidence = z.infer<typeof confidenceSchema>;
export type ScanMode = z.infer<typeof scanModeSchema>;
export type Device = z.infer<typeof deviceSchema>;
export type AISummary = z.infer<typeof aiSummarySchema>;

export type AuditProgressEvent =
  | { type: "progress"; phase: string; phaseIndex: number; completedPhases: string[]; pagesDiscovered: number; findingsCount: number; elapsedMs: number; message?: string }
  | { type: "complete"; audit: Audit }
  | { type: "error"; error: { title: string; message: string; referenceId: string; retryable: boolean } };

export interface CrawledPage {
  requestedUrl: string;
  finalUrl: string;
  statusCode: number;
  contentType: string;
  headers: Record<string, string>;
  html: string;
  responseTimeMs: number;
  bytes: number;
  redirectCount: number;
  depth: number;
}
