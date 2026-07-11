import { makeFinding } from "@/lib/audit/finding";
import type { Finding } from "@/types/audit";
import type { AuditJobState, Env } from "../types";
import { safeFetch } from "../http/safe-fetch";

export function parseRobotsText(content: string): { sitemapUrls: string[]; blocksAll: boolean } {
  const sitemapUrls = content
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*sitemap\s*:\s*(.+)$/i)?.[1]?.trim())
    .filter((value): value is string => Boolean(value));
  return { sitemapUrls, blocksAll: /^\s*disallow\s*:\s*\/\s*$/im.test(content) };
}

export async function inspectRobots(env: Env, state: AuditJobState): Promise<{ sitemapUrls: string[]; findings: Finding[] }> {
  const robotsUrl = new URL("/robots.txt", state.finalUrl || state.normalizedUrl);
  try {
    const response = await safeFetch(env, state, robotsUrl, {
      maxBytes: 100_000,
      acceptedContentTypes: ["text/plain", "text/html"],
    });
    if (response.status === 404) {
      return {
        sitemapUrls: [],
        findings: [makeFinding({
          category: "seo", subcategory: "robots", title: "robots.txt ontbreekt",
          description: "Er is geen robots.txt-bestand gevonden. Dit is niet verplicht, maar het bestand kan crawlrichtlijnen en sitemaplocaties centraliseren.",
          evidence: "GET /robots.txt reageerde met 404.", affectedUrl: robotsUrl.toString(), severity: "low", confidence: "confirmed", source: "robots",
          recommendation: "Publiceer een eenvoudige robots.txt wanneer crawlrichtlijnen of sitemaps relevant zijn.",
          technicalImplementation: "Plaats robots.txt in de webroot, vermijd het blokkeren van essentiële CSS/JS en verwijs naar de XML-sitemap.",
          estimatedEffort: "klein", acceptanceCriterion: "robots.txt reageert met 200, bevat geldige regels en blokkeert geen belangrijke publieke inhoud.",
        })],
      };
    }
    const parsed = parseRobotsText(response.body);
    const findings: Finding[] = [];
    if (parsed.blocksAll) findings.push(makeFinding({
      category: "seo", subcategory: "robots", title: "robots.txt bevat een volledige crawlblokkade",
      description: "Een Disallow: / regel kan crawlers voor een gebruikersagent volledig weren.", evidence: "Een regel Disallow: / is aangetroffen.",
      affectedUrl: robotsUrl.toString(), severity: "high", confidence: "likely", source: "robots",
      recommendation: "Bevestig dat een volledige blokkade bewust en alleen voor de juiste user-agent geldt.",
      technicalImplementation: "Controleer groepsindeling en verwijder de blokkade voor publieke productie-inhoud wanneer indexering gewenst is.",
      estimatedEffort: "klein", acceptanceCriterion: "Belangrijke productiepagina’s zijn niet onbedoeld voor relevante crawlers geblokkeerd.",
    }));
    if (!parsed.sitemapUrls.length) findings.push(makeFinding({
      category: "seo", subcategory: "robots", title: "robots.txt verwijst niet naar een sitemap",
      description: "Zoekmachines ontvangen via robots.txt geen expliciete sitemaplocatie.", evidence: "Geen Sitemap:-regel aangetroffen.",
      affectedUrl: robotsUrl.toString(), severity: "low", confidence: "confirmed", source: "robots",
      recommendation: "Voeg de absolute sitemap-URL toe.", technicalImplementation: "Plaats bijvoorbeeld Sitemap: https://example.com/sitemap.xml buiten user-agentgroepen.",
      estimatedEffort: "klein", acceptanceCriterion: "robots.txt bevat minstens één geldige absolute Sitemap:-regel.",
    }));
    return { sitemapUrls: parsed.sitemapUrls, findings };
  } catch (error) {
    return { sitemapUrls: [], findings: [makeFinding({
      category: "seo", subcategory: "robots", title: "robots.txt kon niet worden gecontroleerd",
      description: "Het bestand was niet bereikbaar binnen de veilige controlelimieten.", evidence: error instanceof Error ? error.message : "Onbekende fout",
      affectedUrl: robotsUrl.toString(), severity: "low", confidence: "manual-review-required", source: "robots",
      recommendation: "Controleer het bestand handmatig en via serverlogs.", technicalImplementation: "Zorg dat /robots.txt zonder authenticatie, redirectketen of foutrespons beschikbaar is.",
      estimatedEffort: "klein", acceptanceCriterion: "robots.txt reageert betrouwbaar met een geldige tekstrespons.",
    })] };
  }
}
