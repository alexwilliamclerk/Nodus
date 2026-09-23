# Windows 卸载 Nodus 与损坏卸载程序的修复

正常情况下，可以在 **Windows 设置 → 应用 → 已安装的应用 → Nodus → 卸载** 中删除程序。新版 Nodus 的设置页也提供“卸载应用…”按钮。卸载前请结束正在运行的任务，并备份重要作品。

卸载程序会移除应用和 Windows 的卸载入口。对话、作品和模型连接数据默认保留在 `%APPDATA%\Nodus\forma-data`，避免误卸载造成丢失。如果还要清除这些数据，请先备份，确认应用卸载成功后再自行删除这个目录。

## 出现“NSIS Error: Installer integrity check has failed”

这表示刚刚运行的 EXE 未通过 NSIS 自身的完整性检查。需要先确认双击的是下载的安装包，还是安装目录里的 `Uninstall Nodus.exe`。**不要使用 `/NCRC` 跳过校验，也不要关闭杀毒或系统防护。**

如果出错的是下载的安装包，请从 [Nodus Releases](https://github.com/alexwilliamclerk/Nodus/releases) 重新下载，并与同一版本的 `SHA256SUMS.txt` 比对。在 PowerShell 中运行 `Get-FileHash "C:\实际路径\Nodus-windows-x64.exe" -Algorithm SHA256` 可查看文件校验值。

如果出错的是 **`Uninstall Nodus.exe`**，请按以下顺序修复：

1. 关闭错误弹窗，退出 Nodus，并在任务管理器确认 `Nodus.exe` 已结束。
2. 找到旧版 Nodus 的安装目录。下面这条 PowerShell 命令只读取 Windows 卸载入口，显示卸载程序路径，不会修改电脑：

   ```powershell
   Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*','HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue | Where-Object DisplayName -Like 'Nodus*' | Select-Object DisplayName,UninstallString
   ```

3. 在显示的安装目录里，**只把** `Uninstall Nodus.exe` 移到该目录之外的备份文件夹。先保留这份损坏文件。不要动 `Nodus.exe`、`resources` 或 `%APPDATA%\Nodus\forma-data`。
4. 从 [Nodus Releases](https://github.com/alexwilliamclerk/Nodus/releases) 下载完整安装包，对照 `SHA256SUMS.txt` 验证后运行。在向导中选择**原来的安装目录**，让安装包重建卸载程序。
5. 安装完成后，到 **Windows 设置 → 应用 → 已安装的应用 → Nodus → 卸载**。确认应用文件和卸载入口都已消失。

我们在干净的 Windows 测试机上，故意损坏了 v1.2.0 的卸载程序，再将其移出安装目录；重新安装到同一目录后，卸载程序恢复，系统卸载成功。杀毒软件隔离、权限和旧版本差异仍可能使个别电脑结果不同。如果失败，请在 [Issues](https://github.com/alexwilliamclerk/Nodus/issues) 提供 Nodus 版本、Windows 版本、安装目录，以及报错的 EXE 文件名；不要公开 API Key、私人对话或任务数据。

## “未知应用”提示与完整性错误

当前 Nodus 安装包尚未正式签名。Windows SmartScreen 可能因签名或下载信誉不足提示“未知应用”；这与 NSIS 完整性错误不同。请先核对下载来源和 SHA-256，再决定是否运行，项目不要求关闭 Windows 安全功能。
