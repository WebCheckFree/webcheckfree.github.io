import type { Env } from "./types";

export function numberFromEnv(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.trunc(parsed))) : fallback;
}

export function booleanFromEnv(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value === "") return fallback;
  return value.toLowerCase() === "true";
}

export function runtimeConfig(env: Env) {
  return {
    appUrl: env.APP_URL || "https://webcheckfree.github.io",
    appName: env.APP_NAME || "WEBCHECK",
    repositoryUrl: env.GITHUB_REPOSITORY_URL || "https://github.com/WebCheckFree/webcheckfree.github.io",
    corsOrigins: (env.CORS_ALLOWED_ORIGINS || "https://webcheckfree.github.io,http://localhost:4173")
      .split(",")
      .map((value) => value.trim().replace(/\/$/, ""))
      .filter(Boolean),
    aiEnabled: booleanFromEnv(env.AI_ENABLED, false),
    aiModel: env.AI_MODEL || "@cf/meta/llama-3.1-8b-instruct-fast",
    aiDailyLimit: numberFromEnv(env.AI_DAILY_REQUEST_LIMIT, 3, 0, 100),
    aiMaxOutputTokens: numberFromEnv(env.AI_MAX_OUTPUT_TOKENS, 1400, 256, 4000),
    pageSpeedEnabled: booleanFromEnv(env.PAGESPEED_ENABLED, false),
    pageSpeedApiKey: env.PAGESPEED_API_KEY || "",
    ttlMinutes: numberFromEnv(env.AUDIT_DATA_TTL_MINUTES, 60, 10, 1440),
    maxResponseBytes: numberFromEnv(env.AUDIT_MAX_RESPONSE_BYTES, 350_000, 50_000, 1_000_000),
    dnsCacheSeconds: numberFromEnv(env.AUDIT_DNS_CACHE_SECONDS, 300, 30, 3600),
    rateLimits: {
      quick: numberFromEnv(env.RATE_LIMIT_QUICK_PER_HOUR, 5, 1, 100),
      standard: numberFromEnv(env.RATE_LIMIT_STANDARD_PER_HOUR, 2, 1, 100),
      extended: numberFromEnv(env.RATE_LIMIT_EXTENDED_PER_HOUR, 1, 1, 100),
    },
    ipHashSalt: env.IP_HASH_SALT || "webcheck-public-fallback-salt",
  } as const;
}
