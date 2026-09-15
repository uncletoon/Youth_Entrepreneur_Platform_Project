param(
  [string]$EnvironmentFile = ".env"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$resolvedEnvironment = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $EnvironmentFile))
if (-not (Test-Path -LiteralPath $resolvedEnvironment -PathType Leaf)) {
  throw "Configuration file not found: $resolvedEnvironment"
}

function Get-EnvironmentValue([string]$Name) {
  $line = Get-Content -LiteralPath $resolvedEnvironment |
    Where-Object { $_ -match "^$Name=" } |
    Select-Object -First 1
  if (-not $line) { throw "$Name is missing from $resolvedEnvironment." }
  return $line.Substring($Name.Length + 1).Trim()
}

function Read-PostgresUrl([string]$Name) {
  $uri = [System.Uri](Get-EnvironmentValue $Name)
  if ($uri.Scheme -notin @('postgres', 'postgresql')) {
    throw "$Name must use the postgres or postgresql scheme."
  }
  if ($uri.Host -notin @('127.0.0.1', 'localhost')) {
    throw "$Name must point to localhost for the local PostgreSQL cluster."
  }
  $credentials = $uri.UserInfo -split ':', 2
  if ($credentials.Count -ne 2) { throw "$Name must include a user and password." }
  $user = [System.Uri]::UnescapeDataString($credentials[0])
  $database = $uri.AbsolutePath.TrimStart('/')
  if ($user -notmatch '^[A-Za-z_][A-Za-z0-9_]*$' -or $database -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
    throw "$Name contains an invalid database user or database name."
  }
  return [PSCustomObject]@{
    User = $user
    Password = [System.Uri]::UnescapeDataString($credentials[1])
    Database = $database
    Port = if ($uri.Port -gt 0) { $uri.Port } else { 5432 }
  }
}

$application = Read-PostgresUrl 'DATABASE_URL'

$postgresRoot = 'C:\Program Files\PostgreSQL'
$postgresBin = Get-ChildItem -LiteralPath $postgresRoot -Directory -ErrorAction SilentlyContinue |
  Sort-Object { [int]$_.Name } -Descending |
  ForEach-Object { Join-Path $_.FullName 'bin' } |
  Where-Object { Test-Path -LiteralPath (Join-Path $_ 'pg_ctl.exe') } |
  Select-Object -First 1
if (-not $postgresBin) {
  throw "PostgreSQL tools were not found under $postgresRoot. Install PostgreSQL 17 first."
}

$runtimeRoot = Join-Path $env:LOCALAPPDATA 'YERSPS\PostgreSQL'
$dataDirectory = Join-Path $runtimeRoot 'data'
$logDirectory = Join-Path $runtimeRoot 'logs'
$logPath = Join-Path $logDirectory 'postgresql.log'
New-Item -ItemType Directory -Path $runtimeRoot, $logDirectory -Force | Out-Null

if (-not (Test-Path -LiteralPath (Join-Path $dataDirectory 'PG_VERSION'))) {
  $passwordFile = [System.IO.Path]::GetTempFileName()
  try {
    [System.IO.File]::WriteAllText($passwordFile, $application.Password)
    & (Join-Path $postgresBin 'initdb.exe') `
      -D $dataDirectory `
      -U $application.User `
      --encoding=UTF8 `
      --auth-local=trust `
      --auth-host=scram-sha-256 `
      --pwfile=$passwordFile
    if ($LASTEXITCODE -ne 0) { throw "initdb failed." }
  }
  finally {
    Remove-Item -LiteralPath $passwordFile -Force -ErrorAction SilentlyContinue
  }
}

& (Join-Path $postgresBin 'pg_ctl.exe') -D $dataDirectory status *> $null
if ($LASTEXITCODE -ne 0) {
  & (Join-Path $postgresBin 'pg_ctl.exe') `
    -D $dataDirectory `
    -l $logPath `
    -o "-h 127.0.0.1 -p $($application.Port)" `
    start `
    -w
  if ($LASTEXITCODE -ne 0) { throw "PostgreSQL did not start. Review $logPath." }
}

$previousPassword = $env:PGPASSWORD
$env:PGPASSWORD = $application.Password
try {
  $databaseExists = & (Join-Path $postgresBin 'psql.exe') `
    -h 127.0.0.1 -p $application.Port -U $application.User -d postgres `
    -X -tAc "SELECT 1 FROM pg_database WHERE datname = '$($application.Database)'"
  if ($LASTEXITCODE -ne 0) { throw "Could not inspect the local PostgreSQL cluster." }
  if ([string]$databaseExists -ne '1') {
    & (Join-Path $postgresBin 'createdb.exe') `
      -h 127.0.0.1 -p $application.Port -U $application.User -O $application.User `
      $application.Database
    if ($LASTEXITCODE -ne 0) { throw "Could not create database $($application.Database)." }
  }
}
finally {
  $env:PGPASSWORD = $previousPassword
}

Write-Output "Native PostgreSQL is ready at 127.0.0.1:$($application.Port)/$($application.Database)."
Write-Output "Database role: $($application.User)"
Write-Output "Data directory: $dataDirectory"
