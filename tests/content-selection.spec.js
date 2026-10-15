// 選字翻譯：浮窗、送給 AI 的上下文大小、單字查詢
const { test, expect } = require("@playwright/test");
const { openFixture, selectText } = require("./helpers");

// 按鈕出現後要停留一下才接受點擊（防點擊劫持），所以先等一下
async function clickTranslate(page) {
  await expect(page.locator("#ctx-trans-floating-btn")).toBeVisible();
  await page.waitForTimeout(400);
  const b = await page.locator("#ctx-trans-floating-btn").boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}

test("本機翻譯：選取句子後浮窗顯示譯文", async ({ context }) => {
  const { page, errors } = await openFixture(context, null, "pages/article.html");
  await selectText(page, "#sel-target", "someone else.");
  await clickTranslate(page);
  await expect(page.locator("#ctx-body .ctx-result")).toHaveText("WE RARELY NOTICE HOW MUCH OF THE INTERNET WAS WRITTEN FOR SOMEONE ELSE.");
  await expect(page.locator("#ctx-mode-label")).toContainText("Chrome");
  expect(errors).toEqual([]);
});

for (const [name, sel, end] of [["一般段落", "#sel-target", "someone else."], ["很短的段落", "#short", null]]) {
  test(`AI：只送選取處前後約 400 字（${name}）`, async ({ context }) => {
    const { page } = await openFixture(context, null, "pages/article.html", { provider: "gemini" });
    await selectText(page, sel, end);
    await clickTranslate(page);
    await expect(page.locator("#ctx-body")).toContainText("AI譯:");
    const msg = await page.evaluate(() => window.__stub.sent.find((m) => m.action === "translate"));
    expect(msg.context).toContain(msg.text);
    expect(msg.context.length).toBeLessThanOrEqual(msg.text.length + 420);
    expect(msg.context).not.toContain("FAR-AWAY-PARAGRAPH");
    if (sel === "#sel-target") expect(msg.context).toContain("CONTEXT-NEAR");
  });
}

test("AI：查單字顯示釋義與語境說明", async ({ context }) => {
  const { page } = await openFixture(context, null, "pages/word.html", { provider: "gemini", wordreply: 1 });
  await page.dblclick("#word");
  await clickTranslate(page);
  await expect(page.locator(".ctx-sense")).toHaveCount(2);
  await expect(page.locator(".ctx-note")).toContainText("河邊");
});

test("本機：查單字顯示一般譯文", async ({ context }) => {
  const { page, errors } = await openFixture(context, null, "pages/word.html");
  await page.dblclick("#word");
  await clickTranslate(page);
  await expect(page.locator(".ctx-sense")).toContainText("BANK");
  await expect(page.locator(".ctx-note")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("免費 AI：用 AI 翻譯，並顯示今天剩下的次數", async ({ context }) => {
  const { page, errors } = await openFixture(context, null, "pages/article.html", { provider: "free" });
  await selectText(page, "#sel-target", "someone else.");
  await clickTranslate(page);
  await expect(page.locator("#ctx-body .ctx-result")).toHaveText("免費譯:We rarely notice how much of the internet was written for someone else.");
  await expect(page.locator("#ctx-mode-label")).toContainText("今天還剩 9 次");
  const msg = await page.evaluate(() => window.__stub.sent.find((m) => m.action === "translate"));
  expect(msg.context).toContain("CONTEXT-NEAR");
  expect(errors).toEqual([]);
});

test("免費 AI 次數用完：改用本機翻譯，並說明原因", async ({ context }) => {
  const { page } = await openFixture(context, null, "pages/article.html", { provider: "free", freemode: "quota" });
  await selectText(page, "#sel-target", "someone else.");
  await clickTranslate(page);
  await expect(page.locator("#ctx-body .ctx-result")).toHaveText("WE RARELY NOTICE HOW MUCH OF THE INTERNET WAS WRITTEN FOR SOMEONE ELSE.");
  await expect(page.locator("#ctx-body .ctx-notice")).toContainText("次數用完了");
  await expect(page.locator("#ctx-mode-label")).toContainText("Chrome");
});

test("內容腳本不讀 API 金鑰，只讀哪些服務商有金鑰", async ({ context }) => {
  const { page } = await openFixture(context, null, "pages/article.html", { provider: "gemini" });
  await selectText(page, "#sel-target", "someone else.");
  await clickTranslate(page);
  await expect(page.locator("#ctx-body")).toContainText("AI譯:");
  const asked = await page.evaluate(() => window.__stub.gets.flat());
  expect(asked).toContain("keyedProviders");
  expect(asked).not.toContain("apiKeys");
  expect(asked).not.toContain("*");
});

test("防點擊劫持：網頁動外層容器會被改回來；容器樣式不對、或按鈕剛出現就被點，都不翻譯", async ({ context }) => {
  const { page } = await openFixture(context, null, "pages/article.html", { provider: "gemini" });
  const sent = () => page.evaluate(() => window.__stub.sent.filter((m) => m.action === "translate").length);
  const btn = page.locator("#ctx-trans-floating-btn");
  const reselect = async () => {
    await page.evaluate(() => getSelection().removeAllRanges());
    await selectText(page, "#sel-target", "someone else.");
    await expect(btn).toBeVisible();
  };
  const clickButton = async () => {
    const b = await btn.boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  };

  // 剛出現就點（例如雙擊的第二下）
  await reselect();
  await clickButton();
  expect(await sent()).toBe(0);

  // 網頁改外層容器的 style：馬上被改回來
  await reselect();
  await page.waitForTimeout(400);
  const restored = await page.evaluate(async () => {
    const host = document.querySelector("ctx-translator-root");
    host.style.setProperty("opacity", "0", "important");
    host.setAttribute("class", "evil");
    await new Promise((r) => setTimeout(r, 0));
    return { opacity: getComputedStyle(host).opacity, cls: host.getAttribute("class") };
  });
  expect(restored).toEqual({ opacity: "1", cls: null });

  // 網頁用自己的 CSS 想把容器變透明、放大：容器的 inline !important 樣式優先，點擊照常有效
  await page.addStyleTag({ content: "ctx-translator-root { opacity: 0 !important; transform: scale(40) !important; }" });
  await clickButton();
  await expect(page.locator("#ctx-body")).toContainText("AI譯:");
  expect(await sent()).toBe(1);

  // 若外層容器的樣式真的被改掉（例如瀏覽器擋不住的情況），點擊不算數
  await page.evaluate(() => document.querySelector("#ctx-close-btn")?.click());
  await reselect();
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const host = document.querySelector("ctx-translator-root");
    // 暫停改回來的機制，模擬容器被改掉
    Object.defineProperty(host.style, "cssText", { get: () => "", set: () => {}, configurable: true });
    host.style.setProperty("filter", "opacity(0)", "important");
  });
  await clickButton();
  expect(await sent()).toBe(1);
});
