import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { CrawledPage, Finding } from "@/types/audit";
import { makeFinding } from "./finding";
import { analyzeSecurityHeaders } from "./headers";
import { clean } from "./page";

const tokenPatterns = [
  /AKIA[0-9A-Z]{16}/g,
  /AIza[0-9A-Za-z\-_]{35}/g,
  /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g,
  /ghp_[A-Za-z0-9]{30,}/g,
];

export function analyzeSecurity(page: CrawledPage, document?: CheerioAPI): Finding[] {
  const $ = document ?? cheerio.load(page.html);
  const findings: Finding[] = [];
  const url = page.finalUrl;
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") findings.push(makeFinding({ category: "security", subcategory: "https", title: "Website gebruikt geen HTTPS", description: "Verkeer kan zonder transportversleuteling worden onderschept of gewijzigd.", evidence: `Eind-URL gebruikt ${parsed.protocol}`, affectedUrl: url, severity: "critical", confidence: "confirmed", source: "tls", recommendation: "Activeer HTTPS voor de volledige website en redirect HTTP permanent.", technicalImplementation: "Installeer een geldig certificaat, forceer HTTPS met een 301/308 en corrigeer alle absolute HTTP-bronnen.", estimatedEffort: "gemiddeld", acceptanceCriterion: "Alle publieke pagina’s en subresources laden via HTTPS met een geldig certificaat." }));
  else findings.push(...analyzeSecurityHeaders(page.headers, url));

  const insecureResources: string[] = [];
  $("script[src^='http://'], link[href^='http://'], img[src^='http://'], iframe[src^='http://'], source[src^='http://']").each((_, el) => {
    const value = $(el).attr("src") ?? $(el).attr("href");
    if (value) insecureResources.push(value);
  });
  if (parsed.protocol === "https:" && insecureResources.length) findings.push(makeFinding({ category: "security", subcategory: "mixed-content", title: "Onbeveiligde subresources op HTTPS-pagina", description: "HTTP-bronnen kunnen worden geblokkeerd of de vertrouwelijkheid van de pagina verlagen.", evidence: `${insecureResources.length} expliciete HTTP-bron(nen), waaronder ${insecureResources[0]}.`, affectedUrl: url, severity: "high", confidence: "confirmed", source: "html", recommendation: "Laad alle bronnen via HTTPS of host ze lokaal.", technicalImplementation: "Vervang hardcoded http://-URL’s, controleer externe providers en voeg waar nodig CSP upgrade-insecure-requests toe als aanvullende maatregel.", estimatedEffort: "klein", acceptanceCriterion: "De browserconsole rapporteert geen mixed content en alle subresources gebruiken HTTPS." }));

  const insecureForms = $("form[action^='http://']").length;
  if (insecureForms) findings.push(makeFinding({ category: "security", subcategory: "forms", title: "Formulieraction gebruikt HTTP", description: "Ingevoerde gegevens kunnen onversleuteld worden verzonden.", evidence: `${insecureForms} formulier(en) posten naar een HTTP-endpoint.`, affectedUrl: url, severity: "critical", confidence: "confirmed", source: "html", recommendation: "Gebruik uitsluitend HTTPS-endpoints.", technicalImplementation: "Wijzig action-URL’s naar HTTPS, forceer TLS server-side en voorkom protocol-downgrade redirects.", estimatedEffort: "klein", acceptanceCriterion: "Alle formulierverzendingen gebruiken HTTPS tot en met de eindbestemming." }));

  const setCookie = page.headers["set-cookie"] ?? "";
  if (setCookie) {
    if (!/;\s*secure(?:;|,|$)/i.test(setCookie) && parsed.protocol === "https:") findings.push(makeFinding({ category: "security", subcategory: "cookies", title: "Cookie zonder zichtbaar Secure-attribuut", description: "Een cookie kan mogelijk ook via een onbeveiligde verbinding worden verstuurd.", evidence: "In de gecombineerde Set-Cookie-response is geen Secure-attribuut waargenomen.", affectedUrl: url, severity: "medium", confidence: "likely", source: "response-header", recommendation: "Markeer sessie- en gevoelige cookies als Secure.", technicalImplementation: "Configureer cookies server-side met Secure; HttpOnly voor niet-JavaScriptcookies; en een passende SameSite-waarde.", estimatedEffort: "klein", acceptanceCriterion: "Alle gevoelige cookies bevatten Secure en worden uitsluitend via HTTPS verzonden." }));
    if (!/;\s*httponly(?:;|,|$)/i.test(setCookie)) findings.push(makeFinding({ category: "security", subcategory: "cookies", title: "Cookie zonder zichtbaar HttpOnly-attribuut", description: "Een sessiecookie die JavaScript niet nodig heeft, hoort niet vanuit scripts leesbaar te zijn.", evidence: "In de gecombineerde Set-Cookie-response is geen HttpOnly-attribuut waargenomen.", affectedUrl: url, severity: "medium", confidence: "likely", source: "response-header", recommendation: "Gebruik HttpOnly voor sessie- en authenticatiecookies.", technicalImplementation: "Stel HttpOnly in bij server-side cookiecreatie; laat het weg alleen voor cookies die aantoonbaar client-side gelezen moeten worden.", estimatedEffort: "klein", acceptanceCriterion: "Sessie- en authenticatiecookies zijn HttpOnly." }));
    if (!/;\s*samesite=/i.test(setCookie)) findings.push(makeFinding({ category: "security", subcategory: "cookies", title: "Cookie zonder zichtbaar SameSite-beleid", description: "Cross-site cookiegedrag is niet expliciet beperkt.", evidence: "In de gecombineerde Set-Cookie-response is geen SameSite-attribuut waargenomen.", affectedUrl: url, severity: "low", confidence: "likely", source: "response-header", recommendation: "Kies SameSite=Lax of Strict waar mogelijk.", technicalImplementation: "Gebruik SameSite=Lax als veilige standaard; SameSite=None alleen met Secure en wanneer cross-site gebruik noodzakelijk is.", estimatedEffort: "klein", acceptanceCriterion: "Alle cookies hebben een functioneel onderbouwde SameSite-waarde." }));
  }

  const generator = $("meta[name='generator']").attr("content");
  if (generator) findings.push(makeFinding({ category: "security", subcategory: "information-disclosure", title: "Technologie-identificatie publiek zichtbaar", description: "De generator-tag geeft aanvullende platforminformatie prijs.", evidence: `Generator: ${generator}`, affectedUrl: url, severity: "informational", confidence: "confirmed", source: "html", recommendation: "Verwijder onnodige versie- of productidentificatie.", technicalImplementation: "Schakel de generator-meta-tag uit via het CMS of de template en verberg exacte versienummers in publieke headers en assets.", estimatedEffort: "klein", acceptanceCriterion: "Publieke HTML en headers bevatten geen onnodige exacte softwareversies." }));

  const lowerHtml = page.html.toLowerCase();
  if (/stack trace|uncaught exception|fatal error|debug mode|traceback \(most recent call last\)/i.test(lowerHtml)) findings.push(makeFinding({ category: "security", subcategory: "debug-output", title: "Mogelijke debug- of stacktrace-informatie", description: "Technische foutdetails kunnen interne paden, componenten of configuratie onthullen.", evidence: "De HTML bevat tekst die overeenkomt met debug- of stacktracepatronen.", affectedUrl: url, severity: "high", confidence: "likely", source: "heuristic", recommendation: "Toon bezoekers alleen generieke foutmeldingen en log details intern.", technicalImplementation: "Schakel production mode in, configureer centrale foutafhandeling en redigeer secrets en interne paden uit logs.", estimatedEffort: "gemiddeld", acceptanceCriterion: "Publieke foutpagina’s bevatten geen stacktraces, interne paden of configuratiedetails." }));

  const exposed = tokenPatterns.flatMap((pattern) => page.html.match(pattern) ?? []);
  if (exposed.length) findings.push(makeFinding({ category: "security", subcategory: "secrets", title: "Mogelijke publieke API-sleutel of token", description: "Een conservatief patroon detecteerde een waarde die op een credential lijkt.", evidence: `${exposed.length} potentiële credentialwaarde(n) in de HTML. De waarde zelf wordt om veiligheidsredenen niet getoond.`, affectedUrl: url, severity: "critical", confidence: "likely", source: "heuristic", recommendation: "Onderzoek en roteer de sleutel onmiddellijk wanneer deze werkelijk geheim is.", technicalImplementation: "Verwijder secrets uit clientbundels en HTML, bewaar ze in server-side omgevingsvariabelen en beperk scopes, origins en quota.", estimatedEffort: "gemiddeld", acceptanceCriterion: "Geen geheime credentials verschijnen in publieke broncode; mogelijk gelekte sleutels zijn ingetrokken en vervangen." }));

  const scripts = $("script[src]");
  const thirdParty = scripts.filter((_, el) => {
    const src = $(el).attr("src");
    if (!src) return false;
    try { return new URL(src, url).origin !== parsed.origin; } catch { return false; }
  }).length;
  if (thirdParty > 10) findings.push(makeFinding({ category: "security", subcategory: "third-party", title: "Veel externe scripts", description: "Elke externe scriptleverancier vergroot de supply-chain- en privacyoppervlakte.", evidence: `${thirdParty} externe scriptverwijzingen aangetroffen.`, affectedUrl: url, severity: "medium", confidence: "confirmed", source: "html", recommendation: "Beperk scripts tot aantoonbaar noodzakelijke leveranciers.", technicalImplementation: "Inventariseer eigenaar, doel en gegevensverwerking per script; verwijder ongebruikte tags en gebruik CSP plus Subresource Integrity waar haalbaar.", estimatedEffort: "gemiddeld", acceptanceCriterion: "Alle externe scripts zijn noodzakelijk, gedocumenteerd, contractueel beoordeeld en technisch beperkt." }));
  return findings;
}

export function analyzeTrust(page: CrawledPage, document?: CheerioAPI): Finding[] {
  const $ = document ?? cheerio.load(page.html);
  const findings: Finding[] = [];
  const url = page.finalUrl;
  const links = $("a[href]").map((_, el) => ({ href: $(el).attr("href") ?? "", text: clean($(el).text()) })).get();
  const hasLink = (pattern: RegExp) => links.some((link) => pattern.test(`${link.href} ${link.text}`));
  if (!hasLink(/privacy|privacyverklaring|gegevensbescherming/i)) findings.push(makeFinding({ category: "security", subcategory: "trust", title: "Geen duidelijke privacyverklaring gevonden", description: "Bezoekers krijgen mogelijk onvoldoende inzicht in de verwerking van persoonsgegevens.", evidence: "Geen herkenbare privacy-link op deze pagina gevonden.", affectedUrl: url, severity: "medium", confidence: "likely", source: "heuristic", recommendation: "Plaats een duidelijke en actuele privacyverklaring in de footer en bij relevante formulieren.", technicalImplementation: "Beschrijf verantwoordelijke, doeleinden, grondslagen, bewaartermijnen, ontvangers, rechten en contactmogelijkheid.", estimatedEffort: "gemiddeld", acceptanceCriterion: "Een publiek bereikbare privacyverklaring is vanaf iedere pagina vindbaar en inhoudelijk actueel." }));
  if (!hasLink(/cookie|cookies/i)) findings.push(makeFinding({ category: "security", subcategory: "trust", title: "Geen cookiebeleid gevonden", description: "Bezoekers kunnen moeilijk nagaan welke cookies of vergelijkbare technologieën worden gebruikt.", evidence: "Geen herkenbare cookiebeleid-link op deze pagina gevonden.", affectedUrl: url, severity: "low", confidence: "likely", source: "heuristic", recommendation: "Publiceer een cookiebeleid wanneer niet-noodzakelijke of analytische technologie wordt gebruikt.", technicalImplementation: "Documenteer categorie, aanbieder, doel, duur en toestemming; koppel het beleid aan de voorkeureninterface.", estimatedEffort: "gemiddeld", acceptanceCriterion: "Het cookiebeleid is vindbaar, specifiek en consistent met de werkelijk geplaatste cookies." }));
  if (!hasLink(/algemene voorwaarden|terms|voorwaarden|terms-and-conditions/i)) findings.push(makeFinding({ category: "security", subcategory: "trust", title: "Geen algemene voorwaarden gevonden", description: "Voor commerciële of contractuele diensten kan essentiële informatie ontbreken.", evidence: "Geen herkenbare voorwaarden-link op deze pagina gevonden.", affectedUrl: url, severity: "low", confidence: "manual-review-required", source: "heuristic", recommendation: "Beoordeel of algemene voorwaarden juridisch en commercieel relevant zijn.", technicalImplementation: "Publiceer toepasselijke voorwaarden en link ze vóór contractsluiting of bestelling; laat juridische inhoud professioneel valideren.", estimatedEffort: "gemiddeld", acceptanceCriterion: "Relevante voorwaarden zijn vóór de transactie duidelijk beschikbaar." }));
  const body = clean($("body").text());
  const email = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(body) || $("a[href^='mailto:']").length > 0;
  const phone = /(?:\+?\d[\d\s().-]{7,}\d)/.test(body) || $("a[href^='tel:']").length > 0;
  if (!email && !phone && !hasLink(/contact/i)) findings.push(makeFinding({ category: "security", subcategory: "trust", title: "Geen duidelijk contactkanaal gevonden", description: "Bezoekers kunnen de verantwoordelijke organisatie moeilijk bereiken.", evidence: "Geen e-mailadres, telefoonlink of herkenbare contactlink gedetecteerd.", affectedUrl: url, severity: "medium", confidence: "likely", source: "heuristic", recommendation: "Maak contactgegevens en een contactpagina duidelijk vindbaar.", technicalImplementation: "Plaats professionele contactkanalen in header/footer en vermeld bedrijfsidentiteit op de contactpagina.", estimatedEffort: "klein", acceptanceCriterion: "Vanaf iedere pagina is binnen één interactie een actueel contactkanaal bereikbaar." }));
  return findings;
}
