import { aiSummarySchema } from "@/schemas/audit";
import type { AISummary, Audit } from "@/types/audit";
import { runtimeConfig } from "../config";
import { AppError } from "../errors";
import type { Env } from "../types";

const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    executiveSummary: { type: "string" },
    topPriorities: {
      type: "array",
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          rationale: { type: "string" },
          acceptanceCriterion: { type: "string" },
        },
        required: ["title", "rationale", "acceptanceCriterion"],
      },
    },
    quickWins: { type: "array", maxItems: 10, items: { type: "string" } },
    mediumTermImprovements: { type: "array", maxItems: 10, items: { type: "string" } },
    implementationPlan: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          step: { type: "integer", minimum: 1 },
          action: { type: "string" },
          why: { type: "string" },
          verification: { type: "string" },
        },
        required: ["step", "action", "why", "verification"],
      },
    },
    limitations: { type: "array", items: { type: "string" } },
    disclaimer: { type: "string" },
  },
  required: [
    "executiveSummary",
    "topPriorities",
    "quickWins",
    "mediumTermImprovements",
    "implementationPlan",
    "limitations",
    "disclaimer",
  ],
} as const;

function compactAudit(audit: Audit) {
  return {
    domain: audit.domain,
    scanMode: audit.scanMode,
    devices: audit.devices,
    pagesScanned: audit.pagesScanned,
    linksChecked: audit.linksChecked,
    scores: audit.scores,
    metrics: audit.metrics,
    limitations: audit.limitations,
    findings: audit.findings.map((finding) => ({
      id: finding.id,
      category: finding.category,
      subcategory: finding.subcategory,
      title: finding.title,
      description: finding.description,
      evidence: finding.evidence,
      affectedUrl: finding.affectedUrl,
      severity: finding.severity,
      confidence: finding.confidence,
      recommendation: finding.recommendation,
      technicalImplementation: finding.technicalImplementation,
      estimatedEffort: finding.estimatedEffort,
      acceptanceCriterion: finding.acceptanceCriterion,
      measuredValue: finding.measuredValue,
      targetValue: finding.targetValue,
    })),
  };
}

function extractAiPayload(result: unknown): unknown {
  if (typeof result === "string") return JSON.parse(result);
  if (!result || typeof result !== "object") return result;
  const record = result as Record<string, unknown>;
  const response = record.response;
  if (typeof response === "string") return JSON.parse(response);
  if (response && typeof response === "object") return response;
  return result;
}

export async function generateWorkersAiSummary(env: Env, audit: Audit): Promise<AISummary> {
  const config = runtimeConfig(env);
  if (!config.aiEnabled || !env.AI) {
    throw new AppError({
      code: "AI_DISABLED",
      title: "AI-samenvatting uitgeschakeld",
      message: "Cloudflare Workers AI is voor deze installatie niet ingeschakeld.",
      status: 503,
    });
  }

  const system = [
    "Je bent een senior website-auditor.",
    "Gebruik uitsluitend de aangeleverde deterministische auditgegevens als feitelijke bron.",
    "Schrijf in helder Nederlands.",
    "Verzin geen metingen, kwetsbaarheden, indexeringsstatus, versienummers of externe gegevens.",
    "Behoud de prioriteit en acceptatiecriteria uit de bevindingen.",
    "Noem handmatige controles expliciet als beperking.",
    "Retourneer uitsluitend JSON dat exact aan het gevraagde schema voldoet.",
  ].join(" ");

  try {
    const result = await env.AI.run(config.aiModel as keyof AiModels, {
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(compactAudit(audit)) },
      ],
      max_tokens: config.aiMaxOutputTokens,
      temperature: 0.2,
      response_format: {
        type: "json_schema",
        json_schema: responseSchema,
      },
    } as never);
    return aiSummarySchema.parse(extractAiPayload(result));
  } catch (cause) {
    throw new AppError({
      code: "AI_FAILED",
      title: "AI-samenvatting niet beschikbaar",
      message: "De regelgebaseerde samenvatting blijft beschikbaar. Cloudflare Workers AI kon deze aanvraag niet afronden.",
      status: 502,
      retryable: true,
      cause,
    });
  }
}
