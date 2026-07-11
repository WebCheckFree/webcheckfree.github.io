import { AUDIT_PHASES, SCAN_LIMITS, USER_AGENT } from "@/config/audit";
import { deduplicateFindings } from "@/lib/audit/finding";
import { calculateScores } from "@/lib/audit/scoring";
import { auditSchema } from "@/schemas/audit";
import { auditRequestSchema } from "@/schemas/request";
import type { Audit, AuditProgressEvent } from "@/types/audit";
import { runtimeConfig } from "../config";
import { AppError, asAppError } from "../errors";
import { normalizeUrl, validatePublicUrl } from "../security/url";
import {
  consumeFixedWindow,
  createJob,
  getJob,
  saveJobState,
} from "../storage/d1";
import type { AdvanceResult, AuditJobState, Env } from "../types";
import { generateWorkersAiSummary } from "../ai/workers-ai";
import { analyzeCrossPageMetadata, fetchAndAnalyzePage } from "./page";
import { checkLinkBatch } from "./links";
import { fetchPageSpeed } from "./pagespeed";
import { inspectRobots } from "./robots";
import { inspectHttpToHttps } from "./security";
import { inspectSitemap } from "./sitemap";
import { buildRuleBasedSummary } from "./summary";

function addCompletedPhase(state: AuditJobState, phase: string): void {
  if (!state.completedPhases.includes(phase)) state.completedPhases.push(phase);
}

function progressEvent(state: AuditJobState, phaseIndex: number, message?: string): AuditProgressEvent {
  return {
    type: "progress",
    phase: AUDIT_PHASES[Math.min(AUDIT_PHASES.length - 1, Math.max(0, phaseIndex))],
    phaseIndex,
    completedPhases: state.completedPhases,
    pagesDiscovered: Math.min(
      SCAN_LIMITS[state.scanMode].maxPages,
      new Set([...state.visited, ...state.queue.map((item) => item.url)]).size,
    ),
    findingsCount: state.findings.length,
    elapsedMs: Math.max(0, Date.now() - Date.parse(state.startedAt)),
    message,
  };
}

function stateStatus(state: AuditJobState): "running" | "completed" | "partial" | "failed" {
  if (state.stage === "failed") return "failed";
  if (state.stage !== "complete") return "running";
  return state.audit?.status === "partial" ? "partial" : "completed";
}

function addLimitOnce(values: string[], value: string): void {
  if (!values.includes(value)) values.push(value);
}

export async function createAuditJob(
  env: Env,
  input: unknown,
  clientKey: string,
): Promise<{ auditId: string; event: AuditProgressEvent }> {
  const parsed = auditRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError({ code: "INVALID_INPUT", title: "Ongeldige invoer", message: parsed.error.issues[0]?.message ?? "Controleer de website-URL en scaninstellingen.", status: 400 });
  }
  const request = parsed.data;
  const config = runtimeConfig(env);
  const aiAvailable = config.aiEnabled && Boolean(env.AI);
  const normalized = normalizeUrl(request.url);
  const id = crypto.randomUUID();
  const state: AuditJobState = {
    id,
    version: 0,
    requestedUrl: request.url,
    normalizedUrl: normalized.toString(),
    finalUrl: normalized.toString(),
    domain: normalized.hostname,
    startedAt: new Date().toISOString(),
    scanMode: request.scanMode,
    devices: request.devices,
    generateAiSummary: request.generateAiSummary,
    stage: "pages",
    queue: [{ url: normalized.toString(), depth: 0 }],
    visited: [],
    pages: [],
    findings: [],
    internalLinks: [],
    skippedUrls: [],
    linksChecked: 0,
    linkCursor: 0,
    pageSpeedCursor: 0,
    metrics: {},
    robotsSitemapUrls: [],
    completedPhases: [AUDIT_PHASES[0]],
    dnsCache: {},
    aiStatus: request.generateAiSummary
      ? aiAvailable
        ? "pending"
        : "unavailable"
      : "not-requested",
  };
  await validatePublicUrl(env, state, normalized);

  const rate = await consumeFixedWindow(
    env,
    `audit:${request.scanMode}:${clientKey}`,
    config.rateLimits[request.scanMode],
    60 * 60,
  );
  if (!rate.allowed) {
    throw new AppError({
      code: "RATE_LIMIT",
      title: "Te veel websitecontroles",
      message: `De limiet voor deze auditdiepte is bereikt. Probeer het na ${new Date(rate.resetAt).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" })} opnieuw.`,
      status: 429,
      retryable: true,
    });
  }

  await createJob(env, state, clientKey, config.ttlMinutes * 60);
  return {
    auditId: id,
    event: progressEvent(state, 1, "URL gevalideerd. De homepage wordt opgehaald."),
  };
}

async function processPageStage(env: Env, state: AuditJobState): Promise<{ phase: number; message: string }> {
  const limits = SCAN_LIMITS[state.scanMode];
  if (state.pages.length >= limits.maxPages || state.queue.length === 0) {
    addCompletedPhase(state, AUDIT_PHASES[2]);
    state.stage = "pagespeed";
    return { phase: 3, message: "De geselecteerde pagina’s zijn verzameld. Performancegegevens worden gecontroleerd." };
  }

  const item = state.queue.shift();
  if (!item) {
    state.stage = "pagespeed";
    return { phase: 3, message: "De geselecteerde pagina’s zijn verzameld." };
  }
  if (state.visited.includes(item.url)) return { phase: 2, message: "Dubbele URL overgeslagen." };

  try {
    const result = await fetchAndAnalyzePage(env, state, item);
    state.visited.push(item.url);
    state.pages.push(result.page);
    state.findings.push(...result.findings);
    if (state.pages.length === 1) {
      state.finalUrl = result.finalUrl;
      state.domain = new URL(result.finalUrl).hostname;
      addCompletedPhase(state, AUDIT_PHASES[1]);
    }

    const seen = new Set([...state.visited, ...state.queue.map((queued) => queued.url)]);
    for (const candidate of result.discovered) {
      if (state.queue.length + state.pages.length >= limits.maxPages) break;
      if (candidate.depth > limits.maxDepth || seen.has(candidate.url)) continue;
      seen.add(candidate.url);
      state.queue.push(candidate);
    }
    const links = new Set([...state.internalLinks, ...result.internalLinks]);
    state.internalLinks = [...links].slice(0, limits.maxLinks);

    if (state.pages.length >= limits.maxPages || state.queue.length === 0) {
      addCompletedPhase(state, AUDIT_PHASES[2]);
      state.stage = "pagespeed";
    }
    return {
      phase: state.stage === "pagespeed" ? 3 : 2,
      message: `${state.pages.length} van maximaal ${limits.maxPages} pagina('s) gecontroleerd.`,
    };
  } catch (error) {
    const appError = asAppError(error);
    if (state.pages.length === 0) throw appError;
    state.visited.push(item.url);
    state.skippedUrls.push({ url: item.url, reason: appError.message });
    if (state.queue.length === 0) {
      addCompletedPhase(state, AUDIT_PHASES[2]);
      state.stage = "pagespeed";
    }
    return { phase: 2, message: "Een secundaire pagina is veilig overgeslagen; de controle gaat verder." };
  }
}

function auditLimitations(state: AuditJobState, pageSpeedUsed: boolean, aiAvailable: boolean): string[] {
  const values = [
    "Automatische toegankelijkheidscontroles bewijzen geen volledige WCAG-conformiteit; toetsenbord-, schermlezer- en visuele controles blijven handmatig nodig.",
    "Werkelijke Google-indexering, zoekposities en Search Console-problemen zijn zonder geautoriseerde Search Console-toegang niet verifieerbaar.",
    "CMS-, plug-in-, server-, back-up- en gebruikersrechten konden niet vanuit de openbare website worden gecontroleerd.",
    "De beveiligingscontrole is passief en niet-destructief en vervangt geen penetratietest.",
    "Cloudflare Workers kan DNS-bestemmingen vóór ieder verzoek controleren, maar kan in de Fetch API geen verbinding op een vooraf gevalideerd IP-adres vastpinnen.",
  ];
  if (!pageSpeedUsed) values.push("PageSpeed Insights leverde geen meetgegevens; Core Web Vitals zijn daarom alleen opgenomen wanneer ze werkelijk beschikbaar waren.");
  if (!aiAvailable) values.push("Cloudflare Workers AI is uitgeschakeld; de managementsamenvatting is volledig regelgebaseerd samengesteld.");
  for (const skipped of state.skippedUrls) addLimitOnce(values, `${skipped.url} is overgeslagen: ${skipped.reason}`);
  return values;
}

function finalizeAudit(env: Env, state: AuditJobState): Audit {
  const config = runtimeConfig(env);
  const aiAvailable = config.aiEnabled && Boolean(env.AI);
  state.findings.push(...analyzeCrossPageMetadata(state.pages));
  state.findings = deduplicateFindings(state.findings);
  const scores = calculateScores(state.findings);
  const completedAt = new Date().toISOString();
  const pageSpeedUsed = Object.keys(state.metrics).length > 0;
  const status: Audit["status"] = state.skippedUrls.length ? "partial" : "completed";
  const limitations = auditLimitations(state, pageSpeedUsed, aiAvailable);

  const baseAudit = auditSchema.parse({
    schemaVersion: "1.0.0",
    id: state.id,
    requestedUrl: state.requestedUrl,
    normalizedUrl: state.normalizedUrl,
    finalUrl: state.finalUrl,
    domain: state.domain,
    startedAt: state.startedAt,
    completedAt,
    status,
    scanMode: state.scanMode,
    devices: state.devices,
    pagesScanned: state.pages.length,
    linksChecked: state.linksChecked,
    skippedUrls: state.skippedUrls,
    aiEnabled: aiAvailable,
    aiStatus: state.aiStatus,
    scores,
    metrics: state.metrics,
    findings: state.findings,
    pages: state.pages,
    limitations,
    metadata: {
      auditDurationMs: Math.max(0, Date.parse(completedAt) - Date.parse(state.startedAt)),
      userAgent: USER_AGENT,
      pageSpeedUsed,
      storageAdapter: "cloudflare-d1",
      summarySource: "rules",
      aiAvailable,
      executionModel: "cloudflare-step-machine",
    },
  });

  return auditSchema.parse({ ...baseAudit, aiSummary: buildRuleBasedSummary(baseAudit) });
}

export async function advanceAuditJob(env: Env, id: string): Promise<AdvanceResult> {
  const job = await getJob(env, id);
  if (!job) {
    throw new AppError({
      code: "AUDIT_NOT_FOUND",
      title: "Rapport niet beschikbaar",
      message: "Deze controle bestaat niet, is verwijderd of is verlopen.",
      status: 404,
    });
  }
  const { row, state } = job;
  if (state.stage === "complete" && state.audit) return { type: "complete", state, audit: state.audit };
  if (state.stage === "failed") {
    throw new AppError({
      code: "AUDIT_FAILED",
      title: state.failure?.title ?? "Controle mislukt",
      message: state.failure?.message ?? "De controle kon niet worden afgerond.",
      status: 500,
      retryable: state.failure?.retryable ?? true,
    });
  }

  const config = runtimeConfig(env);
  const aiAvailable = config.aiEnabled && Boolean(env.AI);
  let phase = 1;
  let message = "De controle wordt vervolgd.";

  try {
    switch (state.stage) {
      case "pages": {
        ({ phase, message } = await processPageStage(env, state));
        break;
      }
      case "robots": {
        const result = await inspectRobots(env, state);
        state.robotsSitemapUrls = result.sitemapUrls;
        state.findings.push(...result.findings);
        state.stage = "sitemap";
        phase = 5;
        message = "robots.txt is gecontroleerd. De XML-sitemap wordt geanalyseerd.";
        break;
      }
      case "sitemap": {
        state.findings.push(...(await inspectSitemap(env, state)));
        state.stage = "links";
        phase = 5;
        message = "De sitemapcontrole is afgerond. Interne links worden gecontroleerd.";
        break;
      }
      case "links": {
        const result = await checkLinkBatch(env, state, 4);
        state.findings.push(...result.findings);
        if (state.linkCursor >= state.internalLinks.length) {
          addCompletedPhase(state, AUDIT_PHASES[5]);
          state.stage = "security";
        }
        phase = 5;
        message = result.checked
          ? `${state.linksChecked} van ${state.internalLinks.length} geselecteerde interne link(s) gecontroleerd.`
          : "Geen aanvullende interne links om te controleren.";
        break;
      }
      case "pagespeed": {
        if (state.pageSpeedCursor < state.devices.length) {
          const device = state.devices[state.pageSpeedCursor];
          const result = await fetchPageSpeed(env, state.finalUrl, device);
          if (result) {
            state.metrics[device] = result.metrics;
            state.findings.push(...result.findings);
          }
          state.pageSpeedCursor += 1;
          phase = 3;
          message = result
            ? `PageSpeed-gegevens voor ${device === "mobile" ? "mobiel" : "desktop"} zijn verwerkt.`
            : `PageSpeed-gegevens voor ${device === "mobile" ? "mobiel" : "desktop"} waren niet beschikbaar; de audit gaat verder.`;
        }
        if (state.pageSpeedCursor >= state.devices.length) {
          addCompletedPhase(state, AUDIT_PHASES[3]);
          addCompletedPhase(state, AUDIT_PHASES[4]);
          state.stage = "robots";
        }
        break;
      }
      case "security": {
        state.findings.push(...(await inspectHttpToHttps(env, state)));
        addCompletedPhase(state, AUDIT_PHASES[6]);
        state.stage = "finalize";
        phase = 7;
        message = "De beveiligingssignalen zijn gecontroleerd. De scores worden berekend.";
        break;
      }
      case "finalize": {
        addCompletedPhase(state, AUDIT_PHASES[7]);
        state.audit = finalizeAudit(env, state);
        if (state.generateAiSummary && aiAvailable) {
          state.audit.aiStatus = "pending";
          state.aiStatus = "pending";
          state.stage = "ai";
          phase = 8;
          message = "De regelgebaseerde samenvatting is gereed. Cloudflare Workers AI wordt optioneel aangeroepen.";
        } else {
          if (state.generateAiSummary && !aiAvailable) {
            state.aiStatus = "unavailable";
            state.audit.aiStatus = "unavailable";
          }
          addCompletedPhase(state, AUDIT_PHASES[9]);
          state.stage = "complete";
          phase = 9;
          message = "Het rapport is gereed.";
        }
        break;
      }
      case "ai": {
        if (!state.audit) throw new Error("Audit ontbreekt vóór AI-verrijking.");
        const dailyKey = new Date().toISOString().slice(0, 10);
        const quota = await consumeFixedWindow(env, `ai:${dailyKey}:${row.client_key}`, config.aiDailyLimit, 24 * 60 * 60);
        if (!quota.allowed) {
          state.aiStatus = "rate-limited";
          state.audit.aiStatus = "rate-limited";
        } else {
          try {
            state.audit.aiSummary = await generateWorkersAiSummary(env, state.audit);
            state.audit.aiStatus = "completed";
            state.audit.metadata.summarySource = "workers-ai";
            state.aiStatus = "completed";
          } catch {
            state.audit.aiStatus = "failed";
            state.aiStatus = "failed";
          }
        }
        addCompletedPhase(state, AUDIT_PHASES[8]);
        addCompletedPhase(state, AUDIT_PHASES[9]);
        state.stage = "complete";
        phase = 9;
        message = state.aiStatus === "completed"
          ? "Cloudflare Workers AI heeft de managementsamenvatting verrijkt."
          : "De regelgebaseerde samenvatting blijft beschikbaar; AI-verrijking is niet uitgevoerd.";
        break;
      }
      case "complete":
        break;
    }

    await saveJobState(env, state, row.version, config.ttlMinutes * 60, stateStatus(state));
    if (state.stage === "complete" && state.audit) return { type: "complete", state, audit: state.audit };
    return { type: "progress", state, phaseIndex: phase, message };
  } catch (error) {
    const appError = asAppError(error);
    state.stage = "failed";
    state.failure = appError.toPublic();
    await saveJobState(env, state, row.version, config.ttlMinutes * 60, "failed").catch(() => undefined);
    throw appError;
  }
}

export function toProgressEvent(result: AdvanceResult): AuditProgressEvent {
  if (result.type === "complete") return { type: "complete", audit: result.audit };
  return progressEvent(result.state, result.phaseIndex, result.message);
}
