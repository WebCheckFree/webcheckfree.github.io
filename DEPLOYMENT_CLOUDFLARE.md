# WEBCHECK publiceren met GitHub Pages en Cloudflare Workers Free

Deze handleiding publiceert:

- de statische interface op `https://webcheckfree.github.io`;
- de audit-API op een Cloudflare Workers-adres;
- tijdelijke auditstatus en rapporten in Cloudflare D1;
- optionele Workers AI, standaard uitgeschakeld.

## 1. Project naar GitHub uploaden

1. Pak de release-ZIP uit.
2. Open GitHub Desktop.
3. Kies **File → Clone repository…**.
4. Selecteer of vul in: `WebCheckFree/webcheckfree.github.io`.
5. Klik **Clone**.
6. Kopieer alle bestanden uit de uitgepakte release naar de gekloonde repositorymap.
7. Vervang de bestaande `README.md` wanneer daarom wordt gevraagd.
8. Ga terug naar GitHub Desktop.
9. Vul bij **Summary** in: `Migrate WEBCHECK to Cloudflare Workers Free`.
10. Klik **Commit to main**.
11. Klik **Push origin**.

## 2. Cloudflare-account voorbereiden

1. Meld je aan bij het Cloudflare-dashboard.
2. Open rechtsboven het gebruikersmenu.
3. Open **My Profile**.
4. Open **API Tokens**.
5. Klik **Create Token**.
6. Kies een Workers-template of maak een custom token.
7. Geef minimaal rechten voor het gekozen account op:
   - Workers Scripts: Edit;
   - D1: Edit;
   - Workers AI: Read, alleen nodig wanneer AI later wordt ingeschakeld.
8. Beperk de token tot het Cloudflare-account waarop WEBCHECK wordt gepubliceerd.
9. Maak de token aan.
10. Kopieer de token direct; deze wordt later niet volledig opnieuw getoond.
11. Ga terug naar de Cloudflare-homepagina.
12. Kopieer je **Account ID** uit de accountgegevens.

## 3. Cloudflare-gegevens als GitHub Secrets opslaan

1. Open `WebCheckFree/webcheckfree.github.io` op GitHub.
2. Klik **Settings**.
3. Klik links **Secrets and variables → Actions**.
4. Open het tabblad **Secrets**.
5. Klik **New repository secret**.
6. Maak:
   - Name: `CLOUDFLARE_API_TOKEN`
   - Secret: de Cloudflare API-token
7. Klik **Add secret**.
8. Klik opnieuw **New repository secret**.
9. Maak:
   - Name: `CLOUDFLARE_ACCOUNT_ID`
   - Secret: je Cloudflare Account ID
10. Klik **Add secret**.

## 4. Worker en D1 automatisch publiceren

1. Open in GitHub het tabblad **Actions**.
2. Klik links op **Deploy Cloudflare Worker**.
3. Klik rechts **Run workflow**.
4. Selecteer branch **main**.
5. Klik **Run workflow**.
6. Open de nieuwe workflowrun.
7. Controleer dat de stappen groen worden:
   - dependencies installeren;
   - project valideren;
   - Worker deployen;
   - D1-migraties toepassen.
8. Open de stap **Deploy Worker and provision bindings**.
9. Kopieer het gepubliceerde Workers-adres, bijvoorbeeld:
   `https://webcheckfree-api.<account-subdomain>.workers.dev`
10. Open in een nieuw tabblad:
    `https://webcheckfree-api.<account-subdomain>.workers.dev/api/health`
11. Controleer dat de JSON minimaal bevat:

```json
{
  "status": "ok",
  "architecture": "github-pages + cloudflare-workers + d1",
  "services": {
    "ai": "disabled",
    "storage": "d1"
  }
}
```

## 5. Extra beveiligingssecret voor rate limiting

Voer dit één keer lokaal uit of via Cloudflare Wrangler:

```bash
npm install
npx wrangler login
npx wrangler secret put IP_HASH_SALT
```

Voer als waarde een lange willekeurige tekenreeks in, bijvoorbeeld gegenereerd met een wachtwoordmanager. Commit deze waarde nooit.

Na het instellen:

```bash
npx wrangler deploy
```

## 6. Worker-URL aan GitHub Pages doorgeven

1. Open de GitHub-repository.
2. Klik **Settings**.
3. Klik **Secrets and variables → Actions**.
4. Open het tabblad **Variables**.
5. Klik **New repository variable**.
6. Vul in:
   - Name: `WEBCHECK_API_BASE_URL`
   - Value: je Workers-adres, zonder `/api` en zonder slash achteraan
7. Voorbeeldwaarde:
   `https://webcheckfree-api.<account-subdomain>.workers.dev`
8. Klik **Add variable**.

## 7. GitHub Pages inschakelen

1. Open **Settings** van de repository.
2. Klik links **Pages**.
3. Zoek **Build and deployment**.
4. Kies bij **Source**: **GitHub Actions**.
5. Open daarna het tabblad **Actions**.
6. Klik links **Deploy GitHub Pages**.
7. Klik **Run workflow**.
8. Selecteer **main**.
9. Klik opnieuw **Run workflow**.
10. Controleer dat de jobs **build** en **deploy** groen zijn.
11. Open `https://webcheckfree.github.io`.

## 8. Eerste functietest

1. Open `https://webcheckfree.github.io`.
2. Vul `https://example.com` in.
3. Kies **Quick scan**.
4. Kies **Mobile**.
5. Laat AI uitgeschakeld.
6. Klik **Start gratis websitecheck**.
7. Controleer dat de voortgang stapsgewijs doorloopt.
8. Controleer dat het rapport scores, bevindingen, een regelgebaseerde samenvatting en exports bevat.

## 9. Workers AI optioneel inschakelen

De regelgebaseerde samenvatting werkt altijd zonder AI.

1. Open lokaal `wrangler.jsonc`.
2. Zoek:

```jsonc
"AI_ENABLED": "false"
```

3. Wijzig dit naar:

```jsonc
"AI_ENABLED": "true"
```

4. Controleer het model:

```jsonc
"AI_MODEL": "@cf/meta/llama-3.1-8b-instruct-fast"
```

5. Commit en push de wijziging.
6. Open GitHub **Actions → Deploy Cloudflare Worker**.
7. Open de automatisch gestarte workflow of klik **Run workflow**.
8. Open na deployment `/api/health`.
9. Controleer dat `services.ai` nu `configured` is.

Wanneer het gratis AI-quotum op is of een AI-aanvraag mislukt, blijft de regelgebaseerde samenvatting beschikbaar.

## 10. PageSpeed optioneel inschakelen

PageSpeed staat standaard uit om het gratis Worker-profiel voorspelbaar te houden.

1. Maak een Google PageSpeed Insights API-key aan.
2. Voer lokaal uit:

```bash
npx wrangler secret put PAGESPEED_API_KEY
```

3. Open `wrangler.jsonc`.
4. Wijzig:

```jsonc
"PAGESPEED_ENABLED": "true"
```

5. Commit en push.
6. Deploy de Worker opnieuw.

## 11. Controle na iedere update

Gebruik lokaal:

```bash
npm install
npm run d1:migrate:local
npm run check
```

Verwacht:

- ESLint geslaagd;
- TypeScript geslaagd;
- unit- en integratietests geslaagd;
- GitHub Pages-bestanden geldig;
- Wrangler dry-runbuild geslaagd.

## 12. Veelvoorkomende problemen

### Workerworkflow meldt authenticatiefout

Controleer de GitHub Secrets `CLOUDFLARE_API_TOKEN` en `CLOUDFLARE_ACCOUNT_ID`. Maak zo nodig een nieuwe token met Workers Scripts- en D1-bewerkingsrechten.

### D1-tabel ontbreekt

Start opnieuw **Deploy Cloudflare Worker** en controleer de stap **Apply D1 migrations**. Handmatig kan dit met:

```bash
npx wrangler d1 migrations apply webcheckfree --remote
```

### Frontend meldt dat de API niet is geconfigureerd

Controleer de GitHub Actions-variable `WEBCHECK_API_BASE_URL` en start daarna **Deploy GitHub Pages** opnieuw.

### CORS-fout

Controleer in `wrangler.jsonc`:

```jsonc
"CORS_ALLOWED_ORIGINS": "https://webcheckfree.github.io,http://localhost:4173"
```

Deploy daarna de Worker opnieuw.

### AI blijft disabled

Controleer:

- `AI_ENABLED` staat op `true`;
- de productieconfiguratie bevat de `AI`-binding;
- de Worker is opnieuw gedeployed;
- `/api/health` meldt `configured`.
