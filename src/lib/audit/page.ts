import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { CrawledPage } from "@/types/audit";
import type { z } from "zod";
import type { pageResultSchema } from "@/schemas/audit";

export type PageResult = z.infer<typeof pageResultSchema>;

export function toPageResult(page: CrawledPage, document?: CheerioAPI): PageResult {
  const $ = document ?? cheerio.load(page.html);
  const title = clean($("title").first().text()) || null;
  const metaDescription = clean($("meta[name='description']").attr("content") ?? "") || null;
  const canonicalValue = $("link[rel~='canonical']").attr("href");
  let canonical: string | null = null;
  if (canonicalValue) {
    try { canonical = new URL(canonicalValue, page.finalUrl).toString(); } catch { canonical = canonicalValue; }
  }
  const h1 = $("h1").map((_, element) => clean($(element).text())).get().filter(Boolean);
  const robots = `${$("meta[name='robots']").attr("content") ?? ""},${page.headers["x-robots-tag"] ?? ""}`.toLowerCase();
  const text = clean($("body").text());
  return {
    requestedUrl: page.requestedUrl,
    finalUrl: page.finalUrl,
    statusCode: page.statusCode,
    contentType: page.contentType,
    responseTimeMs: page.responseTimeMs,
    redirectCount: page.redirectCount,
    title,
    metaDescription,
    canonical,
    h1,
    indexable: !/(?:^|[,\s])noindex(?:[,\s]|$)/.test(robots) && page.statusCode >= 200 && page.statusCode < 400,
    wordCount: text ? text.split(/\s+/).filter(Boolean).length : 0,
  };
}

export function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
