// 全頁翻譯：本機與 AI 模式、連結、混合語言、略過網站框架、快取、失敗重試
const { test, expect } = require("@playwright/test");
const { openFixture, translatePage } = require("./helpers");

const tr = (page, sel) => page.locator(`${sel} ctx-tr`).first();

test("本機：譯文模式、連結可點、混合語言逐段偵測、還原後完全一樣", async ({ context }) => {
  const { page, errors } = await openFixture(context, null, "pages/article.html");
  const before = await page.locator("article").innerHTML();
  await translatePage(page);
  await expect(tr(page, "#title")).toHaveText("A BEGINNER'S GUIDE TO COFFEE");
  await expect(page.locator("#ctx-page-bar")).toBeVisible();
  // 程式碼不翻；已經是中文的段落略過
  await expect(page.locator("#code")).toHaveText("ratio = water / coffee");
  await expect(page.locator("#p-zh ctx-tr")).toHaveCount(0);
  // 日文段落用日文→中文翻譯，而不是整頁的英文
  await expect(tr(page, "#p-ja")).toContainText("‹ja›");
  // 整段都是連結：譯文放在連結裡面，點得到
  await expect(page.locator("#whole-link ctx-tr")).toHaveCount(1);
  // 段落中的連結：譯文裡有對應的連結
  const link = page.locator("#p-link ctx-tr a");
  await expect(link).toHaveAttribute("href", "#grinders");
  await expect(link).toHaveText("BURR GRINDER");
  await link.click();
  await expect.poll(() => page.evaluate(() => location.hash)).toBe("#grinders");
  // 對照模式顯示原文
  await page.click("#ctx-page-bar [data-act=bilingual]");
  await expect(page.locator("#grinder")).toHaveText("burr grinder");
  await page.click("#ctx-page-bar [data-act=restore]");
  await expect(page.locator("ctx-tr")).toHaveCount(0);
  expect(await page.locator("article").innerHTML()).toBe(before);
  expect(errors).toEqual([]);
});

test("本機：捲動到哪才翻到哪", async ({ context }) => {
  const { page } = await openFixture(context, null, "pages/article.html");
  await translatePage(page);
  await expect(tr(page, "#title")).toBeVisible();
  await page.waitForTimeout(600);
  await expect(page.locator("#far ctx-tr")).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.locator("#far ctx-tr")).toHaveCount(1);
});

test("本機：第一次翻譯某語言要按一下才下載語言套件", async ({ context }) => {
  await context.addInitScript(() => {
    let last = 0;
    addEventListener("mousedown", (e) => { if (e.isTrusted) last = Date.now(); }, true);
    Object.defineProperty(navigator, "userActivation", { configurable: true, get: () => ({ isActive: Date.now() - last < 5000, hasBeenActive: last > 0 }) });
  });
  const { page } = await openFixture(context, null, "pages/article.html", { avail: "downloadable" });
  await translatePage(page);
  const btn = page.locator("#ctx-page-bar [data-act=download]");
  await expect(btn).toBeVisible();
  await btn.click();
  await expect(tr(page, "#title")).toHaveText("A BEGINNER'S GUIDE TO COFFEE");
});

test("AI：不送網站框架、連結標記保留、還原後再翻不重送", async ({ context }) => {
  const { page, errors } = await openFixture(context, null, "pages/article.html", { provider: "gemini" });
  await translatePage(page);
  await expect(tr(page, "#title")).toHaveText("AI譯:A beginner's guide to coffee");
  await page.waitForTimeout(400);
  const sent = await page.evaluate(() => window.__stub.sent.filter((m) => m.action === "translateBatch").flatMap((m) => m.texts));
  expect(sent.join("\n")).not.toMatch(/Home page|Recipes and guides|Field Notes|Copyright/);
  expect(sent).toContain("Ground coffee loses its aroma within minutes. A simple ⟦1⟧burr grinder⟦/1⟧ is the best upgrade you can make.");
  const link = page.locator("#p-link ctx-tr a");
  await expect(link).toHaveAttribute("href", "#grinders");
  await expect(link).toHaveText("burr grinder");
  await expect(tr(page, "#p-link")).not.toContainText("⟦");
  const batches = await page.evaluate(() => window.__stub.sent.filter((m) => m.action === "translateBatch").length);
  await page.click("#ctx-page-bar [data-act=restore]");
  await translatePage(page);
  await expect(tr(page, "#title")).toBeVisible();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__stub.sent.filter((m) => m.action === "translateBatch").length)).toBe(batches);
  expect(errors).toEqual([]);
});

test("AI：金鑰錯誤時顯示原因，修好後按重試", async ({ context }) => {
  const { page } = await openFixture(context, null, "pages/article.html", { provider: "gemini", batchfail: 99 });
  await translatePage(page);
  await expect(page.locator("#ctx-page-bar")).toContainText("API key not valid");
  await page.evaluate(() => { window.__stub.batchFail = 0; });
  await page.click("#ctx-page-bar [data-act=retryFailed]");
  await expect(tr(page, "#title")).toHaveText("AI譯:A beginner's guide to coffee");
});

test("AI：選了服務商但沒有金鑰時，改用本機翻譯", async ({ context }) => {
  const { page } = await openFixture(context, null, "pages/article.html", { provider: "openai" });
  await translatePage(page);
  await expect(tr(page, "#title")).toHaveText("A BEGINNER'S GUIDE TO COFFEE");
});

test("英文介面的全頁翻譯狀態列", async ({ context }) => {
  const { page } = await openFixture(context, null, "pages/article.html", { ui: "en" });
  await translatePage(page);
  await expect(page.locator("#ctx-page-bar")).toContainText("Side by side");
  await expect(page.locator("#ctx-page-bar")).toContainText("translated");
});

// 頁面本身已經是譯文語言（像說明頁、中文新聞引用英文）：不再直接說「已經是中文」，而是只翻外文段落
test("本機：中文頁面只翻夾在裡面的外文段落", async ({ context }) => {
  const { page, errors } = await openFixture(context, null, "pages/mixed-zh.html");
  await translatePage(page);
  await expect(tr(page, "#en")).toHaveText("WE RARELY NOTICE HOW MUCH OF THE INTERNET WAS WRITTEN FOR SOMEONE ELSE.");
  await expect(page.locator("#ctx-page-bar")).toContainText("外文段落 → 繁體中文");
  await expect(page.locator("#ctx-page-bar")).toContainText("1");
  // 中文段落（包括夾著幾個英文單字的）和很短的英文都不動
  await expect(page.locator("main ctx-tr")).toHaveCount(1);
  await page.click("#ctx-page-bar [data-act=restore]");
  await expect(page.locator("ctx-tr")).toHaveCount(0);
  await expect(page.locator("#en")).toHaveText("We rarely notice how much of the internet was written for someone else.");
  expect(errors).toEqual([]);
});

test("AI：中文頁面只把外文段落送出去", async ({ context }) => {
  const { page } = await openFixture(context, null, "pages/mixed-zh.html", { provider: "gemini" });
  await translatePage(page);
  await expect(tr(page, "#en")).toHaveText("AI譯:We rarely notice how much of the internet was written for someone else.");
  await page.waitForTimeout(300);
  const sent = await page.evaluate(() => window.__stub.sent.filter((m) => m.action === "translateBatch").flatMap((m) => m.texts));
  expect(sent).toEqual(["We rarely notice how much of the internet was written for someone else."]);
});

test("沒有語言偵測模型時，用文字判斷哪些段落是外文", async ({ context }) => {
  const { page } = await openFixture(context, null, "pages/mixed-zh.html", { detector: "unavailable" });
  await translatePage(page);
  await expect(tr(page, "#en")).toHaveText("WE RARELY NOTICE HOW MUCH OF THE INTERNET WAS WRITTEN FOR SOMEONE ELSE.");
  await expect(page.locator("main ctx-tr")).toHaveCount(1);
});

test("整頁都是譯文語言時才說不用翻", async ({ context }) => {
  const { page } = await openFixture(context, null, "pages/mixed-zh.html", { provider: "gemini" });
  await page.evaluate(() => document.getElementById("en").remove());
  await translatePage(page);
  await expect(page.locator("#ctx-page-bar")).toContainText("這個頁面已經是繁體中文，沒有需要翻譯的段落");
  expect(await page.evaluate(() => window.__stub.sent.filter((m) => m.action === "translateBatch").length)).toBe(0);
});

test("本機：中文頁面的外文段落第一次要下載語言套件，按一下之後一樣只翻外文", async ({ context }) => {
  await context.addInitScript(() => {
    let last = 0;
    addEventListener("mousedown", (e) => { if (e.isTrusted) last = Date.now(); }, true);
    Object.defineProperty(navigator, "userActivation", { configurable: true, get: () => ({ isActive: Date.now() - last < 5000, hasBeenActive: last > 0 }) });
  });
  const { page } = await openFixture(context, null, "pages/mixed-zh.html", { avail: "downloadable" });
  await translatePage(page);
  const btn = page.locator("#ctx-page-bar [data-act=download]");
  await expect(btn).toBeVisible();
  await btn.click();
  await expect(tr(page, "#en")).toHaveText("WE RARELY NOTICE HOW MUCH OF THE INTERNET WAS WRITTEN FOR SOMEONE ELSE.");
  await expect(page.locator("#ctx-page-bar")).toContainText("外文段落");
  await expect(page.locator("main ctx-tr")).toHaveCount(1);
});
