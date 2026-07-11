import { describe, expect, it } from "vitest";
import worker from "@/worker/index";
import type { Env } from "@/worker/types";

const env = {
  APP_URL: "https://webcheckfree.github.io",
  CORS_ALLOWED_ORIGINS: "https://webcheckfree.github.io",
  AI_ENABLED: "false",
  PAGESPEED_ENABLED: "false",
} as Env;

describe("Cloudflare Worker API", () => {
  it("publiceert een healthcheck met D1 en uitgeschakelde AI", async () => {
    const response = await worker.fetch(new Request("https://worker.example/api/health", {
      headers: { origin: "https://webcheckfree.github.io" },
    }), env);
    expect(response.status).toBe(200);
    const body = await response.json<{ status: string; services: { ai: string; storage: string } }>();
    expect(body.status).toBe("ok");
    expect(body.services).toEqual(expect.objectContaining({ ai: "disabled", storage: "d1" }));
    expect(response.headers.get("access-control-allow-origin")).toBe("https://webcheckfree.github.io");
  });

  it("blokkeert private adressen vóór databasegebruik", async () => {
    const response = await worker.fetch(new Request("https://worker.example/api/audit", {
      method: "POST",
      headers: { origin: "https://webcheckfree.github.io", "content-type": "application/json" },
      body: JSON.stringify({ url: "http://127.0.0.1", scanMode: "quick", devices: ["mobile"], generateAiSummary: false }),
    }), env);
    expect(response.status).toBe(400);
    const body = await response.json<{ error: { title: string } }>();
    expect(body.error.title).toBe("Intern adres geblokkeerd");
  });

  it("weigert niet-toegestane origins", async () => {
    const response = await worker.fetch(new Request("https://worker.example/api/audit", {
      method: "OPTIONS",
      headers: { origin: "https://malicious.example" },
    }), env);
    expect(response.status).toBe(403);
  });
});
