param(
  [Parameter(Mandatory = $true)]
  [string]$BackupPath,
  [switch]$ConfirmRestore
)

$ErrorActionPreference = "Stop"
if (-not $ConfirmRestore) {
  throw "Restoring replaces current database objects. Re-run with -ConfirmRestore after verifying the target."
}
$projectRoot = Split-Path -Parent $PSScriptRoot
$resolvedBackup = [System.IO.Path]::GetFullPath($BackupPath)
$backupRoot = [System.IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA "YERSPS\Backups"))
if (-not $resolvedBackup.StartsWith($backupRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "The backup file must be inside $backupRoot."
}
if (-not (Test-Path -LiteralPath $resolvedBackup -PathType Leaf)) {
  throw "Backup file not found."
}
$envPath = Join-Path $projectRoot ".env"
$databaseLine = Get-Content -LiteralPath $envPath | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
if (-not $databaseLine) {
  throw "DATABASE_URL is missing from the root .env file."
}
$databaseUrl = $databaseLine.Substring('DATABASE_URL='.Length).Trim()
$pgRestore = Get-Command pg_restore.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1
if (-not $pgRestore) {
  $pgRestore = Get-ChildItem -LiteralPath 'C:\Program Files\PostgreSQL' -Directory -ErrorAction SilentlyContinue |
    Sort-Object { [int]$_.Name } -Descending |
    ForEach-Object { Join-Path $_.FullName 'bin\pg_restore.exe' } |
    Where-Object { Test-Path -LiteralPath $_ } |
    Select-Object -First 1
}
if (-not $pgRestore) { throw "pg_restore was not found. Install PostgreSQL client tools." }
& $pgRestore --dbname=$databaseUrl --clean --if-exists --no-owner $resolvedBackup
if ($LASTEXITCODE -ne 0) {
  throw "pg_restore failed."
}
Write-Output "Database restored from: $resolvedBackup"
