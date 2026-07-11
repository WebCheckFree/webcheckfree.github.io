import { z } from "zod";
import { deviceSchema, scanModeSchema, auditSchema } from "./audit";

export const auditRequestSchema = z.object({
  url: z.string().trim().min(1, "Voer een website-URL in.").max(2048),
  scanMode: scanModeSchema.default("quick"),
  devices: z.array(deviceSchema).min(1).max(2).default(["mobile"]),
  generateAiSummary: z.boolean().default(false),
});

export const aiSummaryRequestSchema = z.object({
  auditId: z.string().uuid(),
  audit: auditSchema.optional(),
});
