import ipaddr from "ipaddr.js";
import { getDomain } from "tldts";
import { AppError } from "../errors";
import type { AuditJobState, Env } from "../types";
import { runtimeConfig } from "../config";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata",
  "instance-data",
]);
const BLOCKED_SUFFIXES = [".local", ".internal", ".localhost", ".home", ".lan", ".test"];
const CLOUD_METADATA_IPS = new Set(["169.254.169.254", "100.100.100.200"]);
const IPV4_LITERAL = /^(?:\d{1,3}\.){3}\d{1,3}$/;

type DnsRecordType = "A" | "AAAA";
interface DnsJsonResponse {
  Status?: number;
  Answer?: Array<{ type?: number; data?: string }>;
}

export function normalizeUrl(input: string): URL {
  const trimmed = input.trim();
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new AppError({ code: "INVALID_URL", title: "Ongeldige website-URL", message: "Voer een geldige openbare website-URL in." });
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new AppError({ code: "UNSUPPORTED_PROTOCOL", title: "Protocol niet ondersteund", message: "Alleen HTTP- en HTTPS-websites kunnen worden gecontroleerd." });
  }
  if (url.username || url.password) {
    throw new AppError({ code: "URL_CREDENTIALS", title: "URL bevat aanmeldgegevens", message: "Webadressen met een gebruikersnaam of wachtwoord worden niet geaccepteerd." });
  }
  url.hash = "";
  url.hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!url.pathname) url.pathname = "/";
  return url;
}

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.replace(/\.$/, "").toLowerCase();
  return BLOCKED_HOSTNAMES.has(host) || BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

export function isPublicIp(address: string): boolean {
  if (CLOUD_METADATA_IPS.has(address)) return false;
  if (!ipaddr.isValid(address)) return false;
  return ipaddr.parse(address).range() === "unicast";
}

async function requestDnsJson(endpoint: URL, accept: string, type: DnsRecordType): Promise<string[]> {
  const response = await fetch(endpoint, {
    headers: { accept },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`DNS resolver returned HTTP ${response.status}`);

  const data = await response.json<DnsJsonResponse>();
  if (data.Status !== 0) return [];

  const acceptedType = type === "A" ? 1 : 28;
  return (data.Answer ?? [])
    .filter((answer) => answer.type === acceptedType && typeof answer.data === "string")
    .map((answer) => answer.data!);
}

async function resolveDnsType(hostname: string, type: DnsRecordType): Promise<string[]> {
  const cloudflare = new URL("https://cloudflare-dns.com/dns-query");
  cloudflare.searchParams.set("name", hostname);
  cloudflare.searchParams.set("type", type);

  const google = new URL("https://dns.google/resolve");
  google.searchParams.set("name", hostname);
  google.searchParams.set("type", type);
  google.searchParams.set("edns_client_subnet", "0.0.0.0/0");

  const providers = [
    { endpoint: cloudflare, accept: "application/dns-json" },
    { endpoint: google, accept: "application/json" },
  ];

  let lastError: unknown;
  let hadSuccessfulResponse = false;
  for (const provider of providers) {
    try {
      const addresses = await requestDnsJson(provider.endpoint, provider.accept, type);
      hadSuccessfulResponse = true;
      if (addresses.length) return addresses;
    } catch (cause) {
      lastError = cause;
    }
  }

  if (!hadSuccessfulResponse && lastError) throw lastError;
  return [];
}

export async function resolveAndValidateHostname(env: Env, state: AuditJobState | null, hostname: string): Promise<string[]> {
  const host = hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (isBlockedHostname(host)) {
    throw new AppError({ code: "PRIVATE_ADDRESS", title: "Intern adres geblokkeerd", message: "Lokale en interne netwerkadressen kunnen niet worden gecontroleerd." });
  }
  if (ipaddr.isValid(host) || IPV4_LITERAL.test(host)) {
    if (!isPublicIp(host)) {
      throw new AppError({ code: "PRIVATE_ADDRESS", title: "Intern adres geblokkeerd", message: "Lokale en interne netwerkadressen kunnen niet worden gecontroleerd." });
    }
    return [host];
  }

  const cached = state?.dnsCache[host];
  if (cached && cached.expiresAt > Date.now()) return cached.addresses;

  const results = await Promise.allSettled([resolveDnsType(host, "A"), resolveDnsType(host, "AAAA")]);
  const addresses = [...new Set(results.flatMap((result) => result.status === "fulfilled" ? result.value : []))];

  if (!addresses.length && results.every((result) => result.status === "rejected")) {
    throw new AppError({
      code: "DNS_FAILURE",
      title: "DNS-controle tijdelijk niet beschikbaar",
      message: "De DNS-resolvers konden tijdelijk niet worden bereikt. Probeer de websitecheck opnieuw.",
      retryable: true,
      cause: results,
    });
  }
  if (!addresses.length) {
    throw new AppError({ code: "DNS_FAILURE", title: "Domein niet gevonden", message: "Voor dit domein zijn geen bruikbare DNS-adressen gevonden.", retryable: true });
  }
  if (addresses.some((address) => !isPublicIp(address))) {
    throw new AppError({ code: "PRIVATE_ADDRESS", title: "Intern adres geblokkeerd", message: "Het domein verwijst naar een lokaal, gereserveerd of intern netwerkadres." });
  }
  if (state) {
    state.dnsCache[host] = { addresses, expiresAt: Date.now() + runtimeConfig(env).dnsCacheSeconds * 1000 };
  }
  return addresses;
}

export async function validatePublicUrl(env: Env, state: AuditJobState | null, input: string | URL): Promise<URL> {
  const url = normalizeUrl(input.toString());
  await resolveAndValidateHostname(env, state, url.hostname);
  return url;
}

export function sameRegistrableDomain(a: URL, b: URL): boolean {
  return (getDomain(a.hostname) ?? a.hostname) === (getDomain(b.hostname) ?? b.hostname);
}

export function canonicalizeCrawlUrl(input: string, base: string): URL | null {
  let url: URL;
  try {
    url = new URL(input, base);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
  url.hash = "";
  ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"].forEach((key) => url.searchParams.delete(key));
  url.searchParams.sort();
  return url;
}

const DANGEROUS_PATH = /(?:^|\/)(?:logout|log-out|signout|delete|remove|destroy|checkout|cart\/add|add-to-cart|account|wp-admin|admin)(?:\/|$)/i;
const DANGEROUS_QUERY = /(?:action|do|command)=(?:delete|remove|logout|purchase|pay)/i;

export function isSafeCrawlCandidate(url: URL): boolean {
  return !DANGEROUS_PATH.test(url.pathname) && !DANGEROUS_QUERY.test(url.search);
}

export async function hashClientIp(request: Request, salt: string): Promise<string> {
  const ip = request.headers.get("cf-connecting-ip");
  const fallback = request.headers.get("user-agent") || "unknown-client";
  const identity = ip || `no-ip:${fallback}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}|${identity}`));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("").slice(0, 40);
}
