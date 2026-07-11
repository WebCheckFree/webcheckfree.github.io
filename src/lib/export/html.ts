import type { Audit } from "@/types/audit";

function primitive(value: unknown): string {
  if (value === null || value === undefined) return "";
  switch (typeof value) {
    case "string": return value;
    case "number":
    case "boolean":
    case "bigint": return `${value}`;
    default: return JSON.stringify(value);
  }
}

function esc(value: unknown): string {
  return primitive(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]!);
}

export function auditToHtml(audit: Audit): string {
  const rows = audit.findings.map((finding) => `<tr><td>${esc(finding.severity)}</td><td>${esc(finding.category)}</td><td>${esc(finding.title)}</td><td>${esc(finding.affectedUrl)}</td><td>${esc(finding.evidence)}</td><td>${esc(finding.recommendation)}</td><td>${esc(finding.acceptanceCriterion)}</td></tr>`).join("");
  const score = (key: "performance" | "ux" | "seo" | "security") => audit.scores[key].score;
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>WEBCHECK — ${esc(audit.domain)}</title><style>@page{size:A4;margin:16mm}body{font:11pt/1.5 Arial,sans-serif;color:#111}h1,h2{page-break-after:avoid}table{width:100%;border-collapse:collapse;font-size:8.5pt}th,td{border:1px solid #bbb;padding:5px;vertical-align:top}thead{display:table-header-group}.scores{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.score{border:1px solid #aaa;padding:10px}tr{page-break-inside:avoid}</style></head><body><h1>Website-audit: ${esc(audit.domain)}</h1><p>Datum: ${esc(audit.completedAt ?? audit.startedAt)} · Modus: ${esc(audit.scanMode)} · Pagina’s: ${audit.pagesScanned}</p><div class="scores"><div class="score"><b>Totaal</b><br>${audit.scores.overall}</div><div class="score"><b>Performance</b><br>${score("performance")}</div><div class="score"><b>UX</b><br>${score("ux")}</div><div class="score"><b>SEO</b><br>${score("seo")}</div><div class="score"><b>Security</b><br>${score("security")}</div></div>${audit.aiSummary ? `<h2>Managementsamenvatting</h2><p>${esc(audit.aiSummary.executiveSummary)}</p>` : ""}<h2>Bevindingen</h2><table><thead><tr><th>Ernst</th><th>Categorie</th><th>Probleem</th><th>URL</th><th>Bewijs</th><th>Aanbeveling</th><th>Acceptatie</th></tr></thead><tbody>${rows}</tbody></table><h2>Beperkingen</h2><ul>${audit.limitations.map((value) => `<li>${esc(value)}</li>`).join("")}</ul></body></html>`;
}
