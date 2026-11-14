# Publish CastCall to GitHub Pages.
# Bumps the ?v= version on every CSS/JS link (so phones and browsers load the new files, not old cached ones),
# then commits and pushes. Usage:  powershell -ExecutionPolicy Bypass -File publish.ps1 "What changed"
param([string]$Message = "Update CastCall")
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')

$index = Join-Path $root 'index.html'
$html = [IO.File]::ReadAllText($index)
$v = '?v=' + (Get-Date -Format 'yyyyMMddHHmm')
$html = [regex]::Replace($html, '(href="css/[a-z\-]+\.css)(\?v=\d+)?"', "`$1$v`"")
$html = [regex]::Replace($html, '(src="js/[a-z\-/]+\.js)(\?v=\d+)?"', "`$1$v`"")
[IO.File]::WriteAllText($index, $html, (New-Object Text.UTF8Encoding $false))

git add -A
git commit -q -m $Message -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q
Write-Host "Published $v - live in about a minute at https://castcallau.github.io/"
