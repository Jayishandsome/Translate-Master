// 隨選翻譯 — 安裝後的說明頁：先讓使用者試一次，再用三張示意圖教三個用法，最後列出可以選的翻譯方式。
// 也會檢查這台電腦的 Chrome 能不能用本機翻譯。
// 頁面最後也載入 content.js，讓使用者直接在「試試看」區塊選字翻譯。

const t = (key, subs) => globalThis.chrome?.i18n?.getMessage(key, subs) || key;

const BUILTIN_TARGETS = {
  "zh-TW": "zh-Hant", "zh-CN": "zh", en: "en", ja: "ja", ko: "ko", fr: "fr", de: "de", es: "es",
  pt: "pt", it: "it", ru: "ru", vi: "vi", th: "th", id: "id",
};
const MARKS = { ok: "✓", warn: "!", off: "✕", wait: "…" };
function applyI18n() {
  document.documentElement.lang = t("htmlLang");
  document.title = `${t("appName")} — Context Translator`;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const text = t(el.dataset.i18n);
    if (text !== el.dataset.i18n) el.textContent = text;
  });
}

function setCheck(id, state, key, subs) {
  const row = document.getElementById(id);
  row.dataset.state = state;
  row.querySelector(".mark").textContent = MARKS[state];
  row.querySelector(".desc").textContent = t(key, subs);
}

async function checkTranslator() {
  const version = (navigator.userAgent.match(/Chrome\/(\d+)/) || [])[1] || "?";
  if (!("Translator" in self)) {
    setCheck("check-translator", "off", "translatorMissing", [version]);
    return;
  }
  const { targetLang } = await chrome.storage.sync.get("targetLang");
  const target = BUILTIN_TARGETS[targetLang] || "zh-Hant";
  const source = target === "en" ? "ja" : "en";
  const availability = await Translator.availability({ sourceLanguage: source, targetLanguage: target }).catch(() => "unavailable");
  if (availability === "unavailable") setCheck("check-translator", "warn", "translatorPairMissing");
  else setCheck("check-translator", "ok", availability === "available" ? "translatorReady" : "translatorFirstUse", [version]);
}

// 「免費 AI」開放時才列出來（背景程式知道伺服器有沒有設定好）
async function showEngines() {
  const reply = await chrome.runtime.sendMessage({ action: "getProviders" }).catch(() => null);
  const free = reply?.free;
  const card = document.getElementById("engine-free");
  if (free?.enabled) {
    card.hidden = false;
    document.getElementById("engine-free-desc").textContent = t("engineFreeCardDesc", [String(free.dailyLimit || 10)]);
  } else {
    card.hidden = true;
    document.getElementById("engines").classList.add("two");
  }
}

applyI18n();
checkTranslator().catch(() => setCheck("check-translator", "warn", "translatorPairMissing"));
showEngines().catch(() => {});
