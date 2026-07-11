import type { Audit } from "@/types/audit";
export function auditToJson(audit: Audit): string { return JSON.stringify(audit, null, 2); }
