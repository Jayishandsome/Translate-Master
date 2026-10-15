// 翻譯按鈕的位置：每次都在選取範圍最後一個字的右下方，不管怎麼選（三連擊、反向拖曳、拖到下一行），捲動時也跟著文字走
const { test, expect } = require("@playwright/test");
const { openFixture } = require("./helpers");

const BTN = "#ctx-trans-floating-btn";

/** 元素裡最後一個非空白字（或指定字串的最後一個字）的位置 */
function lastCharRect(page, selector, endText) {
  return page.evaluate(([sel, end]) => {
    const el = document.querySelector(sel);
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node, hit = null;
    while ((node = w.nextNode())) {
      if (end) {
        const i = node.data.indexOf(end);
        if (i >= 0) { hit = [node, i + end.length - 1]; break; }
      } else if (/\S/.test(node.data)) {
        hit = [node, node.data.trimEnd().length - 1];
      }
    }
    const r = document.createRange();
    r.setStart(hit[0], hit[1]); r.setEnd(hit[0], hit[1] + 1);
    const q = r.getBoundingClientRect();
    return { right: q.right, bottom: q.bottom, top: q.top };
  }, [selector, endText]);
}

async function expectAtEnd(page, expected) {
  const b = await page.locator(BTN).boundingBox();
  expect(Math.abs(b.x - (expected.right + 4))).toBeLessThan(3);
  expect(Math.abs(b.y - (expected.bottom + 6))).toBeLessThan(3);
}

/** 用滑鼠從 a 拖到 b（座標） */
async function drag(page, a, b) {
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator(BTN)).toBeVisible();
  await page.waitForTimeout(250);
}

const textPoint = (page, selector, text, side) => page.evaluate(([sel, t, s]) => {
  const el = document.querySelector(sel);
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = w.nextNode())) {
    const i = node.data.indexOf(t);
    if (i < 0) continue;
    const r = document.createRange();
    const at = s === "start" ? i : i + t.length - 1;
    r.setStart(node, at); r.setEnd(node, at + 1);
    const q = r.getBoundingClientRect();
    return { x: s === "start" ? q.left + 1 : q.right - 1, y: q.top + q.height / 2 };
  }
}, [selector, text, side]);

test("一般拖曳：按鈕在最後一個字的右下方", async ({ context }) => {
  const { page } = await openFixture(context, null, "pages/article.html");
  await drag(page, await textPoint(page, "#sel-target", "We", "start"), await textPoint(page, "#sel-target", "else.", "end"));
  await expectAtEnd(page, await lastCharRect(page, "#sel-target", "else."));
});

test("由後往前拖：按鈕一樣在選取範圍的結尾，不是滑鼠放開的地方", async ({ context }) => {
  const { page } = await openFixture(context, null, "pages/article.html");
  await drag(page, await textPoint(page, "#sel-target", "else.", "end"), await textPoint(page, "#sel-target", "We", "start"));
  await expectAtEnd(page, await lastCharRect(page, "#sel-target", "else."));
});

test("三連擊選整段：按鈕在段落最後一個字，不會跑到下一段開頭", async ({ context }) => {
  const { page } = await openFixture(context, null, "pages/article.html");
  const p = await textPoint(page, "#p-link", "Ground", "start");
  await page.mouse.click(p.x, p.y, { clickCount: 3 });
  await expect(page.locator(BTN)).toBeVisible();
  await page.waitForTimeout(250);
  await expectAtEnd(page, await lastCharRect(page, "#p-link"));
});

test("拖過段落結尾到下一段：按鈕在最後一個選到的字", async ({ context }) => {
  const { page } = await openFixture(context, null, "pages/article.html");
  const end = await textPoint(page, "#short", "Short", "start");
  await drag(page, await textPoint(page, "#p-ja", "朝", "start"), { x: end.x - 2, y: end.y });
  const sel = await page.evaluate(() => getSelection().toString());
  expect(sel.trim().endsWith("ratio = water / coffee") || sel.trim().endsWith("Short")).toBeTruthy();
  const lastText = sel.trim().endsWith("Short") ? ["#short", "Short"] : ["#code", null];
  await expectAtEnd(page, await lastCharRect(page, ...lastText));
});

test("捲動時按鈕跟著文字移動", async ({ context }) => {
  const { page } = await openFixture(context, null, "pages/article.html");
  await drag(page, await textPoint(page, "#sel-target", "We", "start"), await textPoint(page, "#sel-target", "else.", "end"));
  await page.evaluate(() => window.scrollBy(0, 60));
  await page.waitForTimeout(200);
  await expectAtEnd(page, await lastCharRect(page, "#sel-target", "else."));
  // 捲到看不到選取處時，按鈕先藏起來，捲回來再出現
  await page.evaluate(() => window.scrollBy(0, 2000));
  await page.waitForTimeout(200);
  await expect(page.locator(BTN)).toBeHidden();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await expect(page.locator(BTN)).toBeVisible();
  await expectAtEnd(page, await lastCharRect(page, "#sel-target", "else."));
});
