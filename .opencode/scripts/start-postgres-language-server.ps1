$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$version = '0.25.0'
$assetName = switch ($env:PROCESSOR_ARCHITECTURE) {
  'ARM64' { 'postgres-language-server_aarch64-pc-windows-msvc.exe' }
  default { 'postgres-language-server_x86_64-pc-windows-msvc.exe' }
}

$installRoot = Join-Path $env:LOCALAPPDATA 'Temp\opencode\postgres-language-server'
$versionRoot = Join-Path $installRoot $version
$binaryPath = Join-Path $versionRoot 'postgres-language-server.exe'

if (-not (Test-Path -LiteralPath $binaryPath)) {
  New-Item -ItemType Directory -Path $versionRoot -Force | Out-Null
  $downloadUrl = "https://github.com/supabase-community/postgres-language-server/releases/download/$version/$assetName"
  Invoke-WebRequest -Uri $downloadUrl -OutFile $binaryPath
}

& $binaryPath 'lsp-proxy'
