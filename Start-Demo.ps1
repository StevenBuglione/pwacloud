$ErrorActionPreference = 'Stop'
$workspaceRoot = $PSScriptRoot
$bundledNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$nodeExecutable = if (Test-Path -LiteralPath $bundledNode) { $bundledNode } else { (Get-Command node -ErrorAction Stop).Source }
$version = & $nodeExecutable --version
if ($version -ne 'v24.19.0') { throw "This build requires Node 24.19.0; found $version." }
if (-not (Test-Path -LiteralPath (Join-Path $workspaceRoot 'dist\shell\index.html'))) { throw 'Run pnpm install --frozen-lockfile and pnpm build first.' }
Push-Location -LiteralPath $workspaceRoot
try { & $nodeExecutable --import tsx scripts/start-demo.ts; if ($LASTEXITCODE -ne 0) { throw "Demo exited with code $LASTEXITCODE." } }
finally { Pop-Location }
