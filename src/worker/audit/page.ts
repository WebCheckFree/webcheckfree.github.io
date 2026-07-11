import * as cheerio from "cheerio";
import { analyzeAccessibility } from "@/lib/audit/accessibility";
import { analyzePerformance } from "@/lib/audit/performance";
import { analyzeSecurity, analyzeTrust } from "@/lib/audit/security";
import { analyzeSeo } from "@/lib/audit/seo";
import { analyzeUx } from "@/lib/audit/ux";
import { makeFinding } from "@/lib/audit/finding";
import { toPageResult } from "@/lib/audit/page";
import type { CrawledPage, Finding } from "@/types/audit";
import type { AuditJobState, CrawlQueueItem, Env, PageResult } from "../types";
import { safeFetch } from "../http/safe-fetch";
import { canonicalizeCrawlUrl, isSafeCrawlCandidate, sameRegistrableDomain } from "../security/url";

export interface ProcessedPage {
  page: PageResult;
  findings: Finding[];
  discovered: CrawlQueueItem[];
  internalLinks: string[];
  finalUrl: string;
}

export async function fetchAndAnalyzePage(env: Env, state: AuditJobState, item: CrawlQueueItem): Promise<ProcessedPage> {
  const response = await safeFetch(env, state, item.url, {
    acceptedContentTypes: ["text/html", "application/xhtml+xml"],
  });
  const page: CrawledPage = {
    requestedUrl: item.url,
    finalUrl: response.finalUrl,
    statusCode: response.status,
    contentType: response.contentType,
    headers: response.headers,
    html: response.body,
    responseTimeMs: response.responseTimeMs,
    bytes: response.bytes,
    redirectCount: response.redirectCount,
    depth: item.depth,
  };

  const $ = cheerio.load(page.html);
  const findings: Finding[] = [
    ...analyzePerformance(page, response.bytes, $),
    ...analyzeAccessibility(page, $),
    ...analyzeUx(page, $),
    ...analyzeSeo(page, $),
    ...analyzeSecurity(page, $),
    ...analyzeTrust(page, $),
  ];
  if (page.statusCode >= 400) {
    findings.push(makeFinding({
      category: "performance",
      subcategory: "http-status",
      title: "Pagina reageert met een foutstatus",
      description: "De gecrawlde pagina leverde geen succesvolle HTTP-respons.",
      evidence: `HTTP ${page.statusCode}.`,
      affectedUrl: page.finalUrl,
      severity: page.statusCode >= 500 ? "high" : "medium",
      confidence: "confirmed",
      source: "response-header",
      recommendation: "Herstel de route of stuur permanent door naar een relevante bestaande pagina.",
      technicalImplementation: "Controleer routing, applicatielogs en hostingconfiguratie; gebruik 301/308 alleen wanneer inhoud definitief is verplaatst.",
      estimatedEffort: "gemiddeld",
      acceptanceCriterion: "De bedoelde pagina reageert met 200 of een bewuste enkele redirect.",
    }));
  }

  const base = new URL(page.finalUrl);
  const links = $("a[href]")
    .map((_, element) => $(element).attr("href") || "")
    .get();
  const discovered = new Map<string, CrawlQueueItem>();
  const internalLinks = new Set<string>();
  for (const href of links) {
    const candidate = canonicalizeCrawlUrl(href, page.finalUrl);
    if (!candidate || !sameRegistrableDomain(base, candidate) || !isSafeCrawlCandidate(candidate)) continue;
    const value = candidate.toString();
    internalLinks.add(value);
    if (item.depth < 3 && !state.visited.includes(value)) discovered.set(value, { url: value, depth: item.depth + 1 });
  }

  return {
    page: toPageResult(page, $),
    findings,
    discovered: [...discovered.values()],
    internalLinks: [...internalLinks],
    finalUrl: page.finalUrl,
  };
}

export function analyzeCrossPageMetadata(pages: PageResult[]): Finding[] {
  const findings: Finding[] = [];
  const titleMap = new Map<string, string[]>();
  const descriptionMap = new Map<string, string[]>();
  for (const page of pages) {
    const title = page.title?.trim().toLowerCase();
    const description = page.metaDescription?.trim().toLowerCase();
    if (title) titleMap.set(title, [...(titleMap.get(title) ?? []), page.finalUrl]);
    if (description) descriptionMap.set(description, [...(descriptionMap.get(description) ?? []), page.finalUrl]);
  }
  for (const [title, urls] of titleMap) {
    if (urls.length < 2) continue;
    findings.push(makeFinding({
      category: "seo",
      subcategory: "duplicate-metadata",
      title: "Dubbele paginatitels",
      description: "Meerdere gecrawlde pagina’s gebruiken exact dezelfde titel.",
      evidence: `${urls.length} pagina’s delen de titel “${title.slice(0, 120)}”.`,
      affectedUrl: urls[0],
      severity: "medium",
      confidence: "confirmed",
      source: "html",
      recommendation: "Maak iedere indexeerbare paginatitel uniek.",
      technicalImplementation: "Gebruik paginatype- en onderwerpvelden in metadata-templates en valideer duplicaten in de contentworkflow.",
      estimatedEffort: "klein",
      acceptanceCriterion: "Alle indexeerbare gecrawlde pagina’s hebben een unieke titel.",
    }));
  }
  for (const [description, urls] of descriptionMap) {
    if (urls.length < 2) continue;
    findings.push(makeFinding({
      category: "seo",
      subcategory: "duplicate-metadata",
      title: "Dubbele metabeschrijvingen",
      description: "Meerdere gecrawlde pagina’s gebruiken exact dezelfde beschrijving.",
      evidence: `${urls.length} pagina’s delen de metabeschrijving “${description.slice(0, 120)}”.`,
      affectedUrl: urls[0],
      severity: "low",
      confidence: "confirmed",
      source: "html",
      recommendation: "Schrijf unieke beschrijvingen per belangrijke pagina.",
      technicalImplementation: "Genereer metadata uit unieke paginavelden en voorkom algemene fallbackteksten op indexeerbare pagina’s.",
      estimatedEffort: "klein",
      acceptanceCriterion: "Belangrijke indexeerbare pagina’s hebben unieke metabeschrijvingen.",
    }));
  }
  return findings;
}
