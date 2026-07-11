# WEBCHECK

WEBCHECK is een gratis, open-source website-audittool voor vier kerngebieden:

1. technische prestaties en Core Web Vitals;
2. gebruikerservaring en automatische toegankelijkheidscontroles;
3. zoekmachineoptimalisatie;
4. beveiliging en vertrouwen.

De publieke interface draait statisch op GitHub Pages. De audit-API draait op Cloudflare Workers Free en bewaart tijdelijke auditstatus en rapporten in Cloudflare D1. Elke audit krijgt standaard een regelgebaseerde managementsamenvatting. Cloudflare Workers AI is optioneel en standaard uitgeschakeld.

## Kernfuncties

- URL-invoer zonder gebruikersaccount;
- Quick-, standaard- en uitgebreide audit;
- mobiele en desktop-PageSpeed-metingen wanneer beschikbaar;
- gecontroleerde crawling met SSRF-bescherming;
- HTML-, metadata-, header-, robots.txt-, sitemap- en linkanalyse;
- transparante scores voor performance, UX, SEO en security;
- regelgebaseerde managementsamenvatting zonder AI-kosten;
- optionele Cloudflare Workers AI-verrijking;
- tijdelijke rapportopslag in D1 met automatische vervaldatum;
- JSON-, CSV-, HTML- en print/PDF-export;
- GitHub Actions voor CI, Worker-deployment en GitHub Pages;
- responsive interface voor desktop en Android Chrome.

## Architectuur

```text
Bezoeker
   │
   ▼
https://webcheckfree.github.io
GitHub Pages: statische HTML/CSS/JavaScript-interface
   │
   ▼
https://webcheckfree-api.<account>.workers.dev
Cloudflare Worker: routevalidatie en audit-state-machine
   │
   ├── Cloudflare D1: tijdelijke jobs, rapporten en rate limits
   ├── PageSpeed Insights API: optionele meetdata
   └── Cloudflare Workers AI: optionele samenvattingsverrijking
```

### Waarom een audit-state-machine?

Cloudflare Workers Free heeft beperkte CPU-tijd per request. WEBCHECK voert daarom niet de hele crawl in één lang verzoek uit. De frontend start een audit en roept vervolgens korte auditstappen aan. Iedere stap verwerkt maximaal één pagina of een kleine linkbatch en schrijft de voortgang naar D1.

De fasen zijn:

1. URL valideren;
2. website bereiken;
3. pagina’s verzamelen;
4. performance controleren;
5. gebruikerservaring controleren;
6. SEO controleren;
7. beveiliging controleren;
8. scores berekenen;
9. optionele Workers AI-verrijking;
10. rapport voorbereiden.

## Scanlimieten

De standaardlimieten zijn afgestemd op het gratis Worker-profiel:

| Scan | Pagina’s | Interne links | Crawldiepte |
|---|---:|---:|---:|
| Quick | 1 | 10 | 0 |
| Standaard | 3 | 18 | 2 |
| Uitgebreid | 5 | 25 | 3 |

De audit voert alleen passieve GET- en HEAD-verzoeken uit. Formulieren, uploads, accounts, betalingen en actieve beveiligingstests worden niet uitgevoerd.

## Projectstructuur

Zie [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) voor de volledige mappenstructuur.

Belangrijkste onderdelen:

- `site/`: statische GitHub Pages-interface;
- `src/worker/`: Cloudflare Worker, state-machine, beveiliging, D1 en Workers AI;
- `src/lib/audit/`: deterministische analysemethoden;
- `migrations/`: D1-databaseschema;
- `wrangler.local.jsonc`: lokale Workerconfiguratie zonder remote AI-binding;
- `.github/workflows/`: CI, Worker-deployment en Pages-deployment;
- `tests/`: unit-, schema-, parser-, export- en browsertests.

## Vereisten

- Node.js 20.9 of hoger;
- npm;
- een GitHub-account;
- een gratis Cloudflare-account;
- Wrangler via de lokale projectdependency.

## Lokale installatie

```bash
npm install
npm run cf:typegen
```

### Lokale D1-database migreren

```bash
npm run d1:migrate:local
```

### Worker lokaal starten

```bash
npm run dev:worker
```

Voor lokale ontwikkeling gebruikt dit commando `wrangler.local.jsonc`, zonder remote Workers AI-binding. Daardoor is geen Cloudflare-login nodig zolang AI uitgeschakeld blijft. Wrangler toont een lokaal adres, doorgaans:

```text
http://localhost:8787
```

Healthcheck:

```text
http://localhost:8787/api/health
```

### Statische frontend lokaal starten

Open een tweede terminal:

```bash
npm run dev:site
```

De statische site draait doorgaans op:

```text
http://localhost:4173
```

Pas voor lokaal testen `site/config.js` tijdelijk aan:

```js
window.__WEBCHECK_CONFIG__ = {
  apiBaseUrl: "http://localhost:8787",
  repositoryUrl: "https://github.com/WebCheckFree/webcheckfree.github.io"
};
```

Zet vóór committen de placeholder terug:

```js
apiBaseUrl: "__WEBCHECK_API_BASE_URL__"
```

## Omgevingsvariabelen

Niet-geheime standaardwaarden staan in `wrangler.jsonc`.

Belangrijkste variabelen:

```text
APP_URL
APP_NAME
GITHUB_REPOSITORY_URL
CORS_ALLOWED_ORIGINS
AI_ENABLED
AI_MODEL
AI_DAILY_REQUEST_LIMIT
AI_MAX_OUTPUT_TOKENS
PAGESPEED_ENABLED
PAGESPEED_API_KEY
AUDIT_DATA_TTL_MINUTES
AUDIT_MAX_RESPONSE_BYTES
AUDIT_DNS_CACHE_SECONDS
RATE_LIMIT_QUICK_PER_HOUR
RATE_LIMIT_STANDARD_PER_HOUR
RATE_LIMIT_EXTENDED_PER_HOUR
IP_HASH_SALT
LOG_LEVEL
```

### Geheimen

Zet geheimen nooit in `wrangler.jsonc`, GitHub, browsercode of documentatie.

Voor productie:

```bash
npx wrangler secret put IP_HASH_SALT
```

Voer een lange willekeurige waarde in.

Een optionele PageSpeed-key:

```bash
npx wrangler secret put PAGESPEED_API_KEY
```

Cloudflare Workers AI gebruikt een binding en vereist geen externe AI-API-key.

## Volledige klik-voor-klik deployment

Gebruik [DEPLOYMENT_CLOUDFLARE.md](DEPLOYMENT_CLOUDFLARE.md) voor de volledige publicatieprocedure via GitHub Actions, Cloudflare Workers, D1 en GitHub Pages.

## Cloudflare Worker handmatig deployen

### 1. Aanmelden

```bash
npx wrangler login
```

Een browservenster opent. Selecteer het juiste Cloudflare-account en geef Wrangler toestemming.

### 2. Worker deployen en D1 aanmaken

```bash
npx wrangler deploy
```

`wrangler.jsonc` bevat een D1-binding zonder vast database-ID. Wrangler kan de D1-database bij de eerste deployment provisioneren en schrijft het toegewezen ID terug naar de configuratie.

Commit de bijgewerkte `wrangler.jsonc` wanneer Wrangler een `database_id` heeft toegevoegd.

### 3. Migraties toepassen

```bash
npx wrangler d1 migrations apply webcheckfree --remote
```

### 4. Geheim instellen

```bash
npx wrangler secret put IP_HASH_SALT
```

### 5. Healthcheck testen

Wrangler toont na de deployment een Worker-URL, bijvoorbeeld:

```text
https://webcheckfree-api.<account-subdomain>.workers.dev
```

Open:

```text
https://webcheckfree-api.<account-subdomain>.workers.dev/api/health
```

Verwachte kernuitvoer:

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

## GitHub Actions deployment

### Vereiste GitHub Secrets

Open de repository en ga naar:

```text
Settings
→ Secrets and variables
→ Actions
→ Secrets
→ New repository secret
```

Maak deze secrets:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

De Cloudflare API-token moet minimaal Workers Scripts en D1 mogen bewerken voor het gekozen account.

### Worker workflow

De workflow `.github/workflows/worker.yml`:

1. installeert dependencies;
2. voert typecheck, tests en dry-runbuild uit;
3. deployt de Worker;
4. past D1-migraties toe.

Start handmatig via:

```text
GitHub repository
→ Actions
→ Deploy Cloudflare Worker
→ Run workflow
→ main
→ Run workflow
```

### Worker-URL aan GitHub Pages doorgeven

Open:

```text
Settings
→ Secrets and variables
→ Actions
→ Variables
→ New repository variable
```

Maak:

```text
Name: WEBCHECK_API_BASE_URL
Value: https://webcheckfree-api.<account-subdomain>.workers.dev
```

Gebruik geen `/api` en geen slash achteraan.

### GitHub Pages activeren

Open:

```text
Settings
→ Pages
→ Build and deployment
→ Source
→ GitHub Actions
```

Start vervolgens:

```text
Actions
→ Deploy GitHub Pages
→ Run workflow
```

De publieke site wordt bereikbaar op:

```text
https://webcheckfree.github.io
```

## Cloudflare Workers AI inschakelen

AI is standaard uitgeschakeld:

```jsonc
"AI_ENABLED": "false"
```

De regelgebaseerde samenvatting blijft altijd actief en is de feitelijke fallback.

Om Workers AI in te schakelen:

1. open `wrangler.jsonc`;
2. verander:

```jsonc
"AI_ENABLED": "true"
```

3. controleer het model:

```jsonc
"AI_MODEL": "@cf/meta/llama-3.1-8b-instruct-fast"
```

4. deploy opnieuw:

```bash
npx wrangler deploy
```

De frontend activeert de AI-checkbox alleen wanneer `/api/health` meldt dat AI is geconfigureerd.

Workers AI ontvangt uitsluitend:

- scores;
- genormaliseerde bevindingen;
- metrics;
- beperkingen;
- minimale auditmetadata.

Volledige ruwe HTML wordt niet naar Workers AI gestuurd. AI kan geen metingen wijzigen en het resultaat wordt met Zod gevalideerd.

## PageSpeed Insights

`PAGESPEED_ENABLED` staat standaard op `false` om het gratis Worker-profiel voorspelbaar te houden. Wanneer je deze instelling op `true` zet, probeert WEBCHECK de PageSpeed API. Wanneer die aanvraag geen bruikbare data oplevert, gaat de deterministische audit gewoon verder.

Voor een eigen key:

```bash
npx wrangler secret put PAGESPEED_API_KEY
```

WEBCHECK verzint nooit LCP-, CLS-, INP- of Lighthousewaarden. Ontbrekende waarden worden als niet gemeten weergegeven.

## D1-opslag en privacy

D1 bewaart:

- auditstatus;
- genormaliseerde bevindingen;
- scores en metrics;
- tijdelijke rapporten;
- anonieme rate-limitcounters.

D1 bewaart geen externe AI-API-key en geen permanente ruwe HTML. Auditrecords verlopen standaard na 60 minuten. Een cron-trigger verwijdert verlopen records.

De browser bewaart het actieve rapport tijdelijk in `sessionStorage`.

## SSRF-bescherming

WEBCHECK:

- accepteert alleen HTTP en HTTPS;
- blokkeert credentials in URL’s;
- blokkeert localhost, interne suffixen en private adressen;
- blokkeert cloudmetadata-adressen;
- valideert A- en AAAA-records via DNS over HTTPS;
- valideert iedere redirectbestemming opnieuw;
- limiteert redirects, responsgrootte en time-outs;
- blijft binnen het oorspronkelijke registrable domain;
- vermijdt bekende logout-, delete-, cart-, checkout- en beheer-URL’s.

Beperking: de Cloudflare Fetch API laat de Worker niet toe om een outboundverbinding expliciet op een vooraf gevalideerd IP-adres vast te pinnen. WEBCHECK controleert daarom DNS voor ieder verzoek en iedere redirect en vermeldt deze platformbeperking in het auditrapport.

## Testen

Volledige lokale controle:

```bash
npm run check
```

Afzonderlijk:

```bash
npm run lint
npm run typecheck
npm test
npm run check:site
npm run build
```

Browsertests:

```bash
npx playwright install chromium
npm run test:e2e
```

De automatische tests gebruiken lokale fixtures en maken in CI geen audits van willekeurige publieke websites.

## Bekende beperkingen

- Automatische toegankelijkheidschecks bewijzen geen volledige WCAG-conformiteit.
- Werkelijke Google-indexering vereist Google Search Console.
- CMS-, plug-in-, thema- en serverupdates vereisen beheer- of hostingtoegang.
- De beveiligingsaudit is passief en is geen penetratietest.
- PageSpeed-resultaten kunnen per meetmoment variëren.
- Cloudflare Workers Free is bedoeld voor begrensde audits; verhoog de crawlgrenzen niet zonder CPU-, subrequest- en D1-gebruik opnieuw te testen.
- Workers AI Free heeft dagelijkse gebruikslimieten; de regelgebaseerde samenvatting blijft daarom altijd beschikbaar.

## Beveiligingsmeldingen

Lees [SECURITY.md](SECURITY.md). Publiceer kwetsbaarheden niet direct in een openbaar issue.

## Bijdragen

Lees [CONTRIBUTING.md](CONTRIBUTING.md).

## Licentie

MIT. Zie [LICENSE](LICENSE).
