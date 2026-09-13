param(
    [switch]$Setup,
    [switch]$SeedDemo
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$venvPython = Join-Path $PSScriptRoot '.venv/Scripts/python.exe'

function Assert-Exit([string]$Operation) {
    if ($LASTEXITCODE -ne 0) { throw "$Operation failed (exit code $LASTEXITCODE)." }
}

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw 'Install Node.js 22.12+ or 24 LTS, then open a new terminal.'
}

# Check before pip/npm/seed: npm ci replaces node_modules and cannot remove
# native modules loaded by a running Vite process on Windows.
foreach ($port in @(5000, 5173)) {
    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $port)
    try { $listener.Start() }
    catch {
        throw "Port $port is already in use. Open http://127.0.0.1:5173 to check the running site, or stop its terminal with Ctrl+C before running setup. No dependencies have been changed."
    }
    finally { $listener.Stop() }
}

if (-not (Test-Path -LiteralPath $venvPython)) {
    $pythonCommand = Get-Command python.exe -ErrorAction SilentlyContinue
    $pyCommand = Get-Command py.exe -ErrorAction SilentlyContinue
    $bundledPython = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
    if ($pythonCommand) { & $pythonCommand.Source -m venv .venv }
    elseif ($pyCommand) { & $pyCommand.Source -3 -m venv .venv }
    elseif (Test-Path -LiteralPath $bundledPython) { & $bundledPython -m venv .venv }
    else { throw 'Install Python 3.11+ and enable Add Python to PATH.' }
    Assert-Exit 'Creating Python virtual environment'
    $Setup = $true
}

if (-not (Test-Path -LiteralPath 'backend/.env')) {
    Copy-Item -LiteralPath 'backend/.env.example' -Destination 'backend/.env'
}

if ($Setup) {
    & $venvPython -m pip install -r backend/requirements.txt
    Assert-Exit 'Installing Python dependencies'
}
$frontendFiles = @(
    'frontend/node_modules/.bin/vite.cmd',
    'frontend/node_modules/vite/bin/vite.js',
    'frontend/node_modules/react/package.json',
    'frontend/node_modules/react-dom/package.json',
    'frontend/node_modules/@tailwindcss/vite/package.json'
)
$frontendReady = $true
foreach ($frontendFile in $frontendFiles) {
    if (-not (Test-Path -LiteralPath $frontendFile)) { $frontendReady = $false; break }
}
if ($Setup -or -not $frontendReady) {
    & npm.cmd --prefix frontend ci
    if ($LASTEXITCODE -ne 0) {
        throw "Installing frontend dependencies failed (exit code $LASTEXITCODE). For EPERM/unlink errors, stop the Gym TN Vite terminal with Ctrl+C, then rerun this script with -Setup."
    }
}

Push-Location -LiteralPath (Join-Path $PSScriptRoot 'backend')
try {
    if ($SeedDemo) {
        & $venvPython -m flask --app app seed
        Assert-Exit 'Creating demo data'
    }
} finally { Pop-Location }

$logFolder = Join-Path $PSScriptRoot 'backend/instance'
New-Item -ItemType Directory -Force -Path $logFolder | Out-Null
$backendProcess = Start-Process -FilePath $venvPython -ArgumentList 'app.py' -WorkingDirectory (Join-Path $PSScriptRoot 'backend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logFolder 'server.log') -RedirectStandardError (Join-Path $logFolder 'server-error.log')
try {
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        if ($backendProcess.HasExited) { throw 'Backend exited. Read backend/instance/server-error.log.' }
        try {
            $health = Invoke-RestMethod -Uri 'http://127.0.0.1:5000/api/health' -TimeoutSec 1
            if ($health.status -eq 'ok') { $ready = $true; break }
        } catch { Start-Sleep -Milliseconds 300 }
    }
    if (-not $ready) { throw 'Backend did not become ready. Read backend/instance/server-error.log.' }
    Write-Host 'Gym TN: http://127.0.0.1:5173' -ForegroundColor Green
    Write-Host 'Keep this terminal open. Press Ctrl+C to stop.'
    & npm.cmd run dev
} finally {
    # The Windows venv Python launcher may start a child Python process.
    # Stop only this backend's process tree so Ctrl+C also releases port 5000.
    if (-not $backendProcess.HasExited) {
        & taskkill.exe /PID $backendProcess.Id /T /F | Out-Null
    }
}
