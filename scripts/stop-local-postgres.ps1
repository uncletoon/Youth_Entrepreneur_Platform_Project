$ErrorActionPreference = "Stop"
$dataDirectory = Join-Path $env:LOCALAPPDATA 'YERSPS\PostgreSQL\data'
if (-not (Test-Path -LiteralPath (Join-Path $dataDirectory 'PG_VERSION'))) {
  Write-Output "The YERSPS local PostgreSQL cluster is not initialized."
  exit 0
}

$postgresBin = Get-ChildItem -LiteralPath 'C:\Program Files\PostgreSQL' -Directory -ErrorAction SilentlyContinue |
  Sort-Object { [int]$_.Name } -Descending |
  ForEach-Object { Join-Path $_.FullName 'bin' } |
  Where-Object { Test-Path -LiteralPath (Join-Path $_ 'pg_ctl.exe') } |
  Select-Object -First 1
if (-not $postgresBin) { throw "PostgreSQL tools are not installed." }

& (Join-Path $postgresBin 'pg_ctl.exe') -D $dataDirectory status *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Output "The YERSPS local PostgreSQL cluster is already stopped."
  exit 0
}

& (Join-Path $postgresBin 'pg_ctl.exe') -D $dataDirectory stop -m fast -w
if ($LASTEXITCODE -ne 0) { throw "PostgreSQL did not stop cleanly." }
Write-Output "The YERSPS local PostgreSQL cluster is stopped."
