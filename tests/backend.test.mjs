import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { StorageService } from "../backend/storage.mjs";
import { PiService, normalizeEvent } from "../backend/pi-service.mjs";
import {interviewFixture} from './helpers/artifact-fixtures.mjs';

const testRoot = path.join(process.cwd(), ".forma-data", `backend-test-${process.pid}`);

test.after(async () => {
  await rm(testRoot, { recursive: true, force: true });
});

test("task state survives reload and version restore copies the source", async () => {
  const storage = new StorageService(testRoot);
  await storage.initialize();
  const state = {
    schemaVersion: 1,
    activeTaskId: "task-a",
    settings: { provider: "deepseek", modelId: "deepseek-chat" },
    tasks: [{ id: "task-a", requirement: "制作企业页面", ratings: { v1: { 视觉表现: 4 } } }],
  };
  await storage.saveState(state);
  assert.deepEqual(await storage.loadState(), state);

  const v1 = await storage.prepareVersion("task-a", "v1");
  await writeFile(path.join(v1, "index.html"), "<!doctype html><html><body>V1</body></html>", "utf8");
  const v2 = await storage.prepareVersion("task-a", "v2", "v1");
  assert.equal(await readFile(path.join(v2, "index.html"), "utf8"), "<!doctype html><html><body>V1</body></html>");
  assert.equal(await storage.artifactExists("task-a", "v2"), true);

  const working = await storage.prepareWorkingVersion("task-a", "v3", "v1");
  await writeFile(path.join(working, "index.html"), "<!doctype html><html><body>V3</body></html>", "utf8");
  assert.equal(await storage.artifactExists("task-a", "v3"), false);
  await storage.commitWorkingVersion("task-a", "v3", working);
  assert.equal(await storage.artifactExists("task-a", "v3"), true);
});

test("Pi SDK initializes without pretending a model is configured", async () => {
  const piDir = path.join(testRoot, "pi-no-credential");
  await mkdir(piDir, { recursive: true });
  const service = new PiService({ piDir, emit: () => {} });
  await service.initialize();
  assert.equal(service.status().configured, false);
  await assert.rejects(
    service.generateOptions({ requirement: "制作企业页面" }),
    /尚未配置真实模型/,
  );
});

test('provider credentials select distinct Moonshot, Coding and GLM endpoints; unknown model rolls back',async()=>{
  const service=new PiService({piDir:path.join(testRoot,'provider-routing'),emit:()=>{}});
  await mkdir(service.piDir,{recursive:true});
  const cases=[
    ['moonshotai-cn','https://api.moonshot.cn/v1','openai-completions'],
    ['moonshotai','https://api.moonshot.ai/v1','openai-completions'],
    ['kimi-coding','https://api.kimi.com/coding','anthropic-messages'],
    ['minimax-cn','https://api.minimaxi.com/anthropic','anthropic-messages'],
    ['minimax','https://api.minimax.io/anthropic','anthropic-messages'],
    ['qwen-api-cn','https://dashscope.aliyuncs.com/compatible-mode/v1','openai-completions'],
    ['zai-coding-cn','https://open.bigmodel.cn/api/coding/paas/v4','openai-completions'],
    ['zai','https://api.z.ai/api/coding/paas/v4','openai-completions'],
    ['deepseek','https://api.deepseek.com','openai-completions'],
  ];
  for(const [providerId,baseUrl,api] of cases){
    await service.configure({providerId,apiKey:'local-test-not-a-real-key',verify:false});
    assert.equal(service.model.baseUrl,baseUrl);assert.equal(service.model.api,api);
    if(providerId==='kimi-coding')assert.equal(service.modelId,'kimi-for-coding');
    if(providerId==='qwen-api-cn')assert.equal(service.modelId,'qwen-plus');
    if(providerId==='deepseek') {
      assert.equal(service.modelId,'deepseek-flash');
      assert.equal(service.status().supportsImages,true);
      assert.equal(service.model.compat.requiresReasoningContentOnAssistantMessages,true);
      assert(service.modelRuntime.getModel('deepseek','deepseek-v4-pro'));
    }
  }
  const previous=service.model;
  await assert.rejects(service.configure({providerId:'deepseek',modelId:'v4.1',apiKey:'local-test-not-a-real-key',verify:false}),/当前可用/);
  assert.equal(service.model,previous);assert.equal(service.providerId,'deepseek');
  service.runText=async()=>{throw new Error('401 simulated');};
  service.discoverModels=async()=>['kimi-k3'];
  const initialize=service.initialize.bind(service);
  service.initialize=async()=>{await initialize();service.modelRuntime.refresh=async()=>({});};
  await assert.rejects(service.configure({providerId:'moonshotai-cn',apiKey:'invalid'}),/401/);
  assert.equal(service.model,previous);
});

test("model-only stages keep task identity and use truthful event labels", async () => {
  const service = new PiService({ piDir: testRoot, emit: () => {} });
  service.model = { id: "test-model" };
  const calls = [];
  service.runText = async request => {
    calls.push(request);
    if (request.phase === "options") return JSON.stringify({ options: [1, 2, 3, 4].map(id => ({ id: String(id) })) });
    if (request.phase === "revision-analysis") return JSON.stringify(interviewFixture());
    return "完整答复";
  };
  const task = { id: "task-events", requirement: "制作页面" };
  await service.generateOptions(task);
  await service.oneShotChat(task, "问题");
  await service.proposeRevision(task, { versionId: "v1" });
  assert.deepEqual(calls.map(call => [call.taskId, call.phase]), [
    ["task-events", "options"],
    ["task-events", "chat"],
    ["task-events", "revision-analysis"],
  ]);
  assert.equal(normalizeEvent({ type: "agent_end" }, { phase: "options", hasTools: false }).label, "模型回复完成，正在整理结果");
  assert.equal(normalizeEvent({ type: "agent_end" }, { phase: "website", hasTools: true }).label, "Pi 执行结束，正在核对生成文件");
});
