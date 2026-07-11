import { describe, expect, it } from "vitest";
import { parseRobotsText } from "@/worker/audit/robots";
import { parseSitemapXml } from "@/worker/audit/sitemap";
import { toPageResult } from "@/lib/audit/page";
import type { CrawledPage } from "@/types/audit";

describe("robots- en sitemapparsers", () => {
  it("leest sitemapregels en volledige blokkades", () => {
    const result = parseRobotsText("User-agent: *\nDisallow: /\nSitemap: https://example.com/sitemap.xml");
    expect(result.blocksAll).toBe(true);
    expect(result.sitemapUrls).toEqual(["https://example.com/sitemap.xml"]);
  });
  it("herkent een urlset", () => {
    expect(parseSitemapXml("<urlset><url><loc>https://example.com/</loc></url><url><loc>https://example.com/a</loc></url></urlset>")).toEqual({ type: "urlset", urlCount: 2 });
  });
  it("herkent een sitemapindex", () => {
    expect(parseSitemapXml("<sitemapindex><sitemap><loc>https://example.com/a.xml</loc></sitemap></sitemapindex>")).toEqual({ type: "sitemapindex", urlCount: 1 });
  });
  it("markeert onbekende XML als ongeldig", () => {
    expect(parseSitemapXml("<root><item /></root>")).toEqual({ type: "invalid", urlCount: 0 });
  });
});

describe("paginaresultaat", () => {
  it("leest metadata, headings en indexeerbaarheid", () => {
    const page: CrawledPage = {
      requestedUrl: "https://example.com",
      finalUrl: "https://example.com/",
      statusCode: 200,
      contentType: "text/html",
      headers: {},
      html: "<html><head><title> Test </title><meta name='description' content='Omschrijving'><link rel='canonical' href='/'></head><body><h1>Hoofd titel</h1><p>Een korte inhoud met meerdere woorden.</p></body></html>",
      responseTimeMs: 100,
      bytes: 200,
      redirectCount: 0,
      depth: 0,
    };
    const result = toPageResult(page);
    expect(result.title).toBe("Test");
    expect(result.canonical).toBe("https://example.com/");
    expect(result.h1).toEqual(["Hoofd titel"]);
    expect(result.indexable).toBe(true);
    expect(result.wordCount).toBeGreaterThan(5);
  });
});
