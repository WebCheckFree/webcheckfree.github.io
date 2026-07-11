import { expect, test } from "@playwright/test";

test("homepage toont auditformulier en Cloudflare-architectuur", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Controleer de kwaliteit van je website" })).toBeVisible();
  await expect(page.getByLabel("Website URL")).toBeVisible();
  await expect(page.getByText("GitHub Pages, Workers en D1")).toBeVisible();
  await expect(page.getByLabel(/Verrijk met Cloudflare Workers AI/)).toBeDisabled();
});

test("methodologie toont gratis-tier scanlimieten", async ({ page }) => {
  await page.goto("/#/methodology");
  await expect(page.getByRole("heading", { name: "Hoe WEBCHECK websites beoordeelt" })).toBeVisible();
  await expect(page.getByText(/Quick:.*1 pagina/)).toBeVisible();
  await expect(page.getByText(/Standaard:.*3 pagina/)).toBeVisible();
  await expect(page.getByText(/Uitgebreid:.*5 pagina/)).toBeVisible();
});

test("privacypagina beschrijft D1 en regelgebaseerde fallback", async ({ page }) => {
  await page.goto("/#/privacy");
  await expect(page.getByRole("heading", { name: "Minimale gegevensverwerking" })).toBeVisible();
  await expect(page.getByText(/Cloudflare D1/)).toBeVisible();
  await expect(page.getByText(/regelgebaseerde samenvatting blijft altijd beschikbaar/)).toBeVisible();
});
