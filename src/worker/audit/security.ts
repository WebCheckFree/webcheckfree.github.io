import { makeFinding } from "@/lib/audit/finding";
import type { Finding } from "@/types/audit";
import type { AuditJobState, Env } from "../types";
import { safeFetch } from "../http/safe-fetch";

export async function inspectHttpToHttps(env: Env, state: AuditJobState): Promise<Finding[]> {
  const base = new URL(state.finalUrl || state.normalizedUrl);
  if (base.protocol !== "https:") return [];
  const httpUrl = new URL(base);
  httpUrl.protocol = "http:";
  httpUrl.port = "";
  try {
    const response = await safeFetch(env, state, httpUrl, { method: "HEAD", maxBytes: 1_000, maxRedirects: 4 });
    if (!response.finalUrl.startsWith("https://")) return [makeFinding({
      category: "security", subcategory: "https", title: "HTTP wordt niet naar HTTPS doorgestuurd",
      description: "De onbeveiligde URL eindigt niet automatisch op de beveiligde variant.", evidence: `HTTP-eindbestemming: ${response.finalUrl}`,
      affectedUrl: httpUrl.toString(), severity: "high", confidence: "confirmed", source: "response-header",
      recommendation: "Redirect alle HTTP-verzoeken permanent naar HTTPS.",
      technicalImplementation: "Configureer op CDN/webserver een 301 of 308 naar dezelfde host en pad via HTTPS, zonder tussenstappen.",
      estimatedEffort: "klein", acceptanceCriterion: "Elk HTTP-verzoek eindigt via maximaal één permanente redirect op de canonieke HTTPS-URL.",
    })];
  } catch {
    return [];
  }
  return [];
}
