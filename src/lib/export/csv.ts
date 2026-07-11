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

function cell(value: unknown): string {
  const text = primitive(value).replace(/\r?\n/g, " ");
  return `"${text.replace(/"/g, '""')}"`;
}

export function auditToCsv(audit: Audit): string {
  const headers = ["ID", "Categorie", "Subcategorie", "Ernst", "Betrouwbaarheid", "Titel", "URL", "Bewijs", "Aanbeveling", "Technische implementatie", "Inspanning", "Acceptatiecriterium", "Bron"];
  const rows = audit.findings.map((finding) => [finding.id, finding.category, finding.subcategory, finding.severity, finding.confidence, finding.title, finding.affectedUrl, finding.evidence, finding.recommendation, finding.technicalImplementation, finding.estimatedEffort, finding.acceptanceCriterion, finding.source]);
  return "\ufeff" + [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
}
