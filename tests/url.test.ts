import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canonicalizeCrawlUrl,
  isBlockedHostname,
  isPublicIp,
  isSafeCrawlCandidate,
  normalizeUrl,
  resolveAndValidateHostname,
  sameRegistrableDomain,
} from "@/worker/security/url";
import type { Env } from "@/worker/types";

function toRequestUrl(input: RequestInfo | URL): URL {
  if (input instanceof URL) return input;
  if (typeof input === "string") return new URL(input);
  return new URL(input.url);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("URL-beveiliging", () => {
  it("voegt HTTPS toe en verwijdert fragmenten", () => {
    expect(normalizeUrl("Example.COM/path#deel").toString()).toBe("https://example.com/path");
  });
  it("weigert niet-HTTP-protocollen", () => {
    expect(() => normalizeUrl("file:///etc/passwd")).toThrow("Alleen HTTP- en HTTPS-websites");
  });
  it("weigert credentials in URL's", () => {
    expect(() => normalizeUrl("https://user:pass@example.com")).toThrow("gebruikersnaam of wachtwoord");
  });
  it("herkent interne hostnamen", () => {
    expect(isBlockedHostname("localhost")).toBe(true);
    expect(isBlockedHostname("printer.internal")).toBe(true);
    expect(isBlockedHostname("example.com")).toBe(false);
  });
  it("blokkeert private en metadata-IP's", () => {
    expect(isPublicIp("127.0.0.1")).toBe(false);
    expect(isPublicIp("192.168.1.10")).toBe(false);
    expect(isPublicIp("169.254.169.254")).toBe(false);
    expect(isPublicIp("8.8.8.8")).toBe(true);
    expect(isPublicIp("::1")).toBe(false);
    expect(isPublicIp("2001:4860:4860::8888")).toBe(true);
  });
  it("valt terug op Google DNS wanneer Cloudflare DoH niet bereikbaar is", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = toRequestUrl(input);
      if (url.hostname === "cloudflare-dns.com") {
        return Promise.reject(new Error("Cloudflare DoH unavailable"));
      }

      const isARecord = url.searchParams.get("type") === "A";
      return Promise.resolve(new Response(JSON.stringify({
        Status: 0,
        Answer: isARecord ? [{ type: 1, data: "93.184.216.34" }] : [],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }));
    });

    await expect(resolveAndValidateHostname({} as Env, null, "example.com"))
      .resolves.toEqual(["93.184.216.34"]);
  });
  it("blijft werken wanneer alleen een A-record bruikbaar is", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = toRequestUrl(input);
      const isARecord = url.searchParams.get("type") === "A";
      return Promise.resolve(new Response(JSON.stringify({
        Status: 0,
        Answer: isARecord ? [{ type: 1, data: "93.184.216.34" }] : [],
      }), {
        status: 200,
        headers: { "content-type": "application/dns-json" },
      }));
    });

    await expect(resolveAndValidateHostname({} as Env, null, "example.com"))
      .resolves.toEqual(["93.184.216.34"]);
  });
  it("normaliseert trackingparameters voor crawl-URL's", () => {
    expect(canonicalizeCrawlUrl("/page?utm_source=x&b=2&a=1#top", "https://example.com")?.toString()).toBe("https://example.com/page?a=1&b=2");
  });
  it("blijft binnen hetzelfde registrable domain", () => {
    expect(sameRegistrableDomain(new URL("https://www.example.co.uk"), new URL("https://shop.example.co.uk"))).toBe(true);
    expect(sameRegistrableDomain(new URL("https://example.com"), new URL("https://example.org"))).toBe(false);
  });
  it("slaat toestandwijzigende routes over", () => {
    expect(isSafeCrawlCandidate(new URL("https://example.com/logout"))).toBe(false);
    expect(isSafeCrawlCandidate(new URL("https://example.com/cart/add"))).toBe(false);
    expect(isSafeCrawlCandidate(new URL("https://example.com/diensten"))).toBe(true);
  });
});
