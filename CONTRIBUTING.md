# Contributing to Nodus

感谢你帮助改进 Nodus。欢迎可复现的问题报告、文档修正与聚焦的代码改进。

## 开始之前

请先阅读 [开发指南](docs/development.md)。较大的功能改动建议先开 Issue 说明用户需求与范围。

提交问题时说明操作系统、CPU 架构、Nodus 版本、复现步骤、预期和实际行为。仅使用无敏感信息的示例。不要上传 API Key、凭据文件、完整用户数据目录或私人任务备份。

## 提交改进

1. Fork 仓库并创建分支。
2. 完成聚焦的修改，保留用户已确认的要求和作品历史。
3. 运行 `pnpm run check` 和 `pnpm test`；界面或 Electron 改动还应做相应桌面验证。
4. 在 Pull Request 中说明具体行为变化、验证方式和仍未验证的部分。

不要用模拟模型的通过结果声称真实模型能力已验证，也不要将文件生成、程序检查和用户接受混为一谈。不要提交测试产生的数据或安装包；安装包通过 Releases 分发。

历史桌面脚本中，一部分依赖本机曾有的测试数据。请选择可独立复现的检查，不要为了让旧脚本通过而上传私人记录。参见开发指南。

By contributing, you agree that your contribution is provided under the repository's MIT license. Keep third-party notices intact.
