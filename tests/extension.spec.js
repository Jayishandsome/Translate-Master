// 真正載入擴充功能：背景程式送給各家服務商的請求格式、換站台、自訂模型、模型停用的錯誤訊息、
// 金鑰只存本機、安裝後打開說明頁。服務商的 API 都用 route 假造回應，不會真的連出去。
const { test, expect, chromium } = require("@playwright/test");
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");
const { ROOT } = require("./helpers");

const HOSTS = ["generativelanguage.googleapis.com", "api.openai.com", "api.anthropic.com", "api.deepseek.com",
  "api.moonshot.cn", "api.moonshot.ai", "api.minimax.io", "api.minimax.cn", "api.minimaxi.com"];

// 背景程式啟動後才開始測。電腦很忙時，偶爾整個瀏覽器啟動後背景程式一直沒出現，就關掉重開。
async function launch({ lang = "en-US" } = {}) {
  for (let attempt = 1; ; attempt++) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ctx-ext-"));
    const context = await chromium.launchPersistentContext(dir, {
      channel: "chromium",
      headless: true,
      locale: lang,
      args: [`--disable-extensions-except=${ROOT}`, `--load-extension=${ROOT}`, `--lang=${lang}`],
    });
    const sw = await serviceWorker(context, 10_000);
    // 背景程式剛啟動時，chrome.* API 可能還沒接上
    if (sw && (await waitFor(() => sw.evaluate(() => Boolean(globalThis.chrome?.storage?.sync)), 10_000))) return { context, sw };
    await context.close();
    if (attempt === 3) throw new Error("The extension's service worker did not start");
  }
}

// 背景程式可能在開始等待之前就已經啟動，所以邊等事件邊重新檢查清單
async function serviceWorker(context, timeout) {
  const deadline = Date.now() + timeout;
  let sw = context.serviceWorkers()[0];
  while (!sw && Date.now() < deadline) {
    sw = await context.waitForEvent("serviceworker", { timeout: 1000 }).catch(() => context.serviceWorkers()[0]);
  }
  return sw;
}

async function waitFor(check, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check().catch(() => false)) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

/** 依測試需要回應的假服務商；記下每個請求 */
async function fakeProviders(context, respond) {
  const calls = [];
  await context.route((url) => HOSTS.includes(url.hostname), async (route) => {
    const req = route.request();
    const body = JSON.parse(req.postData() || "{}");
    const call = { host: new URL(req.url()).hostname, path: new URL(req.url()).pathname, body, headers: req.headers() };
    calls.push(call);
    const [status, json] = respond(call, calls.length);
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(json) });
  });
  return calls;
}

const promptOf = (body) => body.contents?.[0]?.parts?.[0]?.text ?? body.messages?.[0]?.content ?? "";
function okReply(call, text) {
  if (call.host.includes("googleapis")) return [200, { candidates: [{ content: { parts: [{ text }] } }] }];
  if (call.host.includes("anthropic")) return [200, { content: [{ type: "text", text }] }];
  return [200, { choices: [{ message: { content: text } }] }];
}

test("安裝後打開說明頁，介面跟著 Chrome 的語言", async () => {
  const { context, sw } = await launch({ lang: "en-US" });
  await expect.poll(() => context.pages().some((p) => p.url().endsWith("/welcome.html"))).toBe(true);
  const welcome = context.pages().find((p) => p.url().endsWith("/welcome.html"));
  await expect(welcome.locator("h1")).toHaveText("Context Translator");
  expect(await sw.evaluate(() => chrome.i18n.getMessage("menuTranslatePage"))).toBe("Translate full page");
  await context.close();
});

test("各家服務商的請求格式", async () => {
  const { context, sw } = await launch();
  const calls = await fakeProviders(context, (call) => okReply(call, promptOf(call.body).includes("INPUT:") ? '["譯1","譯2"]' : "譯文"));
  const expectBody = {
    gemini: (c) => { expect(c.path).toContain("/gemini-3.5-flash-lite:generateContent"); expect(c.body.generationConfig.thinkingConfig.thinkingLevel).toBe("minimal"); expect(c.headers["x-goog-api-key"]).toBe("KEY"); },
    openai: (c) => { expect(c.body).toMatchObject({ model: "gpt-6-luna", reasoning_effort: "none" }); expect(c.body.max_completion_tokens).toBeGreaterThan(0); expect(c.body.temperature).toBeUndefined(); },
    claude: (c) => { expect(c.body.model).toBe("claude-haiku-4-5-20251001"); expect(c.headers["anthropic-dangerous-direct-browser-access"]).toBe("true"); },
    deepseek: (c) => { expect(c.body).toMatchObject({ model: "deepseek-flash", thinking: { type: "disabled" } }); },
    kimi: (c) => { expect(c.body).toMatchObject({ model: "kimi-k2.6", thinking: { type: "disabled" } }); expect(c.body.temperature).toBeUndefined(); },
    minimax: (c) => { expect(c.path).toBe("/v1/chat/completions"); expect(c.body).toMatchObject({ model: "MiniMax-M3", thinking: { type: "disabled" } }); },
  };
  for (const [provider, check] of Object.entries(expectBody)) {
    calls.length = 0;
    await sw.evaluate((p) => chrome.storage.sync.set({ apiProvider: p, apiKeys: { [p]: "KEY" }, targetLang: "zh-TW", customModels: {} }), provider);
    expect(await sw.evaluate(() => handleTranslation("bank", "She waited on the bank."))).toBe("譯文");
    check(calls[0]);
    // 全頁翻譯一批：要求保留連結標記
    expect(await sw.evaluate(() => handleBatchTranslation(["a ⟦1⟧b⟦/1⟧", "c"], "T"))).toEqual(["譯1", "譯2"]);
    expect(promptOf(calls.at(-1).body)).toContain("⟦1⟧…⟦/1⟧");
  }
  await context.close();
});

test("金鑰屬於另一個站台時自動換站，並記住", async () => {
  const { context, sw } = await launch();
  const calls = await fakeProviders(context, (call) => (call.host === "api.moonshot.cn" ? [401, { error: { message: "Invalid Authentication" } }] : okReply(call, "OK")));
  await sw.evaluate(() => chrome.storage.sync.set({ apiProvider: "kimi", apiKeys: { kimi: "KEY" } }));
  expect(await sw.evaluate(() => handleTranslation("hello world", "hello world"))).toBe("OK");
  expect(calls.map((c) => c.host)).toEqual(["api.moonshot.cn", "api.moonshot.ai"]);
  await sw.evaluate(() => handleTranslation("hello again", "hello again"));
  expect(calls.at(-1).host).toBe("api.moonshot.ai");
  expect(calls).toHaveLength(3);
  await context.close();
});

test("自訂模型：參數不被接受時改用精簡請求；模型停用時說清楚", async () => {
  const { context, sw } = await launch();
  let mode = "unsupported";
  const calls = await fakeProviders(context, (call) => {
    if (mode === "gone") return [404, { error: { message: "The model `gpt-old` does not exist or you do not have access to it." } }];
    if (call.body.reasoning_effort) return [400, { error: { message: "Unsupported parameter: 'reasoning_effort' is not supported with this model." } }];
    return okReply(call, "OK");
  });
  await sw.evaluate(() => chrome.storage.sync.set({ apiProvider: "openai", apiKeys: { openai: "KEY" }, customModels: { openai: "gpt-4o-mini" } }));
  expect(await sw.evaluate(() => handleTranslation("hello world", "hello world"))).toBe("OK");
  expect(calls[0].body.model).toBe("gpt-4o-mini");
  expect(calls[1].body).toEqual({ model: "gpt-4o-mini", messages: expect.any(Array) });

  mode = "gone";
  await sw.evaluate(() => chrome.storage.sync.set({ customModels: { openai: "gpt-old" } }));
  const custom = await sw.evaluate(() => handleTranslation("x y", "x y").catch((e) => e.message));
  expect(custom).toContain("gpt-old");
  expect(custom).toContain("Advanced");

  await sw.evaluate(() => chrome.storage.sync.set({ customModels: {} }));
  const builtinModel = await sw.evaluate(() => handleTranslation("x y", "x y").catch((e) => e.message));
  expect(builtinModel).toContain("retired");
  expect(builtinModel).toContain("gpt-6-luna");
  await context.close();
});

test("金鑰只存在這台電腦時，背景程式從本機讀取", async () => {
  const { context, sw } = await launch();
  const calls = await fakeProviders(context, (call) => okReply(call, "OK"));
  await sw.evaluate(async () => {
    await chrome.storage.sync.set({ apiProvider: "gemini", keyStorage: "local", customModels: {} });
    await chrome.storage.sync.remove("apiKeys");
    await chrome.storage.local.set({ apiKeys: { gemini: "LOCAL-KEY" } });
  });
  expect(await sw.evaluate(() => handleTranslation("hello world", "hello world"))).toBe("OK");
  expect(calls[0].headers["x-goog-api-key"]).toBe("LOCAL-KEY");
  await context.close();
});

test("真正的內容腳本：AI 全頁翻譯，連結保留、網站框架不送出", async () => {
  const { context, sw } = await launch();
  await context.route("http://fixture.test/**", async (route) => {
    const rel = new URL(route.request().url()).pathname;
    // 測試頁裡給替身用的 /ext/content.js 不提供：真正的內容腳本由擴充功能自己注入
    if (rel.startsWith("/ext/")) return route.fulfill({ status: 404, body: "" });
    await route.fulfill({ status: 200, contentType: "text/html", body: fs.readFileSync(path.join(__dirname, "fixtures", rel)) });
  });
  const calls = await fakeProviders(context, (call) => {
    const items = JSON.parse(promptOf(call.body).split("INPUT:\n").pop());
    return okReply(call, JSON.stringify(items.map((t) => `譯:${t}`)));
  });
  await sw.evaluate(() => chrome.storage.sync.set({ apiProvider: "gemini", apiKeys: { gemini: "KEY" }, targetLang: "zh-TW", customModels: {} }));
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("http://fixture.test/pages/article.html");
  await page.waitForTimeout(500);
  await sw.evaluate(() => chrome.tabs.query({ active: true, lastFocusedWindow: true }).then((t) => requestPageTranslation(t[0].id)));
  await expect(page.locator("#title ctx-tr")).toHaveText("譯:A beginner's guide to coffee");
  await expect(page.locator("#p-link ctx-tr a")).toHaveAttribute("href", "#grinders");
  await expect(page.locator("#ctx-page-bar")).toContainText("Gemini");
  const sent = calls.flatMap((c) => JSON.parse(promptOf(c.body).split("INPUT:\n").pop())).join("\n");
  expect(sent).not.toMatch(/Home page|Copyright/);
  expect(errors).toEqual([]);
  await context.close();
});

test("免費 AI：送出文字、譯文語言和安裝 ID，記下剩下的次數；次數用完時回報原因", async () => {
  const { context, sw } = await launch();
  const calls = [];
  let status = 200;
  await context.route("https://free.test/**", async (route) => {
    const req = route.request();
    const cors = { "Access-Control-Allow-Origin": req.headers().origin || "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    calls.push({ url: req.url(), body: JSON.parse(req.postData() || "{}") });
    const body = status === 200 ? { translation: "河岸", remaining: 7, limit: 10 } : { error: "quota", remaining: 0, limit: 10 };
    await route.fulfill({ status, headers: cors, contentType: "application/json", body: JSON.stringify(body) });
  });
  await sw.evaluate(async () => {
    FREE_AI.endpoint = "https://free.test/";
    await chrome.storage.sync.set({ apiProvider: "free", targetLang: "ja" });
  });
  const ok = await sw.evaluate(() => handleFreeTranslation("bank", "She waited on the bank."));
  expect(ok).toEqual({ text: "河岸", remaining: 7 });
  expect(calls[0].url).toBe("https://free.test/translate");
  expect(calls[0].body).toMatchObject({ text: "bank", context: "She waited on the bank.", target: "ja" });
  expect(calls[0].body.installId).toMatch(/^[0-9a-f-]{36}$/);
  const stored = await sw.evaluate(() => chrome.storage.local.get(["installId", "freeAI"]));
  expect(stored.installId).toBe(calls[0].body.installId);
  expect(stored.freeAI.remaining).toBe(7);

  status = 429;
  const quota = await sw.evaluate(() => handleFreeTranslation("bank", "x").then(() => null, (e) => ({ reason: e.reason, message: e.message })));
  expect(quota.reason).toBe("quota");
  expect(quota.message).toContain("free AI");
  expect(calls[1].body.installId).toBe(calls[0].body.installId);
  expect((await sw.evaluate(() => chrome.storage.local.get("freeAI"))).freeAI.remaining).toBe(0);

  // 太長的選取不送出
  const long = await sw.evaluate(() => handleFreeTranslation("a".repeat(2001), "").then(() => null, (e) => e.reason));
  expect(long).toBe("too_long");
  expect(calls).toHaveLength(2);
  await context.close();
});

test("安全：格式不對的回覆最多只拆一層重送；選字太長不送出", async () => {
  const { context, sw } = await launch();
  const calls = await fakeProviders(context, (call) => okReply(call, "not json, just prose"));
  await sw.evaluate(() => chrome.storage.sync.set({ apiProvider: "gemini", apiKeys: { gemini: "KEY" }, keyStorage: "sync", customModels: {} }));
  const out = await sw.evaluate(() => handleBatchTranslation(["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8"], "t"));
  expect(calls).toHaveLength(3);
  expect(out).toEqual(["", "", "", "", "", "", "", ""]);

  const long = await sw.evaluate(() => handleTranslation("x".repeat(5001), "").then(() => null, (e) => e.message));
  expect(long).toContain("5000");
  expect(calls).toHaveLength(3);
  await context.close();
});

test("安全：背景程式只把「哪些服務商有金鑰」給內容腳本看", async () => {
  const { context, sw } = await launch();
  await sw.evaluate(() => chrome.storage.sync.set({ keyStorage: "sync", apiKeys: { gemini: "KEY", openai: "" } }));
  await expect.poll(() => sw.evaluate(async () => (await chrome.storage.local.get("keyedProviders")).keyedProviders)).toEqual(["gemini"]);
  await sw.evaluate(async () => {
    await chrome.storage.local.set({ apiKeys: { claude: "LOCAL" } });
    await chrome.storage.sync.set({ keyStorage: "local" });
  });
  await expect.poll(() => sw.evaluate(async () => (await chrome.storage.local.get("keyedProviders")).keyedProviders)).toEqual(["claude"]);
  await context.close();
});

test("安全：免費 AI 今天用完就不送出；Kimi 記住能用的站台，重新啟動後直接用", async () => {
  const { context, sw } = await launch();
  const free = [];
  await context.route("https://free.test/**", (route) => { free.push(route.request().url()); return route.abort(); });
  const left = await sw.evaluate(async () => {
    FREE_AI.endpoint = "https://free.test";
    await chrome.storage.local.set({ freeAI: { day: new Date().toISOString().slice(0, 10), remaining: 0 } });
    return handleFreeTranslation("bank", "x").then(() => null, (e) => e.reason);
  });
  expect(left).toBe("quota");
  expect(free).toHaveLength(0);

  const calls = await fakeProviders(context, (call) => (call.host === "api.moonshot.cn" ? [401, { error: { message: "Invalid Authentication" } }] : okReply(call, "OK")));
  await sw.evaluate(() => chrome.storage.sync.set({ apiProvider: "kimi", apiKeys: { kimi: "INTL" }, keyStorage: "sync", customModels: {} }));
  expect(await sw.evaluate(() => handleTranslation("hello world", "hello world"))).toBe("OK");
  expect(calls.map((c) => c.host)).toEqual(["api.moonshot.cn", "api.moonshot.ai"]);
  await expect.poll(() => sw.evaluate(async () => (await chrome.storage.local.get("preferredEndpoints")).preferredEndpoints?.kimi)).toBe("https://api.moonshot.ai/v1/chat/completions");
  // 模擬背景程式被 Chrome 關掉再啟動：記憶體裡的資料不見了
  await sw.evaluate(() => { preferredEndpointCache = null; });
  expect(await sw.evaluate(() => handleTranslation("hello again", "hello again"))).toBe("OK");
  expect(calls.map((c) => c.host)).toEqual(["api.moonshot.cn", "api.moonshot.ai", "api.moonshot.ai"]);
  await context.close();
});
