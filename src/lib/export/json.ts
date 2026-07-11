import type { Audit } from "@/types/audit";
import { groupFindingsByRootCause } from "@/lib/audit/finding";

export function auditToJson(audit: Audit): string {
  return JSON.stringify({
    ...audit,
    findings: groupFindingsByRootCause(audit.findings),
  }, null, 2);
}
