import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { CrawledPage, Finding } from "@/types/audit";
import { makeFinding } from "./finding";
import { clean } from "./page";

export function analyzeUx(page: CrawledPage, document?: CheerioAPI): Finding[] {
  const $ = document ?? cheerio.load(page.html);
  const findings: Finding[] = [];
  const url = page.finalUrl;
  const viewport = $("meta[name='viewport']").attr("content") ?? "";
  if (viewport && !/width\s*=\s*device-width/i.test(viewport)) findings.push(makeFinding({ category: "ux", subcategory: "mobile", title: "Viewport is niet apparaatbreed ingesteld", description: "De mobiele schaal kan afwijken van de echte schermbreedte.", evidence: `Viewportwaarde: ${viewport}`, affectedUrl: url, severity: "high", confidence: "confirmed", source: "html", recommendation: "Gebruik width=device-width.", technicalImplementation: "Stel content in op width=device-width, initial-scale=1 en vermijd maximum-scale=no of user-scalable=no.", estimatedEffort: "klein", acceptanceCriterion: "De pagina schaalt correct op 320–390 px zonder horizontale document-scroll." }));
  if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:\.0)?(?:,|$)/i.test(viewport)) findings.push(makeFinding({ category: "ux", subcategory: "zoom", title: "Inzoomen is mogelijk beperkt", description: "Het blokkeren van pinch-zoom maakt tekst moeilijker leesbaar voor slechtziende bezoekers.", evidence: `Viewportwaarde: ${viewport}`, affectedUrl: url, severity: "high", confidence: "confirmed", source: "html", recommendation: "Laat browserzoom toe.", technicalImplementation: "Verwijder user-scalable=no en beperkende maximum-scale-instellingen.", estimatedEffort: "klein", acceptanceCriterion: "Gebruikers kunnen op mobiele apparaten minimaal tot 200% inzoomen." }));

  const text = clean($("body").text());
  const longParagraphs = $("p").filter((_, el) => clean($(el).text()).length > 800).length;
  if (longParagraphs) findings.push(makeFinding({ category: "ux", subcategory: "readability", title: "Zeer lange tekstblokken", description: "Lange ononderbroken alinea’s zijn moeilijk te scannen.", evidence: `${longParagraphs} alinea('s) bevatten meer dan 800 tekens.`, affectedUrl: url, severity: "low", confidence: "confirmed", source: "html", recommendation: "Splits lange tekst op met tussenkoppen, korte alinea’s en waar zinvol lijsten.", technicalImplementation: "Herschrijf inhoud in semantische secties en behoud één hoofdgedachte per alinea.", estimatedEffort: "klein", acceptanceCriterion: "Belangrijke inhoud is scanbaar met korte alinea’s en informatieve tussenkoppen." }));
  if (text.length < 100 && $("main").length) findings.push(makeFinding({ category: "ux", subcategory: "content", title: "Zeer weinig zichtbare hoofdinhoud", description: "De pagina bevat mogelijk te weinig context om het doel of aanbod te begrijpen.", evidence: `Ongeveer ${text.split(/\s+/).filter(Boolean).length} zichtbare woorden gedetecteerd.`, affectedUrl: url, severity: "medium", confidence: "likely", source: "heuristic", recommendation: "Controleer of de kernboodschap zonder JavaScript en direct bij laden beschikbaar is.", technicalImplementation: "Render essentiële titel, waardepropositie, uitleg en primaire actie server-side of in de initiële HTML.", estimatedEffort: "gemiddeld", acceptanceCriterion: "De primaire inhoud en conversiecontext zijn direct zichtbaar en begrijpelijk." }));

  const forms = $("form");
  forms.each((index, form) => {
    const fields = $(form).find("input:not([type='hidden']), select, textarea").length;
    if (fields > 12) findings.push(makeFinding({ category: "ux", subcategory: "forms", title: "Lang formulier", description: "Veel velden verhogen invulduur en uitval.", evidence: `Formulier ${index + 1} bevat ${fields} zichtbare velden.`, affectedUrl: url, affectedElement: `form:nth-of-type(${index + 1})`, severity: "medium", confidence: "confirmed", source: "html", recommendation: "Vraag alleen informatie die voor deze stap noodzakelijk is.", technicalImplementation: "Verwijder optionele velden, groepeer gerelateerde gegevens en gebruik meerstapsinvoer alleen wanneer dit de cognitieve belasting verlaagt.", estimatedEffort: "gemiddeld", acceptanceCriterion: "Elk veld heeft een aantoonbaar doel en het formulier kan zonder onnodige invoer worden voltooid." }));
    const insecureAction = $(form).attr("action");
    if (url.startsWith("https://") && insecureAction?.startsWith("http://")) findings.push(makeFinding({ category: "ux", subcategory: "forms", title: "Formulier verzendt naar onbeveiligde URL", description: "Bezoekers kunnen gegevens via een onversleutelde verbinding verzenden.", evidence: `Form action: ${insecureAction}`, affectedUrl: url, severity: "critical", confidence: "confirmed", source: "html", recommendation: "Verzend alle formulieren uitsluitend via HTTPS.", technicalImplementation: "Wijzig de action naar een HTTPS-endpoint en forceer server-side HTTPS.", estimatedEffort: "klein", acceptanceCriterion: "Alle formulieracties gebruiken HTTPS en de ontvangstendpoint valideert TLS." }));
  });

  const nav = $("nav, [role='navigation']");
  if (!nav.length && $("a[href]").length >= 8) findings.push(makeFinding({ category: "ux", subcategory: "navigation", title: "Navigatie mist een semantische landmark", description: "Een verzameling navigatielinks is niet als navigatie gemarkeerd.", evidence: "Minstens acht links gevonden, maar geen nav-element of navigation-role.", affectedUrl: url, severity: "low", confidence: "likely", source: "heuristic", recommendation: "Markeer primaire en secundaire navigatie semantisch.", technicalImplementation: "Gebruik <nav aria-label=\"Hoofdnavigatie\"> en afzonderlijke labels voor footer- of subnavigatie.", estimatedEffort: "klein", acceptanceCriterion: "Navigatiegebieden zijn herkenbaar als landmarks en hebben unieke labels waar meerdere voorkomen." }));

  return findings;
}
