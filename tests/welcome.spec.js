// 安裝後的說明頁：檢查本機翻譯，並可以直接試用選字翻譯
const { test, expect } = require("@playwright/test");
const { openFixture, selectText } = require("./helpers");

test("檢查本機翻譯", async ({ context }) => {
  const { page, errors } = await openFixture(context, null, "ext/welcome.html");
  await expect(page.locator("#check-translator")).toHaveAttribute("data-state", "ok");
  await expect(page.locator(".check")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("在說明頁直接試用選字翻譯", async ({ context }) => {
  const { page } = await openFixture(context, null, "ext/welcome.html");
  await selectText(page, "#try p:first-of-type", "someone else");
  const b = await page.locator("#ctx-trans-floating-btn").boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await expect(page.locator("#ctx-body .ctx-result")).toContainText("SOMEONE ELSE");
});

test("英文介面的說明頁", async ({ context }) => {
  const { page } = await openFixture(context, null, "ext/welcome.html", { ui: "en" });
  await expect(page.locator("h1")).toHaveText("Context Translator");
  await expect(page.locator(".steps li").first()).toContainText("Select text");
});
