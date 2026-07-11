export const phases = [
  "URL valideren",
  "Website bereiken",
  "Pagina’s verzamelen",
  "Performance controleren",
  "Gebruikservaring controleren",
  "SEO controleren",
  "Beveiliging controleren",
  "Scores berekenen",
  "AI-samenvatting genereren",
  "Rapport voorbereiden",
];

export const categoryLabels = { performance: "Performance", ux: "Gebruikservaring", seo: "SEO", security: "Beveiliging" };
export const severityLabels = { critical: "Kritiek", high: "Hoog", medium: "Gemiddeld", low: "Laag", informational: "Informatief" };
export const confidenceLabels = { confirmed: "Bevestigd", likely: "Waarschijnlijk", "manual-review-required": "Handmatige controle" };
export const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, informational: 4 };

export function esc(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[character]);
}

export function badge(text, kind = "good") {
  return `<span class="badge badge-${esc(kind)}">${esc(text)}</span>`;
}

export function scoreCard(label, detail) {
  return `<article class="score-card"><div class="score-card-top"><span class="score-icon">◫</span><strong class="score-number">${detail.score}</strong></div><h3>${esc(label)}</h3><p>${esc(detail.label)}</p><div class="score-bar"><span style="width:${detail.score}%"></span></div></article>`;
}

export function homeTemplate(apiConfigured) {
  return `<section class="hero"><div class="container hero-inner"><div class="hero-copy"><span class="eyebrow">Open-source website-audit</span><h1>Controleer de kwaliteit van je website</h1><p>Een feitelijke websitecheck voor performance, gebruikservaring, SEO en beveiliging. Geen account, geen verplichte AI en geen destructieve tests.</p><div class="hero-trust"><span>✓ Gratis basisaudit</span><span>✓ Alleen publieke gegevens</span><span>✓ Open broncode</span></div></div><div class="audit-shell"><form id="audit-form" class="audit-form" novalidate><label class="field field-url"><span>Website URL</span><div class="url-row"><input id="audit-url" type="text" inputmode="url" autocomplete="url" placeholder="https://voorbeeld.be" aria-describedby="url-help"><button class="button button-primary" type="submit">Start gratis websitecheck →</button></div><small id="url-help">Alleen publiek bereikbare HTTP(S)-websites. Geen account nodig.</small></label><div class="form-grid"><fieldset><legend>Auditdiepte</legend><div class="segmented">${[
    ["quick", "Quick"], ["standard", "Standaard"], ["extended", "Uitgebreid"],
  ].map(([value, label], index) => `<label><input type="radio" name="mode" value="${value}" ${index === 0 ? "checked" : ""}><span>${label}</span></label>`).join("")}</div></fieldset><fieldset><legend>Apparaat</legend><div class="segmented">${[
    ["mobile", "Mobiel"], ["desktop", "Desktop"], ["both", "Beide"],
  ].map(([value, label], index) => `<label><input type="radio" name="device" value="${value}" ${index === 0 ? "checked" : ""}><span>${label}</span></label>`).join("")}</div></fieldset></div><label class="check-row"><input id="audit-ai" type="checkbox" disabled><span><strong>Verrijk met Cloudflare Workers AI wanneer beschikbaar</strong><small id="audit-ai-help">AI is standaard uitgeschakeld. De regelgebaseerde managementsamenvatting wordt altijd gegenereerd.</small></span></label></form><div id="progress-slot"></div><div id="error-slot"></div><div id="api-status" class="api-status ${apiConfigured ? "" : "error"}"><span class="status-dot"></span>${apiConfigured ? "Cloudflare Worker-configuratie gevonden; verbinding wordt gecontroleerd." : "Worker-API nog niet geconfigureerd. De statische website is online, maar audits starten pas na de Cloudflare-koppeling."}</div></div></div></section><div class="container"><section class="category-grid"><article class="category-card"><div class="category-icon">⚡</div><h3>Performance</h3><p>Core Web Vitals, laadtijd, afbeeldingen, caching en zware resources.</p></article><article class="category-card"><div class="category-icon">◎</div><h3>Gebruikservaring</h3><p>Mobiele bruikbaarheid, formulieren, semantiek en automatische toegankelijkheidschecks.</p></article><article class="category-card"><div class="category-icon">⌕</div><h3>SEO</h3><p>Metadata, headings, canonicals, robots.txt, sitemap, links en indexeerbaarheidssignalen.</p></article><article class="category-card"><div class="category-icon">✓</div><h3>Beveiliging</h3><p>HTTPS, securityheaders, cookies, mixed content en zichtbare vertrouwenssignalen.</p></article></section><section class="split-section"><article><span class="eyebrow">Wat WEBCHECK doet</span><h2>Concreet bewijs, geen algemene checklist</h2><ul class="feature-list"><li>Controleert HTML, headers, redirects, sitemap, robots.txt en links.</li><li>Meet Core Web Vitals via PageSpeed wanneer data beschikbaar is.</li><li>Geeft bewijs, impact, oplossing en acceptatiecriterium.</li><li>Exporteert JSON, CSV en printvriendelijke HTML.</li></ul></article><article><span class="eyebrow">Bewuste beperkingen</span><h2>Veilig en privacygericht</h2><p>WEBCHECK verstuurt geen formulieren, maakt geen accounts aan en probeert geen beveiliging te omzeilen. Volledige WCAG-conformiteit, CMS-updates, Search Console-data en serverbeveiliging vereisen aanvullende toegang.</p><a class="text-link" href="#/methodology">Bekijk de volledige methodologie →</a></article></section><section class="open-source-cta"><div><span class="eyebrow">Gratis Cloudflare-architectuur</span><h2>GitHub Pages, Workers en D1</h2><p>De auditkern draait op Cloudflare Workers Free, rapporten worden tijdelijk in D1 opgeslagen en de managementsamenvatting werkt standaard zonder AI. Cloudflare Workers AI kan optioneel worden geactiveerd.</p></div><a class="button button-primary" href="https://github.com/WebCheckFree/webcheckfree.github.io" target="_blank" rel="noreferrer">Bekijk op GitHub</a></section></div>`;
}

export function methodologyTemplate() {
  return `<article class="container prose-page"><span class="eyebrow">Open methodologie</span><h1>Hoe WEBCHECK websites beoordeelt</h1><p>WEBCHECK combineert gecontroleerde crawling, HTML- en headeranalyse, linkcontrole en optionele PageSpeed-data. Iedere audit wordt opgesplitst in korte Cloudflare Worker-stappen en tussentijds in D1 bewaard.</p><h2>Scans binnen het gratis Worker-profiel</h2><ul><li><strong>Quick:</strong> 1 pagina en maximaal 10 geselecteerde interne links.</li><li><strong>Standaard:</strong> maximaal 3 pagina’s en 18 links.</li><li><strong>Uitgebreid:</strong> maximaal 5 pagina’s en 25 links.</li></ul><h2>Scores</h2><p>Iedere categorie start op 100. Kritieke bevindingen trekken 20 punten af, hoge 10, gemiddelde 5 en lage 2. Dubbele hoofdoorzaken worden samengevoegd en ontbrekende metingen kosten geen punten.</p><h2>Samenvatting</h2><p>Iedere audit krijgt een transparante regelgebaseerde managementsamenvatting. Wanneer Cloudflare Workers AI expliciet is ingeschakeld en door de gebruiker wordt gekozen, kan die samenvatting worden verrijkt. AI wijzigt geen meetwaarden of feitelijke bevindingen.</p><h2>Beperkingen</h2><p>Automatische toegankelijkheidscontroles bewijzen geen volledige WCAG-conformiteit. Werkelijke Google-indexering, CMS-updates, serverconfiguratie en penetratests vereisen aanvullende toegang en gespecialiseerde controle.</p><h2>Veiligheid</h2><p>De backend blokkeert private en interne adressen, controleert DNS en iedere redirect, begrenst responsgrootte en time-outs en verzendt geen formulieren.</p></article>`;
}

export function privacyTemplate() {
  return `<article class="container prose-page"><span class="eyebrow">Privacy</span><h1>Minimale gegevensverwerking</h1><p>WEBCHECK vereist geen account. De tool verwerkt uitsluitend de ingevoerde URL, technisch noodzakelijke requestmetadata en publiek bereikbare website-inhoud die nodig is voor de audit.</p><h2>Tijdelijke rapporten in Cloudflare D1</h2><p>Rapporten worden standaard maximaal 60 minuten in Cloudflare D1 bewaard en daarna automatisch verwijderd. De browser bewaart het actieve rapport tijdelijk in sessionStorage. Ruwe HTML wordt na analyse niet in het rapport opgeslagen.</p><h2>Cloudflare Workers AI</h2><p>AI is standaard uitgeschakeld. Bij expliciete activering worden alleen genormaliseerde bevindingen, scores, metrics en beperkingen naar de Workers AI-binding gestuurd; geen volledige ruwe HTML. De regelgebaseerde samenvatting blijft altijd beschikbaar.</p><h2>Doelsites</h2><p>WEBCHECK verstuurt geen formulieren, maakt geen accounts aan en voert geen betalingen, uploads of actieve beveiligingstests uit.</p></article>`;
}
