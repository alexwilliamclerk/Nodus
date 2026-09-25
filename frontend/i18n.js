// These translations apply to interface chrome. Task text, model output, and
// delivered files remain exactly as authored by the user or model.
let activeLanguage='zh-CN';
export const uiLanguage=()=>activeLanguage;
const english={
  '新对话':'New chat','新建对话':'New chat','添加插件':'Add plugins','已归档对话':'Archived chats','模型连接':'Model connections',
  '模型未配置':'Model not configured','尚未连接':'Not connected','设置与模型':'Settings & models','断开连接':'Disconnect',
  '收起侧栏':'Collapse sidebar','展开侧栏':'Expand sidebar','对话导航':'Chat navigation','对话列表':'Chat list',
  '当前操作':'Current action','对话记录':'Conversation','作品与方案':'Work & plan','作品预览':'Work preview',
  '方案说明':'Plan details','预览':'Preview','还原预览':'Restore preview','展开预览':'Expand preview',
  '收起预览':'Close preview','桌面预览':'Desktop preview','手机预览':'Mobile preview','刷新预览':'Refresh preview',
  '版本':'Version','尚未生成':'Nothing generated yet','生成作品后，可在这里查看和比较版本。':'Your work will appear here after it is created.',
  '置顶':'Pinned','项目':'Projects','最近':'Recent','右键对话可置顶':'Right-click a chat to pin it',
  '按项目组织对话':'Organize chats by project','暂无其他对话':'No other chats','新建项目':'New project',
  '新建项目…':'New project…','未分组':'Ungrouped','选择本地目录…':'Choose local folder…',
  '首次制作前请选择本地交付目录':'Choose a local delivery folder before production',
  '自动识别类型':'Detect type automatically','主产物类型':'Main deliverable type',
  '任务需求':'Task request','你想完成什么任务？':'What would you like to make?',
  '描述任务目标、交付格式和已有材料…':'Describe your goal, output format, and source materials…',
  '提交需求':'Submit request','选择制作方向':'Choose a direction','换一组':'New options',
  '帮我推荐':'Recommend','完成条件':'Completion conditions','提交选择':'Submit choice',
  '评价补充':'Additional feedback','补充你的直观感受…':'Add your impressions…',
  '调整':'Revise','查看依据':'View evidence','跳过':'Skip','提交评价，继续改进':'Submit feedback and continue',
  '恢复对话':'Restore chat','继续评价':'Continue review',
  '模型设置':'Model settings','返回重试':'Go back and retry','选择处理方式':'Choose what to do',
  '继续选择':'Continue choosing','查看已选':'Review choices','返回作品':'Return to work',
  '结束提问':'Finish questions','上一题':'Previous question','生成下一题':'Generate next question',
  '提交操作':'Submit action','提交选择并继续':'Submit and continue',
  '临时对话':'Quick chat','临时提问':'Quick question','取消':'Cancel',
  '问一个问题，完整答复后返回刚才的操作…':'Ask a question, then return to your task…',
  '提交临时对话':'Send question','停止':'Stop',
  '从一个想法出发，改变世界':'Start with an idea','描述你的任务目标和交付格式，我们一起确定方向。':'Describe the goal and output format. We will choose a direction together.',
  '任务要求':'Task requirements','查看作品':'View work','打开目录':'Open folder','导出作品…':'Export work…',
  '已保存':'Saved','保存中…':'Saving…','保存失败':'Save failed','处理中':'Working',
  '有效要求':'Active requirements','查看记录':'View activity','可能原因：':'Possible cause:','修改范围：':'Scope:','保持：':'Keep:',
  '设置与模型连接':'Settings & model connections','关闭设置':'Close settings','外观主题':'Appearance',
  '界面语言':'Interface language','简体中文':'Simplified Chinese',
  '浅色':'Light','深色':'Dark','跟随系统':'Follow system','应用更新':'App updates',
  '检查更新':'Check for updates','下载更新':'Download update','重新下载安装包':'Download installer again',
  '安装并重启':'Install and restart','安装更新并重启？':'Install update and restart?',
  '前往 GitHub 下载':'Open GitHub to download',
  '安装后删除旧版 AppImage（仅程序文件；任务与作品保留）':'Remove the old AppImage after installing (app file only; chats and work stay)',
  '已打开对应版本的 GitHub 发布页。下载 DMG 后，将 Nodus 拖入“应用程序”；选择“替换”会删除旧程序文件，任务与作品数据保留。':'The matching GitHub release page is open. Download the DMG and drag Nodus into Applications. Choosing Replace removes the old app files while keeping chats and work data.',
  '将先保存当前对话，再退出 Nodus 并安装已校验的更新。请先完成或停止正在运行的任务。':'The current chat will be saved before Nodus exits to install the verified update. Finish or stop any running task first.',
  '请先完成或停止正在运行的任务。':'Finish or stop the running task first.',
  '正在退出并安装更新…':'Exiting to install the update…',
  '打开安装包':'Open installer','定位 AppImage':'Show AppImage','查看发布页':'View releases',
  '卸载 Nodus':'Uninstall Nodus','卸载应用':'Uninstall app','卸载应用…':'Uninstall app…',
  '卸载报错怎么办？':'Uninstall troubleshooting','显示临时对话按钮':'Show quick chat button',
  '提供商入口':'Provider','连接名称（可选）':'Connection name (optional)',
  'OpenAI API（GPT）':'OpenAI API (GPT)','Anthropic API（Claude）':'Anthropic API (Claude)',
  '联网搜索':'Web search','搜索中…':'Searching…','搜索连接方式':'Search connection','复用当前模型 API Key':'Use current model API key','独立搜索 API Key':'Separate search API key',
  '搜索服务':'Search provider','搜索 API Key':'Search API key','在本机加密记住搜索 Key':'Remember search key encrypted on this device','保存搜索设置':'Save search settings','恢复已保存搜索连接':'Restore saved search connection',
  '搜索服务已连接。':'Search is connected.','选择搜索方式后保存。':'Choose a search mode and save.','联网搜索已关闭。':'Web search is off.','联网搜索已配置。':'Web search is configured.',
  '使用 OpenAI Platform 的 API Key；ChatGPT 订阅不是 API Key。留空优先使用 gpt-4.1，可填写账户可用的完整 GPT 模型 ID。':'Use an OpenAI Platform API key. A ChatGPT subscription is not an API key. Leave the model ID blank to prefer gpt-4.1, or enter an available GPT model ID.',
  '使用 Anthropic Console 的 API Key；Claude 订阅不是 API Key。留空优先使用 claude-sonnet-4-6，可填写账户可用的完整 Claude 模型 ID。':'Use an Anthropic Console API key. A Claude subscription is not an API key. Leave the model ID blank to prefer claude-sonnet-4-6, or enter an available Claude model ID.',
  '例如：开发用 Qwen':'For example: Development Qwen',
  '模型 ID':'Model ID','留空使用此入口的可用模型':'Leave blank to use an available model',
  'API Key / Coding Plan 凭据':'API key / Coding Plan credential',
  '从剪贴板粘贴':'Paste from clipboard','在本机记住连接':'Remember this connection on this device',
  '恢复已保存连接（系统授权）':'Restore saved connections (system authorization)',
  '尚未接入模型':'No model connections','尚未连接模型':'No model connected',
  '连接并验证':'Add and verify','添加并验证':'Add and verify','正在验证…':'Verifying…','关闭':'Close',
  '备份对话并导出':'Back up and export chats','备份对话并导出…':'Back up and export chats…',
  '连接模型':'Connect a model','选择已接入模型':'Choose a connected model','管理模型连接':'Manage model connections',
  '当前任务的预览节奏':'Preview cadence for this task',
  '手动确认后生成':'Generate after manual confirmation',
  '每 3 次修改生成预览':'Preview every 3 changes','每 5 次修改生成预览':'Preview every 5 changes',
  '每 8 次修改生成预览':'Preview every 8 changes',
  '仅本次使用':'This session only','已加密保存':'Encrypted on this device','当前':'Current',
  '正在连接模型':'Connecting to model','已连接':'Connected',
  '本机累计用量':'Recorded local usage','暂无已记录的模型用量':'No model usage recorded',
  '打开已有对话':'Open a chat','打开已有对话…':'Open a chat…','打开文件作为材料…':'Open file as material…',
  '导出当前作品…':'Export current work…','打开作品目录':'Open work folder',
  '保存对话':'Save chat','关闭窗口':'Close window','退出 Nodus':'Quit Nodus',
  '关于 Nodus':'About Nodus','设置…':'Settings…','隐藏 Nodus':'Hide Nodus',
  '隐藏其他应用':'Hide others','显示全部':'Show all','文件':'File','编辑':'Edit','视图':'View',
  '窗口':'Window','设置':'Settings','模型与应用设置…':'Model & app settings…',
  '撤销':'Undo','重做':'Redo','剪切':'Cut','复制':'Copy','粘贴':'Paste','全选':'Select all',
  '显示／隐藏预览':'Show / hide preview','实际大小':'Actual size','放大':'Zoom in',
  '缩小':'Zoom out','切换全屏':'Toggle full screen','最小化':'Minimize','缩放窗口':'Zoom window',
  '全部置于前面':'Bring all to front',
  '选择作品交付目录':'Choose work delivery folder','导出作品到文件夹':'Export work to folder',
  '添加任务材料':'Add task materials','ZIP 备份':'ZIP backup',
  '确认卸载 Nodus？':'Uninstall Nodus?',
  '应用将退出并启动 Windows 卸载程序。对话、作品和已保存的连接数据会留在本机，以免意外丢失。':'Nodus will quit and start the Windows uninstaller. Conversations, work files, and saved connection data remain on this device to prevent accidental loss.',
  '已在文件管理器中定位新版 AppImage。退出 Nodus 后用它替换旧文件，再重新启动。':'The new AppImage is shown in your file manager. Quit Nodus, replace the old file, then restart.',
  '已打开 DMG。退出 Nodus 后将新版拖入“应用程序”并覆盖旧版。':'The DMG is open. Quit Nodus, then drag the new app into Applications and replace the old version.',
  '安装程序已打开。请退出 Nodus，再按安装向导完成更新。':'The installer is open. Quit Nodus, then follow the installer to finish updating.',
  '页面视觉':'Page visuals','交互与动效':'Interactions & motion','页面内容':'Page content',
  '适配与资源':'Responsive layout & assets','报告结构':'Report structure','事实与来源':'Facts & sources',
  '论证与结论':'Reasoning & conclusions','文字表达':'Writing',
  '叙事结构':'Narrative structure','信息密度':'Information density','演讲备注':'Speaker notes',
  '数据读取':'Data input','处理逻辑':'Processing logic','输出结果':'Output','依赖与说明':'Dependencies & instructions',
  '输入材料':'Input material','统计指标':'Statistics','结果解读':'Interpreting results','交付内容':'Deliverables',
  'PPT／演示文稿':'Presentation','Python 脚本／工程':'Python project','网站／网页':'Website',
  '需求符合度':'Requirements met','视觉表现':'Visual quality','信息清晰度':'Information clarity',
  '交互可用性':'Interaction usability','论证清晰度':'Strength of argument','来源透明度':'Source transparency',
  '结论实用性':'Practical conclusions','叙事结构':'Narrative structure','页面可读性':'Slide readability',
  '内容准确性':'Content accuracy','代码清晰度':'Code clarity','运行说明':'Run instructions',
  '可维护性':'Maintainability','数据可追溯性':'Data traceability','方法透明度':'Method transparency',
  '结果可读性':'Result clarity',
  '1 分：差距明显；3 分：基本符合；5 分：符合预期':'1: Significant gaps; 3: Mostly meets expectations; 5: Meets expectations',
  'MiniMax 中国 API':'MiniMax China API','MiniMax 全球 API':'MiniMax Global API',
  'MiniMax API（中国）':'MiniMax API (China)','MiniMax API（全球）':'MiniMax API (Global)',
  'Moonshot 中国 API':'Moonshot China API','Moonshot 全球 API':'Moonshot Global API',
  'Qwen 百炼 API':'Qwen Bailian API','智谱中国 Coding Plan':'Zhipu China Coding Plan',
  'Qwen 百炼 API（中国北京）':'Qwen Bailian API (China, Beijing)',
  'Kimi 开放平台（中国 · platform.kimi.com）':'Kimi Open Platform (China · platform.kimi.com)',
  'Kimi 开放平台（全球 · platform.kimi.ai）':'Kimi Open Platform (Global · platform.kimi.ai)',
  '智谱 Coding Plan（中国）':'Zhipu Coding Plan (China)',
  '智谱 Coding Plan（全球）':'Zhipu Coding Plan (Global)',
  '智谱全球 Coding Plan':'Zhipu Global Coding Plan','模型':'Model',
  '接下来你想怎么处理？':'What would you like to do next?',
  '接下来如何处理？':'How would you like to proceed?',
  '确认接下来的操作':'Confirm the next action','你想调整哪一部分？':'Which part would you like to revise?',
  '调整当前任务':'Revise this task','补充要求':'Add requirements','按原计划继续':'Continue as planned',
  '暂时结束':'Pause for now','调整后重试':'Revise and retry','按原要求重试':'Retry with the same requirements',
  '更换模型':'Change model','确认并执行':'Confirm and execute',
  '返回调整选择':'Go back and revise choices','继续细化':'Refine further','暂存，不执行':'Save for later, do not execute',
  '任务目标':'Task goal','已有材料':'Existing material','交付约束':'Delivery constraints','交付格式':'Output format',
  '效果':'Effect','取舍':'Trade-off','适用条件':'When to use','具体做法':'How it works',
  '预期效果':'Expected effect','主要取舍':'Main trade-off',
  '补充自己的方向':'Add your own direction','补充自己的方向或具体要求…':'Add your own direction or specific requirements…',
  '完整说明与补充':'Details and notes','已补充':'Notes added',
  '补充这一项的具体要求…':'Add specific requirements for this option…',
  '推荐方向':'Recommended direction','暂无推荐':'No recommendation',
  '查看已选路径':'Review choices','已选路径':'Chosen path','待确认范围':'Scope to confirm',
  '尚无作品':'No work yet','尚无已确认要求。':'No confirmed requirements yet.',
  '目标':'Goal','禁止事项':'Prohibitions','保留项':'Keep','验收条件':'Acceptance criteria','约束':'Constraints',
  '修改规则':'Edit requirement','恢复要求':'Restore requirement','停用要求':'Retire requirement',
  '持续生效':'Active','已停用':'Retired','规则变更记录':'Requirement changes',
  '确认':'Confirm','确定':'OK','返回':'Back',
  '确认已选修改并预览…':'Confirm selected changes and preview…',
  '网站 / 网页':'Website','调研报告':'Research report','PPT / 演示文稿':'Presentation',
  'Python 脚本 / 工程':'Python project','数据分析':'Data analysis',
  'Agent 模式':'Agent mode','任务所属项目':'Task project','模型连接管理':'Manage model connections',
  '添加材料':'Add material','管理当前对话':'Manage current chat','调整侧栏宽度':'Resize sidebar',
  '调整预览宽度':'Resize preview','选择作品保存的本地目录':'Choose a local work folder',
  '选择作品版本':'Choose work version',
  '/plan：先规划，确认后执行；/goat：提交即授权自主制作，单次最多3次尝试，可随时停止':'/plan: plan and confirm before execution; /goat: submit to authorize autonomous work, at most three attempts; stop at any time',
  '选择次数即授权按之后提交的修改自动制作新版本（消耗模型用量）。只用于已有作品的修改；普通答疑不计数，每版完成后停在评分处。可随时改回手动。':'This setting authorizes a new preview after the selected number of submitted changes (uses model tokens). It applies only to revisions of existing work. Ordinary questions do not count; each preview stops for review. You can return to manual mode at any time.',
  '检查 GitHub Releases 上的最新版本；下载安装包后会校验 SHA-256。':'Check GitHub Releases for the latest version. Downloaded installers are verified with SHA-256.',
  '凭据仅在本机加密保存。任务材料会发送给你配置的模型服务。':'Credentials are encrypted only when saved on this device. Task materials are sent to your configured model service.',
  '默认仅在本次运行使用，不保存密钥。主动记住或恢复连接可能需要系统授权。':'By default, credentials are used only for this session. Saving or restoring a connection may need system authorization.',
  '启动 Windows 卸载程序前会再次确认。卸载应用不会自动删除对话、作品和连接数据。若曾看到 NSIS 完整性错误，请先阅读“卸载报错怎么办？”。':'We will confirm before starting the Windows uninstaller. Removing the app keeps conversations, work, and connection data. If you saw an NSIS integrity error, read Uninstall troubleshooting first.',
  'DeepSeek 普通 API Key，留空默认 deepseek-flash（V4.1 Flash）。':'DeepSeek standard API key; leaving the model blank selects deepseek-flash (V4.1 Flash).',
  'MiniMax 中国站 API Key，接口 api.minimaxi.com/anthropic；模型须在账户权限内。':'MiniMax China API key for api.minimaxi.com/anthropic; the model must be available to your account.',
  'MiniMax 全球站 API Key，接口 api.minimax.io/anthropic。':'MiniMax Global API key for api.minimax.io/anthropic.',
  'platform.kimi.ai 国际站 Key；使用 api.moonshot.ai/v1。与中国站账户和 Key 隔离。':'platform.kimi.ai international key for api.moonshot.ai/v1. Accounts and keys are separate from the China site.',
  'platform.kimi.com 中国站 Key；使用 api.moonshot.cn/v1 和 Bearer 认证。先查询账户模型列表，留空优先选择列表中的 kimi-k3。':'platform.kimi.com China key for api.moonshot.cn/v1 with Bearer authentication. Available models are fetched first; leaving the model blank prefers kimi-k3 when available.',
  '仅适用 Kimi Code 订阅凭据。platform.kimi.com 创建的开放平台 Key 请选中国开放平台，不要选此项。':'For Kimi Code subscription credentials only. For a platform.kimi.com open-platform key, choose the China open-platform provider instead.',
  '使用智谱中国区 Coding Plan 凭据；入口 open.bigmodel.cn/api/coding/paas/v4。':'Use a Zhipu China Coding Plan credential with open.bigmodel.cn/api/coding/paas/v4.',
  '使用智谱全球 Coding Plan 凭据；入口 api.z.ai/api/coding/paas/v4。':'Use a Zhipu Global Coding Plan credential with api.z.ai/api/coding/paas/v4.',
  '阿里云百炼中国北京普通 API Key；不是 Coding Plan。默认 qwen-plus，支持 qwen-turbo、qwen-max，当前只接入文本。':'Alibaba Bailian China (Beijing) standard API key, not a Coding Plan credential. The default is qwen-plus; qwen-turbo and qwen-max are supported for text.',
  '连接已添加，可以继续添加或关闭设置后切换。':'Connection added. Add another or close Settings to switch models.',
  '模型已添加，可以继续添加或关闭设置后切换。':'Model added. Add another or close Settings to switch models.',
  '当前任务还没有模型返回的推荐理由。':'The model has not provided a recommendation for this task.',
  '推荐供你参考，提交选择后才执行。':'The recommendation is for reference; work starts only after you submit a choice.',
  '补充会随方案提交；在此编辑不会开始制作。':'Your notes will be submitted with the option. Editing here will not start production.',
  '未选择方案、草稿和返回后失效的分支不会进入要求清单。停用只影响后续版本，不改写历史证据。':'Unchosen options, drafts, and invalidated branches are excluded from requirements. Retiring an item affects future versions without changing history.',
  '主产物类型；项目仅用于对话分组':'Main deliverable type; projects only group chats',
  '保存后更新后续调用使用的规则，旧文本保留在变更记录中。':'Saving updates the requirement for future calls. The previous text remains in change history.',
  '在此编辑不会开始制作。':'Editing here will not start production.',
  '临时对话 · 正在答复':'Quick chat · Replying','正在生成方案':'Generating options',
  '正在生成下一问题':'Generating the next question','正在答复':'Replying','正在识别请求':'Understanding request',
  '正在制作':'Creating work','正在修改':'Revising work','正在恢复版本':'Restoring version',
  '正在核对作品是否符合已确认要求':'Checking work against confirmed requirements',
  '正在检查 GitHub 最新版本…':'Checking GitHub for updates…',
  '正在下载并校验安装包…':'Downloading and verifying installer…',
  '正在导出…':'Exporting…','任务处理中':'Task in progress',
  '本机累计用量：0 Token\n暂无已记录的模型用量':'Recorded local usage: 0 tokens\nNo model usage recorded',
  '移到项目':'Move to project','重命名对话':'Rename chat','删除这条对话？':'Delete this chat?',
  '归档':'Archive','恢复':'Restore','取消置顶':'Unpin','删除':'Delete',
  '项目用于归组对话，不移动已有作品文件。':'Projects group chats and do not move work files.',
  '项目用于分组对话，本地目录单独选择。':'Projects group chats; choose a local folder separately.',
  '只修改名称，记录与作品保持原样。':'Only the name changes. Conversation and work remain unchanged.',
  '输入已有项目名称或新项目名称；留空移回最近。':'Enter an existing or new project name; leave blank to move back to Recent.',
  '移除当前模型连接？':'Remove this model connection?',
  '移除此模型连接及其已保存凭据？任务和作品保留。':'Remove this connection and its saved credential? Tasks and work will remain.',
  '此对话仍在运行，请先停止再归档或删除。':'This chat is still running. Stop it before archiving or deleting.',
  '请先描述任务目标与交付格式。':'Describe your goal and output format first.',
  '请先确定主产物类型，再确认执行。':'Choose the main deliverable type before confirming execution.',
  '请先规划并确定产物类型。':'Plan the task and choose a deliverable type first.',
  '请先填写问题。':'Enter a question first.',
  '请先完成或关闭当前对话框。':'Finish or close the current dialog first.',
  '请先在本机填写此入口的凭据。':'Enter a credential for this provider on this device.',
  '材料正在读取，请稍后提交。':'Materials are still loading. Please submit again shortly.',
  '请在需求或方案阶段添加材料，等待当前操作结束。':'Add materials while defining requirements or options, after the current action finishes.',
  '请将文件拖到下方输入框中。':'Drop files in the composer below.',
  '至少填写一项评分或补充意见。':'Enter at least one rating or comment.',
  '请填写有效范围和相对文件名。':'Enter a valid range and relative filename.',
  '请通过 Nodus 桌面应用打开；此界面需要本机任务与模型接口。':'Open this screen in the Nodus desktop app; it requires local task and model APIs.',
  '请求识别失败，输入已保留，请重试或使用选项按钮继续。':'Could not understand the request. Your input is preserved; retry or use the option buttons.',
  '已配置的自动检查通过；不代表未配置的要求已验证。':'Configured automated checks passed; other requirements have not been verified.',
  '产物已生成，仍有条件需要人工确认。':'Work was generated; some conditions need human review.',
  '文件已变化，旧验证证据失效。':'Files changed; previous verification is stale.',
  '存在未满足条件。':'Some conditions are not met.',
  '完成记录不可读取；原始文件已保留，此版本尚未验证。':'The completion record could not be read. Original files remain; this version is unverified.',
  '仍需人工验收。':'Human review is still needed.',
  '文件协议检查通过；尚未逐项验证任务目标。':'File checks passed; task goals have not all been verified.',
  '请查看并验收。':'Review and accept the work.','尚未验证':'Not verified',
  '尚未生成作品':'No work generated yet','未命名对话':'Unnamed chat',
  '待选择':'Awaiting choice','待澄清':'Needs clarification','可评价':'Ready to review',
  '暂未评价':'Not reviewed yet','待验收':'Awaiting acceptance','已接受':'Accepted',
  '已读取':'Read','未解析':'Unreadable','图片待发送':'Image ready to send','需视觉模型':'Vision model required',
  '已打开安装包':'Installer opened',
  '已读取文字；点击移除':'Text read; click to remove',
  '图片已保留；请连接支持视觉的模型，或移除图片后继续。':'Image kept. Connect a vision-capable model or remove the image to continue.',
  '操作已停止，已有作品与部分文件保留。':'Operation stopped; existing work and partial files remain.',
  '对话已保存':'Chat saved','已保存；提交制作时确认执行':'Saved; confirm when you submit production',
  '使用了已校验的本地文件。':'Used a previously verified local file.',
  '初始生成':'Initial version','确认修改':'Confirmed revision','决策说明':'Decision explanation',
  '执行确认':'Execution confirmation','执行输出':'Execution output','完整答复':'Full reply',
  '请求未执行':'Request not executed','操作完成':'Action completed',
  '任务规则':'Task requirements','作品':'Work','产物':'Deliverable',
  '主产物：':'Main deliverable: ',
  '你可以组合选择，也可以补充自己的想法。':'You can combine options or add your own ideas.',
  '输入':'Input','运行':'Run','依赖':'Dependencies','限制':'Limitations',
  '摘要':'Summary','方法':'Method','结果':'Results','结论':'Conclusion',
  '识别类型':'Detect type','在需要制作作品时手动识别产物类型':'Detect a deliverable type when you want to create work',
  '想聊什么，或想制作什么？':'What would you like to chat about or create?',
  '消息或任务需求':'Message or task request',
  '直接聊天；需要制作作品时点击“制作作品”…':'Chat freely; choose Create work when you want a deliverable…',
  '制作作品':'Create work','发送消息':'Send message',
  '请先输入消息。':'Enter a message first.',
  '请先停止当前操作，再识别产物类型。':'Stop the current action before detecting a deliverable type.',
  '识别产物类型':'Detect deliverable type',
  'Word 文档':'Word document','Excel 工作簿':'Excel workbook','通用代码工程':'General code project',
  '其他类型，先讨论…':'Other type — discuss first',
  '描述你要制作的作品。普通聊天不会自动识别类型；确认后才会生成方案。':'Describe the work you want to create. Ordinary chats do not trigger type detection; options are generated only after you confirm.',
};

const patterns=[
  [/^当前 v([\d.]+)，发现新版 v([\d.]+)。前往 GitHub 下载 DMG，安装时可选择替换旧应用。$/,([,current,latest])=>`Current v${current}; v${latest} is available. Open GitHub for the DMG and choose whether to replace the old app during installation.`],
  [/^当前 v([\d.]+)，发现新版 v([\d.]+)。下载后可在应用内安装并重启。$/,([,current,latest])=>`Current v${current}; v${latest} is available. Download, then install and restart in the app.`],
  [/^当前 v([\d.]+)，发现新版 v([\d.]+)。可下载并校验安装包，再按安装向导更新。$/,([,current,latest])=>`Current v${current}; v${latest} is available. Download and verify the installer, then follow its setup steps.`],
  [/^目录：(.+)$/,([,name])=>`Folder: ${name}`],
  [/^查看作品 · (V\d+)$/,([,version])=>`View work · ${version}`],
  [/^有效要求 · (\d+) 项$/,([,count])=>`Active requirements · ${count}`],
  [/^查看记录 · (\d+) 条$/,([,count])=>`View activity · ${count}`],
  [/^评价 (V\d+) · 这版符合你的期待吗？$/,([,version])=>`Review ${version} · Does this version meet your expectations?`],
  [/^接受 (V\d+) 并结束$/,([,version])=>`Accept ${version} and finish`],
  [/^(.+) · 已连接$/,([,name])=>`${name} · Connected`],
  [/^当前 v([\d.]+)，发现新版 v([\d.]+)。可下载并校验安装包。$/,([,current,latest])=>`Current v${current}; v${latest} is available. Download and verify the installer.`],
  [/^当前已是最新版本 v([\d.]+)。$/,([,version])=>`You have the latest version, v${version}.`],
  [/^正在下载更新包：(\d+)%$/,([,percent])=>`Downloading update: ${percent}%`],
  [/^v([\d.]+) 安装包已下载并通过 SHA-256 校验。$/,([,version])=>`Installer v${version} downloaded and verified with SHA-256.`],
  [/^已累计 (\d+) 次修改选择$/,([,count])=>`${count} submitted changes`],
  [/^([Vv]\d+) · 初始生成$/,([,version])=>`${version} · Initial version`],
  [/^([Vv]\d+) · 决策修改$/,([,version])=>`${version} · Revised version`],
  [/^([Vv]\d+) · 自主制作$/,([,version])=>`${version} · Autonomous version`],
  [/^([Vv]\d+) · 恢复自 ([Vv]\d+)$/,([,version,source])=>`${version} · Restored from ${source}`],
  [/^(.+)：详情与补充$/,([,title])=>`${title}: details and notes`],
  [/^(.+) (\d+) 分$/,([,name,score])=>`${translateUiText(name,'en-US')} ${score} points`],
  [/^本机累计用量：(.+) Token\n(\d+) 次模型响应（所有任务与模型的已记录用量）$/,([,tokens,count])=>`Recorded local usage: ${tokens} tokens\n${count} recorded model responses across all tasks and models`],
  [/^当前 v([\d.]+)，发现新版 v([\d.]+)。可下载并校验安装包。$/,([,current,latest])=>`Current v${current}; v${latest} is available. Download and verify the installer.`],
  [/^发现新版 v([\d.]+)，但此平台的安装包或校验文件尚未备齐。$/,([,version])=>`v${version} is available, but this platform's installer or checksum file is not ready yet.`],
  [/^当前已是最新版本 v([\d.]+)。如本机安装文件损坏，可重新下载安装包；若卸载程序报完整性错误，请先阅读下方“卸载报错怎么办？”。$/,([,version])=>`You have the latest version, v${version}. You may download the installer again to repair local installation files. If the uninstaller has an integrity error, read Uninstall troubleshooting first.`],
  [/^v([\d.]+) 安装包已下载并通过 SHA-256 校验。使用了已校验的本地文件。$/,([,version])=>`Installer v${version} is verified with SHA-256; a verified local copy was reused.`],
  [/^检查更新失败：(.+)$/,([,detail])=>`Update check failed: ${translateUiText(detail,'en-US')}`],
  [/^下载更新失败：(.+)$/,([,detail])=>`Update download failed: ${translateUiText(detail,'en-US')}`],
  [/^无法打开安装包：(.+)$/,([,detail])=>`Could not open installer: ${translateUiText(detail,'en-US')}`],
  [/^已归档$/,()=> 'Archived'],[/^待选择$/,()=> 'Awaiting choice'],
];

export function translateUiText(value,language='zh-CN'){
  if(language!=='en-US'||typeof value!=='string')return value;
  const match=/^(\s*)(.*?)(\s*)$/s.exec(value);
  const source=match[2];
  const translated=english[source]||patterns.map(([pattern,render])=>{const found=pattern.exec(source);return found?render(found):null;}).find(Boolean);
  return translated?match[1]+translated+match[3]:value;
}

export function createUiTranslator(document){
  let language='zh-CN';
  const originals=new WeakMap();
  const attributes=new WeakMap();
  const translatableAttributes=['aria-label','title','placeholder'];
  const skipped=node=>node.parentElement?.closest('textarea, input, #timeline .event p, #timeline .event-meta, #explanationView p');
  function translateNode(node){
    if(node.nodeType===3){
      if(skipped(node))return;
      let entry=originals.get(node);
      if(!entry||node.nodeValue!==entry.rendered){entry={source:node.nodeValue,rendered:node.nodeValue};originals.set(node,entry);}
      const next=translateUiText(entry.source,language);
      if(node.nodeValue!==next)node.nodeValue=next;
      entry.rendered=next;
      return;
    }
    if(node.nodeType!==1)return;
    translateAttributes(node);
    const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);
    while(walker.nextNode())translateNode(walker.currentNode);
    for(const element of node.querySelectorAll('[aria-label],[title],[placeholder]'))translateAttributes(element);
  }
  function translateAttributes(node){
    for(const name of translatableAttributes){
      if(!node.hasAttribute(name))continue;
      let values=attributes.get(node);
      if(!values){values=new Map();attributes.set(node,values);}
      const current=node.getAttribute(name);
      let entry=values.get(name);
      if(!entry||current!==entry.rendered){entry={source:current,rendered:current};values.set(name,entry);}
      const next=translateUiText(entry.source,language);
      if(current!==next)node.setAttribute(name,next);
      entry.rendered=next;
    }
  }
  const observer=new MutationObserver(records=>{
    for(const record of records){
      if(record.type==='attributes'){translateAttributes(record.target);continue;}
      for(const node of record.addedNodes)translateNode(node);
    }
  });
  return {
    set(next){
      language=next==='en-US'?'en-US':'zh-CN';
      activeLanguage=language;
      document.documentElement.lang=language;
      document.title=language==='en-US'?'Nodus · Agent Workspace':'Nodus · Agent 工作台';
      translateNode(document.body);
    },
    start(){observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:translatableAttributes});},
    refresh(){translateNode(document.body);},
  };
}
