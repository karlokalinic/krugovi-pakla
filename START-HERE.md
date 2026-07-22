# Krugovi pakla — start guide

## Brzi start
- Double-click RUNME.bat
- Or run: powershell -NoProfile -ExecutionPolicy Bypass -File .\START-APP.ps1

## What it does
- Installs dependencies if needed
- Starts the Next.js dev server
- Opens the app on port 3000

## URLs
- App: http://localhost:3000
- Pilot studio: http://localhost:3000/pilot

## Notes
- Default pilot password is configured in .env.local
- For diagnostics use: powershell -NoProfile -ExecutionPolicy Bypass -File .\POKRENI-I-POPRAVI.ps1 -DiagnosticsOnly
