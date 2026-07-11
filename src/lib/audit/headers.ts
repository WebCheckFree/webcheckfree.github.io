import type { Finding } from "@/types/audit";
import { makeFinding } from "./finding";

interface HeaderRule {
  header: string;
  title: string;
  severity: "high" | "medium" | "low";
  description: string;
  recommendation: string;
  implementation: string;
  acceptance: string;
}

const rules: HeaderRule[] = [
  { header: "strict-transport-security", title: "HSTS-header ontbreekt", severity: "medium", description: "Browsers worden niet expliciet verplicht om toekomstige verbindingen via HTTPS te openen.", recommendation: "Activeer HSTS nadat HTTPS op alle subdomeinen betrouwbaar is.", implementation: "Stel Strict-Transport-Security in, bijvoorbeeld max-age=31536000; includeSubDomains pas na volledige verificatie.", acceptance: "HTTPS-responsen bevatten een passend HSTS-beleid zonder HTTP-subresources." },
  { header: "content-security-policy", title: "Content Security Policy ontbreekt", severity: "medium", description: "Er is geen browserbeleid waargenomen dat toegestane script-, stijl- en framebronnen beperkt.", recommendation: "Introduceer een CSP gefaseerd en meet overtredingen.", implementation: "Start met Content-Security-Policy-Report-Only, verwijder inline uitzonderingen en activeer daarna een restrictief beleid met nonces of hashes.", acceptance: "Een actieve CSP beperkt bronnen zonder legitieme functionaliteit te breken." },
  { header: "x-content-type-options", title: "X-Content-Type-Options ontbreekt", severity: "low", description: "Browsers kunnen MIME-sniffing toepassen op verkeerd getypeerde bronnen.", recommendation: "Voeg nosniff toe.", implementation: "Stel X-Content-Type-Options: nosniff in op alle relevante responsen.", acceptance: "De respons bevat X-Content-Type-Options: nosniff." },
  { header: "referrer-policy", title: "Referrer-Policy ontbreekt", severity: "low", description: "De website definieert niet expliciet hoeveel URL-informatie naar andere origins wordt doorgestuurd.", recommendation: "Kies een privacybewust referrerbeleid.", implementation: "Gebruik bijvoorbeeld strict-origin-when-cross-origin of een strenger beleid passend bij de toepassing.", acceptance: "De respons bevat een gedocumenteerde Referrer-Policy." },
  { header: "permissions-policy", title: "Permissions-Policy ontbreekt", severity: "low", description: "Browserfuncties zoals camera, microfoon en geolocatie zijn niet expliciet beperkt.", recommendation: "Schakel ongebruikte browsermogelijkheden uit.", implementation: "Stel Permissions-Policy in met lege allowlists voor functies die de site niet nodig heeft.", acceptance: "De respons bevat een minimaal Permissions-Policy dat alleen benodigde functies toestaat." },
];

export function analyzeSecurityHeaders(headers: Record<string, string>, url: string): Finding[] {
  const findings: Finding[] = [];
  for (const rule of rules) if (!headers[rule.header]) findings.push(makeFinding({ category: "security", subcategory: "headers", title: rule.title, description: rule.description, evidence: `Responseheader ${rule.header} ontbreekt.`, affectedUrl: url, severity: rule.severity, confidence: "confirmed", source: "response-header", recommendation: rule.recommendation, technicalImplementation: rule.implementation, estimatedEffort: "klein", acceptanceCriterion: rule.acceptance }));
  const csp = headers["content-security-policy"] ?? "";
  const frameProtected = /(?:^|;)\s*frame-ancestors\s+/i.test(csp) || Boolean(headers["x-frame-options"]);
  if (!frameProtected) findings.push(makeFinding({ category: "security", subcategory: "clickjacking", title: "Framebescherming ontbreekt", description: "De pagina kan mogelijk in een externe framecontext worden geladen.", evidence: "Geen CSP frame-ancestors en geen X-Frame-Options waargenomen.", affectedUrl: url, severity: "medium", confidence: "confirmed", source: "response-header", recommendation: "Beperk welke origins de pagina mogen framen.", technicalImplementation: "Gebruik bij voorkeur CSP frame-ancestors 'none' of een expliciete allowlist; voeg desgewenst X-Frame-Options als legacy fallback toe.", estimatedEffort: "klein", acceptanceCriterion: "Ongeautoriseerde externe framing wordt door de browser geblokkeerd." }));
  return findings;
}
