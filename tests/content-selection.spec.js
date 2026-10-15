// 選字翻譯：浮窗、送給 AI 的上下文大小、單字查詢
const { test, expect } = require("@playwright/test");
const { openFixture, selectText } = require("./helpers");

// 按鈕出現後要停留一下才接受點擊（防點擊劫持），所以先等一下
async function clickTranslate(page) {
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

test("防點擊劫持：按鈕被拉大、變透明、移位或剛出現就被點，都不翻譯", async ({ context }) => {
  const { page } = await openFixture(context, null, "pages/article.html", { provider: "gemini" });
  const sent = () => page.evaluate(() => window.__stub.sent.filter((m) => m.action === "translate").length);
  const btn = page.locator("#ctx-trans-floating-btn");

  // 剛出現就點（例如雙擊的第二下）
  await selectText(page, "#sel-target", "someone else.");
  const b0 = await btn.boundingBox();
  await page.evaluate(() => {
    const b = document.getElementById("ctx-trans-floating-btn");
    b.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  });
  await page.mouse.click(b0.x + b0.width / 2, b0.y + b0.height / 2);
  expect(await sent()).toBe(0);

  // 網頁把按鈕拉滿整個畫面（先取消原本的選取，否則拖曳會變成拖放文字）
  const reselect = async () => {
    await page.evaluate(() => getSelection().removeAllRanges());
    await selectText(page, "#sel-target", "someone else.");
    await expect(btn).toBeVisible();
  };
  await reselect();
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const b = document.getElementById("ctx-trans-floating-btn");
    b.style.setProperty("left", "0px", "important");
    b.style.setProperty("top", "0px", "important");
    b.style.setProperty("width", "100vw", "important");
    b.style.setProperty("height", "100vh", "important");
  });
  await page.mouse.click(300, 300);
  expect(await sent()).toBe(0);

  // 網頁把按鈕變透明
  await page.evaluate(() => document.getElementById("ctx-trans-floating-btn").removeAttribute("style"));
  await reselect();
  await page.waitForTimeout(400);
  await page.evaluate(() => document.getElementById("ctx-trans-floating-btn").style.setProperty("opacity", "0", "important"));
  const b1 = await btn.boundingBox();
  await page.mouse.click(b1.x + b1.width / 2, b1.y + b1.height / 2);
  expect(await sent()).toBe(0);

  // 正常的情況：一樣可以翻譯
  await page.evaluate(() => document.getElementById("ctx-trans-floating-btn").style.removeProperty("opacity"));
  await reselect();
  await clickTranslate(page);
  await expect(page.locator("#ctx-body")).toContainText("AI譯:");
  expect(await sent()).toBe(1);
});
