import { describe, expect, it } from "vitest";
import { canonicalizeCrawlUrl, isBlockedHostname, isPublicIp, isSafeCrawlCandidate, normalizeUrl, sameRegistrableDomain } from "@/worker/security/url";

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
