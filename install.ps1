param(
  [string]$InstallDir = (Join-Path $HOME '.agent-skills'),
  [switch]$Force,
  [switch]$DryRun
)

$source = Split-Path -Parent $MyInvocation.MyCommand.Path
$installer = Join-Path $source 'install.mjs'
$arguments = @($installer, '--prefix', $InstallDir)
if ($Force) { $arguments += '--force' }
if ($DryRun) { $arguments += '--dry-run' }

& node @arguments
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
if ($DryRun) { exit 0 }

$resolvedInstallDir = [System.IO.Path]::GetFullPath($InstallDir).TrimEnd('\')
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$pathEntries = @($userPath -split ';' | Where-Object { $_ })
$alreadyPresent = $pathEntries | Where-Object {
  [System.IO.Path]::GetFullPath($_).TrimEnd('\') -ieq $resolvedInstallDir
}
if (-not $alreadyPresent) {
  $updatedUserPath = (@($pathEntries) + $resolvedInstallDir) -join ';'
  [Environment]::SetEnvironmentVariable('Path', $updatedUserPath, 'User')
  Write-Host "เพิ่ม $resolvedInstallDir ใน User PATH แล้ว เปิด Terminal ใหม่เพื่อใช้ initskill"
}
