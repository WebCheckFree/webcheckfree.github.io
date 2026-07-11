import type { AISummary, Audit, Finding } from "@/types/audit";
import { SEVERITY_ORDER } from "@/config/audit";
import { groupFindingsByRootCause } from "@/lib/audit/finding";

function sorted(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const severity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (severity !== 0) return severity;
    return a.title.localeCompare(b.title, "nl");
  });
}

function uniqueStrings(values: string[], max: number): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, max);
}

function affectedScope(finding: Finding): string {
  const urls = finding.affectedUrls ?? [finding.affectedUrl];
  if (urls.length === 1) return "Getroffen pagina: 1.";
  return `Getroffen pagina's: ${urls.length}.`;
}

export function buildRuleBasedSummary(audit: Pick<Audit, "domain" | "scores" | "findings" | "limitations" | "pagesScanned" | "linksChecked">): AISummary {
  const grouped = groupFindingsByRootCause(audit.findings);
  const ordered = sorted(grouped);
  const urgent = ordered.filter((finding) => finding.severity === "critical" || finding.severity === "high");
  const top = (urgent.length ? urgent : ordered).slice(0, 5);
  const quick = ordered.filter((finding) => finding.estimatedEffort === "klein").slice(0, 6);
  const structural = ordered.filter((finding) => finding.estimatedEffort !== "klein").slice(0, 6);
  const urgentCount = urgent.length;

  const executiveSummary = grouped.length === 0
    ? `WEBCHECK controleerde ${audit.pagesScanned} pagina('s) en ${audit.linksChecked} interne link(s) op ${audit.domain}. Binnen de automatisch controleerbare scope zijn geen concrete problemen gevonden. Handmatige toegankelijkheids-, CMS- en servercontroles blijven noodzakelijk.`
    : `WEBCHECK controleerde ${audit.pagesScanned} pagina('s) en ${audit.linksChecked} interne link(s) op ${audit.domain}. De totaalscore is ${audit.scores.overall}/100 (${audit.scores.overallLabel}). Er zijn ${grouped.length} unieke aandachtspunten vastgesteld, waarvan ${urgentCount} met hoge of kritieke prioriteit. Herhaalde templateproblemen zijn over de getroffen pagina's samengevoegd. Los eerst de bevestigde beveiligings-, bereikbaarheids- en indexeringsproblemen op en voer daarna de structurele optimalisaties uit.`;

  const topPriorities = top.map((finding) => ({
    title: finding.title,
    rationale: `${affectedScope(finding)} ${finding.evidence} Impact: ${finding.description}`,
    acceptanceCriterion: finding.acceptanceCriterion,
  }));

  const quickWins = uniqueStrings(
    quick.map((finding) => `${finding.title}: ${finding.recommendation}`),
    6,
  );

  const mediumTermImprovements = uniqueStrings(
    structural.map((finding) => `${finding.title}: ${finding.technicalImplementation}`),
    6,
  );

  const planSource = top.length ? top : ordered.slice(0, 5);
  const implementationPlan = planSource.map((finding, index) => ({
    step: index + 1,
    action: finding.recommendation,
    why: `${finding.title} heeft prioriteit ${finding.severity}, treft ${(finding.affectedUrls ?? [finding.affectedUrl]).length} pagina('s) en is ${finding.confidence === "confirmed" ? "automatisch bevestigd" : "aangemerkt voor aanvullende controle"}.`,
    verification: finding.acceptanceCriterion,
  }));

  return {
    executiveSummary,
    topPriorities,
    quickWins,
    mediumTermImprovements,
    implementationPlan,
    limitations: uniqueStrings(audit.limitations, 12),
    disclaimer: "Deze managementsamenvatting is regelgebaseerd samengesteld uit de gemeten en geobserveerde auditresultaten. Automatische controles vervangen geen volledige WCAG-audit, penetratietest, CMS-inspectie of Google Search Console-controle.",
  };
}
