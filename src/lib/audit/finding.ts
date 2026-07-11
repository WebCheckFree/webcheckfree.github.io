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

export function makeFinding(input: Omit<FindingInput, "id" | "references"> & { references?: string[] }): Finding {
  const fingerprint = [input.category, input.subcategory, input.affectedUrl, input.title, input.evidence].join("|");
  return findingSchema.parse({ id: stableHash(fingerprint), references: [], ...input });
}

export function deduplicateFindings(findings: Finding[]): Finding[] {
  const byKey = new Map<string, Finding>();
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, informational: 4 } as const;
  for (const finding of findings) {
    const key = `${finding.category}|${finding.subcategory}|${finding.affectedUrl}|${finding.title}|${finding.affectedElement ?? ""}`;
    const existing = byKey.get(key);
    if (!existing || severityOrder[finding.severity] < severityOrder[existing.severity]) byKey.set(key, finding);
  }
  return [...byKey.values()];
}
