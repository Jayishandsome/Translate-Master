// 隨選翻譯 — 安裝後的說明頁：教三個用法，並檢查這台電腦的 Chrome 能不能用本機翻譯與本機語境解釋。
// 頁面最後也載入 content.js，讓使用者直接在「試試看」區塊選字翻譯。

const t = (key, subs) => globalThis.chrome?.i18n?.getMessage(key, subs) || key;

const BUILTIN_TARGETS = {
  "zh-TW": "zh-Hant", "zh-CN": "zh", en: "en", ja: "ja", ko: "ko", fr: "fr", de: "de", es: "es",
  pt: "pt", it: "it", ru: "ru", vi: "vi", th: "th", id: "id",
};
const MARKS = { ok: "✓", warn: "!", off: "✕", wait: "…" };
const NANO_OPTIONS = {
  expectedInputs: [{ type: "text", languages: ["en"] }],
  expectedOutputs: [{ type: "text", languages: ["en"] }],
};

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

async function checkNano() {
  const button = document.getElementById("nano-download");
  if (!("LanguageModel" in self)) {
    setCheck("check-nano", "off", "nanoUnsupported");
    return;
  }
  const availability = await LanguageModel.availability(NANO_OPTIONS).catch(() => "unavailable");
  if (availability === "available") {
    setCheck("check-nano", "ok", "nanoReady");
  } else if (availability === "unavailable") {
    setCheck("check-nano", "off", "nanoUnsupported");
  } else {
    setCheck("check-nano", "warn", availability === "downloading" ? "nanoDownloading" : "nanoDownloadable");
    button.hidden = false;
  }
}

// 模型要使用者親手按一下才能開始下載（Chrome 的規定），所以放一個按鈕
async function downloadNano() {
  const button = document.getElementById("nano-download");
  button.disabled = true;
  setCheck("check-nano", "warn", "nanoProgress", ["0"]);
  try {
    const session = await LanguageModel.create({
      ...NANO_OPTIONS,
      monitor(m) {
        m.addEventListener("downloadprogress", (event) => {
          setCheck("check-nano", "warn", "nanoProgress", [String(Math.round(event.loaded * 100))]);
        });
      },
    });
    session.destroy?.();
    setCheck("check-nano", "ok", "nanoReady");
    button.hidden = true;
  } catch (_) {
    setCheck("check-nano", "warn", "nanoFailed");
    button.disabled = false;
  }
}

applyI18n();
document.getElementById("nano-download").addEventListener("click", downloadNano);
checkTranslator().catch(() => setCheck("check-translator", "warn", "translatorPairMissing"));
checkNano().catch(() => setCheck("check-nano", "off", "nanoUnsupported"));
