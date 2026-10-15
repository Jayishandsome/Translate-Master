// 安裝後的說明頁：先試一次、三個用法、選翻譯方式；檢查本機翻譯，並可以直接試用選字翻譯
const { test, expect } = require("@playwright/test");
const { openFixture, selectText, translatePage } = require("./helpers");

test("一行顯示本機翻譯能不能用；三個用法；免費 AI 沒開放時不列出", async ({ context }) => {
  const { page, errors } = await openFixture(context, null, "ext/welcome.html");
  await expect(page.locator("#check-translator")).toHaveAttribute("data-state", "ok");
  await expect(page.locator("#check-translator")).toContainText("可以使用");
  await expect(page.locator(".use")).toHaveCount(3);
  await expect(page.locator("#engine-free")).toBeHidden();
  await expect(page.locator(".engine:visible")).toHaveCount(2);
  expect(errors).toEqual([]);
});

test("免費 AI 開放時，翻譯方式列出三種，寫出每天幾次", async ({ context }) => {
  const { page } = await openFixture(context, null, "ext/welcome.html", { free: "on" });
  await expect(page.locator("#engine-free")).toBeVisible();
  await expect(page.locator("#engine-free")).toContainText("每天 10 次");
  await expect(page.locator(".engine:visible")).toHaveCount(3);
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
  await expect(page.locator("h1")).toHaveText("Select text, translate it in place");
  await expect(page.locator(".use").first()).toContainText("Translate a selection");
  await expect(page.locator(".fig-menu")).toContainText("Translate full page");
});

test("在說明頁按全頁翻譯：只翻英文範例句，標題不翻", async ({ context }) => {
  const { page } = await openFixture(context, null, "ext/welcome.html");
  await translatePage(page);
  await expect(page.locator("#try p ctx-tr").first()).toContainText("WE RARELY NOTICE");
  await expect(page.locator("#try p ctx-tr")).toHaveCount(2);
  await expect(page.locator(".brand ctx-tr, .fig ctx-tr")).toHaveCount(0);
  await expect(page.locator("#ctx-page-bar")).not.toContainText("已經是");
});
