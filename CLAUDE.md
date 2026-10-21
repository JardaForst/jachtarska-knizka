# Lodní deník – Námořní klub

Digitální lodní deník pro jachtaře, členy Námořního klubu (IFP Publishing / Krása jachtingu).
Webová aplikace (PWA): instaluje se z webu na plochu telefonu, funguje offline, exportuje do Excelu.
Vlastník projektu: Jarda Foršt (IFP). Komunikace a celé uživatelské rozhraní je česky.

## Struktura

- `src/app.html` – celá aplikace v jednom souboru (HTML + CSS + JS, bez knihoven).
  - Značka `<!--/HEAD-->` odděluje část do `<head>` od těla; používá ji `build.mjs`.
  - Blok mezi `// XLSX-START` a `// XLSX-END` je čistá logika bez DOM: vlastní zápis .xlsx
    (ZIP + SpreadsheetML), výpočty souhrnů, ukázková data. Testuje ho `tools/test-export.mjs`.
- `src/sw.js` – service worker (offline). **Při každé změně aplikace zvýšit `VERSION`.**
- `src/manifest.webmanifest`, `src/icons/` – instalace na plochu.
- `build.mjs` – sestaví `dist/lodni-denik/` (nahrát na web přes FTP) a `dist/nahled.html`.
- `dist/` se necommituje.
- Repozitář je veřejný: https://github.com/JardaForst/lodni-denik. Push do `main` spustí
  `.github/workflows/pages.yml` a nasadí zkušební verzi na https://jardaforst.github.io/lodni-denik/.
  Do commitů nepsat osobní údaje; autor commitů používá noreply e-mail GitHubu.

## Příkazy

- `node build.mjs` – sestavení
- `node tools/test-export.mjs` – test exportu a souhrnů
- Lokální zkouška: `npx serve dist/lodni-denik` nebo `python -m http.server -d dist/lodni-denik`

## Data

- Ukládají se v `localStorage` pod klíčem `ifp-lodni-denik-v1` jako `{voyages, legs, meta}`.
  Formát neměnit bez migrace – uživatelé mají data jen v telefonu.
- Plavba (voyage): name, boat, boatType, length, area, kind, skipper, crew, role, from, to, notes, sample.
- Etapa (leg): voyageId, date, dep, arr, from, to, nm, motorH, nightH, windDir, bft, sea, pos, notes.
  Čísla se ukládají jako text (česká desetinná čárka), převádí je funkce `n()`.
- Záloha = JSON soubor; obnova slučuje podle `id`.

## Zásady

- Žádné závislosti a žádný build krok uvnitř aplikace – musí fungovat offline z jednoho souboru.
- Ukládání souborů jde přes `saveFile()`: v náhledu na claude.ai přes `window.claude.use('downloads')`,
  v telefonu přes sdílení souboru, jinde klasické stažení. Zachovat všechny tři cesty.
- Mobil na prvním místě, šířka od 360 px, světlý i tmavý režim přes CSS proměnné v `:root`.
- Texty v aplikaci píšeme česky, srozumitelně pro jachtaře, ne programátorsky.

## Možný další vývoj (verze 2)

- Synchronizace dat na server a přihlášení přes členství v Circle.
- Více zápisů během dne (hodinové záznamy), fotky, PDF výpis praxe pro zkoušky.
- Distribuce do App Storu / Google Play zabalením stávajícího kódu.
