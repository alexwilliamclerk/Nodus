# Windows: uninstall Nodus or repair a damaged uninstaller

Nodus appears in **Windows Settings → Apps → Installed apps → Nodus**. Recent versions also have an **Uninstall app** button in Nodus Settings. Close running tasks and back up important work before uninstalling.

Uninstalling removes the application and its Windows uninstall entry. It keeps task and model-connection data in `%APPDATA%\Nodus\forma-data` so an accidental uninstall does not erase your work. If you also want to remove that data, back it up first, then delete the directory yourself after confirming Nodus has been uninstalled.

## If “NSIS Error: Installer integrity check has failed” appears

This means the EXE you opened failed NSIS's self-check. The damaged file may be the downloaded installer or the installed `Uninstall Nodus.exe`. **Do not use `/NCRC`, disable antivirus protection, or run an unverified replacement file.**

If you opened the downloaded installer, get a fresh copy from [Nodus Releases](https://github.com/alexwilliamclerk/Nodus/releases) and compare its SHA-256 with `SHA256SUMS.txt` on that release page. In PowerShell, run `Get-FileHash "C:\path\to\Nodus-windows-x64.exe" -Algorithm SHA256` with the actual downloaded file path.

If you opened **`Uninstall Nodus.exe`**, use these steps:

1. Close the error message and quit Nodus. Check Task Manager to make sure `Nodus.exe` is no longer running.
2. Find the installed Nodus directory. You can locate its uninstall command with this read-only PowerShell command:

   ```powershell
   Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*','HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue | Where-Object DisplayName -Like 'Nodus*' | Select-Object DisplayName,UninstallString
   ```

3. In that installed directory, move **only** `Uninstall Nodus.exe` to a backup folder outside the Nodus installation directory. Keep the damaged copy until the repair is complete. Do not delete `Nodus.exe`, `resources`, or `%APPDATA%\Nodus\forma-data`.
4. Download a fresh installer from [Nodus Releases](https://github.com/alexwilliamclerk/Nodus/releases), verify it against that release's `SHA256SUMS.txt`, and run it. Choose the **same installation directory** as the previous installation. The installer will recreate `Uninstall Nodus.exe`.
5. After installation finishes, use **Windows Settings → Apps → Installed apps → Nodus → Uninstall**. Confirm that the application and its Windows uninstall entry disappear.

This recovery was tested on a clean Windows runner by deliberately damaging the v1.2.0 uninstaller, moving it aside, reinstalling into the same directory, and then uninstalling successfully. Results can differ on a device with antivirus quarantine, unusual permissions, or an older installer. If repair still fails, open an [issue](https://github.com/alexwilliamclerk/Nodus/issues) with the Nodus version, Windows version, installation directory, and which EXE showed the error. Do not post personal data, API keys, or your task directory.

## Security warning versus integrity failure

Nodus installers are currently unsigned. Windows SmartScreen may show an “unrecognized app” warning for unsigned or low-reputation downloads. That warning is different from the NSIS integrity error. Verify the download source and SHA-256 before deciding whether to run it; the project does not ask you to turn off Windows security features.
