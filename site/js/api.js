const rawBase = window.__WEBCHECK_CONFIG__?.apiBaseUrl ?? "";
export const apiBaseUrl = rawBase && rawBase !== "__WEBCHECK_API_BASE_URL__" ? rawBase.replace(/\/$/, "") : "";

export function apiUrl(path) {
  if (!apiBaseUrl) throw new Error("De Cloudflare Worker-API is nog niet gekoppeld aan deze GitHub Pages-installatie.");
  return `${apiBaseUrl}${path}`;
}

async function jsonRequest(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    cache: "no-store",
    ...options,
    headers: { accept: "application/json", ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = body?.error ?? { title: "Aanvraag mislukt", message: "De audit-API gaf geen bruikbare respons." };
    throw Object.assign(new Error(error.message), error, { status: response.status });
  }
  return body;
}

export async function healthCheck() {
  if (!apiBaseUrl) return { configured: false, online: false };
  try {
    return { configured: true, online: true, data: await jsonRequest("/api/health") };
  } catch {
    return { configured: true, online: false, data: null };
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function startAudit(payload, onEvent) {
  const started = await jsonRequest("/api/audit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const auditId = started.auditId;
  if (started.event) onEvent(started.event);

  for (let step = 0; step < 120; step += 1) {
    await delay(step < 3 ? 120 : 240);
    let body;
    try {
      body = await jsonRequest(`/api/audit-status/${encodeURIComponent(auditId)}`, { method: "POST" });
    } catch (error) {
      if (error.status === 409) continue;
      throw error;
    }
    const event = body.event;
    if (!event) throw new Error("De audit-API retourneerde geen voortgangsstatus.");
    onEvent(event);
    if (event.type === "error") throw Object.assign(new Error(event.error.message), event.error);
    if (event.type === "complete") return event.audit;
  }
  throw new Error("De controle duurde langer dan de toegestane voortgangscyclus. Open het rapport later opnieuw met het auditnummer.");
}

export async function fetchAudit(id) {
  const body = await jsonRequest(`/api/audit-status/${encodeURIComponent(id)}`);
  if (!body.audit) throw new Error("Dit rapport is nog niet afgerond of niet meer beschikbaar.");
  return body.audit;
}

export async function requestAiSummary(auditId, audit) {
  const body = await jsonRequest("/api/ai-summary", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ auditId, audit }),
  });
  return body.audit;
}

export async function deleteAudit(id) {
  await jsonRequest(`/api/audit-status/${encodeURIComponent(id)}`, { method: "DELETE" });
  return true;
}
