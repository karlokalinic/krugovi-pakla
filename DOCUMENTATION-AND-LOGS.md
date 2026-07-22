# Krugovi pakla — consolidated documentation

## Quick start
1. Double-click RUNME.bat
2. Or run: powershell -NoProfile -ExecutionPolicy Bypass -File .\START-APP.ps1
3. Open http://localhost:3000

## Project status
- Build status: passing
- Runtime launcher: available via START-APP.ps1 and RUNME.bat
- Main entry points:
  - App: / 
  - Pilot studio: /pilot

## Repair and troubleshooting notes
- Repair scripts: POKRENI-I-POPRAVI.ps1
- Windows troubleshooting: TROUBLESHOOTING-WINDOWS.md
- Repair logs: repair-logs/
- Repair backups: repair-backups/

## Common commands
- npm install --engine-strict=false
- npm run build
- npm run dev
- powershell -NoProfile -ExecutionPolicy Bypass -File .\POKRENI-I-POPRAVI.ps1 -DiagnosticsOnly

## Important notes
- The project was verified with a successful production build.
- The launcher uses the existing Next.js dev server and is intended to be the single starting point for local development.
