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
