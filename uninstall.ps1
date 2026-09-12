param(
  [string]$InstallDir = (Join-Path $HOME '.agent-skills'),
  [switch]$Yes,
  [switch]$DryRun
)

$source = Split-Path -Parent $MyInvocation.MyCommand.Path
$uninstaller = Join-Path $source 'uninstall.mjs'
$arguments = @($uninstaller, '--prefix', $InstallDir)
if ($Yes) { $arguments += '--yes' }
if ($DryRun) { $arguments += '--dry-run' }

& node @arguments
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
if ($DryRun) { exit 0 }

$resolvedInstallDir = [System.IO.Path]::GetFullPath($InstallDir).TrimEnd('\')
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$pathEntries = @($userPath -split ';' | Where-Object { $_ })
$remaining = @($pathEntries | Where-Object {
  [System.IO.Path]::GetFullPath($_).TrimEnd('\') -ine $resolvedInstallDir
})
if ($remaining.Count -ne $pathEntries.Count) {
  [Environment]::SetEnvironmentVariable('Path', ($remaining -join ';'), 'User')
  Write-Host 'นำโฟลเดอร์เครื่องมือออกจาก User PATH แล้ว เปิด Terminal ใหม่เพื่อให้มีผล'
}
