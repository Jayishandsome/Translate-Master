// 測試用的替身：在一般網頁裡模擬擴充功能的 chrome.* API 與 Chrome 內建 AI，
// 讓 content.js / popup.html 不經修改就能在 Playwright 裡跑。
// 參數從網址的 query string 讀取，例如 ?provider=gemini&avail=downloadable。
(() => {
  if (window.__stub) return;
  let top = window;
  try { if (window.top && window.top.location.href) top = window.top; } catch (_) {}
  const q = new URLSearchParams(top.location.search);
  const delay = Number(q.get("delay") || 40);
  const S = top.__stub || (top.__stub = {
    sync: {
      isEnabled: true,
      apiProvider: q.get("provider") || "builtin",
      apiKeys: q.get("keys") === "none" ? {} : { gemini: "AIza-test", claude: "sk-ant-test" },
      targetLang: q.get("target") || "zh-TW",
    },
    local: {},
    listeners: [],          // storage.onChanged
    msgListeners: [],       // runtime.onMessage (content script side)
    sent: [],               // runtime.sendMessage payloads
    tabsCreated: [],
    translators: [],        // Translator.create options
    batchFail: Number(q.get("batchfail") || 0),
    batchError: q.get("batcherr") || "API key not valid. Please pass a valid API key.",
    messages: null,
  });
  window.__stub = S;

  // ---- i18n：從 _locales 同步載入，跟 chrome.i18n.getMessage 一樣是同步 API
  const uiLang = q.get("ui") || "zh_TW";
  if (!S.messages) {
    S.messages = {};
    for (const lang of [uiLang, "zh_TW"]) {
      try {
        const x = new XMLHttpRequest();
        x.open("GET", `/ext/_locales/${lang}/messages.json`, false);
        x.send();
        if (x.status === 200) S.messages = { ...JSON.parse(x.responseText), ...S.messages };
      } catch (_) {}
    }
  }
  const getMessage = (key, subs) => {
    const m = S.messages[key];
    if (!m) return "";
    const list = subs === undefined ? [] : Array.isArray(subs) ? subs : [subs];
    let text = m.message;
    if (m.placeholders) {
      for (const [name, ph] of Object.entries(m.placeholders)) {
        text = text.split(`$${name.toUpperCase()}$`).join(ph.content).split(`$${name}$`).join(ph.content);
      }
    }
    return text.replace(/\$(\d)/g, (_, n) => String(list[Number(n) - 1] ?? ""));
  };

  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const area = (name) => ({
    get(keys, cb) {
      const src = S[name];
      const list = Array.isArray(keys) ? keys : typeof keys === "string" ? [keys] : keys && typeof keys === "object" ? Object.keys(keys) : Object.keys(src);
      const out = {};
      list.forEach((k) => { if (k in src) out[k] = clone(src[k]); else if (keys && typeof keys === "object" && !Array.isArray(keys) && k in keys) out[k] = keys[k]; });
      if (cb) { cb(out); return; }
      return Promise.resolve(out);
    },
    set(data, cb) {
      const changes = {};
      Object.keys(data).forEach((k) => { changes[k] = { oldValue: clone(S[name][k]), newValue: clone(data[k]) }; });
      Object.assign(S[name], clone(data));
      S.listeners.forEach((fn) => { try { fn(changes, name); } catch (_) {} });
      if (cb) { cb(); return; }
      return Promise.resolve();
    },
    remove(keys, cb) {
      const list = Array.isArray(keys) ? keys : [keys];
      const changes = {};
      list.forEach((k) => { if (k in S[name]) { changes[k] = { oldValue: clone(S[name][k]) }; delete S[name][k]; } });
      S.listeners.forEach((fn) => { try { fn(changes, name); } catch (_) {} });
      if (cb) { cb(); return; }
      return Promise.resolve();
    },
  });

  const reply = (msg) => {
    S.sent.push(clone(msg));
    if (msg?.action === "translateBatch") {
      if (S.batchFail > 0) { S.batchFail--; return { success: false, error: S.batchError }; }
      return { success: true, data: msg.texts.map((t) => `AI譯:${t}`) };
    }
    if (msg?.action === "getProviders") return { providers: { gemini: { model: "gemini-test-lite" }, openai: { model: "gpt-test" } } };
    if (msg?.action === "translate") {
      return { success: true, data: q.get("wordreply") ? "【翻譯】河岸；岸邊\n【上下文】這裡指河邊。" : `AI譯:${msg.text}` };
    }
    return { ok: true };
  };

  window.chrome = {
    runtime: {
      id: "test-extension",
      getManifest: () => ({ version: "9.9.9" }),
      getURL: (p) => `/ext/${p}`,
      sendMessage: (msg) => new Promise((resolve) => setTimeout(() => resolve(reply(msg)), delay)),
      onMessage: { addListener: (fn) => S.msgListeners.push(fn) },
    },
    storage: { sync: area("sync"), local: area("local"), onChanged: { addListener: (fn) => S.listeners.push(fn) } },
    i18n: { getMessage, getUILanguage: () => uiLang.replace("_", "-") },
    tabs: { create: (o) => { S.tabsCreated.push(o); return Promise.resolve({ id: 1 }); } },
  };
  window.close = () => { S.closed = true; };
  S.toContent = (msg) => S.msgListeners.forEach((fn) => fn(msg, { id: "test-extension" }, () => {}));

  // ---- Chrome 內建 AI 替身
  // 依字數最多的文字系統判斷語言（跟真的偵測器一樣看主要語言）
  const guess = (text) => {
    const n = (re) => (String(text).match(re) || []).length;
    const counts = { ja: n(/[\u3040-\u30ff]/g) * 3, ko: n(/[\uac00-\ud7af]/g), zh: n(/[\u4e00-\u9fff]/g), en: n(/[a-z]/gi) / 4 };
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return best[1] > 0 ? best[0] : "en";
  };
  window.LanguageDetector = {
    availability: async () => q.get("detector") || "available",
    create: async () => ({ detect: async (t) => [{ detectedLanguage: q.get("src") || guess(t), confidence: 0.95 }], destroy() {} }),
  };
  const avail = q.get("avail") || "available";
  let downloaded = avail === "available";
  window.Translator = {
    availability: async ({ sourceLanguage }) => (q.get(`no_${sourceLanguage}`) ? "unavailable" : downloaded ? "available" : avail),
    create: async (opts = {}) => {
      if (!downloaded && !navigator.userActivation.isActive) throw new DOMException("Requires a user gesture", "NotAllowedError");
      if (!downloaded) { opts.monitor?.({ addEventListener() {} }); downloaded = true; }
      S.translators.push({ source: opts.sourceLanguage, target: opts.targetLanguage });
      const tag = opts.sourceLanguage === "en" ? "" : `‹${opts.sourceLanguage}›`;
      return {
        translate: (t) => new Promise((r) => setTimeout(() => r(tag + String(t).toUpperCase()), delay)),
        destroy() {},
      };
    },
  };
  try {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: (t) => { S.copied = t; return Promise.resolve(); } }, configurable: true });
  } catch (_) {}
})();
