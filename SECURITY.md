# Security Policy

## Ondersteunde versie

Beveiligingsupdates worden toegepast op de actuele `main`-branch.

## Een kwetsbaarheid melden

Publiceer geen exploiteerbare details, API-tokens, geheime waarden of persoonsgegevens in een openbaar GitHub-issue.

Meld een probleem via GitHub Private Vulnerability Reporting wanneer dit voor de repository is ingeschakeld. Vermeld:

- betrokken route of module;
- reproduceerbare stappen;
- impact;
- noodzakelijke voorwaarden;
- een veilige oplossingsrichting;
- geen echte geheimen of persoonsgegevens.

## Security boundaries

WEBCHECK is een passieve publieke website-auditor en geen penetratietesttool. De applicatie mag niet worden uitgebreid met brute force, injectiepayloads, uploads, portscans, accountcreatie, betaaltests of authenticatieomzeiling.

## SSRF-eisen

Wijzigingen aan URL- of fetchlogica moeten minimaal behouden:

- alleen HTTP(S);
- geen credentials in URL’s;
- blokkering van localhost, private, gereserveerde, link-local en metadata-adressen;
- DNS-validatie voor iedere doelhost;
- hervalidatie van iedere redirect;
- redirect-, time-out- en responsgroottelimieten;
- gecontroleerde contenttypes;
- blokkering van vermoedelijk toestandwijzigende crawl-URL’s.

## Geheimen

Geheimen worden uitsluitend ingesteld met Cloudflare Secrets of GitHub Actions Secrets. Zet nooit `IP_HASH_SALT`, PageSpeed-keys of Cloudflare-tokens in:

- `wrangler.jsonc`;
- `site/config.js`;
- `.env.example`;
- commits;
- issues;
- logs of screenshots.

## Cloudflare Workers AI

Workers AI is standaard uitgeschakeld. De AI-laag mag alleen genormaliseerde bevindingen en meetdata ontvangen en mag nooit feitelijke metingen wijzigen. Ongeldige AI-uitvoer moet worden afgewezen en de regelgebaseerde samenvatting moet beschikbaar blijven.
