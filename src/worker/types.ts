import type { z } from "zod";
import type { auditSchema, metricsSchema, pageResultSchema } from "@/schemas/audit";
import type { Audit, Device, Finding, ScanMode } from "@/types/audit";

export interface Env {
  DB: D1Database;
  AI?: Ai;
  APP_URL?: string;
  APP_NAME?: string;
  GITHUB_REPOSITORY_URL?: string;
  CORS_ALLOWED_ORIGINS?: string;
  AI_ENABLED?: string;
  AI_MODEL?: string;
  AI_DAILY_REQUEST_LIMIT?: string;
  AI_MAX_OUTPUT_TOKENS?: string;
  PAGESPEED_ENABLED?: string;
  PAGESPEED_API_KEY?: string;
  AUDIT_DATA_TTL_MINUTES?: string;
  AUDIT_MAX_RESPONSE_BYTES?: string;
  AUDIT_DNS_CACHE_SECONDS?: string;
  RATE_LIMIT_QUICK_PER_HOUR?: string;
  RATE_LIMIT_STANDARD_PER_HOUR?: string;
  RATE_LIMIT_EXTENDED_PER_HOUR?: string;
  IP_HASH_SALT?: string;
  LOG_LEVEL?: string;
}

export type Metrics = z.infer<typeof metricsSchema>;
export type PageResult = z.infer<typeof pageResultSchema>;
export type StoredAudit = z.infer<typeof auditSchema>;

export type AuditStage =
  | "pages"
  | "robots"
  | "sitemap"
  | "links"
  | "pagespeed"
  | "security"
  | "finalize"
  | "ai"
  | "complete"
  | "failed";

export interface DnsCacheEntry {
  addresses: string[];
  expiresAt: number;
}

export interface CrawlQueueItem {
  url: string;
  depth: number;
}

export interface AuditJobState {
  id: string;
  version: number;
  requestedUrl: string;
  normalizedUrl: string;
  finalUrl: string;
  domain: string;
  startedAt: string;
  scanMode: ScanMode;
  devices: Device[];
  generateAiSummary: boolean;
  stage: AuditStage;
  queue: CrawlQueueItem[];
  visited: string[];
  pages: PageResult[];
  findings: Finding[];
  internalLinks: string[];
  skippedUrls: Array<{ url: string; reason: string }>;
  linksChecked: number;
  linkCursor: number;
  pageSpeedCursor: number;
  metrics: Record<string, Metrics>;
  robotsSitemapUrls: string[];
  completedPhases: string[];
  dnsCache: Record<string, DnsCacheEntry>;
  aiStatus: Audit["aiStatus"];
  audit?: Audit;
  failure?: { title: string; message: string; referenceId: string; retryable: boolean };
}

export interface StoredJobRow {
  id: string;
  status: string;
  stage: AuditStage;
  state_json: string;
  audit_json: string | null;
  version: number;
  created_at: number;
  updated_at: number;
  expires_at: number;
  client_key: string;
}

export type AdvanceResult =
  | { type: "progress"; state: AuditJobState; phaseIndex: number; message: string }
  | { type: "complete"; state: AuditJobState; audit: Audit };
