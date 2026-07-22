param(
  [int]$Port = 3000
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Test-PortOpen {
  param([int]$PortNumber)
  try {
    $client = [System.Net.Sockets.TcpClient]::new()
    $client.Connect('127.0.0.1', $PortNumber)
    $client.Close()
    return $true
  }
  catch {
    return $false
  }
}

Write-Host "[launcher] Starting Krugovi pakla from $root" -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js nije instaliran ili nije na PATH-u."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "npm nije instaliran ili nije na PATH-u."
}

Write-Host "[launcher] Instaliram/obnavljam ovisnosti..." -ForegroundColor Yellow
npm install --engine-strict=false

if (Test-PortOpen -PortNumber $Port) {
  Write-Host "[launcher] Server je već pokrenut na http://localhost:$Port" -ForegroundColor Green
}
else {
  Write-Host "[launcher] Pokrećem razvojni server na http://localhost:$Port" -ForegroundColor Green
  $command = "Set-Location '$root'; npm run dev -- --hostname 127.0.0.1 --port $Port"
  Start-Process powershell -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-Command', $command) -WindowStyle Normal
}

Write-Host "[launcher] Otvori: http://localhost:$Port" -ForegroundColor Green
Write-Host "[launcher] Studio: http://localhost:$Port/pilot" -ForegroundColor Green
