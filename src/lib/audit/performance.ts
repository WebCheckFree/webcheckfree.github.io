import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { CrawledPage, Finding } from "@/types/audit";
import { makeFinding } from "./finding";

export function analyzePerformance(page: CrawledPage, bytes?: number, document?: CheerioAPI): Finding[] {
  const $ = document ?? cheerio.load(page.html);
  const findings: Finding[] = [];
  const url = page.finalUrl;
  const contentEncoding = page.headers["content-encoding"];
  const cacheControl = page.headers["cache-control"];

  if (page.responseTimeMs > 1800) findings.push(makeFinding({
    category: "performance", subcategory: "server-response", title: "Zeer trage serverrespons", description: "De eerste HTML-respons duurde uitzonderlijk lang.", evidence: `Gemeten responstijd: ${page.responseTimeMs} ms.`, affectedUrl: url, severity: "high", confidence: "confirmed", source: "response-header", recommendation: "Verlaag server- en databasevertraging en gebruik caching op documentniveau.", technicalImplementation: "Profileer de serverroute, optimaliseer databasequeries, activeer full-page caching waar passend en plaats statische assets achter een CDN.", estimatedEffort: "groot", acceptanceCriterion: "De HTML-respons is bij herhaalde metingen lager dan 800 ms.", measuredValue: page.responseTimeMs, targetValue: 800,
  }));
  else if (page.responseTimeMs > 800) findings.push(makeFinding({
    category: "performance", subcategory: "server-response", title: "Serverrespons kan sneller", description: "Een trage documentrespons vertraagt alle volgende renderstappen.", evidence: `Gemeten responstijd: ${page.responseTimeMs} ms.`, affectedUrl: url, severity: "medium", confidence: "confirmed", source: "response-header", recommendation: "Optimaliseer serververwerking en caching.", technicalImplementation: "Controleer hostingresources, backend-profielen, cachingheaders en databasevertraging.", estimatedEffort: "gemiddeld", acceptanceCriterion: "De HTML-respons is lager dan 800 ms.", measuredValue: page.responseTimeMs, targetValue: 800,
  }));

  if (!contentEncoding && (bytes ?? page.html.length) > 20_000) findings.push(makeFinding({
    category: "performance", subcategory: "compression", title: "Geen HTTP-compressie waargenomen", description: "De HTML-respons lijkt zonder Brotli- of Gzip-compressie te worden geleverd.", evidence: "De responseheader Content-Encoding ontbreekt.", affectedUrl: url, severity: "medium", confidence: "confirmed", source: "response-header", recommendation: "Schakel Brotli of Gzip in voor tekstbestanden.", technicalImplementation: "Configureer de webserver of CDN om br, met gzip als fallback, toe te passen op HTML, CSS, JavaScript, SVG en JSON.", estimatedEffort: "klein", acceptanceCriterion: "Content-Encoding bevat br of gzip voor tekstresponsen.",
  }));
  if (!cacheControl) findings.push(makeFinding({
    category: "performance", subcategory: "caching", title: "Geen cachebeleid op HTML-respons", description: "Er is geen expliciete Cache-Control-header waargenomen.", evidence: "De responseheader Cache-Control ontbreekt.", affectedUrl: url, severity: "low", confidence: "confirmed", source: "response-header", recommendation: "Definieer een bewust cachebeleid.", technicalImplementation: "Gebruik voor dynamische HTML bijvoorbeeld private/no-cache met revalidatie en voor statische versies public, max-age en stale-while-revalidate.", estimatedEffort: "klein", acceptanceCriterion: "De respons bevat een passend en gedocumenteerd Cache-Control-beleid.",
  }));

  const blockingScripts = $("head script[src]").filter((_, el) => !$(el).attr("defer") && !$(el).attr("async") && $(el).attr("type") !== "module").length;
  if (blockingScripts > 0) findings.push(makeFinding({
    category: "performance", subcategory: "render-blocking", title: "Render-blokkerende scripts in de documentkop", description: "Scripts zonder defer, async of module kunnen de eerste render blokkeren.", evidence: `${blockingScripts} script(s) in <head> zonder niet-blokkerende laadstrategie.`, affectedUrl: url, affectedElement: "head script[src]", severity: blockingScripts >= 4 ? "high" : "medium", confidence: "confirmed", source: "html", recommendation: "Laad niet-kritieke scripts uitgesteld.", technicalImplementation: "Voeg defer toe aan afhankelijke scripts, async aan onafhankelijke scripts of gebruik ES-modules. Inline alleen strikt noodzakelijke kritieke code.", estimatedEffort: "gemiddeld", acceptanceCriterion: "Niet-kritieke scripts blokkeren de HTML-parser niet meer.", measuredValue: blockingScripts, targetValue: 0,
  }));

  const stylesheets = $("head link[rel='stylesheet']").length;
  if (stylesheets > 6) findings.push(makeFinding({
    category: "performance", subcategory: "render-blocking", title: "Veel stylesheetverzoeken vóór de eerste render", description: "Een groot aantal stylesheets kan de renderketen verlengen.", evidence: `${stylesheets} stylesheet-links in de documentkop.`, affectedUrl: url, affectedElement: "head link[rel='stylesheet']", severity: "medium", confidence: "confirmed", source: "html", recommendation: "Bundel en verklein kritieke CSS-afhankelijkheden.", technicalImplementation: "Verwijder ongebruikte CSS, consolideer kleine bestanden en laad niet-kritieke stylesheets na de eerste render.", estimatedEffort: "gemiddeld", acceptanceCriterion: "De initiële pagina heeft maximaal zes noodzakelijke stylesheetverzoeken of Lighthouse toont geen onnodig render-blokkerende CSS.",
  }));

  const elements = $("*").length;
  if (elements > 1500) findings.push(makeFinding({
    category: "performance", subcategory: "dom-size", title: "Zeer grote DOM-structuur", description: "Een grote DOM verhoogt style-, layout- en geheugenkosten.", evidence: `${elements} HTML-elementen aangetroffen.`, affectedUrl: url, severity: elements > 3000 ? "high" : "medium", confidence: "confirmed", source: "html", recommendation: "Verminder overbodige wrappers en render alleen zichtbare of noodzakelijke onderdelen.", technicalImplementation: "Vereenvoudig componentmark-up, virtualiseer lange lijsten en laad secundaire interfaceonderdelen op aanvraag.", estimatedEffort: "groot", acceptanceCriterion: "De DOM bevat bij de eerste render minder dan 1.500 elementen of een onderbouwde uitzondering.", measuredValue: elements, targetValue: 1500,
  }));

  const images = $("img");
  const legacy = images.filter((_, el) => /\.(?:jpe?g|png)(?:\?|$)/i.test($(el).attr("src") ?? "")).length;
  if (legacy > 0) findings.push(makeFinding({
    category: "performance", subcategory: "images", title: "Afbeeldingen gebruiken mogelijk geen modern formaat", description: "WebP en AVIF leveren vaak een kleiner bestand dan JPEG of PNG.", evidence: `${legacy} afbeelding(en) met een .jpg, .jpeg of .png bron-URL.`, affectedUrl: url, affectedElement: "img[src]", severity: legacy >= 6 ? "medium" : "low", confidence: "likely", source: "html", recommendation: "Lever waar geschikt AVIF of WebP met een goede fallback.", technicalImplementation: "Gebruik een beeldpipeline of <picture> met AVIF/WebP-bronnen en behoud PNG alleen voor inhoud die transparantie of lossless kwaliteit vereist.", estimatedEffort: "gemiddeld", acceptanceCriterion: "Rasterafbeeldingen worden in AVIF/WebP geleverd waar dit aantoonbaar kleiner is zonder zichtbaar kwaliteitsverlies.",
  }));
  const missingDimensions = images.filter((_, el) => !$(el).attr("width") || !$(el).attr("height")).length;
  if (missingDimensions > 0) findings.push(makeFinding({
    category: "performance", subcategory: "layout-stability", title: "Afbeeldingen zonder expliciete afmetingen", description: "Ontbrekende dimensies kunnen layoutverschuivingen veroorzaken.", evidence: `${missingDimensions} afbeelding(en) missen width of height.`, affectedUrl: url, affectedElement: "img", severity: missingDimensions >= 4 ? "medium" : "low", confidence: "confirmed", source: "html", recommendation: "Reserveer vooraf de juiste afbeeldingsruimte.", technicalImplementation: "Voeg intrinsieke width- en height-attributen toe en behoud de beeldverhouding met responsieve CSS.", estimatedEffort: "klein", acceptanceCriterion: "Alle inhoudelijke afbeeldingen hebben geldige width- en height-attributen of een equivalent aspect-ratio-reservering.",
  }));
  const noResponsive = images.filter((_, el) => !$(el).attr("srcset") && !$(el).parents("picture").length).length;
  if (images.length >= 3 && noResponsive > Math.ceil(images.length / 2)) findings.push(makeFinding({
    category: "performance", subcategory: "images", title: "Meeste afbeeldingen missen responsive sources", description: "Zonder srcset of picture kunnen mobiele bezoekers te grote bestanden ontvangen.", evidence: `${noResponsive} van ${images.length} afbeeldingen missen srcset en picture-bronnen.`, affectedUrl: url, affectedElement: "img", severity: "medium", confidence: "confirmed", source: "html", recommendation: "Bied meerdere afbeeldingsbreedtes aan.", technicalImplementation: "Genereer varianten en configureer srcset plus sizes op basis van de werkelijke lay-outbreedtes.", estimatedEffort: "gemiddeld", acceptanceCriterion: "Responsieve inhoudsafbeeldingen hebben passende srcset- en sizes-attributen.",
  }));
  const belowFoldWithoutLazy = images.slice(2).filter((_, el) => $(el).attr("loading") !== "lazy").length;
  if (belowFoldWithoutLazy > 3) findings.push(makeFinding({
    category: "performance", subcategory: "images", title: "Afbeeldingen buiten de eerste inhoud laden direct", description: "Niet-zichtbare afbeeldingen kunnen bandbreedte en netwerkprioriteit innemen.", evidence: `${belowFoldWithoutLazy} latere afbeelding(en) missen loading="lazy".`, affectedUrl: url, severity: "low", confidence: "likely", source: "heuristic", recommendation: "Gebruik native lazy loading buiten het zichtbare scherm.", technicalImplementation: "Voeg loading=\"lazy\" toe aan afbeeldingen die niet direct zichtbaar zijn; laat de hero/LCP-afbeelding eager laden.", estimatedEffort: "klein", acceptanceCriterion: "Afbeeldingen buiten het initiële scherm laden lazy, terwijl de LCP-afbeelding niet vertraagd wordt.",
  }));
  const firstImage = images.first();
  if (firstImage.length && firstImage.attr("loading") === "lazy") findings.push(makeFinding({
    category: "performance", subcategory: "lcp", title: "Mogelijke hero-afbeelding wordt lazy geladen", description: "De eerste grote afbeelding is vaak het LCP-element en moet vroeg starten.", evidence: `De eerste afbeelding in het document heeft loading="lazy".`, affectedUrl: url, affectedElement: "img:first", severity: "medium", confidence: "likely", source: "heuristic", recommendation: "Laat de waarschijnlijke hero-afbeelding direct laden.", technicalImplementation: `Verwijder loading="lazy" van de hero-afbeelding en overweeg fetchpriority="high" en preload wanneer meting dit ondersteunt.`, estimatedEffort: "klein", acceptanceCriterion: "De gemeten LCP-afbeelding start zonder lazy-loadvertraging en LCP is maximaal 2,5 seconden.",
  }));

  if ((bytes ?? page.html.length) > 1_000_000) findings.push(makeFinding({
    category: "performance", subcategory: "page-weight", title: "Zware HTML-respons", description: "Een uitzonderlijk groot HTML-document vertraagt parsing en overdracht.", evidence: `HTML-respons: ${bytes ?? page.html.length} bytes.`, affectedUrl: url, severity: "high", confidence: "confirmed", source: "html", recommendation: "Verklein de initiële documentomvang.", technicalImplementation: "Verwijder inline gegevens en ongebruikte mark-up, pagineer lange inhoud en laad zware JSON of componentdata op aanvraag.", estimatedEffort: "groot", acceptanceCriterion: "Het initiële HTML-document is kleiner dan 1 MB en bij voorkeur ruim onder 300 KB gecomprimeerd.",
  }));
  return findings;
}
