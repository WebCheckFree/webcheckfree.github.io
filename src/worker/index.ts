import { AUDIT_PHASES, SCAN_LIMITS } from "@/config/audit";
import { auditSchema } from "@/schemas/audit";
import { aiSummaryRequestSchema } from "@/schemas/request";
import type { AuditProgressEvent } from "@/types/audit";
import { generateWorkersAiSummary } from "./ai/workers-ai";
import { advanceAuditJob, createAuditJob, toProgressEvent } from "./audit/engine";
import { runtimeConfig } from "./config";
import { AppError, asAppError } from "./errors";
import { hashClientIp } from "./security/url";
import {
  cleanupExpired,
  consumeFixedWindow,
  deleteJob,
  getJob,
  getStoredAudit,
  saveJobState,
} from "./storage/d1";
import type { AuditJobState, Env } from "./types";

function corsHeaders(request: Request, env: Env): HeadersInit {
  const config = runtimeConfig(env);
  const origin = request.headers.get("origin")?.replace(/\/$/, "") ?? "";
  const allowed = origin && config.corsOrigins.includes(origin) ? origin : config.corsOrigins[0];
  return {
    "access-control-allow-origin": allowed,
    "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,accept",
    "access-control-max-age": "86400",
    vary: "Origin",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "cache-control": "no-store",
  };
}

function json(request: Request, env: Env, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request, env), "content-type": "application/json; charset=utf-8" },
  });
}

function validateOrigin(request: Request, env: Env): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const normalized = origin.replace(/\/$/, "");
  if (!runtimeConfig(env).corsOrigins.includes(normalized)) {
    throw new AppError({
      code: "CORS_BLOCKED",
      title: "Herkomst niet toegestaan",
      message: "Deze website mag de WEBCHECK-API niet rechtstreeks gebruiken.",
      status: 403,
    });
  }
}

function currentProgress(state: AuditJobState): AuditProgressEvent {
  const phaseIndexByStage: Record<AuditJobState["stage"], number> = {
    pages: state.pages.length ? 2 : 1,
    robots: 5,
    sitemap: 5,
    links: 5,
    pagespeed: 3,
    security: 6,
    finalize: 7,
    ai: 8,
    complete: 9,
    failed: 9,
  };
  const phaseIndex = phaseIndexByStage[state.stage];
  return {
    type: "progress",
    phase: AUDIT_PHASES[phaseIndex],
    phaseIndex,
    completedPhases: state.completedPhases,
    pagesDiscovered: Math.min(
      SCAN_LIMITS[state.scanMode].maxPages,
      new Set([...state.visited, ...state.queue.map((item) => item.url)]).size,
    ),
    findingsCount: state.findings.length,
    elapsedMs: Math.max(0, Date.now() - Date.parse(state.startedAt)),
    message: "De controle is actief en kan met de volgende stap worden vervolgd.",
  };
}

async function readJson(request: Request): Promise<unknown> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().includes("application/json")) {
    throw new AppError({
      code: "UNSUPPORTED_MEDIA_TYPE",
      title: "Ongeldig verzoekformaat",
      message: "Stuur de aanvraag als application/json.",
      status: 415,
    });
  }
  try {
    return await request.json();
  } catch (cause) {
    throw new AppError({
      code: "INVALID_JSON",
      title: "Ongeldige invoer",
      message: "De verzonden JSON kon niet worden gelezen.",
      status: 400,
      cause,
    });
  }
}

function handleHealth(request: Request, env: Env): Response {
  const config = runtimeConfig(env);
  return json(request, env, {
    status: "ok",
    timestamp: new Date().toISOString(),
    architecture: "github-pages + cloudflare-workers + d1",
    services: {
      ai: config.aiEnabled && env.AI ? "configured" : "disabled",
      storage: "d1",
      pagespeed: config.pageSpeedEnabled ? (config.pageSpeedApiKey ? "configured" : "public-api") : "disabled",
    },
    limits: {
      quick: SCAN_LIMITS.quick,
      standard: SCAN_LIMITS.standard,
      extended: SCAN_LIMITS.extended,
    },
  });
}

async function handleStart(request: Request, env: Env): Promise<Response> {
  validateOrigin(request, env);
  const clientKey = await hashClientIp(request, runtimeConfig(env).ipHashSalt);
  const result = await createAuditJob(env, await readJson(request), clientKey);
  return json(request, env, result, 202);
}

async function handleStatus(request: Request, env: Env, id: string): Promise<Response> {
  validateOrigin(request, env);
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    throw new AppError({ code: "INVALID_ID", title: "Ongeldig rapportnummer", message: "Het opgegeven rapportnummer is ongeldig.", status: 400 });
  }
  if (request.method === "DELETE") {
    await deleteJob(env, id);
    return json(request, env, { deleted: true });
  }
  if (request.method === "POST") {
    const result = await advanceAuditJob(env, id);
    return json(request, env, { auditId: id, event: toProgressEvent(result) });
  }
  const audit = await getStoredAudit(env, id);
  if (audit) return json(request, env, { audit });
  const job = await getJob(env, id);
  if (!job) throw new AppError({ code: "AUDIT_NOT_FOUND", title: "Rapport niet beschikbaar", message: "Dit rapport is verlopen, verwijderd of bestaat niet.", status: 404 });
  if (job.state.stage === "failed") {
    throw new AppError({
      code: "AUDIT_FAILED",
      title: job.state.failure?.title ?? "Controle mislukt",
      message: job.state.failure?.message ?? "De controle kon niet worden afgerond.",
      status: 500,
      retryable: job.state.failure?.retryable ?? true,
    });
  }
  return json(request, env, { auditId: id, event: currentProgress(job.state) });
}

async function handleAiSummary(request: Request, env: Env): Promise<Response> {
  validateOrigin(request, env);
  const config = runtimeConfig(env);
  if (!config.aiEnabled || !env.AI) {
    throw new AppError({
      code: "AI_DISABLED",
      title: "AI-samenvatting uitgeschakeld",
      message: "De regelgebaseerde managementsamenvatting blijft beschikbaar.",
      status: 503,
    });
  }
  const parsed = aiSummaryRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) throw new AppError({ code: "INVALID_INPUT", title: "Ongeldige AI-aanvraag", message: parsed.error.issues[0]?.message ?? "Het rapportnummer is ongeldig.", status: 400 });
  const body = parsed.data;
  const job = await getJob(env, body.auditId);
  const sourceAudit = job?.state.audit ?? body.audit ?? (await getStoredAudit(env, body.auditId));
  if (!sourceAudit) throw new AppError({ code: "AUDIT_NOT_FOUND", title: "Rapport niet beschikbaar", message: "Het rapport is verlopen of verwijderd.", status: 404 });
  const audit = auditSchema.parse(sourceAudit);
  const clientKey = await hashClientIp(request, config.ipHashSalt);
  const daily = new Date().toISOString().slice(0, 10);
  const quota = await consumeFixedWindow(env, `ai:${daily}:${clientKey}`, config.aiDailyLimit, 24 * 60 * 60);
  if (!quota.allowed) {
    throw new AppError({
      code: "AI_RATE_LIMIT",
      title: "Dagelijkse AI-limiet bereikt",
      message: "De regelgebaseerde samenvatting blijft beschikbaar. Probeer na de dagelijkse reset opnieuw.",
      status: 429,
      retryable: true,
    });
  }

  audit.aiSummary = await generateWorkersAiSummary(env, audit);
  audit.aiStatus = "completed";
  audit.metadata.summarySource = "workers-ai";
  if (job) {
    job.state.audit = audit;
    job.state.aiStatus = "completed";
    await saveJobState(env, job.state, job.row.version, config.ttlMinutes * 60, audit.status === "partial" ? "partial" : "completed");
  }
  return json(request, env, { audit });
}

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") {
    validateOrigin(request, env);
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }
  if (request.method === "GET" && url.pathname === "/api/health") return handleHealth(request, env);
  if (request.method === "POST" && url.pathname === "/api/audit") return handleStart(request, env);
  if (request.method === "POST" && url.pathname === "/api/ai-summary") return handleAiSummary(request, env);
  const statusMatch = url.pathname.match(/^\/api\/audit-status\/([^/]+)$/);
  if (statusMatch && ["GET", "POST", "DELETE"].includes(request.method)) return handleStatus(request, env, decodeURIComponent(statusMatch[1]));
  throw new AppError({ code: "NOT_FOUND", title: "Route niet gevonden", message: "Deze API-route bestaat niet.", status: 404 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await route(request, env);
    } catch (error) {
      const appError = asAppError(error);
      console.error(JSON.stringify({ level: "error", code: appError.code, referenceId: appError.referenceId, message: appError.message }));
      return json(request, env, { error: appError.toPublic() }, appError.status);
    }
  },
  scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): void {
    ctx.waitUntil(cleanupExpired(env));
  },
} satisfies ExportedHandler<Env>;
