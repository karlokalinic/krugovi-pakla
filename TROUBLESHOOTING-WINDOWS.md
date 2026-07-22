# Windows popravak: ETARGET, package-lock i Turbopack

## Što je bilo pogrešno u verziji 1.0.1

Problem nije bio samo Turbopack.

1. Windows PowerShell 5.1 ne može pouzdano pretvoriti npm lockfile preko
   `ConvertFrom-Json` zato što `packages` sadrži obvezni prazni ključ `""`.
   Skripta je zato valjani `package-lock.json` pogrešno proglasila nečitljivim.

2. Lockfile je bio izrađen u izoliranom build okruženju i sadržavao je privatne
   Artifactory URL-ove. Ti URL-ovi nisu dostupni na običnom računalu.

3. `$ErrorActionPreference = 'Stop'` pretvarao je npm-ov standardni error stream
   u PowerShell iznimku nakon prve retke. Log je zato prikazivao samo `ETARGET`,
   ali ne i puni naziv problematičnog paketa i sve npm detalje.

4. npm nije bio prisiljen koristiti službeni registry, pa je korisnička ili
   globalna `.npmrc` konfiguracija mogla usmjeriti instalaciju na zastarjeli
   mirror.

## Što radi verzija 1.0.2

- lockfile validira pomoću lokalnog Node.js procesa
- prije promjene izrađuje sigurnosnu kopiju
- privatne registry URL-ove zamjenjuje službenim npm URL-ovima
- koristi zaseban projektni npm cache
- prisiljava `https://registry.npmjs.org/`
- koristi `replace-registry-host=always`
- ne briše postojeći lockfile dok novi nije potpuno izrađen i provjeren
- pri obnovi prvo provjerava svaku izravno prikvačenu verziju
- zapisuje puni stdout i stderr nativnih naredbi
- za razvoj i produkcijski build koristi Webpack
- Turbopack pokreće samo kao posljednju usporednu dijagnostiku

## Preporučeno pokretanje

Projekt raspakiraj u kratak put, primjerice:

```text
C:\Projekti\krugovi-pakla
```

Zatim pokreni:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\POKRENI-I-POPRAVI.ps1
```

Za samostalnu provjeru bez servera:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\POKRENI-I-POPRAVI.ps1 -DiagnosticsOnly
```

Nemoj kopirati novi ZIP preko starog `node_modules` direktorija. Raspakiraj ga u
novu mapu ili izbriši stari `node_modules`, `.next` i `.tools/npm-cache`.
Skripta će ih po potrebi sama ponovno izraditi.
