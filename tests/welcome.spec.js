// 安裝後的說明頁：檢查本機翻譯，並可以直接試用選字翻譯
const { test, expect } = require("@playwright/test");
const { openFixture, selectText, translatePage } = require("./helpers");

test("檢查本機翻譯", async ({ context }) => {
  const { page, errors } = await openFixture(context, null, "ext/welcome.html");
  await expect(page.locator("#check-translator")).toHaveAttribute("data-state", "ok");
  await expect(page.locator(".check")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("在說明頁直接試用選字翻譯", async ({ context }) => {
  const { page } = await openFixture(context, null, "ext/welcome.html");
  // 等「你的 Chrome 準備好了嗎」檢查完：結果文字會改變版面，拖曳到一半版面移動就選不到
  await expect(page.locator("#check-translator")).not.toHaveAttribute("data-state", "wait");
  // 試用區在畫面底部附近；捲到中間，按鈕才不會落在畫面外
  await page.evaluate(() => document.getElementById("try").scrollIntoView({ block: "center" }));
  await selectText(page, "#try p:first-of-type", "someone else");
  await expect(page.locator("#ctx-trans-floating-btn")).toBeVisible();
  await page.waitForTimeout(400);
  const b = await page.locator("#ctx-trans-floating-btn").boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await expect(page.locator("#ctx-body .ctx-result")).toContainText("SOMEONE ELSE");
});

test("英文介面的說明頁", async ({ context }) => {
  const { page } = await openFixture(context, null, "ext/welcome.html", { ui: "en" });
  await expect(page.locator("h1")).toHaveText("Context Translator");
  await expect(page.locator(".steps li").first()).toContainText("Select text");
});

test("在說明頁按全頁翻譯：只翻英文範例句，標題不翻", async ({ context }) => {
  const { page } = await openFixture(context, null, "ext/welcome.html");
  await translatePage(page);
  await expect(page.locator("#try p ctx-tr").first()).toContainText("WE RARELY NOTICE");
  await expect(page.locator("#try p ctx-tr")).toHaveCount(2);
  await expect(page.locator("header ctx-tr")).toHaveCount(0);
  await expect(page.locator("#ctx-page-bar")).not.toContainText("已經是");
});
