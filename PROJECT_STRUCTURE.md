# Projectstructuur

```text
webcheckfree.github.io/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   ├── workflows/
│   │   ├── ci.yml
│   │   ├── pages.yml
│   │   └── worker.yml
│   ├── dependabot.yml
│   └── pull_request_template.md
├── migrations/
│   └── 0001_initial.sql
├── public/
├── scripts/
│   ├── check-site.mjs
│   └── serve-site.mjs
├── site/
│   ├── js/
│   │   ├── api.js
│   │   ├── app.js
│   │   ├── exports.js
│   │   ├── report.js
│   │   └── templates.js
│   ├── config.js
│   ├── index.html
│   ├── styles.css
│   └── manifest.webmanifest
├── src/
│   ├── config/
│   │   └── audit.ts
│   ├── lib/
│   │   ├── audit/
│   │   └── export/
│   ├── schemas/
│   ├── types/
│   └── worker/
│       ├── ai/
│       │   └── workers-ai.ts
│       ├── audit/
│       │   ├── engine.ts
│       │   ├── links.ts
│       │   ├── page.ts
│       │   ├── pagespeed.ts
│       │   ├── robots.ts
│       │   ├── security.ts
│       │   ├── sitemap.ts
│       │   └── summary.ts
│       ├── http/
│       │   └── safe-fetch.ts
│       ├── security/
│       │   └── url.ts
│       ├── storage/
│       │   └── d1.ts
│       ├── config.ts
│       ├── errors.ts
│       ├── index.ts
│       └── types.ts
├── tests/
├── DEPLOYMENT_CLOUDFLARE.md
├── .env.example
├── eslint.config.mjs
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── worker-configuration.d.ts
├── wrangler.local.jsonc
└── wrangler.jsonc
```

## Verantwoordelijkheden

### `site/`

Dependencyvrije statische frontend voor GitHub Pages. De Pages-workflow vervangt tijdens deployment de API-placeholder in `site/config.js` door `WEBCHECK_API_BASE_URL`.

### `src/lib/audit/`

Pure deterministische analysefuncties voor performance, UX, toegankelijkheid, SEO en security. Deze modules kennen geen D1, HTTP-router of UI.

### `src/worker/audit/engine.ts`

Orkestreert de audit-state-machine. Iedere API-aanroep verwerkt één begrensde stap en bewaart vervolgens de status in D1.

### `src/worker/security/` en `http/`

URL-normalisatie, DNS-validatie, SSRF-blokkering, redirecthercontrole, time-outs, contenttype- en responsgroottelimieten.

### `src/worker/storage/d1.ts`

Tijdelijke auditjobs, rapporten, optimistische concurrency, rate limits en cleanup.

### `src/worker/ai/workers-ai.ts`

Optionele Cloudflare Workers AI-integratie met gestructureerde JSON-uitvoer en Zod-validatie. De regelgebaseerde samenvatting in `summary.ts` blijft de standaard en fallback.

### `wrangler.local.jsonc`

Lokale Worker- en D1-configuratie zonder remote Workers AI-binding. Hiermee kan de deterministische audit lokaal worden ontwikkeld zonder Cloudflare-account zolang AI uitgeschakeld blijft.
