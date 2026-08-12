param(
  [string]$OutputDirectory = ""
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $projectRoot ".env"
if (-not (Test-Path -LiteralPath $envPath)) {
  throw "The root .env file is required."
}
$databaseLine = Get-Content -LiteralPath $envPath | Where-Object { $_ -match '^DATABASE_ADMIN_URL=' } | Select-Object -First 1
if (-not $databaseLine) {
  throw "DATABASE_ADMIN_URL is missing from the root .env file."
}
$databaseUrl = $databaseLine.Substring('DATABASE_ADMIN_URL='.Length).Trim()
$defaultBackupRoot = [System.IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA "YERSPS\Backups"))
$resolvedOutput = if ($OutputDirectory) {
  [System.IO.Path]::GetFullPath($OutputDirectory)
} else {
  $defaultBackupRoot
}
if (
  $resolvedOutput -ne $defaultBackupRoot -and
  -not $resolvedOutput.StartsWith($defaultBackupRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)
) {
  throw "Backups must be written inside $defaultBackupRoot."
}
New-Item -ItemType Directory -Path $resolvedOutput -Force | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = Join-Path $resolvedOutput "yersps-$timestamp.dump"
$pgDump = Get-Command pg_dump.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1
if (-not $pgDump) {
  $pgDump = Get-ChildItem -LiteralPath 'C:\Program Files\PostgreSQL' -Directory -ErrorAction SilentlyContinue |
    Sort-Object { [int]$_.Name } -Descending |
    ForEach-Object { Join-Path $_.FullName 'bin\pg_dump.exe' } |
    Where-Object { Test-Path -LiteralPath $_ } |
    Select-Object -First 1
}
if (-not $pgDump) { throw "pg_dump was not found. Install PostgreSQL client tools." }
& $pgDump --dbname=$databaseUrl --format=custom --file=$backupPath
if ($LASTEXITCODE -ne 0) {
  throw "pg_dump failed."
}
Write-Output "Backup created: $backupPath"
