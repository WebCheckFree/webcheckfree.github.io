import { USER_AGENT } from "@/config/audit";
import { runtimeConfig } from "../config";
import { AppError } from "../errors";
import type { AuditJobState, Env } from "../types";
import { sameRegistrableDomain, validatePublicUrl } from "../security/url";

export interface SafeFetchResult {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  body: string;
  bytes: number;
  redirectCount: number;
  responseTimeMs: number;
  contentType: string;
}

export interface SafeFetchOptions {
  method?: "GET" | "HEAD";
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  acceptedContentTypes?: string[];
  acceptAnyContentType?: boolean;
}

async function readLimitedBody(response: Response, maxBytes: number): Promise<{ body: string; bytes: number }> {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > maxBytes) {
    throw new AppError({ code: "RESPONSE_TOO_LARGE", title: "Websitebestand te groot", message: "De website stuurde meer gegevens dan veilig binnen deze controle kunnen worden verwerkt." });
  }
  if (!response.body) return { body: "", bytes: 0 };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new AppError({ code: "RESPONSE_TOO_LARGE", title: "Websitebestand te groot", message: "De website stuurde meer gegevens dan veilig binnen deze controle kunnen worden verwerkt." });
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { body: new TextDecoder().decode(merged), bytes: total };
}

export async function safeFetch(env: Env, state: AuditJobState | null, input: string | URL, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const config = runtimeConfig(env);
  const requestedUrl = input.toString();
  let current = await validatePublicUrl(env, state, input);
  const allowedDomain = new URL(current);
  const method = options.method ?? "GET";
  const maxBytes = options.maxBytes ?? config.maxResponseBytes;
  const maxRedirects = options.maxRedirects ?? 5;
  const accepted = options.acceptedContentTypes ?? ["text/html", "text/plain", "application/xhtml+xml", "application/xml", "text/xml"];
  let redirectCount = 0;
  const started = performance.now();

  while (true) {
    await validatePublicUrl(env, state, current);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 9_000);
    try {
      const response = await fetch(current, {
        method,
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": USER_AGENT,
          accept: method === "HEAD" ? "*/*" : "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.1",
        },
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) throw new AppError({ code: "REDIRECT_ERROR", title: "Doorverwijzing mislukt", message: "De website gaf een doorverwijzing zonder bestemming terug." });
        redirectCount += 1;
        if (redirectCount > maxRedirects) {
          throw new AppError({ code: "TOO_MANY_REDIRECTS", title: "Te veel doorverwijzingen", message: "De website heeft te veel doorverwijzingen.", retryable: true });
        }
        const redirected = await validatePublicUrl(env, state, new URL(location, current));
        if (!sameRegistrableDomain(allowedDomain, redirected)) {
          throw new AppError({ code: "CROSS_DOMAIN_REDIRECT", title: "Externe doorverwijzing geblokkeerd", message: "De website verwijst door naar een ander hoofddomein. WEBCHECK blijft binnen het ingevoerde domein." });
        }
        current = redirected;
        continue;
      }

      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => { headers[key] = value; });
      const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() || "application/octet-stream";
      if (method !== "HEAD" && !options.acceptAnyContentType && !accepted.includes(contentType)) {
        throw new AppError({ code: "UNSUPPORTED_CONTENT_TYPE", title: "Bestandstype niet ondersteund", message: "Dit bestandstype kan niet als website worden gecontroleerd." });
      }
      const payload = method === "HEAD" ? { body: "", bytes: 0 } : await readLimitedBody(response, maxBytes);
      return {
        requestedUrl,
        finalUrl: current.toString(),
        status: response.status,
        headers,
        body: payload.body,
        bytes: payload.bytes,
        redirectCount,
        responseTimeMs: Math.round(performance.now() - started),
        contentType,
      };
    } catch (cause) {
      if (cause instanceof AppError) throw cause;
      if (controller.signal.aborted) {
        throw new AppError({ code: "TIMEOUT", title: "Website reageert te traag", message: "De website reageerde niet binnen de toegestane tijd.", retryable: true, cause });
      }
      throw new AppError({ code: "CONNECTION_ERROR", title: "Website niet bereikbaar", message: "Er kon geen veilige verbinding met de website worden gemaakt.", retryable: true, cause });
    } finally {
      clearTimeout(timer);
    }
  }
}
