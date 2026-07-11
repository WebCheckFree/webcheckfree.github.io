import { apiBaseUrl, healthCheck, startAudit } from "./api.js";
import { esc, homeTemplate, methodologyTemplate, phases, privacyTemplate } from "./templates.js";
import { showReport } from "./report.js";

const root = document.querySelector("#main-content");
const themeButton = document.querySelector("#theme-toggle");
const storedTheme = localStorage.getItem("webcheck:theme");
if (storedTheme === "dark" || (!storedTheme && matchMedia("(prefers-color-scheme: dark)").matches)) document.documentElement.classList.add("dark");
themeButton.addEventListener("click", () => {
  document.documentElement.classList.toggle("dark");
  localStorage.setItem("webcheck:theme", document.documentElement.classList.contains("dark") ? "dark" : "light");
});

document.querySelector("#github-link").href = window.__WEBCHECK_CONFIG__?.repositoryUrl || "https://github.com/WebCheckFree/webcheckfree.github.io";

function renderProgress(event) {
  const slot = document.querySelector("#progress-slot");
  if (!slot) return;
  slot.innerHTML = `<section class="progress-card" aria-live="polite"><div class="progress-head"><div><span class="eyebrow">Websitecontrole actief</span><h3>${esc(event.phase)}</h3><p>${esc(event.message || "")}</p></div><div class="progress-stats"><span>${event.pagesDiscovered} pagina’s ontdekt</span><span>${event.findingsCount} bevindingen</span><span>${Math.max(1, Math.round(event.elapsedMs / 1000))} sec.</span></div></div><ol class="phase-list">${phases.map((phase, index) => `<li class="${event.completedPhases.includes(phase) ? "complete" : index === event.phaseIndex ? "active" : ""}"><span class="phase-dot"></span>${esc(phase)}</li>`).join("")}</ol></section>`;
}

function showError(error) {
  const slot = document.querySelector("#error-slot");
  if (slot) slot.innerHTML = `<div class="error-panel" role="alert"><strong>${esc(error.title || "Controle mislukt")}</strong><p>${esc(error.message || error.toString())}</p>${error.referenceId ? `<small>Referentie: ${esc(error.referenceId)}</small>` : ""}</div>`;
}

async function bindHome() {
  const form = document.querySelector("#audit-form");
  const status = document.querySelector("#api-status");
  const aiInput = document.querySelector("#audit-ai");
  const aiHelp = document.querySelector("#audit-ai-help");
  const health = await healthCheck();
  const aiAvailable = health.online && health.data?.services?.ai === "configured";

  if (status && health.configured) {
    status.className = `api-status ${health.online ? "ok" : "error"}`;
    status.innerHTML = `<span class="status-dot"></span>${health.online ? "Cloudflare Worker-API is online." : "De Worker-API is geconfigureerd maar momenteel niet bereikbaar."}`;
  }
  if (aiInput) {
    aiInput.disabled = !aiAvailable;
    aiInput.checked = false;
  }
  if (aiHelp) {
    aiHelp.textContent = aiAvailable
      ? "Optioneel via Cloudflare Workers AI. De regelgebaseerde samenvatting blijft altijd beschikbaar."
      : "Cloudflare Workers AI is uitgeschakeld. De regelgebaseerde managementsamenvatting wordt automatisch gebruikt.";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const url = document.querySelector("#audit-url").value.trim();
    if (!url) {
      showError({ title: "Website-URL ontbreekt", message: "Voer een openbare website-URL in." });
      return;
    }
    const submit = form.querySelector("button[type=submit]");
    submit.disabled = true;
    submit.textContent = "Controleren…";
    document.querySelector("#error-slot").innerHTML = "";
    const mode = form.querySelector("input[name=mode]:checked").value;
    const device = form.querySelector("input[name=device]:checked").value;
    const payload = {
      url,
      scanMode: mode,
      devices: device === "both" ? ["mobile", "desktop"] : [device],
      generateAiSummary: Boolean(aiInput?.checked && aiAvailable),
    };
    try {
      const audit = await startAudit(payload, (auditEvent) => {
        if (auditEvent.type === "progress") renderProgress(auditEvent);
      });
      sessionStorage.setItem(`webcheck:audit:${audit.id}`, JSON.stringify(audit));
      location.hash = `#/report/${audit.id}`;
    } catch (error) {
      showError(error);
      submit.disabled = false;
      submit.textContent = "Start gratis websitecheck →";
    }
  });
}

async function route() {
  const hash = location.hash || "#/";
  window.scrollTo({ top: 0, behavior: "instant" });
  if (hash.startsWith("#/report/")) {
    await showReport(root, hash.split("/")[2]);
    return;
  }
  if (hash === "#/methodology") {
    root.innerHTML = methodologyTemplate();
    return;
  }
  if (hash === "#/privacy") {
    root.innerHTML = privacyTemplate();
    return;
  }
  root.innerHTML = homeTemplate(Boolean(apiBaseUrl));
  await bindHome();
}

window.addEventListener("hashchange", route);
route();
