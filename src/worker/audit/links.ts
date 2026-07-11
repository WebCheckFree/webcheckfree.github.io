import { makeFinding } from "@/lib/audit/finding";
import type { Finding } from "@/types/audit";
import type { AuditJobState, Env } from "../types";
import { safeFetch } from "../http/safe-fetch";

export async function checkLinkBatch(env: Env, state: AuditJobState, batchSize = 5): Promise<{ findings: Finding[]; checked: number }> {
  const findings: Finding[] = [];
  const batch = state.internalLinks.slice(state.linkCursor, state.linkCursor + batchSize);
  for (const url of batch) {
    try {
      let response = await safeFetch(env, state, url, { method: "HEAD", maxRedirects: 4, maxBytes: 1_000 });
      if ([405, 501].includes(response.status)) {
        response = await safeFetch(env, state, url, { method: "GET", maxRedirects: 4, maxBytes: 20_000, acceptAnyContentType: true });
      }
      if (response.status >= 400) findings.push(makeFinding({
        category: "seo",
        subcategory: "broken-links",
        title: "Interne link verwijst naar een foutrespons",
        description: "Een interne link leidt naar een pagina die geen succesvolle respons geeft.",
        evidence: `${url} reageerde met HTTP ${response.status}.`,
        affectedUrl: url,
        severity: response.status >= 500 ? "high" : "medium",
        confidence: "confirmed",
        source: "link-checker",
        recommendation: "Herstel of vervang de interne link.",
        technicalImplementation: "Werk het href-attribuut bij, herstel de doelroute of configureer een enkele permanente redirect naar de relevante bestemming.",
        estimatedEffort: "klein",
        acceptanceCriterion: "De interne link eindigt op een relevante 200-responderende pagina zonder redirectketen.",
      }));
      if (response.redirectCount > 1) findings.push(makeFinding({
        category: "seo",
        subcategory: "redirects",
        title: "Interne link gebruikt een redirectketen",
        description: "Meerdere omleidingen vertragen crawlers en bezoekers.",
        evidence: `${url} gebruikte ${response.redirectCount} redirects.`,
        affectedUrl: url,
        severity: "low",
        confidence: "confirmed",
        source: "link-checker",
        recommendation: "Link rechtstreeks naar de definitieve URL.",
        technicalImplementation: "Vervang interne href-waarden door de canonieke eindbestemming en reduceer redirects tot maximaal één stap.",
        estimatedEffort: "klein",
        acceptanceCriterion: "Interne links wijzen rechtstreeks naar de definitieve 200-URL.",
      }));
    } catch (error) {
      findings.push(makeFinding({
        category: "seo",
        subcategory: "broken-links",
        title: "Interne link kon niet betrouwbaar worden gecontroleerd",
        description: "De linkcontrole bereikte geen verifieerbare eindstatus.",
        evidence: error instanceof Error ? error.message : "Onbekende netwerkfout",
        affectedUrl: url,
        severity: "low",
        confidence: "manual-review-required",
        source: "link-checker",
        recommendation: "Open de link handmatig en controleer serverlogs.",
        technicalImplementation: "Controleer DNS, TLS, redirects, rate limiting en de doelroute.",
        estimatedEffort: "klein",
        acceptanceCriterion: "De link is zonder authenticatie en binnen de time-out bereikbaar.",
      }));
    }
  }
  state.linkCursor += batch.length;
  state.linksChecked += batch.length;
  return { findings, checked: batch.length };
}
