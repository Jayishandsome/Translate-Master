  // ----------------------------------------------------------------------
  // 狀態
  // ----------------------------------------------------------------------
  let currentSelection = "";
  let currentContext = "";
  let savedRange = null;
  let isFeatureEnabled = true;
  let activeProvider = "builtin";
  // 選了 AI 但還沒儲存金鑰時，暫時用 Chrome 內建翻譯；這裡只記哪些服務商有金鑰，不留金鑰本身
  let storedProvider = "builtin";
  let providersWithKey = new Set();
  let activeTargetLanguage = "zh-TW";
  let currentResult = "";
  let copyText = "";
  let isTranslating = false;
  let popoverAnimation = null;
  let buttonAnimation = null;
  let copyResetTimer = null;

  // 譯文語言：設定裡的代碼 → Chrome 內建翻譯用的語言代碼
  const BUILTIN_TARGETS = {
    "zh-TW": "zh-Hant", "zh-CN": "zh", en: "en", ja: "ja", ko: "ko", fr: "fr", de: "de", es: "es",
    pt: "pt", it: "it", ru: "ru", vi: "vi", th: "th", id: "id",
  };

  const PROVIDER_NAMES = {
    builtin: t("engineBuiltinName"),
    gemini: "Gemini",
    minimax: "MiniMax",
    kimi: "Kimi",
    openai: "OpenAI",
    deepseek: "DeepSeek",
    claude: "Claude",
  };

  let languageNames = null;
  try {
    languageNames = new Intl.DisplayNames([uiLanguage], { type: "language" });
  } catch (_) {}

  // 繁中、簡中用介面語言裡的固定說法，其他語言交給 Intl 依介面語言命名
  function targetName(code = activeTargetLanguage) {
    if (code === "zh-TW") return t("langZhHant");
    if (code === "zh-CN") return t("langZhHans");
    return languageName(code) || t("langZhHant");
  }

  function languageName(code) {
    if (!code) return "";
    try {
      return languageNames?.of(code) || code;
    } catch (_) {
      return code;
    }
  }

  let currentSourceName = "";

  function setHeader(provider, sourceLanguage = "") {
    const target = targetName();
    const source = languageName(sourceLanguage);
    currentSourceName = source;
    directionLabel.textContent = source && source !== target ? `${source} → ${target}` : t("directionTo", [target]);
    modeLabel.textContent = provider === "builtin"
      ? t("modeBuiltin")
      : t("modeAI", [PROVIDER_NAMES[provider] || t("aiModel")]);
  }

  const BLOCK_SELECTOR =
    "p, li, td, th, dd, dt, blockquote, figcaption, h1, h2, h3, h4, h5, h6, article, section, main, pre, div[class], div[id]";

  function getBlockElement(node) {
    let el =
      node instanceof Element
        ? node
        : node?.parentElement instanceof Element
        ? node.parentElement
        : null;
    while (el && el !== document.documentElement) {
      if (el.matches?.(BLOCK_SELECTOR)) {
        const t = el.innerText?.trim() || "";
        if (t.length >= 20) return el;
      }
      el = el.parentElement;
    }
    return node instanceof Element
      ? node
      : node?.parentElement instanceof Element
      ? node.parentElement
      : null;
  }

  // 送給 AI 的上下文：選取處前後各約 200 字，不再送整個區塊。
  // 所在段落太短時，才往外找到上一層區塊，但一樣只取選取處附近的文字。
  const CONTEXT_SIDE = 200;
  const squash = (text) => String(text || "").replace(/\s+/g, " ");

  function textAround(container, range) {
    try {
      const before = document.createRange();
      before.setStart(container, 0);
      before.setEnd(range.startContainer, range.startOffset);
      const after = document.createRange();
      after.setStart(range.endContainer, range.endOffset);
      after.setEndAfter(container.lastChild || container);
      return { before: squash(before.toString()), after: squash(after.toString()) };
    } catch (_) {
      return { before: "", after: "" };
    }
  }

  function extractContextFromRange(range, selectedText) {
    const sel = String(selectedText || "").trim();
    if (!range || !sel) return sel;

    let block = getBlockElement(range.commonAncestorContainer);
    let around = block ? textAround(block, range) : { before: "", after: "" };
    for (let i = 0; i < 3 && block?.parentElement && block.parentElement !== document.documentElement; i++) {
      if (around.before.length + around.after.length >= 40) break;
      block = block.parentElement;
      around = textAround(block, range);
    }

    // 從字詞或句子的邊界切，不要切在字的中間
    let before = around.before.slice(-CONTEXT_SIDE);
    let after = around.after.slice(0, CONTEXT_SIDE);
    if (around.before.length > CONTEXT_SIDE) before = before.replace(/^\S{0,30}\s/, "");
    if (around.after.length > CONTEXT_SIDE) after = after.replace(/\s\S{0,30}$/, "");
    return `${before}${squash(sel)}${after}`.trim();
  }

  function captureSelection(sel) {
    const text = sel?.toString().trim() || "";
    if (!text || !sel?.rangeCount) {
      savedRange = null;
      return { text: "", context: "" };
    }
    savedRange = sel.getRangeAt(0).cloneRange();
    return {
      text,
      context: extractContextFromRange(savedRange, text),
    };
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeLanguageCode(code) {
    const value = String(code || "").trim();
    if (!value) return "";
    if (/^zh-(tw|hk|mo|hant)/i.test(value)) return "zh-Hant";
    if (/^zh/i.test(value)) return "zh";
    if (/^he/i.test(value)) return "he";
    return value.split("-")[0].toLowerCase();
  }

  function pageLanguage() {
    return normalizeLanguageCode(document.documentElement.lang || "");
  }
