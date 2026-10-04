// 產生擴充功能實際載入的檔案：
// 1. 把 src/content/ 裡的檔案依檔名順序接成一個 content.js。
//    內容腳本要包在同一個函式裡，重複注入時才不會撞名；拆檔只是為了好維護。
// 2. 把 src/locales.json 拆成 Chrome 要的 _locales/<語言>/messages.json。
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// ---- content.js
const dir = join(root, "src", "content");
const parts = readdirSync(dir).filter((f) => f.endsWith(".js")).sort();
const body = parts.map((f) => readFileSync(join(dir, f), "utf8").replace(/\s+$/, "")).join("\n\n");
writeFileSync(join(root, "content.js"), `// 隨選翻譯 — 網頁選字與翻譯浮窗
// 這個檔案由 scripts/build.mjs 從 src/content/ 產生；請修改 src/content/ 裡的檔案，再執行 npm run build。

(() => {
${body}
})();
`);
console.log(`content.js ← ${parts.join(", ")}`);

// ---- _locales
// 訊息裡的 $1、$2 轉成 Chrome 文件寫法的具名 placeholder，getMessage(key, [a, b]) 會依序代入
const LOCALES = ["zh_TW", "zh_CN", "en"];
const source = JSON.parse(readFileSync(join(root, "src", "locales.json"), "utf8"));
for (const locale of LOCALES) {
  const out = {};
  for (const [key, entry] of Object.entries(source)) {
    const text = entry[locale];
    if (typeof text !== "string") throw new Error(`locales.json: "${key}" 缺少 ${locale}`);
    const message = { message: text.replace(/\$(\d)/g, (_, n) => `$P${n}$`) };
    if (entry.description) message.description = entry.description;
    const numbers = [...new Set([...text.matchAll(/\$(\d)/g)].map((m) => m[1]))];
    if (numbers.length) {
      message.placeholders = Object.fromEntries(numbers.map((n) => [`p${n}`, { content: `$${n}` }]));
    }
    out[key] = message;
  }
  mkdirSync(join(root, "_locales", locale), { recursive: true });
  writeFileSync(join(root, "_locales", locale, "messages.json"), `${JSON.stringify(out, null, 2)}\n`);
}
console.log(`_locales ← ${LOCALES.join(", ")} (${Object.keys(source).length} messages)`);
