# Nodus: try without a key / 免密钥体验

The demo is included in v1.5.2.
v1.5.2 安装包已包含此演示。

## Desktop / 桌面版

Open **Try without a key / 免密钥体验** in the sidebar or an empty conversation. Three fictional cases explain prompt injection, reviewable memory and budgets with compression. Next, Back and Replay never call a model or change task permissions.

“创建真实试用任务”只复制虚构输入，创建独立的 `/plan` 任务，不自动运行。原来的任务保持不变；接入模型并检查授权后，需要手动提交。

## Browser / 浏览器

From the repository root run:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open [the local demo](http://127.0.0.1:8765/docs/demo/). Use an HTTP server because the demo uses JavaScript modules. All assets are local; no analytics, model credentials or remote fonts are required. The GitHub/download links only navigate when clicked. This local URL is not a public hosted demo.

浏览器版本复用桌面演示组件，不提供模型连接或任务存储。可切换中英文，在窄屏上使用。尚未部署公共演示站点。

## Short recording / 简短录屏

[Watch the recorded scripted demo](nodus-demo.webm). It shows the actual desktop demo with fictional inputs; it is not a recording of a live model evaluation.

Re-record from the repository root with `node scripts/record-demo.mjs`. Recording uses an isolated temporary profile and no model. No user data or credentials are included.

## What to verify next / 下一步验证

- [Prompt injection: check effects and task completion separately](../tutorials/prompt-injection.md)
- [Reviewable memory: retain uncertainty and revoke future use](../tutorials/reviewable-memory.md)

The teaching budget is not a recommendation, and character reduction is not a measured token or cost saving. Use real runs to examine your model's behavior. A single successful example does not establish general protection.
