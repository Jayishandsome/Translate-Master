// 設定視窗：金鑰儲存鍵、只存在這台電腦、自訂模型、譯文語言、說明頁、英文介面
const { test, expect } = require("@playwright/test");
const { openFixture } = require("./helpers");

const stub = (page, fn) => page.evaluate(fn);

test("金鑰按儲存才寫入；換服務商時捨棄沒存的輸入", async ({ context }) => {
  const { page, errors } = await openFixture(context, null, "ext/popup.html", { keys: "none" });
  await page.locator(".sense").nth(1).click();
  await page.fill("#api-key", "AIza-new-key");
  await expect(page.locator("#key-save")).toBeEnabled();
  await expect(page.locator("#api-key-help")).toContainText("還沒儲存");
  expect(await stub(page, () => window.__stub.sync.apiKeys.gemini)).toBeUndefined();
  await page.click("#key-save");
  expect(await stub(page, () => window.__stub.sync.apiKeys.gemini)).toBe("AIza-new-key");
  await expect(page.locator("#key-save")).toHaveText("已儲存");
  await page.fill("#api-key", "typed-but-not-saved");
  await page.selectOption("#provider-select", "openai");
  await page.selectOption("#provider-select", "gemini");
  await expect(page.locator("#api-key")).toHaveValue("AIza-new-key");
  expect(errors).toEqual([]);
});

test("金鑰可以改成只存在這台電腦，也能改回來", async ({ context }) => {
  const { page } = await openFixture(context, null, "ext/popup.html", { provider: "gemini" });
  await page.locator("label.check-line").click();
  await expect.poll(() => stub(page, () => window.__stub.sync.keyStorage)).toBe("local");
  expect(await stub(page, () => window.__stub.local.apiKeys.gemini)).toBe("AIza-test");
  expect(await stub(page, () => window.__stub.sync.apiKeys)).toBeUndefined();
  await expect(page.locator("#api-key-help")).toContainText("只存在這台電腦");
  await page.locator("label.check-line").click();
  await expect.poll(() => stub(page, () => window.__stub.sync.keyStorage)).toBe("sync");
  expect(await stub(page, () => window.__stub.sync.apiKeys.gemini)).toBe("AIza-test");
  expect(await stub(page, () => window.__stub.local.apiKeys)).toBeUndefined();
});

test("進階：自訂模型名稱，預設模型當提示文字", async ({ context }) => {
  const { page } = await openFixture(context, null, "ext/popup.html", { provider: "gemini" });
  await page.click("#advanced summary");
  await expect(page.locator("#model-input")).toHaveAttribute("placeholder", "gemini-test-lite");
  await page.fill("#model-input", "gemini-9-flash");
  await page.press("#model-input", "Enter");
  await expect.poll(() => stub(page, () => window.__stub.sync.customModels?.gemini)).toBe("gemini-9-flash");
  await page.fill("#model-input", "");
  await page.press("#model-input", "Enter");
  await expect.poll(() => stub(page, () => window.__stub.sync.customModels?.gemini)).toBeUndefined();
});

test("譯文語言多了日文、葡萄牙文等；使用說明打開說明頁", async ({ context }) => {
  const { page } = await openFixture(context, null, "ext/popup.html");
  const codes = await page.locator("#lang-select option").evaluateAll((os) => os.map((o) => o.value));
  expect(codes).toEqual(expect.arrayContaining(["zh-TW", "zh-CN", "en", "ja", "ko", "pt", "it", "ru", "vi", "th", "id"]));
  await page.selectOption("#lang-select", "ja");
  expect(await stub(page, () => window.__stub.sync.targetLang)).toBe("ja");
  await page.click("#help-link");
  expect(await stub(page, () => window.__stub.tabsCreated[0].url)).toMatch(/welcome\.html$/);
});

test("英文介面", async ({ context }) => {
  const { page } = await openFixture(context, null, "ext/popup.html", { ui: "en", provider: "gemini" });
  await expect(page.locator("#toggle-label")).toHaveText("Translate on select");
  await expect(page.locator("#api-key")).toHaveAttribute("placeholder", "Paste your Google API key");
  await expect(page.locator("#key-save")).toHaveText("Save");
  expect(await page.evaluate(() => document.documentElement.lang)).toBe("en");
});
