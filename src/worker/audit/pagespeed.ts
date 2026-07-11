import { makeFinding } from "@/lib/audit/finding";
import type { Device, Finding } from "@/types/audit";
import { runtimeConfig } from "../config";
import type { Env, Metrics } from "../types";

export async function fetchPageSpeed(env: Env, targetUrl: string, device: Device): Promise<{ metrics: Metrics; findings: Finding[] } | null> {
  const config = runtimeConfig(env);
  if (!config.pageSpeedEnabled) return null;
  const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  endpoint.searchParams.set("url", targetUrl);
  endpoint.searchParams.set("strategy", device);
  endpoint.searchParams.set("category", "performance");
  if (config.pageSpeedApiKey) endpoint.searchParams.set("key", config.pageSpeedApiKey);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(endpoint, { signal: controller.signal, headers: { accept: "application/json" } });
    if (!response.ok) return null;
    const data = await response.json<PageSpeedResponse>();
    const audits = data.lighthouseResult?.audits ?? {};
    const loading = data.loadingExperience?.metrics ?? {};
    const lcpMs = numeric(audits["largest-contentful-paint"]?.numericValue) ?? percentile(loading.LARGEST_CONTENTFUL_PAINT_MS);
    const cls = numeric(audits["cumulative-layout-shift"]?.numericValue) ?? percentile(loading.CUMULATIVE_LAYOUT_SHIFT_SCORE, 100);
    const inpMs = percentile(loading.INTERACTION_TO_NEXT_PAINT);
    const metrics: Metrics = {
      source: Object.keys(loading).length ? "mixed" : "pagespeed",
      fieldDataAvailable: Object.keys(loading).length > 0,
      lcpMs,
      cls,
      inpMs,
      fcpMs: numeric(audits["first-contentful-paint"]?.numericValue),
      speedIndexMs: numeric(audits["speed-index"]?.numericValue),
      totalBlockingTimeMs: numeric(audits["total-blocking-time"]?.numericValue),
      performanceScore: typeof data.lighthouseResult?.categories?.performance?.score === "number" ? Math.round(data.lighthouseResult.categories.performance.score * 100) : undefined,
      resourceCount: numeric(audits["network-requests"]?.details?.items?.length),
      pageWeightBytes: numeric(audits["total-byte-weight"]?.numericValue),
      ttfbMs: numeric(audits["server-response-time"]?.numericValue),
      notes: ["PageSpeed-resultaten kunnen per testmoment en netwerkprofiel variëren."],
    };
    return { metrics, findings: metricFindings(targetUrl, device, metrics) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function metricFindings(url: string, device: Device, metrics: Metrics): Finding[] {
  const findings: Finding[] = [];
  if (metrics.lcpMs !== undefined && metrics.lcpMs > 2500) findings.push(makeFinding({
    category: "performance", subcategory: "lcp", title: "Largest Contentful Paint overschrijdt de voorkeursgrens",
    description: "De grootste zichtbare inhoud verschijnt te laat in de gemeten PageSpeed-run.", evidence: `${device}: LCP ${Math.round(metrics.lcpMs)} ms.`,
    affectedUrl: url, severity: metrics.lcpMs > 4000 ? "high" : "medium", confidence: "confirmed", source: "pagespeed",
    recommendation: "Optimaliseer het LCP-element en de kritieke renderketen.",
    technicalImplementation: "Identificeer het LCP-element, verlaag TTFB, preload de noodzakelijke bron, gebruik fetchpriority=high voor de hero-afbeelding en verwijder render-blokkades.",
    estimatedEffort: "gemiddeld", acceptanceCriterion: "LCP is bij de 75e percentielmeting maximaal 2,5 seconden.", measuredValue: metrics.lcpMs, targetValue: 2500,
  }));
  if (metrics.cls !== undefined && metrics.cls > 0.1) findings.push(makeFinding({
    category: "performance", subcategory: "cls", title: "Cumulative Layout Shift overschrijdt de voorkeursgrens",
    description: "Inhoud verschuift tijdens het laden meer dan aanbevolen.", evidence: `${device}: CLS ${metrics.cls.toFixed(3)}.`, affectedUrl: url,
    severity: metrics.cls > 0.25 ? "high" : "medium", confidence: "confirmed", source: "pagespeed",
    recommendation: "Reserveer ruimte voor media en dynamische onderdelen.",
    technicalImplementation: "Definieer afbeeldingsdimensies/aspect-ratio, reserveer advertentie- en embedruimte, stabiliseer font-loading en voeg banners niet boven bestaande inhoud in.",
    estimatedEffort: "gemiddeld", acceptanceCriterion: "CLS is bij de 75e percentielmeting maximaal 0,1.", measuredValue: metrics.cls, targetValue: 0.1,
  }));
  if (metrics.inpMs !== undefined && metrics.inpMs > 200) findings.push(makeFinding({
    category: "performance", subcategory: "inp", title: "Interaction to Next Paint overschrijdt de voorkeursgrens",
    description: "Interactiefeedback is trager dan aanbevolen.", evidence: `${device}: INP ${Math.round(metrics.inpMs)} ms.`, affectedUrl: url,
    severity: metrics.inpMs > 500 ? "high" : "medium", confidence: "confirmed", source: "pagespeed",
    recommendation: "Verlaag main-threadwerk rond gebruikersinteracties.",
    technicalImplementation: "Splits lange taken, verklein JavaScriptbundels, stel niet-kritieke code uit en optimaliseer eventhandlers en rendering.",
    estimatedEffort: "groot", acceptanceCriterion: "INP is bij de 75e percentielmeting maximaal 200 ms.", measuredValue: metrics.inpMs, targetValue: 200,
  }));
  return findings;
}

function numeric(value: unknown): number | undefined { return typeof value === "number" && Number.isFinite(value) ? value : undefined; }
function percentile(value: { percentile?: number } | undefined, divisor = 1): number | undefined { return typeof value?.percentile === "number" ? value.percentile / divisor : undefined; }
interface PageSpeedResponse {
  lighthouseResult?: { categories?: { performance?: { score?: number } }; audits?: Record<string, { numericValue?: number; details?: { items?: unknown[] } }> };
  loadingExperience?: { metrics?: Record<string, { percentile?: number }> };
}
