import { findingSchema, type FindingInput } from "@/schemas/finding";
import type { Finding } from "@/types/audit";

/** Fast deterministic non-cryptographic ID. No Node.js runtime dependency. */
function stableHash(value: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= code + index;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0).toString(16).padStart(8, "0")}`;
}

const severityRank: Record<Finding["severity"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  informational: 4,
};

const confidenceRank: Record<Finding["confidence"], number> = {
  confirmed: 0,
  likely: 1,
  "manual-review-required": 2,
};

const effortRank: Record<Finding["estimatedEffort"], number> = {
  klein: 0,
  gemiddeld: 1,
  groot: 2,
};

function rootCauseKey(finding: Finding): string {
  return [
    finding.category,
    finding.subcategory,
    finding.title,
    finding.recommendation,
    finding.acceptanceCriterion,
  ].join("|");
}

export function makeFinding(input: Omit<FindingInput, "id" | "references"> & { references?: string[] }): Finding {
  const fingerprint = [input.category, input.subcategory, input.affectedUrl, input.title, input.evidence].join("|");
  return findingSchema.parse({ id: stableHash(fingerprint), references: [], ...input });
}

export function deduplicateFindings(findings: Finding[]): Finding[] {
  const byKey = new Map<string, Finding>();
  for (const finding of findings) {
    const key = `${finding.category}|${finding.subcategory}|${finding.affectedUrl}|${finding.title}|${finding.affectedElement ?? ""}`;
    const existing = byKey.get(key);
    if (!existing || severityRank[finding.severity] < severityRank[existing.severity]) byKey.set(key, finding);
  }
  return [...byKey.values()];
}

/**
 * Combines the same underlying issue across pages while preserving every
 * affected URL. Scores and management summaries then operate on root causes
 * instead of counting the same template problem once per crawled page.
 */
export function groupFindingsByRootCause(findings: Finding[]): Finding[] {
  const groups = new Map<string, Finding[]>();
  for (const finding of findings) {
    const key = rootCauseKey(finding);
    const group = groups.get(key) ?? [];
    group.push(finding);
    groups.set(key, group);
  }

  return [...groups.entries()].map(([key, group]) => {
    const representative = [...group].sort((a, b) =>
      severityRank[a.severity] - severityRank[b.severity]
      || confidenceRank[a.confidence] - confidenceRank[b.confidence]
      || a.affectedUrl.localeCompare(b.affectedUrl),
    )[0];
    if (!representative) throw new Error("Finding group cannot be empty");

    const affectedUrls = [...new Set(group.flatMap((finding) => finding.affectedUrls ?? [finding.affectedUrl]))].sort();
    const references = [...new Set(group.flatMap((finding) => finding.references))];
    const severity = [...group].sort((a, b) => severityRank[a.severity] - severityRank[b.severity])[0]?.severity ?? representative.severity;
    const confidence = [...group].sort((a, b) => confidenceRank[a.confidence] - confidenceRank[b.confidence])[0]?.confidence ?? representative.confidence;
    const estimatedEffort = [...group].sort((a, b) => effortRank[b.estimatedEffort] - effortRank[a.estimatedEffort])[0]?.estimatedEffort ?? representative.estimatedEffort;

    return findingSchema.parse({
      ...representative,
      id: stableHash(key),
      affectedUrl: affectedUrls[0] ?? representative.affectedUrl,
      affectedUrls,
      occurrenceCount: group.reduce((total, finding) => total + (finding.occurrenceCount ?? 1), 0),
      severity,
      confidence,
      estimatedEffort,
      references,
    });
  });
}
