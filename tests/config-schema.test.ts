import { describe, expect, it } from "vitest";
import { SCAN_LIMITS } from "@/config/audit";
import { booleanFromEnv, numberFromEnv, runtimeConfig } from "@/worker/config";
import { auditRequestSchema } from "@/schemas/request";
import type { Env } from "@/worker/types";

describe("Cloudflare runtimeconfiguratie", () => {
  it("begrensd numerieke omgevingsvariabelen", () => {
    expect(numberFromEnv("999", 3, 1, 10)).toBe(10);
    expect(numberFromEnv("abc", 3, 1, 10)).toBe(3);
  });
  it("leest booleans expliciet", () => {
    expect(booleanFromEnv("true")).toBe(true);
    expect(booleanFromEnv("FALSE", true)).toBe(false);
    expect(booleanFromEnv(undefined, true)).toBe(true);
  });
  it("schakelt AI standaard uit", () => {
    const config = runtimeConfig({} as Env);
    expect(config.aiEnabled).toBe(false);
    expect(config.ttlMinutes).toBe(60);
  });
  it("gebruikt gratis-tier scanlimieten", () => {
    expect(SCAN_LIMITS.quick.maxPages).toBe(1);
    expect(SCAN_LIMITS.standard.maxPages).toBe(3);
    expect(SCAN_LIMITS.extended.maxPages).toBe(5);
  });
});

describe("auditrequest", () => {
  it("past veilige defaults toe", () => {
    const parsed = auditRequestSchema.parse({ url: "example.com" });
    expect(parsed.scanMode).toBe("quick");
    expect(parsed.devices).toEqual(["mobile"]);
    expect(parsed.generateAiSummary).toBe(false);
  });
  it("weigert lege invoer", () => {
    expect(auditRequestSchema.safeParse({ url: "" }).success).toBe(false);
  });
});
