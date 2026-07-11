# Bijdragen aan WEBCHECK

## Ontwikkelproces

1. Fork of clone de repository.
2. Maak een gerichte featurebranch.
3. Installeer dependencies met `npm install`.
4. Genereer Cloudflare-types met `npm run cf:typegen`.
5. Werk code en tests samen bij.
6. Voer `npm run check` uit.
7. Open een pull request met scope, risico’s en testresultaten.

## Kwaliteitseisen

Een wijziging moet:

- TypeScript strict doorstaan;
- deterministisch blijven waar AI niet nodig is;
- iedere bevinding voorzien van bewijs, impact, oplossing en acceptatiecriterium;
- geen meetwaarden of kwetsbaarheden verzinnen;
- de gratis Worker-limieten respecteren;
- de SSRF-bescherming behouden;
- mobiel en toetsenbordvriendelijk blijven;
- geen geheimen of echte testdata toevoegen.

## Auditregels

Nieuwe automatische regels moeten:

- zo weinig mogelijk false positives veroorzaken;
- `confirmed`, `likely` of `manual-review-required` correct gebruiken;
- een stabiele subcategorie hebben;
- worden meegenomen in unit tests;
- geen actieve of destructieve tests uitvoeren.

## Cloudflare-architectuur

Vermijd één lange Worker-aanroep. Zwaardere controles moeten als afzonderlijke state-machinefase of begrensde batch worden uitgevoerd en veilig in D1 worden opgeslagen.

Cloudflare Workers AI blijft optioneel. Nieuwe functies mogen de deterministische audit of regelgebaseerde samenvatting nooit afhankelijk maken van AI.
