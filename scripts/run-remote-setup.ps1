# Fail-fast local setup script for project hjqpprhljvwmcelgwznq.
# Reads SUPABASE_ACCESS_TOKEN and SUPABASE_DB_PASSWORD strictly from current session $env:.
# Contains zero secrets. Stops immediately if any command fails.

param(
  [switch]$MigrationsOnly
)

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

if (-not $env:SUPABASE_ACCESS_TOKEN -or -not $env:SUPABASE_DB_PASSWORD) {
  Write-Error "Set `$env:SUPABASE_ACCESS_TOKEN and `$env:SUPABASE_DB_PASSWORD in this PowerShell session first."
  exit 1
}

function Invoke-Step([string]$label, [scriptblock]$block) {
  Write-Host "`n==> $label" -ForegroundColor Cyan
  & $block
  if ($LASTEXITCODE -ne 0) {
    throw "Step failed ($label) with exit code $LASTEXITCODE"
  }
}

Invoke-Step "Link Supabase CLI to hjqpprhljvwmcelgwznq" {
  npx --no-install supabase link --project-ref hjqpprhljvwmcelgwznq --yes
}

Write-Host "`n==> Push migrations (--remote --include-all)" -ForegroundColor Cyan
npx --no-install supabase db push --remote --include-all --yes
if ($LASTEXITCODE -ne 0) {
  Write-Host "Checking whether base migrations 001-005 were previously applied via SQL Editor..." -ForegroundColor Yellow
  node scripts/db-admin-ops.mjs check-base-tables
  if ($LASTEXITCODE -eq 0) {
    Invoke-Step "Record already-applied base migrations 001..005 in history" {
      npx --no-install supabase migration repair --remote --status applied 001 002 003 004 005 --yes
    }
    Invoke-Step "Push pending migration 006_admin_module.sql" {
      npx --no-install supabase db push --remote --include-all --yes
    }
  } else {
    throw "db push failed and base schema check did not pass."
  }
}

Invoke-Step "Verify remote tables, RLS flags, functions and policies" {
  node scripts/db-admin-ops.mjs verify-schema
}

Invoke-Step "Ensure Confirm email remains OFF (local .env.local SMTP handles OTP)" {
  node scripts/configure-auth-nonsecret.mjs
}

Invoke-Step "Run non-destructive SQL RLS & business-rule test suite" {
  node scripts/db-admin-ops.mjs run-sql-file supabase/tests/admin_rls_and_rules.sql
}

if ($MigrationsOnly) {
  Write-Host "`nMigrationsOnly complete (existing super_admin password & .env.test untouched)." -ForegroundColor Green
  exit 0
}

Invoke-Step "Provision 6 disposable @autogroup.in test accounts into gitignored .env.test" {
  node scripts/db-admin-ops.mjs setup-test-suite
}

try {
  $bytes = New-Object byte[] 18
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $env:FIRST_ADMIN_PASSWORD = "Ag!" + [Convert]::ToBase64String($bytes).Replace('/','A').Replace('+','B') + "9#"
  $env:FIRST_ADMIN_EMAIL = "autogroup256@gmail.com"

  Invoke-Step "Bootstrap first super_admin & verify Supabase Auth login" {
    node scripts/db-admin-ops.mjs bootstrap-first-admin
  }

  Write-Host ""
  Write-Host "==========================================================" -ForegroundColor Green
  Write-Host "FIRST ADMIN EMAIL : $env:FIRST_ADMIN_EMAIL" -ForegroundColor Green
  Write-Host "ONE-TIME PASSWORD : $env:FIRST_ADMIN_PASSWORD" -ForegroundColor Yellow
  Write-Host "Save this password in your password manager now!" -ForegroundColor Green
  Write-Host "==========================================================" -ForegroundColor Green
}
finally {
  Remove-Item Env:\FIRST_ADMIN_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:\FIRST_ADMIN_EMAIL -ErrorAction SilentlyContinue
}
