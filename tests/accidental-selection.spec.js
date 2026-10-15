// 翻頁、點圖片時不小心選到的文字，不要跳出翻譯按鈕：
// 從圖片開始拖、連點「下一頁」、選到的只有數字或符號。正常選字、雙擊單字照常出現。
const { test, expect } = require("@playwright/test");
const { openFixture } = require("./helpers");

const BTN = "#ctx-trans-floating-btn";

const center = async (page, sel) => {
  const b = await page.locator(sel).boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
const textEnd = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  const node = el.firstChild;
  const r = document.createRange();
  r.setStart(node, node.data.length - 2); r.setEnd(node, node.data.length - 1);
  const q = r.getBoundingClientRect();
  return { x: q.right - 1, y: q.top + q.height / 2 };
}, sel);
const selection = (page) => page.evaluate(() => getSelection().toString().trim());

test("選過字之後，點圖片或按「下一頁」翻頁：不會再跳出翻譯按鈕", async ({ context }) => {
  const { page } = await openFixture(context, null, "pages/gallery.html");
  const word = await page.evaluate(() => {
    const node = document.getElementById("text").firstChild;
    const i = node.data.indexOf("harbour");
    const r = document.createRange(); r.setStart(node, i); r.setEnd(node, i + 3);
    const q = r.getBoundingClientRect();
    return { x: q.left + q.width / 2, y: q.top + q.height / 2 };
  });
  await page.mouse.dblclick(word.x, word.y);
  await expect(page.locator(BTN)).toBeVisible();
  // Chrome 點圖片、按鈕時不會取消原本的選取
  const photo = await center(page, "#photo");
  for (let i = 0; i < 3; i++) {
    await page.mouse.click(photo.x, photo.y);
    await page.waitForTimeout(250);
    expect(await selection(page)).toBe("harbour");
    await expect(page.locator(BTN)).toBeHidden();
  }
  const nextBtn = await center(page, "#next-btn");
  await page.mouse.click(nextBtn.x, nextBtn.y);
  await page.waitForTimeout(250);
  await expect(page.locator(BTN)).toBeHidden();
});

test("連點「下一頁」連結或按鈕：不出現翻譯按鈕", async ({ context }) => {
  const { page } = await openFixture(context, null, "pages/gallery.html");
  const next = await center(page, "#next-div");
  await page.mouse.dblclick(next.x, next.y);
  await page.waitForTimeout(400);
  expect(await selection(page)).not.toBe("");
  await expect(page.locator(BTN)).toBeHidden();

  const btn = await center(page, "#next-btn");
  await page.mouse.click(btn.x, btn.y, { clickCount: 3 });
  await page.waitForTimeout(400);
  await expect(page.locator(BTN)).toBeHidden();
});

test("只選到數字或符號（例如頁碼 3 / 10）：不出現翻譯按鈕", async ({ context }) => {
  const { page } = await openFixture(context, null, "pages/gallery.html");
  const ten = await page.evaluate(() => {
    const node = document.getElementById("count").firstChild;
    const i = node.data.indexOf("10");
    const r = document.createRange(); r.setStart(node, i); r.setEnd(node, i + 2);
    const q = r.getBoundingClientRect();
    return { x: q.left + q.width / 2, y: q.top + q.height / 2 };
  });
  await page.mouse.dblclick(ten.x, ten.y);
  await page.waitForTimeout(400);
  expect(await selection(page)).toBe("10");
  await expect(page.locator(BTN)).toBeHidden();
});

test("正常的雙擊單字、拖曳選字：照常出現翻譯按鈕", async ({ context }) => {
  const { page } = await openFixture(context, null, "pages/gallery.html");
  const word = await page.evaluate(() => {
    const node = document.getElementById("text").firstChild;
    const i = node.data.indexOf("harbour");
    const r = document.createRange(); r.setStart(node, i); r.setEnd(node, i + 3);
    const q = r.getBoundingClientRect();
    return { x: q.left + q.width / 2, y: q.top + q.height / 2 };
  });
  await page.mouse.dblclick(word.x, word.y);
  await expect(page.locator(BTN)).toBeVisible();
  expect(await selection(page)).toBe("harbour");

  await page.evaluate(() => getSelection().removeAllRanges());
  await expect(page.locator(BTN)).toBeHidden();
  const start = await page.evaluate(() => {
    const node = document.getElementById("caption").firstChild;
    const r = document.createRange(); r.setStart(node, 0); r.setEnd(node, 1);
    const q = r.getBoundingClientRect();
    return { x: q.left + 1, y: q.top + q.height / 2 };
  });
  const end = await textEnd(page, "#caption");
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator(BTN)).toBeVisible();
});
