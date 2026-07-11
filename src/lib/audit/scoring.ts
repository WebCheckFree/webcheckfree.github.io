import { SCORE_DEDUCTIONS } from "@/config/audit";
import type { Audit, Category, Finding, Severity } from "@/types/audit";

type ScoreDetails = Audit["scores"][Category];
const categories: Category[] = ["performance", "ux", "seo", "security"];

export function scoreLabel(score: number): string {
  if (score >= 90) return "Uitstekend";
  if (score >= 75) return "Goed";
  if (score >= 60) return "Redelijk";
  if (score >= 40) return "Onvoldoende";
  return "Kritiek";
}

export function calculateCategoryScore(findings: Finding[], category: Category): ScoreDetails {
  const relevant = findings.filter((finding) => finding.category === category && finding.severity !== "informational");
  const rootCauses = new Map<string, { severity: Severity; finding: Finding }>();
  for (const finding of relevant) {
    const key = `${finding.subcategory}|${finding.title}`;
    const existing = rootCauses.get(key);
    if (!existing || SCORE_DEDUCTIONS[finding.severity] > SCORE_DEDUCTIONS[existing.severity]) rootCauses.set(key, { severity: finding.severity, finding });
  }
  const subcategoryTotals = new Map<string, number>();
  const deductions: ScoreDetails["deductions"] = [];
  for (const { severity, finding } of rootCauses.values()) {
    const points = SCORE_DEDUCTIONS[severity];
    const used = subcategoryTotals.get(finding.subcategory) ?? 0;
    const allowed = Math.max(0, Math.min(points, 20 - used));
    if (!allowed) continue;
    subcategoryTotals.set(finding.subcategory, used + allowed);
    deductions.push({ findingId: finding.id, points: allowed, reason: `${finding.title} (${severity})` });
  }
  const score = Math.max(0, Math.round(100 - deductions.reduce((sum, item) => sum + item.points, 0)));
  return { score, label: scoreLabel(score), deductions };
}

export function calculateScores(findings: Finding[]): Audit["scores"] {
  const details = Object.fromEntries(categories.map((category) => [category, calculateCategoryScore(findings, category)])) as Record<Category, ScoreDetails>;
  const overall = Math.round(categories.reduce((sum, category) => sum + details[category].score, 0) / categories.length);
  return { ...details, overall, overallLabel: scoreLabel(overall) };
}
