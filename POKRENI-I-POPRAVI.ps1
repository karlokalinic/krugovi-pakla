#requires -version 5.1
<#
KRUGOVI PAKLA - samostalni Windows popravak i pokretanje

Pokretanje:
  Desni klik -> Run with PowerShell

Skripta se sama ponovno pokreće kao administrator, koristi službeni prijenosni
Node.js, provjerava SHA-256, popravlja temeljne konfiguracije, instalira točno
zaključane ovisnosti, pokreće lint/typecheck/build i zatim razvojni server.
#>

[CmdletBinding()]
param(
    [switch]$NoBrowser,
    [switch]$DiagnosticsOnly
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# -----------------------------------------------------------------------------
# 1. Samopodizanje administratorskih ovlasti
# -----------------------------------------------------------------------------
$currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)
$isAdministrator = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdministrator) {
    Write-Host 'Ponovno pokrećem skriptu kao administrator...' -ForegroundColor Yellow

    $elevatedArgs = @(
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', ('"{0}"' -f $PSCommandPath)
    )

    if ($NoBrowser) { $elevatedArgs += '-NoBrowser' }
    if ($DiagnosticsOnly) { $elevatedArgs += '-DiagnosticsOnly' }

    try {
        Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $elevatedArgs -WorkingDirectory (Split-Path -Parent $PSCommandPath) | Out-Null
    }
    catch {
        Write-Host 'Administratorsko pokretanje je odbijeno ili nije uspjelo.' -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        Read-Host 'Pritisni Enter za zatvaranje'
    }
    exit
}

# -----------------------------------------------------------------------------
# 2. Stalne vrijednosti i logiranje
# -----------------------------------------------------------------------------
$ProjectRoot = Split-Path -Parent $PSCommandPath
Set-Location -LiteralPath $ProjectRoot

$NodeVersion = '22.23.1'
$MinimumNodeVersion = [version]'22.12.0'
$MaximumNodeVersion = [version]'23.0.0'
$MinimumNpmVersion = [version]'10.9.0'
$ExpectedNextVersion = '16.2.10'
$ExpectedReactVersion = '19.2.7'
$OfficialRegistry = 'https://registry.npmjs.org/'
$Timestamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$LogDirectory = Join-Path $ProjectRoot 'repair-logs'
$BackupDirectory = Join-Path $ProjectRoot (Join-Path 'repair-backups' $Timestamp)
$ToolsDirectory = Join-Path $ProjectRoot '.tools'
$NodeFolderName = 'node-v{0}-win-{1}' -f $NodeVersion, $(if ($env:PROCESSOR_ARCHITECTURE -match 'ARM64') { 'arm64' } else { 'x64' })
$NodeDirectory = Join-Path $ToolsDirectory $NodeFolderName
$NodeExecutable = Join-Path $NodeDirectory 'node.exe'
$NpmExecutable = Join-Path $NodeDirectory 'npm.cmd'
$NpmCacheDirectory = Join-Path $ToolsDirectory 'npm-cache'
$NpmCommonArguments = @("--registry=$OfficialRegistry", "--cache=$NpmCacheDirectory", '--prefer-online')
$LogFile = Join-Path $LogDirectory ('popravak-{0}.log' -f $Timestamp)
$TranscriptFile = Join-Path $LogDirectory ('transcript-{0}.txt' -f $Timestamp)

New-Item -ItemType Directory -Force -Path $LogDirectory, $BackupDirectory, $ToolsDirectory, $NpmCacheDirectory | Out-Null

try {
    Start-Transcript -Path $TranscriptFile -Force | Out-Null
}
catch {
    # Neke zaključane PowerShell konfiguracije ne dopuštaju transcript. Vlastiti log i dalje radi.
}

function Write-Log {
    param(
        [Parameter(Mandatory = $true)][string]$Message,
        [ValidateSet('INFO', 'OK', 'WARN', 'ERROR', 'STEP')][string]$Level = 'INFO'
    )

    $line = '[{0}] [{1}] {2}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Level, $Message
    Add-Content -LiteralPath $LogFile -Value $line -Encoding UTF8

    switch ($Level) {
        'OK'    { Write-Host $line -ForegroundColor Green }
        'WARN'  { Write-Host $line -ForegroundColor Yellow }
        'ERROR' { Write-Host $line -ForegroundColor Red }
        'STEP'  { Write-Host "`n$line" -ForegroundColor Cyan }
        default { Write-Host $line }
    }
}

function Stop-TranscriptSafely {
    try { Stop-Transcript | Out-Null } catch { }
}

function Exit-WithPause {
    param([int]$Code, [string]$Message)

    if ($Code -eq 0) {
        Write-Log $Message 'OK'
    }
    else {
        Write-Log $Message 'ERROR'
    }

    Write-Host "`nGlavni log: $LogFile" -ForegroundColor White
    Write-Host "Transcript: $TranscriptFile" -ForegroundColor White
    Stop-TranscriptSafely
    Read-Host 'Pritisni Enter za zatvaranje terminala'
    exit $Code
}

function Invoke-Native {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [string[]]$Arguments = @(),
        [string]$Description = $FilePath,
        [switch]$AllowFailure,
        [hashtable]$Environment = @{}
    )

    Write-Log ("Pokrećem: {0} {1}" -f $FilePath, ($Arguments -join ' ')) 'INFO'

    $oldEnvironment = @{}
    foreach ($key in $Environment.Keys) {
        $oldEnvironment[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
        [Environment]::SetEnvironmentVariable($key, [string]$Environment[$key], 'Process')
    }

    $previousErrorActionPreference = $ErrorActionPreference
    try {
        # Windows PowerShell 5.1 pretvara stderr nativnih programa u ErrorRecord.
        # Uz globalni Stop to prekida npm nakon prve retke i skriva stvarni uzrok.
        $ErrorActionPreference = 'Continue'
        & $FilePath @Arguments 2>&1 | ForEach-Object {
            $lineText = $_.ToString()
            Write-Host $lineText
            Add-Content -LiteralPath $LogFile -Value $lineText -Encoding UTF8
        }
        $exitCode = $LASTEXITCODE
    }
    catch {
        $exitCode = 9001
        Write-Log ("Iznimka pri izvršavanju '{0}': {1}" -f $Description, $_.Exception.Message) 'ERROR'
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
        foreach ($key in $Environment.Keys) {
            [Environment]::SetEnvironmentVariable($key, $oldEnvironment[$key], 'Process')
        }
    }

    if ($null -eq $exitCode) { $exitCode = 0 }

    if ($exitCode -eq 0) {
        Write-Log ("Uspješno: {0}" -f $Description) 'OK'
        return $true
    }

    Write-Log ("Neuspješno ({0}): {1}" -f $exitCode, $Description) 'ERROR'
    if (-not $AllowFailure) {
        throw "Naredba nije uspjela: $Description"
    }
    return $false
}

function Remove-PathSafely {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (Test-Path -LiteralPath $Path) {
        Write-Log "Brišem radni artefakt: $Path" 'INFO'
        try {
            Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
        }
        catch {
            Write-Log "Prvo brisanje nije uspjelo: $($_.Exception.Message)" 'WARN'
            Start-Sleep -Seconds 2
            cmd.exe /c "attrib -R -S -H `"$Path`" /S /D 2>nul & rmdir /S /Q `"$Path`" 2>nul" | Out-Null
        }
    }
}

function Stop-StaleProjectNodeProcesses {
    Write-Log 'Tražim zastarjele Node procese vezane uz ovaj projekt.' 'INFO'
    try {
        $escapedRoot = [Regex]::Escape($ProjectRoot)
        $processes = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction Stop
        foreach ($process in $processes) {
            if ($process.CommandLine -and $process.CommandLine -match $escapedRoot) {
                Write-Log ("Zaustavljam zaključani Node proces PID {0}." -f $process.ProcessId) 'WARN'
                Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
            }
        }
    }
    catch {
        Write-Log "Nisam mogao pregledati Node procese: $($_.Exception.Message)" 'WARN'
    }
}

function Backup-File {
    param([Parameter(Mandatory = $true)][string]$RelativePath)

    $source = Join-Path $ProjectRoot $RelativePath
    if (Test-Path -LiteralPath $source) {
        $destination = Join-Path $BackupDirectory $RelativePath
        $destinationParent = Split-Path -Parent $destination
        New-Item -ItemType Directory -Force -Path $destinationParent | Out-Null
        Copy-Item -LiteralPath $source -Destination $destination -Force
        Write-Log "Sigurnosna kopija: $RelativePath" 'INFO'
    }
}

function Set-CanonicalTextFile {
    param(
        [Parameter(Mandatory = $true)][string]$RelativePath,
        [Parameter(Mandatory = $true)][string]$ExpectedContent
    )

    $path = Join-Path $ProjectRoot $RelativePath
    $normalizedExpected = ($ExpectedContent -replace "`r`n", "`n").TrimEnd() + "`n"
    $current = ''

    if (Test-Path -LiteralPath $path) {
        $current = ([IO.File]::ReadAllText($path) -replace "`r`n", "`n").TrimEnd() + "`n"
    }

    if ($current -ceq $normalizedExpected) {
        Write-Log "Točna konfiguracija: $RelativePath" 'OK'
        return $false
    }

    Backup-File $RelativePath
    $parent = Split-Path -Parent $path
    if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
    $utf8NoBom = New-Object System.Text.UTF8Encoding -ArgumentList $false
    [IO.File]::WriteAllText($path, $normalizedExpected, $utf8NoBom)
    Write-Log "Prepisana kanonska konfiguracija: $RelativePath" 'WARN'
    return $true
}

function Get-SemVer {
    param([string]$Text)
    try {
        $clean = ($Text.Trim() -replace '^[vV]', '')
        return [version]$clean
    }
    catch {
        return [version]'0.0.0'
    }
}

function Download-FileRobustly {
    param([string]$Uri, [string]$Destination)

    Write-Log "Preuzimam: $Uri" 'INFO'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

    for ($attempt = 1; $attempt -le 3; $attempt++) {
        try {
            Invoke-WebRequest -UseBasicParsing -Uri $Uri -OutFile $Destination -TimeoutSec 180
            if ((Test-Path -LiteralPath $Destination) -and ((Get-Item -LiteralPath $Destination).Length -gt 0)) {
                Write-Log "Preuzimanje uspjelo u pokušaju $attempt." 'OK'
                return
            }
        }
        catch {
            Write-Log "Pokušaj $attempt nije uspio: $($_.Exception.Message)" 'WARN'
            Start-Sleep -Seconds (2 * $attempt)
        }
    }

    if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
        $ok = Invoke-Native -FilePath 'curl.exe' -Arguments @('-fL', '--retry', '3', '--connect-timeout', '30', '-o', $Destination, $Uri) -Description 'rezervno curl preuzimanje' -AllowFailure
        if ($ok -and (Test-Path -LiteralPath $Destination)) { return }
    }

    throw "Nije moguće preuzeti $Uri"
}

function Ensure-PortableNode {
    Write-Log "Provjeravam prijenosni Node.js $NodeVersion." 'STEP'

    if (Test-Path -LiteralPath $NodeExecutable) {
        $installedText = (& $NodeExecutable --version 2>$null)
        $installedVersion = Get-SemVer $installedText
        if ($installedVersion -eq [version]$NodeVersion) {
            Write-Log "Pronađen provjereni Node.js $installedText." 'OK'
            return
        }
        Write-Log "Lokalni Node ima pogrešnu verziju $installedText; ponovno ga postavljam." 'WARN'
        Remove-PathSafely $NodeDirectory
    }

    $architecture = if ($env:PROCESSOR_ARCHITECTURE -match 'ARM64') { 'arm64' } else { 'x64' }
    $archiveName = "node-v$NodeVersion-win-$architecture.zip"
    $downloadBase = "https://nodejs.org/dist/v$NodeVersion"
    $archivePath = Join-Path $ToolsDirectory $archiveName
    $checksumsPath = Join-Path $ToolsDirectory "SHASUMS256-v$NodeVersion.txt"

    Download-FileRobustly "$downloadBase/$archiveName" $archivePath
    Download-FileRobustly "$downloadBase/SHASUMS256.txt" $checksumsPath

    $checksumLine = Get-Content -LiteralPath $checksumsPath | Where-Object { $_ -match ([Regex]::Escape($archiveName) + '$') } | Select-Object -First 1
    if (-not $checksumLine) {
        throw "Službeni SHA-256 zapis za $archiveName nije pronađen."
    }

    $expectedHash = ($checksumLine -split '\s+')[0].ToUpperInvariant()
    $actualHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToUpperInvariant()

    if ($expectedHash -ne $actualHash) {
        Remove-Item -LiteralPath $archivePath -Force -ErrorAction SilentlyContinue
        throw "SHA-256 se ne podudara. Očekivano $expectedHash, dobiveno $actualHash."
    }
    Write-Log 'SHA-256 službenog Node arhiva je točan.' 'OK'

    Expand-Archive -LiteralPath $archivePath -DestinationPath $ToolsDirectory -Force
    if (-not (Test-Path -LiteralPath $NodeExecutable)) {
        throw 'Node arhiva je raspakirana, ali node.exe nije pronađen.'
    }

    $verifiedVersion = Get-SemVer (& $NodeExecutable --version)
    if ($verifiedVersion -ne [version]$NodeVersion) {
        throw "Raspakirani Node ima neočekivanu verziju $verifiedVersion."
    }

    Remove-Item -LiteralPath $archivePath, $checksumsPath -Force -ErrorAction SilentlyContinue
    Write-Log "Postavljen službeni prijenosni Node.js v$NodeVersion." 'OK'
}

function Assert-ToolVersions {
    Write-Log 'Provjeravam temeljne verzije.' 'STEP'

    $nodeVersionText = (& $NodeExecutable --version).Trim()
    $npmVersionText = (& $NpmExecutable --version).Trim()
    $nodeVersion = Get-SemVer $nodeVersionText
    $npmVersion = Get-SemVer $npmVersionText

    Write-Log "Node: $nodeVersionText; potrebno >= $MinimumNodeVersion i < $MaximumNodeVersion" 'INFO'
    Write-Log "npm: v$npmVersionText; potrebno >= $MinimumNpmVersion" 'INFO'

    if ($nodeVersion -lt $MinimumNodeVersion -or $nodeVersion -ge $MaximumNodeVersion) {
        throw "Node verzija $nodeVersion nije u podržanom rasponu."
    }
    if ($npmVersion -lt $MinimumNpmVersion) {
        throw "npm verzija $npmVersion je prestara."
    }

    $env:Path = "$NodeDirectory;$env:Path"
    $env:NEXT_TELEMETRY_DISABLED = '1'
    $env:NPM_CONFIG_REGISTRY = $OfficialRegistry
    $env:NPM_CONFIG_REPLACE_REGISTRY_HOST = 'always'
    $env:NPM_CONFIG_PREFER_ONLINE = 'true'
    $env:NPM_CONFIG_CACHE = $NpmCacheDirectory
    Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
    Write-Log 'Node i npm zadovoljavaju projektne uvjete.' 'OK'
}

function Repair-WindowsFoundation {
    Write-Log 'Provjeravam Windows temelj.' 'STEP'

    try {
        $os = Get-CimInstance Win32_OperatingSystem
        Write-Log ("Windows: {0} {1}; arhitektura: {2}" -f $os.Caption, $os.Version, $env:PROCESSOR_ARCHITECTURE) 'INFO'
    }
    catch {
        Write-Log 'Nije moguće očitati detalje operacijskog sustava.' 'WARN'
    }

    $driveName = (Get-Item -LiteralPath $ProjectRoot).PSDrive.Name
    $drive = Get-PSDrive -Name $driveName
    $freeGB = [math]::Round($drive.Free / 1GB, 2)
    Write-Log "Slobodno na disku $driveName`: $freeGB GB" 'INFO'
    if ($freeGB -lt 2) { throw 'Potrebno je barem 2 GB slobodnog prostora.' }

    try {
        $registryPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem'
        $longPaths = (Get-ItemProperty -Path $registryPath -Name LongPathsEnabled -ErrorAction SilentlyContinue).LongPathsEnabled
        if ($longPaths -ne 1) {
            Set-ItemProperty -Path $registryPath -Name LongPathsEnabled -Type DWord -Value 1
            Write-Log 'Omogućeni su Windows dugi putovi. Ponovno pokretanje Windowsa ponekad je potrebno da ih svi programi prihvate.' 'WARN'
        }
        else {
            Write-Log 'Windows dugi putovi već su omogućeni.' 'OK'
        }
    }
    catch {
        Write-Log "Nisam mogao postaviti LongPathsEnabled: $($_.Exception.Message)" 'WARN'
    }

    if ($ProjectRoot.Length -gt 140) {
        Write-Log "Put projekta je vrlo dug ($($ProjectRoot.Length) znakova). Skripta će raditi, ali preporučena lokacija je npr. C:\Projekti\krugovi-pakla." 'WARN'
    }
    if ($ProjectRoot -match '[^\x00-\x7F]') {
        Write-Log 'Put projekta sadrži znakove izvan ASCII skupa. Većina alata ih podržava, ali stari Windows pomoćni programi ponekad ne.' 'WARN'
    }
}

function Repair-CanonicalConfiguration {
    Write-Log 'Provjeravam i po potrebi prepisujem temeljne projektne datoteke.' 'STEP'

    $packageJson = @'
{
  "name": "krugovi-pakla",
  "version": "1.0.2",
  "private": true,
  "scripts": {
    "dev": "next dev --webpack",
    "dev:turbo": "next dev --turbopack",
    "build": "next build --webpack",
    "build:turbo": "next build --turbopack",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "hash-password": "node scripts/hash-password.mjs",
    "check": "npm run lint && npm run typecheck && npm run build",
    "doctor": "powershell -NoProfile -ExecutionPolicy Bypass -File ./POKRENI-I-POPRAVI.ps1 -DiagnosticsOnly"
  },
  "dependencies": {
    "@supabase/supabase-js": "2.110.7",
    "bcryptjs": "3.0.2",
    "gsap": "3.15.0",
    "jose": "6.1.3",
    "next": "16.2.10",
    "react": "19.2.7",
    "react-dom": "19.2.7",
    "three": "0.185.1",
    "zod": "4.3.6"
  },
  "devDependencies": {
    "@types/node": "24.10.1",
    "@types/react": "19.2.14",
    "@types/react-dom": "19.2.3",
    "@types/three": "0.181.0",
    "eslint": "9.39.2",
    "eslint-config-next": "16.2.10",
    "typescript": "5.9.3"
  },
  "overrides": {
    "postcss": "8.5.10"
  },
  "engines": {
    "node": ">=22.12 <23",
    "npm": ">=10.9"
  },
  "packageManager": "npm@10.9.8"
}
'@

    $nextConfig = @'
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: {
    // Sprječava pogrešno određivanje workspace root direktorija kada iznad
    // projekta postoji drugi package-lock.json.
    root: process.cwd()
  },
  async headers() {
    return [
      {
        source: "/pilot/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Cache-Control", value: "no-store" }
        ]
      },
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }
        ]
      }
    ];
  }
};

export default nextConfig;
'@

    $tsConfig = @'
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
'@

    $eslintConfig = @'
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  globalIgnores([
    ".next/**",
    ".tools/**",
    "repair-backups/**",
    "repair-logs/**",
    "node_modules/**",
    "out/**",
    "coverage/**",
    "next-env.d.ts"
  ])
]);
'@

    $npmRc = @'
registry=https://registry.npmjs.org/
replace-registry-host=always
engine-strict=true
save-exact=true
fund=false
audit=true
prefer-online=true
fetch-retries=5
fetch-retry-factor=2
fetch-retry-mintimeout=20000
fetch-retry-maxtimeout=120000
'@

    $nvmrc = "22.23.1`n"

    $gitIgnore = @'
node_modules
.next
out
.env
.env.local
.env.*.local
coverage
*.log
data/runtime-circles.json
.DS_Store
*.tsbuildinfo
.tools
repair-backups
repair-logs
'@

    $changed = $false
    if (Set-CanonicalTextFile 'package.json' $packageJson) { $changed = $true }
    if (Set-CanonicalTextFile 'next.config.ts' $nextConfig) { $changed = $true }
    if (Set-CanonicalTextFile 'tsconfig.json' $tsConfig) { $changed = $true }
    if (Set-CanonicalTextFile 'eslint.config.mjs' $eslintConfig) { $changed = $true }
    if (Set-CanonicalTextFile '.npmrc' $npmRc) { $changed = $true }
    if (Set-CanonicalTextFile '.nvmrc' $nvmrc) { $changed = $true }
    if (Set-CanonicalTextFile '.gitignore' $gitIgnore) { $changed = $true }

    try {
        $parsedPackage = Get-Content -LiteralPath (Join-Path $ProjectRoot 'package.json') -Raw | ConvertFrom-Json
        if ($parsedPackage.dependencies.next -ne $ExpectedNextVersion -or $parsedPackage.dependencies.react -ne $ExpectedReactVersion) {
            throw 'package.json nakon popravka nema očekivane Next/React verzije.'
        }
        Write-Log 'package.json je sintaktički i semantički ispravan.' 'OK'
    }
    catch {
        throw "package.json nije ispravan ni nakon prepisivanja: $($_.Exception.Message)"
    }

    return $changed
}

function New-LockUtilityScript {
    $utilityPath = Join-Path $LogDirectory ("lock-utility-{0}.cjs" -f $Timestamp)
    if (Test-Path -LiteralPath $utilityPath) { return $utilityPath }

    $utility = @'
const fs = require("fs");
const { URL } = require("url");

const mode = process.argv[2];
const lockPath = process.argv[3];
const expectedNext = process.argv[4];
const expectedReact = process.argv[5];
const officialRegistry = (process.argv[6] || "https://registry.npmjs.org/").replace(/\/+$/, "/");

function readLock() {
  return JSON.parse(fs.readFileSync(lockPath, "utf8"));
}

function inspect(lock) {
  const reasons = [];
  const root = lock && lock.packages && lock.packages[""];

  if (lock.lockfileVersion !== 3) reasons.push(`lockfileVersion=${lock.lockfileVersion}`);
  if (!root) reasons.push("nedostaje packages[\"\"]");
  if (root && root.dependencies && root.dependencies.next !== expectedNext) {
    reasons.push(`next=${root.dependencies.next || "nedostaje"}`);
  }
  if (root && root.dependencies && root.dependencies.react !== expectedReact) {
    reasons.push(`react=${root.dependencies.react || "nedostaje"}`);
  }
  if (root && root.devDependencies && root.devDependencies.typescript !== "5.9.3") {
    reasons.push(`typescript=${root.devDependencies.typescript || "nedostaje"}`);
  }

  let totalResolved = 0;
  const foreign = [];

  for (const [packagePath, entry] of Object.entries(lock.packages || {})) {
    if (!entry || typeof entry.resolved !== "string") continue;
    totalResolved++;

    const resolved = entry.resolved;
    if (
      resolved.startsWith("file:") ||
      resolved.startsWith("git+") ||
      resolved.startsWith("github:")
    ) {
      continue;
    }

    try {
      const host = new URL(resolved).hostname.toLowerCase();
      if (host !== "registry.npmjs.org") foreign.push({ packagePath, resolved });
    } catch {
      foreign.push({ packagePath, resolved });
    }
  }

  return {
    valid: reasons.length === 0 && foreign.length === 0,
    reasons,
    totalResolved,
    foreignResolved: foreign.length,
    foreignSamples: foreign.slice(0, 5)
  };
}

function sanitize(lock) {
  let changed = 0;
  let unresolvedForeign = 0;

  const markers = [
    "/artifactory/api/npm/npm-public/",
    "/repository/npm-public/",
    "/api/npm/npm-public/"
  ];

  for (const entry of Object.values(lock.packages || {})) {
    if (!entry || typeof entry.resolved !== "string") continue;

    const resolved = entry.resolved;
    if (
      resolved.startsWith("file:") ||
      resolved.startsWith("git+") ||
      resolved.startsWith("github:")
    ) {
      continue;
    }

    let host = "";
    try {
      host = new URL(resolved).hostname.toLowerCase();
    } catch {}

    if (host === "registry.npmjs.org") continue;

    let suffix = null;
    for (const marker of markers) {
      const index = resolved.indexOf(marker);
      if (index >= 0) {
        suffix = resolved.slice(index + marker.length);
        break;
      }
    }

    if (suffix) {
      entry.resolved = officialRegistry + suffix.replace(/^\/+/, "");
      changed++;
    } else {
      unresolvedForeign++;
    }
  }

  if (changed > 0) {
    fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n", "utf8");
  }

  return { changed, unresolvedForeign };
}

try {
  const lock = readLock();

  if (mode === "sanitize") {
    const sanitized = sanitize(lock);
    const current = inspect(lock);
    console.log(JSON.stringify({ ...sanitized, ...current }));
    process.exit(sanitized.unresolvedForeign === 0 ? 0 : 4);
  }

  const result = inspect(lock);
  console.log(JSON.stringify(result));
  process.exit(result.valid ? 0 : 3);
} catch (error) {
  console.log(JSON.stringify({
    valid: false,
    reasons: [error.message],
    totalResolved: 0,
    foreignResolved: 0
  }));
  process.exit(2);
}
'@

    $utf8NoBom = New-Object System.Text.UTF8Encoding -ArgumentList $false
    [IO.File]::WriteAllText($utilityPath, $utility, $utf8NoBom)
    return $utilityPath
}

function Invoke-LockUtility {
    param(
        [Parameter(Mandatory = $true)][ValidateSet('inspect', 'sanitize')][string]$Mode,
        [Parameter(Mandatory = $true)][string]$LockPath
    )

    $utilityPath = New-LockUtilityScript
    $previousErrorActionPreference = $ErrorActionPreference

    try {
        $ErrorActionPreference = 'Continue'
        $rawOutput = @(
            & $NodeExecutable $utilityPath $Mode $LockPath $ExpectedNextVersion $ExpectedReactVersion $OfficialRegistry 2>&1
        )
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }

    foreach ($line in $rawOutput) {
        Add-Content -LiteralPath $LogFile -Value $line.ToString() -Encoding UTF8
    }

    $jsonLine = $rawOutput |
        ForEach-Object { $_.ToString() } |
        Where-Object { $_.TrimStart().StartsWith('{') } |
        Select-Object -Last 1

    if (-not $jsonLine) {
        return [pscustomobject]@{
            ExitCode = $exitCode
            Data = $null
        }
    }

    try {
        return [pscustomobject]@{
            ExitCode = $exitCode
            Data = ($jsonLine | ConvertFrom-Json)
        }
    }
    catch {
        Write-Log "Node provjera lockfilea vratila je nečitljiv rezultat: $jsonLine" 'WARN'
        return [pscustomobject]@{
            ExitCode = $exitCode
            Data = $null
        }
    }
}

function Repair-PackageLockRegistryUrlsForPath {
    param([Parameter(Mandatory = $true)][string]$LockPath)

    $result = Invoke-LockUtility -Mode 'sanitize' -LockPath $LockPath
    if (-not $result.Data -or [int]$result.Data.unresolvedForeign -gt 0) {
        throw "Nije moguće učiniti lockfile prijenosnim: $LockPath"
    }

    return [int]$result.Data.changed
}

function Repair-PackageLockRegistryUrls {
    $lockPath = Join-Path $ProjectRoot 'package-lock.json'
    if (-not (Test-Path -LiteralPath $lockPath)) {
        return $false
    }

    Write-Log 'Provjeravam sadrži li package-lock.json nedostupne privatne registry URL-ove.' 'STEP'

    $before = Invoke-LockUtility -Mode 'inspect' -LockPath $lockPath
    if (-not $before.Data) {
        Write-Log 'Nije moguće analizirati registry URL-ove u lockfileu.' 'WARN'
        return $false
    }

    if ([int]$before.Data.foreignResolved -gt 0) {
        Backup-File 'package-lock.json'
    }

    $changedCount = Repair-PackageLockRegistryUrlsForPath -LockPath $lockPath

    if ($changedCount -gt 0) {
        Write-Log ("Preusmjereno je {0} privatnih package URL-ova na službeni npm registry." -f $changedCount) 'WARN'
    }
    else {
        Write-Log 'package-lock.json već koristi prijenosne npm registry URL-ove.' 'OK'
    }

    return $true
}

function Test-PackageLockConsistency {
    param([string]$LockPath = (Join-Path $ProjectRoot 'package-lock.json'))

    if (-not (Test-Path -LiteralPath $LockPath)) {
        Write-Log 'package-lock.json nedostaje.' 'WARN'
        return $false
    }

    # Windows PowerShell 5.1 ne može pouzdano pretvoriti packages[""] preko
    # ConvertFrom-Json. Lockfile zato provjerava Node, koji je njegov izvorni alat.
    $result = Invoke-LockUtility -Mode 'inspect' -LockPath $LockPath

    if (-not $result.Data) {
        Write-Log 'package-lock.json nije dao čitljiv rezultat provjere.' 'WARN'
        return $false
    }

    if ($result.Data.valid -eq $true) {
        Write-Log ("package-lock.json je valjan; provjereno {0} resolved zapisa." -f $result.Data.totalResolved) 'OK'
        return $true
    }

    $reasonText = @($result.Data.reasons) -join '; '
    if ([int]$result.Data.foreignResolved -gt 0) {
        $reasonText = "$reasonText; strani resolved URL-ovi=$($result.Data.foreignResolved)"
    }

    Write-Log "package-lock.json nije konzistentan: $reasonText" 'WARN'
    return $false
}

function Test-RegistryPackageVersions {
    Write-Log 'Provjeravam postoje li sve izravno prikvačene verzije u službenom npm registru.' 'STEP'

    $package = Get-Content -LiteralPath (Join-Path $ProjectRoot 'package.json') -Raw | ConvertFrom-Json
    $specs = New-Object System.Collections.Generic.List[string]

    foreach ($sectionName in @('dependencies', 'devDependencies', 'overrides')) {
        $section = $package.$sectionName
        if (-not $section) {
            continue
        }

        foreach ($property in $section.PSObject.Properties) {
            if ($property.Value -is [string]) {
                $specs.Add(("{0}@{1}" -f $property.Name, $property.Value))
            }
        }
    }

    $missing = New-Object System.Collections.Generic.List[string]

    foreach ($spec in $specs) {
        $arguments = @('view', $spec, 'version', '--json') + $NpmCommonArguments
        $ok = Invoke-Native `
            -FilePath $NpmExecutable `
            -Arguments $arguments `
            -Description "registry provjera $spec" `
            -AllowFailure

        if (-not $ok) {
            $missing.Add($spec)
        }
    }

    if ($missing.Count -gt 0) {
        $missingMessage = (
            "Službeni npm registry ne potvrđuje ove verzije: {0}. " +
            "Cijeli npm izlaz nalazi se neposredno iznad ove poruke."
        ) -f ($missing -join ', ')

        throw $missingMessage
    }

    Write-Log 'Sve prikvačene izravne verzije postoje u službenom npm registru.' 'OK'
}

function Rebuild-PackageLock {
    Write-Log 'Ponovno izrađujem package-lock.json u izoliranoj privremenoj mapi.' 'STEP'
    Test-RegistryPackageVersions

    $lockPath = Join-Path $ProjectRoot 'package-lock.json'
    $temporaryRoot = Join-Path $ToolsDirectory ("lock-rebuild-{0}" -f $Timestamp)

    Remove-PathSafely $temporaryRoot
    New-Item -ItemType Directory -Force -Path $temporaryRoot | Out-Null

    Copy-Item `
        -LiteralPath (Join-Path $ProjectRoot 'package.json') `
        -Destination (Join-Path $temporaryRoot 'package.json') `
        -Force

    Copy-Item `
        -LiteralPath (Join-Path $ProjectRoot '.npmrc') `
        -Destination (Join-Path $temporaryRoot '.npmrc') `
        -Force

    $ok = $false
    try {
        Push-Location -LiteralPath $temporaryRoot

        $arguments = @(
            'install',
            '--package-lock-only',
            '--ignore-scripts',
            '--no-audit',
            '--fund=false'
        ) + $NpmCommonArguments

        $ok = Invoke-Native `
            -FilePath $NpmExecutable `
            -Arguments $arguments `
            -Description 'izolirana obnova package-lock.json' `
            -AllowFailure
    }
    finally {
        Pop-Location
    }

    $temporaryLock = Join-Path $temporaryRoot 'package-lock.json'

    if (-not $ok -or -not (Test-Path -LiteralPath $temporaryLock)) {
        throw 'Izolirana obnova package-lock.json nije uspjela; postojeći lockfile nije obrisan.'
    }

    Repair-PackageLockRegistryUrlsForPath -LockPath $temporaryLock | Out-Null

    if (-not (Test-PackageLockConsistency -LockPath $temporaryLock)) {
        throw 'Privremeno izrađen package-lock.json nije prošao provjeru; postojeći lockfile nije obrisan.'
    }

    Backup-File 'package-lock.json'
    Copy-Item -LiteralPath $temporaryLock -Destination $lockPath -Force
    Remove-PathSafely $temporaryRoot

    Write-Log 'Konzistentan package-lock.json sigurno je zamijenjen.' 'OK'
}

function Install-DependenciesWithRecovery {
    Write-Log 'Instaliram i provjeravam ovisnosti.' 'STEP'
    Stop-StaleProjectNodeProcesses
    Remove-PathSafely (Join-Path $ProjectRoot '.next')

    # Pokušaj 1: deterministički clean install iz lock datoteke.
    $ok = Invoke-Native -FilePath $NpmExecutable -Arguments (@('ci', '--no-audit', '--fund=false') + $NpmCommonArguments) -Description 'npm ci, pokušaj 1' -AllowFailure
    if ($ok) { return }

    # Pokušaj 2: uklanjanje zaključanih mapa i provjera npm cachea.
    Write-Log 'Prvi npm ci nije uspio. Provodim dubinsko čišćenje.' 'WARN'
    Stop-StaleProjectNodeProcesses
    Remove-PathSafely (Join-Path $ProjectRoot 'node_modules')
    Remove-PathSafely (Join-Path $ProjectRoot '.next')
    Invoke-Native -FilePath $NpmExecutable -Arguments (@('cache', 'verify') + $NpmCommonArguments) -Description 'npm cache verify' -AllowFailure | Out-Null
    $ok = Invoke-Native -FilePath $NpmExecutable -Arguments (@('ci', '--no-audit', '--fund=false') + $NpmCommonArguments) -Description 'npm ci, pokušaj 2' -AllowFailure
    if ($ok) { return }

    # Pokušaj 3: obnova lock datoteke i ponovni clean install.
    Write-Log 'Drugi npm ci nije uspio. Obnavljam lock datoteku.' 'WARN'
    Remove-PathSafely (Join-Path $ProjectRoot 'node_modules')
    Invoke-Native -FilePath $NpmExecutable -Arguments (@('cache', 'clean', '--force') + $NpmCommonArguments) -Description 'npm cache clean' -AllowFailure | Out-Null
    Rebuild-PackageLock
    $ok = Invoke-Native -FilePath $NpmExecutable -Arguments (@('ci', '--no-audit', '--fund=false') + $NpmCommonArguments) -Description 'npm ci, pokušaj 3' -AllowFailure
    if ($ok) { return }

    # Pokušaj 4: npm install je manje strog, ali i dalje koristi samo exact verzije.
    Write-Log 'Treći npm ci nije uspio. Posljednji pokušaj koristi npm install s exact paketima.' 'WARN'
    Remove-PathSafely (Join-Path $ProjectRoot 'node_modules')
    $ok = Invoke-Native -FilePath $NpmExecutable -Arguments (@('install', '--no-audit', '--fund=false') + $NpmCommonArguments) -Description 'npm install, rezervni pokušaj' -AllowFailure
    if (-not $ok) {
        throw 'Nijedna strategija instalacije ovisnosti nije uspjela.'
    }
}

function New-SecureToken {
    param([int]$ByteCount = 32)

    $bytes = New-Object byte[] $ByteCount
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
    return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Set-EnvironmentLine {
    param([string]$Content, [string]$Key, [string]$Value)

    $pattern = '(?m)^\s*' + [Regex]::Escape($Key) + '\s*=.*$'
    $line = "$Key=$Value"
    if ([Regex]::IsMatch($Content, $pattern)) {
        return [Regex]::Replace($Content, $pattern, [Text.RegularExpressions.MatchEvaluator]{ param($match) $line })
    }
    if ($Content.Length -gt 0 -and -not $Content.EndsWith("`n")) { $Content += "`n" }
    return $Content + $line + "`n"
}

function Get-EnvironmentValue {
    param([string]$Content, [string]$Key)

    $pattern = '(?m)^\s*' + [Regex]::Escape($Key) + '\s*=\s*["'']?(.*?)["'']?\s*$'
    $match = [Regex]::Match($Content, $pattern)
    if ($match.Success) { return $match.Groups[1].Value.Trim() }
    return ''
}

function Repair-LocalEnvironment {
    Write-Log 'Provjeravam lokalnu .env.local konfiguraciju.' 'STEP'

    $envPath = Join-Path $ProjectRoot '.env.local'
    $content = ''
    $changed = $false

    if (Test-Path -LiteralPath $envPath) {
        $content = [IO.File]::ReadAllText($envPath) -replace "`r`n", "`n"
    }
    else {
        $content = @'
# Lokalna konfiguracija koju je izradila POKRENI-I-POPRAVI skripta.
# Datoteka je u .gitignore i ne šalje se u Git.
PILOT_PASSWORD_HASH=
PILOT_SESSION_SECRET=
PILOT_PASSWORD=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
'@
        $changed = $true
    }

    $secret = Get-EnvironmentValue $content 'PILOT_SESSION_SECRET'
    if ($secret.Length -lt 24 -or $secret -match 'zamijeni|change|placeholder') {
        $content = Set-EnvironmentLine $content 'PILOT_SESSION_SECRET' (New-SecureToken 48)
        $changed = $true
        Write-Log 'Izrađen je novi lokalni PILOT_SESSION_SECRET.' 'OK'
    }

    $hash = Get-EnvironmentValue $content 'PILOT_PASSWORD_HASH'
    $password = Get-EnvironmentValue $content 'PILOT_PASSWORD'
    if ([string]::IsNullOrWhiteSpace($hash) -and [string]::IsNullOrWhiteSpace($password)) {
        $password = 'pilot-' + (New-SecureToken 12)
        $content = Set-EnvironmentLine $content 'PILOT_PASSWORD' $password
        $changed = $true
        Write-Log "Izrađena lokalna /pilot lozinka: $password" 'WARN'
        Write-Host "`nLOKALNA /pilot LOZINKA: $password`n" -ForegroundColor Magenta
    }
    elseif (-not [string]::IsNullOrWhiteSpace($password)) {
        Write-Log 'Lokalna /pilot lozinka već postoji u .env.local.' 'OK'
    }
    else {
        Write-Log 'PILOT_PASSWORD_HASH je postavljen.' 'OK'
    }

    if ($changed) {
        Backup-File '.env.local'
        $utf8NoBom = New-Object System.Text.UTF8Encoding -ArgumentList $false
        [IO.File]::WriteAllText($envPath, ($content.TrimEnd() + "`n"), $utf8NoBom)
        Write-Log '.env.local je sigurno dopunjena bez diranja Supabase vrijednosti.' 'OK'
    }
    else {
        Write-Log '.env.local već sadrži potrebne lokalne vrijednosti.' 'OK'
    }
}

function Assert-InstalledDependencies {
    Write-Log 'Provjeravam stvarno instalirane pakete.' 'STEP'

    $requiredFiles = @(
        'node_modules/next/package.json',
        'node_modules/react/package.json',
        'node_modules/typescript/package.json',
        'node_modules/.bin/next.cmd',
        'node_modules/.bin/eslint.cmd',
        'node_modules/.bin/tsc.cmd'
    )

    foreach ($relative in $requiredFiles) {
        if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot $relative))) {
            throw "Nedostaje instalacijski artefakt: $relative"
        }
    }

    $next = Get-Content -LiteralPath (Join-Path $ProjectRoot 'node_modules/next/package.json') -Raw | ConvertFrom-Json
    $react = Get-Content -LiteralPath (Join-Path $ProjectRoot 'node_modules/react/package.json') -Raw | ConvertFrom-Json

    if ($next.version -ne $ExpectedNextVersion) {
        throw "Instaliran je Next $($next.version), a očekuje se $ExpectedNextVersion."
    }
    if ($react.version -ne $ExpectedReactVersion) {
        throw "Instaliran je React $($react.version), a očekuje se $ExpectedReactVersion."
    }

    Invoke-Native -FilePath $NpmExecutable -Arguments @('ls', '--depth=0') -Description 'npm ls --depth=0' | Out-Null
    Write-Log 'Sve temeljne ovisnosti postoje u očekivanim verzijama.' 'OK'
}

function Invoke-QualityChecks {
    Write-Log 'Pokrećem lint, TypeScript i produkcijski build.' 'STEP'

    $eslint = Join-Path $ProjectRoot 'node_modules/.bin/eslint.cmd'
    $tsc = Join-Path $ProjectRoot 'node_modules/.bin/tsc.cmd'
    $next = Join-Path $ProjectRoot 'node_modules/.bin/next.cmd'

    Invoke-Native -FilePath $next -Arguments @('info') -Description 'Next.js sistemske informacije' -AllowFailure | Out-Null
    Invoke-Native -FilePath $eslint -Arguments @('.') -Description 'ESLint provjera' | Out-Null
    Invoke-Native -FilePath $tsc -Arguments @('--noEmit') -Description 'TypeScript provjera' | Out-Null

    # Pokušaj 1: Webpack, namjerno izbjegava Turbopack kao zadani bundler.
    Remove-PathSafely (Join-Path $ProjectRoot '.next')
    $buildOk = Invoke-Native -FilePath $next -Arguments @('build', '--webpack') -Description 'produkcijski Webpack build, pokušaj 1' -AllowFailure -Environment @{ 'NODE_OPTIONS' = '--max-old-space-size=4096' }
    if ($buildOk) { return }

    # Pokušaj 2: očisti sve generirane Next/TypeScript cacheve.
    Write-Log 'Prvi build nije uspio. Čistim Next i TypeScript cache.' 'WARN'
    Stop-StaleProjectNodeProcesses
    Remove-PathSafely (Join-Path $ProjectRoot '.next')
    Remove-PathSafely (Join-Path $ProjectRoot 'tsconfig.tsbuildinfo')
    $buildOk = Invoke-Native -FilePath $next -Arguments @('build', '--webpack', '--debug') -Description 'produkcijski Webpack build, pokušaj 2' -AllowFailure -Environment @{ 'NODE_OPTIONS' = '--max-old-space-size=6144' }
    if ($buildOk) { return }

    # Pokušaj 3: obnovi native/optional pakete, pa ponovno gradi.
    Write-Log 'Drugi build nije uspio. Pokrećem npm rebuild i posljednji Webpack pokušaj.' 'WARN'
    Invoke-Native -FilePath $NpmExecutable -Arguments @('rebuild') -Description 'npm rebuild' -AllowFailure | Out-Null
    Remove-PathSafely (Join-Path $ProjectRoot '.next')
    $buildOk = Invoke-Native -FilePath $next -Arguments @('build', '--webpack', '--debug') -Description 'produkcijski Webpack build, pokušaj 3' -AllowFailure -Environment @{ 'NODE_OPTIONS' = '--max-old-space-size=8192' }
    if ($buildOk) { return }

    # Posljednja dijagnostika: Turbopack se pokušava samo kako bi log pokazao
    # je li problem bundler-specifičan. Ne postaje zadani način rada.
    Write-Log 'Webpack i dalje pada. Pokrećem jedan Turbopack build samo radi usporednog loga.' 'WARN'
    Remove-PathSafely (Join-Path $ProjectRoot '.next')
    Invoke-Native -FilePath $next -Arguments @('build', '--turbopack', '--debug') -Description 'dijagnostički Turbopack build' -AllowFailure -Environment @{ 'NODE_OPTIONS' = '--max-old-space-size=8192' } | Out-Null
    throw 'Produkcijski build nije uspio ni nakon tri Webpack strategije. Detalji su u logu.'
}

function Test-PortAvailable {
    param([int]$Port)
    try {
        $listener = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, $Port)
        $listener.Start()
        $listener.Stop()
        return $true
    }
    catch {
        return $false
    }
}

function Find-DevelopmentPort {
    foreach ($port in 3000..3010) {
        if (Test-PortAvailable $port) { return $port }
    }
    throw 'Nijedan port od 3000 do 3010 nije slobodan.'
}

function Start-DevelopmentServer {
    $port = Find-DevelopmentPort
    $next = Join-Path $ProjectRoot 'node_modules/.bin/next.cmd'
    $url = "http://localhost:$port"

    Write-Log "Pokrećem stabilni razvojni server s Webpackom na $url" 'STEP'
    Write-Log 'Terminal ostaje otvoren dok server radi. Za zaustavljanje pritisni Ctrl+C.' 'INFO'

    if (-not $NoBrowser) {
        $browserCommand = "Start-Sleep -Seconds 4; Start-Process '$url'"
        Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -ArgumentList @('-NoProfile', '-Command', $browserCommand) | Out-Null
    }

    $previousErrorActionPreference = $ErrorActionPreference

    try {
        $ErrorActionPreference = 'Continue'

        & $next dev --webpack --hostname 127.0.0.1 --port $port 2>&1 | ForEach-Object {
            $serverLine = $_.ToString()
            Write-Host $serverLine
            Add-Content -LiteralPath $LogFile -Value $serverLine -Encoding UTF8
        }

        $serverExit = $LASTEXITCODE
    }
    catch {
        Write-Log "Razvojni server je prekinut: $($_.Exception.Message)" 'ERROR'
        $serverExit = 1
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }

    if ($serverExit -eq 0 -or $null -eq $serverExit) {
        Write-Log 'Razvojni server je zaustavljen.' 'INFO'
    }
    else {
        Write-Log "Razvojni server završio je kodom $serverExit." 'ERROR'
    }
}

# -----------------------------------------------------------------------------
# 3. Glavni tijek
# -----------------------------------------------------------------------------
try {
    Write-Host '============================================================' -ForegroundColor DarkRed
    Write-Host ' KRUGOVI PAKLA - PROVJERA, POPRAVAK I POKRETANJE' -ForegroundColor Red
    Write-Host '============================================================' -ForegroundColor DarkRed
    Write-Log "Projekt: $ProjectRoot" 'INFO'
    Write-Log "Administrator: $isAdministrator" 'INFO'

    Repair-WindowsFoundation
    Ensure-PortableNode
    Assert-ToolVersions

    $configurationChanged = Repair-CanonicalConfiguration
    $portableLock = Repair-PackageLockRegistryUrls

    if ($configurationChanged -or -not $portableLock -or -not (Test-PackageLockConsistency)) {
        Rebuild-PackageLock
    }

    Install-DependenciesWithRecovery
    Assert-InstalledDependencies
    Repair-LocalEnvironment
    Invoke-QualityChecks

    # Audit ne smije blokirati lokalni rad zbog privremenog mrežnog problema,
    # ali rezultat ostaje u logu.
    Invoke-Native -FilePath $NpmExecutable -Arguments (@('audit', '--audit-level=high') + $NpmCommonArguments) -Description 'npm security audit' -AllowFailure | Out-Null

    Write-Log 'SVE TEMELJNE PROVJERE SU PROŠLE.' 'OK'

    if ($DiagnosticsOnly) {
        Exit-WithPause 0 'Dijagnostika i popravak završeni su bez pokretanja servera.'
    }

    Start-DevelopmentServer
    Exit-WithPause 0 'Skripta je završila nakon zaustavljanja razvojnog servera.'
}
catch {
    Write-Log $_.Exception.Message 'ERROR'
    if ($_.ScriptStackTrace) { Write-Log $_.ScriptStackTrace 'ERROR' }
    Exit-WithPause 1 'Automatski popravak nije mogao zajamčiti ispravno stanje. Pogledaj posljednje ERROR retke u logu.'
}
