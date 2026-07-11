import { apiBaseUrl, deleteAudit, fetchAudit, requestAiSummary } from "./api.js";
import { badge, categoryLabels, confidenceLabels, esc, scoreCard, severityLabels, severityOrder } from "./templates.js";
import { exportCsv, exportHtml, exportJson } from "./exports.js";

function storedAudit(id) {
  try { return JSON.parse(sessionStorage.getItem(`webcheck:audit:${id}`) || "null"); } catch { return null; }
}
function saveAudit(audit) { try { sessionStorage.setItem(`webcheck:audit:${audit.id}`, JSON.stringify(audit)); } catch {} }
function metric(value, suffix = "") { return value === undefined || value === null ? "Niet gemeten" : `${Math.round(value * 100) / 100}${suffix}`; }
function sortedFindings(audit) { return [...audit.findings].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || a.title.localeCompare(b.title)); }

function findingCard(finding) {
  return `<details class="finding-card severity-${esc(finding.severity)}"><summary><div class="finding-summary"><div class="finding-badges">${badge(severityLabels[finding.severity], finding.severity)}${badge(categoryLabels[finding.category])}${badge(confidenceLabels[finding.confidence])}</div><h3>${esc(finding.title)}</h3><p>${esc(finding.description)}</p><code>${esc(finding.affectedUrl)}</code></div><span class="details-label">Details</span></summary><div class="finding-detail"><div class="info-block"><h4>Bewijs</h4><p>${esc(finding.evidence)}</p></div><div class="info-block"><h4>Aanbeveling</h4><p>${esc(finding.recommendation)}</p></div><div class="info-block"><h4>Technische implementatie</h4><p>${esc(finding.technicalImplementation)}</p></div><div class="info-block"><h4>Acceptatiecriterium</h4><p>${esc(finding.acceptanceCriterion)}</p></div><dl class="finding-meta"><div><dt>Bron</dt><dd>${esc(finding.source)}</dd></div><div><dt>Inspanning</dt><dd>${esc(finding.estimatedEffort)}</dd></div>${finding.measuredValue !== undefined ? `<div><dt>Gemeten</dt><dd>${esc(finding.measuredValue)}</dd></div>` : ""}${finding.targetValue !== undefined ? `<div><dt>Doel</dt><dd>${esc(finding.targetValue)}</dd></div>` : ""}</dl></div></details>`;
}

function managementSummary(audit) {
  const summary = audit.aiSummary;
  const isAi = audit.metadata?.summarySource === "workers-ai";
  const sourceLabel = isAi ? "Cloudflare Workers AI" : "Regelgebaseerd";
  const sourceKind = isAi ? "success" : "good";
  if (!summary) {
    const top = sortedFindings(audit).slice(0, 5);
    return `<section class="report-section"><div class="section-heading"><div><span class="eyebrow">Managementsamenvatting</span><h2>Belangrijkste conclusies</h2></div>${badge("Regelgebaseerd")}</div><p>WEBCHECK controleerde ${audit.pagesScanned} pagina('s) en ${audit.linksChecked} link(s). Er zijn ${audit.findings.length} aandachtspunten gevonden.</p>${top.length ? `<ol class="priority-list">${top.map((finding) => `<li><strong>${esc(finding.title)}</strong><span>${esc(finding.recommendation)}</span></li>`).join("")}</ol>` : `<div class="empty-state">Geen automatische aandachtspunten gevonden binnen de uitgevoerde scope.</div>`}</section>`;
  }

  return `<section class="report-section ai-section"><div class="section-heading"><div><span class="eyebrow">Managementsamenvatting</span><h2>${isAi ? "AI-verrijkt advies" : "Automatische conclusies en prioriteiten"}</h2></div>${badge(sourceLabel, sourceKind)}</div><div class="ai-lead"><p>${esc(summary.executiveSummary)}</p></div><div class="ai-columns"><div><h3>Topprioriteiten</h3>${summary.topPriorities.length ? `<ol>${summary.topPriorities.map((priority) => `<li><strong>${esc(priority.title)}</strong><span>${esc(priority.rationale)}</span><small>${esc(priority.acceptanceCriterion)}</small></li>`).join("")}</ol>` : `<p>Geen prioriteiten binnen de automatisch controleerbare scope.</p>`}</div><div><h3>Quick wins</h3>${summary.quickWins.length ? `<ul>${summary.quickWins.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>` : `<p>Geen afzonderlijke quick wins vastgesteld.</p>`}<h3>Middellange termijn</h3>${summary.mediumTermImprovements.length ? `<ul>${summary.mediumTermImprovements.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>` : `<p>Geen structurele verbeteringen vastgesteld.</p>`}</div></div>${summary.implementationPlan.length ? `<div class="roadmap-card"><h3>Implementatievolgorde</h3><ol>${summary.implementationPlan.map((item) => `<li><strong>Stap ${item.step}: ${esc(item.action)}</strong><span>${esc(item.why)}</span><small>${esc(item.verification)}</small></li>`).join("")}</ol></div>` : ""}<p><small>${esc(summary.disclaimer)}</small></p>${!isAi && audit.metadata?.aiAvailable && apiBaseUrl ? `<button id="generate-ai" class="button button-secondary" type="button">Verrijk met Cloudflare Workers AI</button><div id="ai-error"></div>` : ""}</section>`;
}

function criticalSection(audit) {
  const items = sortedFindings(audit).filter((finding) => ["critical", "high"].includes(finding.severity));
  return `<section class="report-section"><div class="section-heading"><div><span class="eyebrow">Kritieke bevindingen</span><h2>Directe risico’s en blokkades</h2></div>${badge(String(items.length), items.length ? "high" : "success")}</div><div class="finding-list">${items.length ? items.map(findingCard).join("") : `<div class="empty-state">Geen kritieke of hoge bevindingen in de uitgevoerde controles.</div>`}</div></section>`;
}

function roadmapSection(audit) {
  const groups = [
    ["Direct oplossen", ["critical", "high"]],
    ["Binnen 30 dagen", ["medium"]],
    ["Binnen 90 dagen", ["low"]],
    ["Doorlopend controleren", ["informational"]],
  ];
  return `<section class="report-section"><div class="section-heading"><div><span class="eyebrow">Implementatieroadmap</span><h2>Verbeteringen in aanbevolen volgorde</h2></div></div><div class="roadmap-grid">${groups.map(([label, severities]) => {
    const items = sortedFindings(audit).filter((finding) => severities.includes(finding.severity)).slice(0, 8);
    return `<article class="roadmap-card"><h3>${esc(label)}</h3>${items.length ? `<ol>${items.map((finding) => `<li><strong>${esc(finding.title)}</strong><small>${esc(finding.acceptanceCriterion)}</small></li>`).join("")}</ol>` : `<p>Geen bevindingen in deze prioriteitsgroep.</p>`}</article>`;
  }).join("")}</div></section>`;
}

function renderReport(audit) {
  const metrics = Object.entries(audit.metrics || {}).map(([device, values]) => `<article class="metric-card"><h3>${esc(device)}</h3><div class="metric-row"><span>LCP</span><strong>${metric(values.lcpMs, " ms")}</strong></div><div class="metric-row"><span>CLS</span><strong>${metric(values.cls)}</strong></div><div class="metric-row"><span>INP</span><strong>${metric(values.inpMs, " ms")}</strong></div><div class="metric-row"><span>TTFB</span><strong>${metric(values.ttfbMs, " ms")}</strong></div><small>Bron: ${esc(values.source)}</small></article>`).join("");
  return `<div class="container report-page"><a class="back-link" href="#/">← Nieuwe controle</a><header class="report-header"><div><span class="eyebrow">Auditrapport</span><h1>${esc(audit.domain)}</h1><div class="report-meta-line"><span>${esc(new Date(audit.completedAt || audit.startedAt).toLocaleString("nl-BE"))}</span><span>${esc(audit.scanMode)}</span><span>${esc(audit.devices.join(", "))}</span><span>${audit.pagesScanned} pagina’s</span><span>${audit.linksChecked} links</span><span>${audit.status === "partial" ? "Gedeeltelijk" : "Voltooid"}</span></div></div><div class="report-toolbar"><button id="export-json" class="button button-secondary">JSON</button><button id="export-csv" class="button button-secondary">CSV</button><button id="export-html" class="button button-secondary">HTML</button><button id="print-report" class="button button-primary">Afdrukken / PDF</button><button id="delete-report" class="button button-secondary">Rapport verwijderen</button></div></header><section class="overall-card"><div><span class="eyebrow">Totaalscore</span><strong>${audit.scores.overall}</strong><span>/100</span></div><dl>${["performance", "ux", "seo", "security"].map((category) => `<div><dt>${categoryLabels[category]}</dt><dd>${audit.scores[category].score}/100</dd></div>`).join("")}</dl></section><section class="score-grid">${scoreCard("Performance", audit.scores.performance)}${scoreCard("Gebruikservaring", audit.scores.ux)}${scoreCard("SEO", audit.scores.seo)}${scoreCard("Beveiliging", audit.scores.security)}</section>${managementSummary(audit)}<section class="report-section"><div class="section-heading"><div><span class="eyebrow">Core Web Vitals</span><h2>Gemeten prestaties</h2></div></div><div class="metrics-grid">${metrics || `<div class="empty-state">Geen PageSpeed-meetgegevens beschikbaar. De deterministische controles zijn wel uitgevoerd.</div>`}</div></section>${criticalSection(audit)}<section class="report-section"><div class="section-heading"><div><span class="eyebrow">Alle kerngebieden</span><h2><span id="finding-count">${audit.findings.length}</span> aandachtspunten</h2></div></div><div class="filter-bar"><label class="search-field"><span>⌕</span><input id="finding-search" type="search" placeholder="Zoek in bevindingen"></label><select id="filter-category"><option value="all">Alle categorieën</option>${Object.entries(categoryLabels).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select><select id="filter-severity"><option value="all">Alle ernstniveaus</option>${Object.entries(severityLabels).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select><select id="filter-confidence"><option value="all">Alle statussen</option>${Object.entries(confidenceLabels).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select><select id="sort-findings"><option value="severity">Sorteer op ernst</option><option value="category">Sorteer op categorie</option><option value="url">Sorteer op URL</option></select></div><div id="finding-list" class="finding-list"></div></section>${roadmapSection(audit)}<section class="report-section"><div class="section-heading"><div><span class="eyebrow">Paginaoverzicht</span><h2>Gecrawlde pagina’s</h2></div></div><div class="table-wrap"><table><thead><tr><th>URL</th><th>Status</th><th>Indexeerbaar</th><th>Titel</th><th>H1</th><th>Woorden</th></tr></thead><tbody>${audit.pages.map((page) => `<tr><td data-label="URL">${esc(page.finalUrl)}</td><td data-label="Status">${page.statusCode}</td><td data-label="Indexeerbaar">${page.indexable ? "Ja" : "Nee"}</td><td data-label="Titel">${esc(page.title || "—")}</td><td data-label="H1">${esc((page.h1 || []).join(" | ") || "—")}</td><td data-label="Woorden">${page.wordCount}</td></tr>`).join("")}</tbody></table></div></section><section class="report-section"><div class="section-heading"><div><span class="eyebrow">Handmatige controles</span><h2>Niet volledig automatiseerbaar</h2></div></div><div class="manual-grid">${["Toetsenbordnavigatie en focusvolgorde", "Schermlezerervaring", "Visueel kleurcontrast en zoom", "Formulierontvangst en foutafhandeling", "Google Search Console en indexering", "CMS-, plug-in- en serverupdates"].map((item) => `<article class="manual-card"><h3>${esc(item)}</h3><p>Handmatige of geautoriseerde aanvullende controle vereist.</p></article>`).join("")}</div></section><section class="report-section"><div class="section-heading"><div><span class="eyebrow">Beperkingen</span><h2>Wat niet kon worden vastgesteld</h2></div></div><ul class="checklist">${audit.limitations.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></section></div>`;
}

function bindFilters(audit) {
  const list = document.querySelector("#finding-list");
  const count = document.querySelector("#finding-count");
  const search = document.querySelector("#finding-search");
  const category = document.querySelector("#filter-category");
  const severity = document.querySelector("#filter-severity");
  const confidence = document.querySelector("#filter-confidence");
  const sort = document.querySelector("#sort-findings");
  function update() {
    const query = search.value.trim().toLowerCase();
    const items = audit.findings.filter((finding) =>
      (category.value === "all" || finding.category === category.value)
      && (severity.value === "all" || finding.severity === severity.value)
      && (confidence.value === "all" || finding.confidence === confidence.value)
      && (!query || [finding.title, finding.description, finding.evidence, finding.affectedUrl, finding.recommendation].some((value) => String(value).toLowerCase().includes(query)))
    ).sort((a, b) => sort.value === "severity"
      ? severityOrder[a.severity] - severityOrder[b.severity] || a.title.localeCompare(b.title)
      : sort.value === "category"
        ? a.category.localeCompare(b.category) || severityOrder[a.severity] - severityOrder[b.severity]
        : a.affectedUrl.localeCompare(b.affectedUrl));
    list.innerHTML = items.length ? items.map(findingCard).join("") : `<div class="empty-state">Geen bevindingen voldoen aan deze filters.</div>`;
    count.textContent = String(items.length);
  }
  [search, category, severity, confidence, sort].forEach((element) => element.addEventListener(element === search ? "input" : "change", update));
  update();
}

function bindReportActions(root, audit) {
  document.querySelector("#export-json").onclick = () => exportJson(audit);
  document.querySelector("#export-csv").onclick = () => exportCsv(audit);
  document.querySelector("#export-html").onclick = () => exportHtml(audit);
  document.querySelector("#print-report").onclick = () => window.print();
  document.querySelector("#delete-report").onclick = async () => {
    sessionStorage.removeItem(`webcheck:audit:${audit.id}`);
    if (apiBaseUrl) await deleteAudit(audit.id).catch(() => undefined);
    location.hash = "#/";
  };
  const aiButton = document.querySelector("#generate-ai");
  if (aiButton) aiButton.onclick = async () => {
    aiButton.disabled = true;
    aiButton.textContent = "Cloudflare Workers AI uitvoeren…";
    try {
      const updated = await requestAiSummary(audit.id, audit);
      saveAudit(updated);
      root.innerHTML = renderReport(updated);
      bindFilters(updated);
      bindReportActions(root, updated);
    } catch (error) {
      document.querySelector("#ai-error").innerHTML = `<div class="inline-error">${esc(error.message)}</div>`;
      aiButton.disabled = false;
      aiButton.textContent = "Opnieuw proberen";
    }
  };
}

export async function showReport(root, id) {
  root.innerHTML = `<div class="container report-loading"><div class="loading-orb"></div><h1>Rapport laden</h1><p>De auditgegevens worden opgehaald.</p></div>`;
  let audit = storedAudit(id);
  if (!audit) {
    try {
      audit = await fetchAudit(id);
      saveAudit(audit);
    } catch (error) {
      root.innerHTML = `<div class="container report-loading"><h1>Rapport niet beschikbaar</h1><p>${esc(error.message)}</p><a class="button button-primary" href="#/">Start een nieuwe controle</a></div>`;
      return;
    }
  }
  root.innerHTML = renderReport(audit);
  bindFilters(audit);
  bindReportActions(root, audit);
}
