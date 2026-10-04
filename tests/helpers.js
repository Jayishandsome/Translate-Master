const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const FIXTURES = path.join(__dirname, "fixtures");
const ORIGIN = "http://fixture.test";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".png": "image/png" };

/** 用 route 直接把檔案送進頁面，不需要另外開伺服器。/ext/ 對應 repo 根目錄。 */
async function serve(context) {
  await context.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    const rel = decodeURIComponent(url.pathname);
    const file = rel.startsWith("/ext/") ? path.join(ROOT, rel.slice(5)) : path.join(FIXTURES, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "not found" });
    await route.fulfill({ status: 200, contentType: TYPES[path.extname(file)] || "application/octet-stream", body: fs.readFileSync(file) });
  });
  await context.addInitScript({ path: path.join(FIXTURES, "stub.js") });
}

async function openFixture(context, page, file, params = {}) {
  await serve(context);
  const qs = new URLSearchParams(params).toString();
  const p = await context.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.goto(`${ORIGIN}/${file}${qs ? `?${qs}` : ""}`);
  return { page: p, errors };
}

/** 模擬使用者在右鍵選單選「全頁翻譯」 */
const translatePage = (page) => page.evaluate(() => window.__stub.toContent({ action: "translatePage" }));

/** 用真實滑鼠拖曳選取某個元素裡的文字（可指定結尾字串） */
async function selectText(page, selector, endText) {
  const s = await page.evaluate(([sel, end]) => {
    const el = document.querySelector(sel);
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const first = w.nextNode(); let last = first, n; while ((n = w.nextNode())) last = n;
    const r = document.createRange(); r.setStart(first, 0);
    if (end) { const i = first.data.indexOf(end); r.setEnd(first, i + end.length); } else r.setEnd(last, last.data.length);
    const rs = [...r.getClientRects()].filter((q) => q.width > 1); const a = rs[0], z = rs[rs.length - 1];
    return { x0: a.left + 1, y0: a.top + a.height / 2, x1: z.right - 1, y1: z.top + z.height / 2 };
  }, [selector, endText]);
  await page.mouse.move(s.x0, s.y0); await page.mouse.down();
  await page.mouse.move(s.x1, s.y1, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(150);
}

module.exports = { ROOT, ORIGIN, serve, openFixture, translatePage, selectText };
