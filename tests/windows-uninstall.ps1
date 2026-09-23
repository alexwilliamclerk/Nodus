param([string]$InstallerPath = '', [switch]$SimulateCorruption)
$ErrorActionPreference = 'Stop'
$installer = if ($InstallerPath) { (Resolve-Path $InstallerPath).Path } else { Join-Path $env:RUNNER_TEMP 'Nodus-Setup.exe' }
$installDir = Join-Path $env:RUNNER_TEMP 'Nodus-installed'
$url = 'https://github.com/alexwilliamclerk/Nodus/releases/download/v1.2.0/Nodus-windows-x64.exe'
if (-not $InstallerPath) { Invoke-WebRequest $url -OutFile $installer }

$install = Start-Process -FilePath $installer -ArgumentList @('/S', "/D=$installDir") -PassThru -Wait
if ($install.ExitCode -ne 0) { throw "Installer failed with exit code $($install.ExitCode)" }
$appExe = Join-Path $installDir 'Nodus.exe'
if (-not (Test-Path $appExe)) { throw "Nodus.exe was not installed at $installDir" }

$registryPaths = @(
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
)
function Get-NodusUninstallEntries {
  foreach ($registryPath in $registryPaths) {
    Get-ItemProperty $registryPath -ErrorAction SilentlyContinue |
      Where-Object { $_.DisplayName -like 'Nodus*' }
  }
}
$entries = @(Get-NodusUninstallEntries)
if ($entries.Count -ne 1) { throw "Expected one Windows Apps uninstall entry, found $($entries.Count)" }
Write-Host "Uninstall entry: $($entries[0].DisplayName)"
Write-Host "Uninstall command: $($entries[0].UninstallString)"

$uninstaller = Get-ChildItem $installDir -Filter '*uninstall*.exe' -File | Select-Object -First 1
if (-not $uninstaller) { throw 'The installed app has no uninstaller executable' }
if ($SimulateCorruption) {
  $originalHash = (Get-FileHash $uninstaller.FullName -Algorithm SHA256).Hash
  $content = [System.IO.File]::ReadAllBytes($uninstaller.FullName)
  $content[[int]($content.Length / 2)] = $content[[int]($content.Length / 2)] -bxor 1
  [System.IO.File]::WriteAllBytes($uninstaller.FullName, $content)
  if ((Get-FileHash $uninstaller.FullName -Algorithm SHA256).Hash -eq $originalHash) { throw 'Corruption simulation did not change the uninstaller' }
  $repair = Start-Process -FilePath $installer -ArgumentList @('/S', "/D=$installDir") -PassThru -Wait
  if ($repair.ExitCode -ne 0) { throw "Repair installation failed with exit code $($repair.ExitCode)" }
  $uninstaller = Get-ChildItem $installDir -Filter '*uninstall*.exe' -File | Select-Object -First 1
  if (-not $uninstaller) { throw 'Repair installation did not restore the uninstaller' }
  if ((Get-FileHash $uninstaller.FullName -Algorithm SHA256).Hash -ne $originalHash) { throw 'Repair installation did not restore the original uninstaller bytes' }
  Write-Host 'The same installer restored a deliberately corrupted uninstaller.'
}
$remove = Start-Process -FilePath $uninstaller.FullName -ArgumentList '/S' -PassThru -Wait
if ($remove.ExitCode -ne 0) { throw "Uninstaller failed with exit code $($remove.ExitCode)" }
if (Test-Path $appExe) { throw 'Nodus.exe remains after uninstall' }
if (@(Get-NodusUninstallEntries).Count -ne 0) { throw 'Windows Apps uninstall entry remains after uninstall' }
Write-Host 'Windows installer, Apps entry, and uninstaller all passed.'
