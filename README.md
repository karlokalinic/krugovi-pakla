# KRUGOVI PAKLA

A professional, immersive web-art experience that transforms Dante's Inferno into a layered, scroll-driven narrative. This project combines procedural 3D visuals, atmospheric audio, and a protected authoring studio to present an elegant and highly curated interpretation of the nine circles.

## Highlights

- Immersive, interactive storytelling with a physical descent through the circles of hell
- Procedural 3D environments for each circle without relying on heavy media assets
- A protected authoring workspace at `/pilot` for editing, publishing, and organizing the infernal structure
- Accessibility-aware motion handling, responsive layout, and keyboard support
- Production-ready Next.js architecture with TypeScript, ESLint, and a verified build pipeline

## Project status

This repository is being prepared as a polished public release with a professional structure, strong documentation, and a clean development workflow.

## Local development

### Requirements

- Node.js 22+
- npm 10+

### Setup

```bash
npm ci
cp .env.example .env.local
```

For the studio login, configure either a password hash or a local password before running the app.

### Run locally

```bash
npm run dev
```

Open the public experience at http://localhost:3000 and the studio at http://localhost:3000/pilot.

## Verification

The project has been verified with:

```bash
npm run check
```

This runs linting, type checking, and a production build.

## Repository structure

- app/ — Next.js app router pages and API routes
- components/ — interactive experience and UI modules
- lib/ — schemas, storage, and authentication logic
- data/ — default circle content and runtime data
- public/ — static assets and web manifest
- docs/ — narrative and design references

## License

This project is licensed under the MIT License.

- Devet detaljno napisanih Danteovih krugova na hrvatskom.
- Predvorje pakla i završni geometrijski preokret uz Lucifera.
- Proceduralna 3D scenografija za svaki krug.
- WebGPU renderer kada ga preglednik podržava, uz automatski WebGL fallback.
- GSAP ScrollTrigger dramaturgija, vezana uz stvarno mjesto korisnika u dokumentu.
- Generativni Web Audio ambijent koji je inicijalno utišan i aktivira se tek korisničkom radnjom.
- Responzivan prikaz, tipkovni fokus i `prefers-reduced-motion` način rada.
- Bočna navigacija koja prikazuje stvarni redoslijed objavljenih krugova.
- Razvijeni detalji: krivnja, kazna, contrapasso, geografija, osjetila, čuvari, figure i podrazine.
- Zaštićeni `/pilot` studio s prijavom, HTTP-only sesijskim kolačićem i bcrypt lozinkom.
- Dodavanje, dupliciranje, uređivanje, brisanje i promjena redoslijeda svih krugova.
- Objavljivanje i skrivanje pojedinog kruga bez brisanja.
- JSON uvoz i izvoz cijelog pakla.
- Povratak na izvornih devet Danteovih krugova.
- Zod validacija na klijentu pri uvozu i ponovno na poslužitelju pri spremanju.
- Supabase spremanje za produkciju ili lokalna JSON datoteka za razvoj.
- Sigurnosna zaglavlja, provjera podrijetla mutacijskih zahtjeva i ograničavanje pokušaja prijave.
- GitHub Actions provjera za lint, TypeScript i produkcijski build.

## Tehnološki sloj

- Next.js 16 App Router
- React 19
- TypeScript 5
- Three.js, WebGPU/WebGL
- GSAP ScrollTrigger
- Web Audio API
- Supabase PostgreSQL, jedan verzionirani JSON dokument projekta
- Zod
- `jose` JWT sesija
- `bcryptjs`

3D je proceduralan. Projekt zbog toga odmah radi bez gigabajta videa, ne ovisi o tuđim CDN-ovima i ne pretvara početno učitavanje u deveti krug za mobilni internet.

## Jedan korak: provjeri, popravi i pokreni na Windowsu

U korijenu projekta nalazi se:

```text
POKRENI-I-POPRAVI.ps1
```

Pokreni ga desnim klikom **Run with PowerShell** ili iz terminala:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\POKRENI-I-POPRAVI.ps1
```

Skripta se sama ponovno pokreće kao administrator i zatim:

1. provjerava Windows, slobodan prostor, arhitekturu i podršku za duge putove
2. preuzima službeni prijenosni Node.js 22.23.1 samo unutar projekta
3. provjerava SHA-256 arhive prema službenom Node popisu
4. uspoređuje Node i npm s minimalnim projektnim verzijama
5. sigurnosno kopira i prepisuje netočne temeljne konfiguracije
6. provjerava ili ponovno stvara `package-lock.json`
7. pokušava više strategija za `npm ci`, zaključane datoteke i oštećen cache
8. provjerava stvarno instalirane Next, React i TypeScript verzije
9. po potrebi stvara sigurnu lokalnu `.env.local` konfiguraciju i `/pilot` lozinku
10. izvršava ESLint, TypeScript i do tri produkcijska build pokušaja
11. pokreće razvojni server i ostavlja terminal otvoren

Detaljni zapisi nastaju u `repair-logs/`, a stare konfiguracije prije prepisivanja u `repair-backups/`.

Verzija 1.0.2 dodatno popravlja Windows PowerShell 5.1 parsiranje lockfilea,
uklanja privatne registry URL-ove i prisiljava službeni npm registry. Detaljna
dijagnoza nalazi se u [`TROUBLESHOOTING-WINDOWS.md`](./TROUBLESHOOTING-WINDOWS.md).

Zadani razvojni i produkcijski build koriste **Webpack**. Next.js 16 uključuje Turbopack kao zadani bundler, ali ovaj projekt ga ostavlja kao eksplicitnu dijagnostičku opciju:

```bash
npm run dev:turbo
npm run build:turbo
```

Za provjeru i popravak bez pokretanja servera:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\POKRENI-I-POPRAVI.ps1 -DiagnosticsOnly
```

## Lokalno pokretanje

Projekt koristi Node.js 22.

```bash
nvm use
npm ci
cp .env.example .env.local
```

Generiraj hash lozinke:

```bash
npm run hash-password -- "tvoja-duga-lozinka"
```

Skripta ispisuje sirovi hash za nadzorne ploče i posebno escapiranu liniju za `.env.local`. Kopiraj baš lokalnu varijantu, jer Next.js u `.env` datotekama znak `$` pokušava protumačiti kao referencu na drugu varijablu. Primjer:

```dotenv
PILOT_PASSWORD_HASH=\$2b\$12\$...
PILOT_SESSION_SECRET="slucajni-kljuc-od-najmanje-24-znaka"
```

U Vercelovu sučelju unosi se sirovi hash bez obrnutih kosa crta.

Za lokalni razvoj može se privremeno koristiti `PILOT_PASSWORD`, ali samo kada `NODE_ENV` nije `production`.

Pokretanje:

```bash
npm run dev
```

- Javno iskustvo: `http://localhost:3000`
- Studio: `http://localhost:3000/pilot`
- Skriveni prečac iz javnog iskustva: `Alt + Shift + 9`

## Spremanje podataka

### Lokalni razvoj

Bez Supabase varijabli projekt čita zadane podatke iz `data/default-circles.ts`, a promjene iz studija zapisuje u:

```text
data/runtime-circles.json
```

Ta je datoteka u `.gitignore` jer predstavlja radno stanje, a ne izvorni kanon.

### Produkcija i Vercel

Vercelov datotečni sustav nije trajna baza. Za produkciju postavi:

```dotenv
SUPABASE_URL="..."
SUPABASE_SERVICE_ROLE_KEY="..."
```

Zatim u Supabase SQL editoru izvrši:

```text
supabase/schema.sql
```

`SUPABASE_SERVICE_ROLE_KEY` smije postojati samo kao poslužiteljska varijabla. Ne dodavati `NEXT_PUBLIC_` prefiks. Tablica nije dostupna anonimnim ni prijavljenim klijentskim ulogama jer isti dokument može sadržavati skrivene krugove.

## `/pilot` sigurnost

Sama činjenica da ruta nije linkana nije zaštita. Zato studio koristi:

1. bcrypt hash lozinke
2. potpisanu JWT sesiju
3. HTTP-only, `SameSite=Strict` kolačić
4. `Secure` kolačić u produkciji
5. provjeru `Origin` i `Host` zaglavlja za mutacije
6. poslužiteljsku autorizaciju svakog spremanja
7. Zod validaciju i ograničenja veličine sadržaja
8. `noindex`, `nofollow`, `noarchive` zaglavlja
9. osnovno ograničenje pokušaja prijave

U memoriji spremljeno ograničenje prijava dobra je početna zaštita, ali nije distribuirani rate limiter. Za javno izloženu instalaciju većeg prometa smislen je Redis/Upstash ili zaštita na rubu mreže.

## Model podataka

Svaki krug je jedan `InfernoCircle` zapis:

```ts
interface InfernoCircle {
  id: string;
  order: number;
  kind: "dante" | "custom";
  slug: string;
  roman: string;
  title: string;
  subtitle: string;
  canto: string;
  sin: string;
  thesis: string;
  summary: string;
  guilt: string;
  punishment: string;
  contrapasso: string;
  guardians: string[];
  inhabitants: string[];
  geography: string;
  senses: string;
  stageDirection: string;
  visualMode: VisualMode;
  palette: [string, string, string];
  ambient: string;
  subregions: Subregion[];
  published: boolean;
  updatedAt: string;
}
```

Javna stranica nikada ne pretpostavlja devet elemenata. Prikazuje objavljene zapise u poslužiteljski normaliziranom redoslijedu. Time novi autorski krug zaista postaje dodatni sloj pada, umjesto da bude ukras zalijepljen ispod hardkodiranog frontenda.

## Rad s Gitom

Projekt je pripremljen kao zaseban repozitorij. Standardni tijek:

```bash
git init
git add .
git commit -m "feat: izgradi interaktivne Krugove pakla"
git branch -M main
git remote add origin git@github.com:KORISNIK/krugovi-pakla.git
git push -u origin main
```

CI se nalazi u `.github/workflows/ci.yml`.

## Provjera prije pusha

```bash
npm run check
npm audit
```

`npm run check` izvršava ESLint, TypeScript provjeru i produkcijski build.

## Autorski i povijesni okvir

Danteova *Božanstvena komedija* je povijesno djelo i izvorna struktura koristi srednjovjekovnu katoličku kozmologiju. Projekt ne skriva problematične povijesne kategorije, ali ih kontekstualizira umjesto da ih predstavlja kao suvremenu etičku normu. Posebno su označene Danteove osude istospolnih odnosa, drugih religija i nevjernika.

Tekstovi u ovom projektu nisu preuzeti prijevod Dantea. Riječ je o originalnim hrvatskim opisima i interpretacijama, što izbjegava i estetsku lijenost i sasvim nepotreban autorskopravni pakao.

## Istraživačke reference

Projekt uzima metodološku inspiraciju, ne vizualne kopije, iz sljedećih područja:

- Danteov `contrapasso` kao dramaturški podatkovni model
- SBS-ov interaktivni grafički roman *The Boat*
- WebGL i eksperimentalna tipografija nagrađivanih Awwwards projekata
- Resnovi interaktivni eksperimenti
- scroll-pripovijedanje koje sinkronizira kameru, zvuk i tekst
- proceduralna grafika koja smanjuje ovisnost o gotovim medijskim assetima

Vidi i `docs/NARATIVNA-BIBLIJA.md`.

## Poznate granice ove verzije

- Nema ugrađenog binarnog upload sustava za video i slike. Za to je predviđen sljedeći adapter, primjerice Supabase Storage ili Cloudinary.
- Proceduralni zvuk nije studijski miks i svjesno je tih.
- In-memory rate limit nije globalan između više serverless instanci.
- WebGPU podrška ovisi o pregledniku i uređaju, zato postoji WebGL fallback.
- Projekt ne koristi CMS s više korisnika. `/pilot` je namjerno vlasnički studio za jednog autora.
