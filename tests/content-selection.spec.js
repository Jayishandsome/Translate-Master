// 選字翻譯：浮窗、送給 AI 的上下文大小、單字查詢
const { test, expect } = require("@playwright/test");
const { openFixture, selectText } = require("./helpers");

async function clickTranslate(page) {
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
