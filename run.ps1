# Usage: .\run.ps1 <manage.py args>   e.g. .\run.ps1 runserver
# Padanan run.sh untuk Windows PowerShell.
# DB is chosen by KIWI_DB (sqlite|postgres) in .env, read by kiwi_local_settings.py.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$py = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
if (-not (Test-Path $py)) {
    [Console]::Error.WriteLine("run.ps1: .venv not found, see 'Setup' in README.md")
    exit 1
}
$env:PYTHONPATH = "$PSScriptRoot;$PSScriptRoot\Kiwi"
if (-not $env:DJANGO_SETTINGS_MODULE) { $env:DJANGO_SETTINGS_MODULE = 'kiwi_local_settings' }
$manageArgs = if ($args.Count) { $args } else { @('runserver') }
& $py Kiwi\manage.py @manageArgs
exit $LASTEXITCODE
