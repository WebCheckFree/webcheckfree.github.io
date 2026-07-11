import { XMLParser } from "fast-xml-parser";
import { makeFinding } from "@/lib/audit/finding";
import type { Finding } from "@/types/audit";
import type { AuditJobState, Env } from "../types";
import { safeFetch } from "../http/safe-fetch";
import { sameRegistrableDomain } from "../security/url";

export function parseSitemapXml(xml: string): { type: "urlset" | "sitemapindex" | "invalid"; urlCount: number } {
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml) as Record<string, unknown>;
  const urlset = parsed.urlset as { url?: unknown } | undefined;
  const sitemapIndex = parsed.sitemapindex as { sitemap?: unknown } | undefined;
  const values = urlset?.url ?? sitemapIndex?.sitemap ?? [];
  const urlCount = Array.isArray(values) ? values.length : values ? 1 : 0;
  return { type: urlset ? "urlset" : sitemapIndex ? "sitemapindex" : "invalid", urlCount };
}

export async function inspectSitemap(env: Env, state: AuditJobState): Promise<Finding[]> {
  const base = new URL(state.finalUrl);
  const robotsCandidate = state.robotsSitemapUrls[0] ? new URL(state.robotsSitemapUrls[0], base) : null;
  const candidate = robotsCandidate && sameRegistrableDomain(base, robotsCandidate)
    ? robotsCandidate.toString()
    : new URL("/sitemap.xml", base).toString();
  try {
    const response = await safeFetch(env, state, candidate, {
      maxBytes: 500_000,
      acceptedContentTypes: ["application/xml", "text/xml", "text/plain", "text/html"],
    });
    if (response.status >= 400) throw new Error(`HTTP ${response.status}`);
    const parsed = parseSitemapXml(response.body);
    const findings: Finding[] = [];
    if (parsed.type === "invalid") findings.push(makeFinding({
      category: "seo", subcategory: "sitemap", title: "Sitemap heeft geen herkenbaar XML-formaat",
      description: "Het document bevat geen urlset of sitemapindex als hoofdelement.", evidence: "XML kon worden gelezen, maar een geldige sitemapstructuur ontbreekt.",
      affectedUrl: candidate, severity: "high", confidence: "confirmed", source: "sitemap",
      recommendation: "Genereer een sitemap volgens het sitemapprotocol.", technicalImplementation: "Gebruik urlset/url/loc of sitemapindex/sitemap/loc met absolute canonieke URL’s en correcte XML-escaping.",
      estimatedEffort: "gemiddeld", acceptanceCriterion: "De sitemap valideert als XML-sitemap en bevat alleen bedoelde canonieke URL’s.",
    }));
    if (parsed.urlCount === 0) findings.push(makeFinding({
      category: "seo", subcategory: "sitemap", title: "Sitemap bevat geen URL-vermeldingen",
      description: "De sitemap levert geen pagina- of child-sitemaplocaties.", evidence: "Nul URL-items aangetroffen.", affectedUrl: candidate,
      severity: "medium", confidence: "confirmed", source: "sitemap", recommendation: "Neem alle belangrijke canonieke indexeerbare pagina’s op.",
      technicalImplementation: "Genereer de sitemap vanuit de publiceerbare routelijst en sluit noindex-, redirect- en fout-URL’s uit.", estimatedEffort: "gemiddeld",
      acceptanceCriterion: "De sitemap bevat actuele 200-responderende canonieke URL’s.",
    }));
    return findings;
  } catch (error) {
    return [makeFinding({
      category: "seo", subcategory: "sitemap", title: "XML-sitemap niet beschikbaar of ongeldig",
      description: "De verwachte sitemap kon niet betrouwbaar worden gelezen.", evidence: error instanceof Error ? error.message : "Onbekende fout",
      affectedUrl: candidate, severity: "medium", confidence: "confirmed", source: "sitemap",
      recommendation: "Publiceer een actuele XML-sitemap en verwijs ernaar vanuit robots.txt.",
      technicalImplementation: "Zorg voor HTTP 200, geldige XML, absolute canonieke URL’s en splits bestanden boven de protocolgrenzen.",
      estimatedEffort: "gemiddeld", acceptanceCriterion: "De sitemap reageert met 200 en valideert zonder parsefouten.",
    })];
  }
}
