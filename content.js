// 隨選翻譯 — 網頁選字與翻譯浮窗
// 這個檔案由 scripts/build.mjs 從 src/content/ 產生；請修改 src/content/ 裡的檔案，再執行 npm run build。

(() => {
  // ----------------------------------------------------------------------
  // 介面文字：都在 _locales/ 裡，依 Chrome 的介面語言顯示
  // ----------------------------------------------------------------------
  const t = (key, subs) => globalThis.chrome?.i18n?.getMessage(key, subs) || key;
  const uiLanguage = globalThis.chrome?.i18n?.getUILanguage?.() || "zh-TW";

  const IDS = {
    style: "ctx-trans-style",
    btn: "ctx-trans-floating-btn",
    pop: "ctx-trans-popover",
    bar: "ctx-page-bar",
    pageStyle: "ctx-page-style",
  };
  const B = `#${IDS.btn}`;
  const P = `#${IDS.pop}`;

  // 清掉舊版殘留節點 (避免擴充更新後重複)
  Object.values(IDS).forEach((id) => document.getElementById(id)?.remove());

  // 紙本字典風：米白紙、墨黑字、朱紅印。所有選擇器都限定在擴充功能自己的節點內，
  // 並重設常見屬性，避免網頁本身的 CSS 滲入。
  const style = document.createElement("style");
  style.id = IDS.style;
  style.textContent = `
    ${B}, ${P} {
      --ctx-paper: #fbf8f1;
      --ctx-paper-2: #f1ebdf;
      --ctx-paper-3: #e6decd;
      --ctx-ink: #1b1a17;
      --ctx-ink-2: #5c574d;
      --ctx-ink-3: #8c8577;
      --ctx-hair: rgba(27, 26, 23, 0.14);
      --ctx-dots: rgba(27, 26, 23, 0.3);
      --ctx-vermilion: #c8372d;
      --ctx-vermilion-text: #b32e25;
      --ctx-seal-text: #fbf7ef;
      --ctx-focus: rgba(200, 55, 45, 0.38);
      --ctx-shadow: 0 1px 0 rgba(27, 26, 23, 0.06), 0 18px 40px -18px rgba(60, 40, 20, 0.45), 0 4px 10px -6px rgba(60, 40, 20, 0.18);
      --ctx-shadow-btn: 0 1px 0 rgba(27, 26, 23, 0.08), 0 8px 18px -10px rgba(60, 40, 20, 0.55);
      --ctx-serif: "Iowan Old Style", "Palatino Linotype", Palatino, "Songti TC", "Noto Serif TC", "Source Han Serif TC", "PMingLiU", "MingLiU", Georgia, serif;
      --ctx-sans: -apple-system, BlinkMacSystemFont, "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif;
      --ctx-ease-out: cubic-bezier(0.23, 1, 0.32, 1);
      all: initial;
      position: fixed;
      z-index: 2147483647;
      display: none;
      box-sizing: border-box;
      color: var(--ctx-ink);
      font-family: var(--ctx-serif);
      font-size: 14px;
      line-height: 1.5;
      text-align: left;
      -webkit-font-smoothing: antialiased;
    }
    ${B} *, ${P} * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      border: 0;
      font: inherit;
      color: inherit;
      letter-spacing: normal;
      text-transform: none;
      text-shadow: none;
      text-decoration: none;
      background: none;
      box-shadow: none;
      min-width: 0;
      max-width: none;
      float: none;
    }
    ${B} svg, ${P} svg { display: block; overflow: visible; }

    /* ---------- 朱印 ---------- */
    ${B} .ctx-seal, ${P} .ctx-seal {
      display: inline-grid;
      place-items: center;
      flex: 0 0 auto;
      color: var(--ctx-seal-text);
      background: var(--ctx-vermilion);
      border-radius: 3px;
      font-family: var(--ctx-serif);
      font-weight: 900;
      line-height: 1;
    }

    /* ---------- 翻譯按鈕 ---------- */
    ${B} {
      align-items: center;
      gap: 8px;
      height: 32px;
      padding: 0 12px 0 4px;
      color: var(--ctx-ink);
      background: var(--ctx-paper);
      border: 1px solid var(--ctx-ink);
      border-radius: 3px;
      box-shadow: var(--ctx-shadow-btn);
      cursor: pointer;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.12em;
      line-height: 1;
      white-space: nowrap;
      user-select: none;
      -webkit-user-select: none;
      transition: box-shadow 160ms ease, transform 140ms var(--ctx-ease-out);
    }
    ${B} .ctx-seal {
      width: 22px;
      height: 22px;
      font-size: 13px;
      letter-spacing: 0;
      transform: rotate(-4deg);
    }
    ${B}:active { transform: translateY(1px); box-shadow: 0 1px 0 rgba(27, 26, 23, 0.08); }
    ${B}:focus-visible {
      outline: 3px solid var(--ctx-focus);
      outline-offset: 2px;
    }

    /* ---------- 結果浮窗 ---------- */
    ${P} {
      width: 380px;
      max-width: calc(100vw - 16px);
      background: var(--ctx-paper);
      border: 1px solid var(--ctx-ink);
      border-radius: 4px;
      box-shadow: var(--ctx-shadow);
      overflow: hidden;
      transform-origin: var(--ctx-origin-x, 50%) var(--ctx-origin-y, 0%);
    }

    ${P} .ctx-header {
      display: flex;
      align-items: center;
      gap: 11px;
      min-height: 52px;
      margin: 0 14px;
      padding: 9px 0 8px;
      border-bottom: 3px double var(--ctx-ink);
      cursor: grab;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
    }
    ${P} .ctx-header:active { cursor: grabbing; }
    ${P} .ctx-header .ctx-seal {
      width: 28px;
      height: 28px;
      font-size: 17px;
      transform: rotate(-4deg);
    }
    ${P} .ctx-title-copy {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
    }
    ${P} .ctx-title-main,
    ${P} .ctx-title-sub {
      display: block;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    ${P} .ctx-title-main {
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.04em;
      line-height: 1.3;
    }
    ${P} .ctx-title-sub {
      margin-top: 1px;
      color: var(--ctx-ink-2);
      font-family: var(--ctx-sans);
      font-size: 11px;
      letter-spacing: 0.04em;
      line-height: 1.3;
    }

    ${P} .ctx-header-actions {
      display: flex;
      flex: 0 0 auto;
      gap: 2px;
      margin-right: -6px;
    }
    ${P} .ctx-icon-btn {
      display: inline-grid;
      place-items: center;
      width: 32px;
      height: 32px;
      color: var(--ctx-ink-2);
      border-radius: 3px;
      cursor: pointer;
      transition: background 140ms ease, color 140ms ease;
    }
    ${P} .ctx-icon-btn:disabled { opacity: 0.35; cursor: default; }
    ${P} .ctx-icon-btn[data-state="success"] { color: var(--ctx-vermilion-text); }
    ${P} .ctx-icon-btn:focus-visible {
      outline: 3px solid var(--ctx-focus);
      outline-offset: -1px;
    }
    ${P} .ctx-icon-btn svg {
      width: 16px;
      height: 16px;
      fill: none;
      stroke: currentColor;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 1.5;
    }

    /* ---------- 內文 ---------- */
    ${P} .ctx-body {
      display: block;
      max-height: min(380px, calc(100vh - 90px));
      padding: 12px 18px 18px;
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-width: thin;
      scrollbar-color: var(--ctx-dots) transparent;
    }

    ${P} .ctx-label {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 5px;
      color: var(--ctx-vermilion-text);
      font-family: var(--ctx-sans);
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.2em;
    }
    ${P} .ctx-label::after {
      content: "";
      flex: 1;
      border-top: 1px dotted var(--ctx-dots);
    }

    ${P} .ctx-source {
      display: -webkit-box;
      margin-bottom: 14px;
      overflow: hidden;
      color: var(--ctx-ink-2);
      font-size: 13.5px;
      line-height: 1.6;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 3;
    }
    ${P} .ctx-source.is-latin { font-style: italic; }

    ${P} .ctx-result {
      display: block;
      color: var(--ctx-ink);
      font-size: 16.5px;
      line-height: 1.8;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      user-select: text;
      -webkit-user-select: text;
    }

    /* 單字：詞條 */
    ${P} .ctx-word { display: block; }
    ${P} .ctx-headword {
      display: block;
      padding-top: 2px;
      color: var(--ctx-ink);
      font-size: 24px;
      font-weight: 700;
      line-height: 1.2;
      letter-spacing: 0.01em;
      overflow-wrap: anywhere;
    }
    ${P} .ctx-headword-meta {
      display: block;
      margin: 3px 0 12px;
      color: var(--ctx-ink-3);
      font-family: var(--ctx-sans);
      font-size: 11px;
      letter-spacing: 0.06em;
    }
    ${P} .ctx-senses {
      display: block;
      user-select: text;
      -webkit-user-select: text;
    }
    ${P} .ctx-sense {
      display: flex;
      gap: 8px;
      align-items: baseline;
      font-size: 18px;
      font-weight: 600;
      line-height: 1.55;
      overflow-wrap: anywhere;
    }
    ${P} .ctx-sense + .ctx-sense { margin-top: 2px; }
    ${P} .ctx-sense-num {
      flex: 0 0 auto;
      color: var(--ctx-vermilion-text);
      font-size: 15px;
      font-weight: 700;
    }
    ${P} .ctx-label-note { margin-top: 16px; }
    ${P} .ctx-note {
      display: block;
      color: var(--ctx-ink-2);
      font-size: 14px;
      line-height: 1.75;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      user-select: text;
      -webkit-user-select: text;
    }

    /* ---------- 查閱中 ---------- */
    ${P} .ctx-skeleton { display: grid; gap: 12px; padding: 6px 0 2px; }
    ${P} .ctx-skeleton i {
      display: block;
      height: 1px;
      border-top: 1px dotted var(--ctx-dots);
      position: relative;
      overflow: visible;
    }
    ${P} .ctx-skeleton i::before {
      content: "";
      position: absolute;
      left: 0;
      top: -5px;
      height: 8px;
      width: 0;
      background: var(--ctx-paper-3);
      border-radius: 1px;
      animation: ctxWrite 1.6s var(--ctx-ease-out) infinite;
    }
    ${P} .ctx-skeleton i:nth-child(1)::before { --w: 92%; }
    ${P} .ctx-skeleton i:nth-child(2)::before { --w: 100%; animation-delay: 160ms; }
    ${P} .ctx-skeleton i:nth-child(3)::before { --w: 56%; animation-delay: 320ms; }
    ${P} .ctx-loading-text {
      display: block;
      margin-top: 14px;
      color: var(--ctx-ink-2);
      font-family: var(--ctx-sans);
      font-size: 11.5px;
      letter-spacing: 0.04em;
    }
    @keyframes ctxWrite {
      0% { width: 0; opacity: 1; }
      60% { width: var(--w, 100%); opacity: 1; }
      100% { width: var(--w, 100%); opacity: 0; }
    }

    /* ---------- 錯誤 ---------- */
    ${P} .ctx-error {
      display: block;
      padding: 2px 0 2px 12px;
      border-left: 3px solid var(--ctx-vermilion);
    }
    ${P} .ctx-error-title {
      display: block;
      color: var(--ctx-vermilion-text);
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.04em;
      line-height: 1.4;
    }
    ${P} .ctx-error-text {
      display: block;
      margin-top: 3px;
      color: var(--ctx-ink-2);
      font-family: var(--ctx-sans);
      font-size: 12.5px;
      line-height: 1.65;
      overflow-wrap: anywhere;
    }

    /* ---------- 夜讀 ---------- */
    @media (prefers-color-scheme: dark) {
      ${B}, ${P} {
        --ctx-paper: #211f1b;
        --ctx-paper-2: #2a2722;
        --ctx-paper-3: #3a352d;
        --ctx-ink: #ede6d8;
        --ctx-ink-2: #b4ac9c;
        --ctx-ink-3: #8a8375;
        --ctx-hair: rgba(237, 230, 216, 0.14);
        --ctx-dots: rgba(237, 230, 216, 0.3);
        --ctx-vermilion: #e0604c;
        --ctx-vermilion-text: #ee7a66;
        --ctx-seal-text: #1a1815;
        --ctx-focus: rgba(238, 122, 102, 0.45);
        --ctx-shadow: 0 18px 40px -16px rgba(0, 0, 0, 0.75);
        --ctx-shadow-btn: 0 8px 18px -10px rgba(0, 0, 0, 0.8);
      }
    }

    /* ---------- 輔助偏好 ---------- */
    @media (prefers-contrast: more) {
      ${B}, ${P} {
        --ctx-ink-2: #3d3931;
        --ctx-dots: rgba(27, 26, 23, 0.6);
      }
      ${B}, ${P} { border-width: 2px; }
    }
    @media (prefers-color-scheme: dark) and (prefers-contrast: more) {
      ${B}, ${P} {
        --ctx-ink-2: #d8d1c3;
        --ctx-dots: rgba(237, 230, 216, 0.6);
      }
    }
    @media (hover: hover) and (pointer: fine) {
      ${B}:hover {
        transform: translateY(-1px);
        box-shadow: 0 1px 0 rgba(27, 26, 23, 0.08), 0 12px 22px -12px rgba(60, 40, 20, 0.6);
      }
      ${B}:active { transform: translateY(1px); }
      ${P} .ctx-icon-btn:not(:disabled):hover {
        color: var(--ctx-ink);
        background: var(--ctx-paper-2);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      ${B}, ${P} .ctx-icon-btn { transition-duration: 0.01ms; }
      ${B}:active, ${B}:hover { transform: none; }
      ${P} .ctx-skeleton i::before { animation: none; width: var(--w, 100%); }
    }
  `;
  (document.head || document.documentElement).appendChild(style);

  // ----------------------------------------------------------------------
  // DOM: 浮動按鈕 + 翻譯氣泡
  // ----------------------------------------------------------------------
  const ICONS = {
    copy: '<svg viewBox="0 0 18 18" aria-hidden="true"><rect x="6" y="6" width="9" height="9" rx="2"></rect><path d="M12 6V4.5A1.5 1.5 0 0 0 10.5 3h-6A1.5 1.5 0 0 0 3 4.5v6A1.5 1.5 0 0 0 4.5 12H6"></path></svg>',
    check: '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="m3.8 9.4 3.3 3.3 7.1-7.4"></path></svg>',
    close: '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M5 5 13 13M13 5 5 13"></path></svg>',
  };

  const btn = document.createElement("button");
  btn.id = IDS.btn;
  btn.type = "button";
  btn.setAttribute("aria-label", t("btnTranslateLabel"));
  btn.innerHTML = `<span class="ctx-seal" aria-hidden="true">文</span><span>${t("btnTranslate")}</span>`;
  document.documentElement.appendChild(btn);

  const pop = document.createElement("div");
  pop.id = IDS.pop;
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-label", t("popoverLabel"));
  pop.setAttribute("aria-hidden", "true");
  pop.innerHTML = `
    <div class="ctx-header" id="ctx-drag-handle" title="${t("dragHint")}">
      <span class="ctx-seal" aria-hidden="true">文</span>
      <span class="ctx-title-copy">
        <span class="ctx-title-main" id="ctx-direction-label">${t("popoverLabel")}</span>
        <span class="ctx-title-sub" id="ctx-mode-label">${t("appName")}</span>
      </span>
      <div class="ctx-header-actions">
        <button type="button" class="ctx-icon-btn" id="ctx-copy-btn" title="${t("copyTranslation")}" aria-label="${t("copyTranslation")}" disabled>${ICONS.copy}</button>
        <button type="button" class="ctx-icon-btn" id="ctx-close-btn" title="${t("closeEsc")}" aria-label="${t("closeResult")}">${ICONS.close}</button>
      </div>
    </div>
    <div class="ctx-body" id="ctx-body" aria-live="polite"></div>
  `;
  document.documentElement.appendChild(pop);

  const body = pop.querySelector("#ctx-body");
  const closeBtn = pop.querySelector("#ctx-close-btn");
  const copyBtn = pop.querySelector("#ctx-copy-btn");
  const handle = pop.querySelector("#ctx-drag-handle");
  const modeLabel = pop.querySelector("#ctx-mode-label");
  const directionLabel = pop.querySelector("#ctx-direction-label");

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

  async function incrementBuiltinUsage() {
    const today = new Date().toISOString().slice(0, 10);
    const data = await chrome.storage.sync.get(["usageDate", "usageCount"]);
    const next = data.usageDate === today ? (Number(data.usageCount) || 0) + 1 : 1;
    await chrome.storage.sync.set({ usageDate: today, usageCount: next });
  }

  async function translateWithBuiltin(text, context, targetCode) {
    if (!("Translator" in globalThis) || !("LanguageDetector" in globalThis)) {
      throw new Error(t("errNoBuiltin"));
    }

    const targetLanguage = BUILTIN_TARGETS[targetCode] || "zh-Hant";
    let detector;
    let translator;

    try {
      updateLoading(t("loadingDetect"));
      const detectorAvailability = await LanguageDetector.availability();
      if (detectorAvailability === "unavailable") {
        throw new Error(t("errNoDetector"));
      }

      detector = await LanguageDetector.create({
        monitor(monitor) {
          monitor.addEventListener("downloadprogress", (event) => {
            updateLoading(t("loadingDetectorProgress", [String(Math.round(event.loaded * 100))]));
          });
        },
      });

      const detectionSample = String(context || text).slice(0, 1200);
      const candidates = await detector.detect(detectionSample);
      const topCandidate = candidates?.[0];
      const fallbackLanguage = pageLanguage();
      const sourceLanguage = normalizeLanguageCode(
        topCandidate?.confidence >= 0.35
          ? topCandidate.detectedLanguage
          : fallbackLanguage || topCandidate?.detectedLanguage
      );

      if (!sourceLanguage) {
        throw new Error(t("errUnknownSource"));
      }

      setHeader("builtin", sourceLanguage);

      if (sourceLanguage === targetLanguage) return text;

      const translatorOptions = { sourceLanguage, targetLanguage };
      const translatorAvailability = await Translator.availability(translatorOptions);
      if (translatorAvailability === "unavailable") {
        throw new Error(t("errPairUnsupported"));
      }

      if (translatorAvailability !== "available") {
        updateLoading(t("loadingPackDownload"));
      } else {
        updateLoading(t("loadingTranslating"));
      }

      translator = await Translator.create({
        ...translatorOptions,
        monitor(monitor) {
          monitor.addEventListener("downloadprogress", (event) => {
            updateLoading(t("loadingPackProgress", [String(Math.round(event.loaded * 100))]));
          });
        },
      });

      updateLoading(t("loadingTranslating"));
      const result = await translator.translate(text);
      return String(result || "").trim();
    } catch (error) {
      if (error?.name === "NotSupportedError") {
        throw new Error(t("errPairUnsupported"));
      }
      if (error?.name === "NetworkError") {
        throw new Error(t("errPackFailed"));
      }
      throw error;
    } finally {
      translator?.destroy?.();
      detector?.destroy?.();
    }
  }

  function keyedProviders(keys) {
    return new Set(Object.keys(keys || {}).filter((k) => String(keys[k] || "").trim()));
  }

  function resolveProvider() {
    activeProvider = storedProvider === "builtin" || providersWithKey.has(storedProvider) ? storedProvider : "builtin";
  }

  // API 金鑰可能跟著 Chrome 同步（sync），也可能只存在這台電腦（local）
  let keyArea = "sync";

  async function refreshState() {
    try {
      if (chrome?.storage?.sync) {
        const s = await chrome.storage.sync.get(["isEnabled", "apiProvider", "apiKeys", "targetLang", "keyStorage"]);
        isFeatureEnabled = s.isEnabled !== false;
        storedProvider = s.apiProvider || "builtin";
        keyArea = s.keyStorage === "local" ? "local" : "sync";
        const keys = keyArea === "local" ? (await chrome.storage.local.get("apiKeys")).apiKeys : s.apiKeys;
        providersWithKey = keyedProviders(keys);
        resolveProvider();
        activeTargetLanguage = BUILTIN_TARGETS[s.targetLang] ? s.targetLang : "zh-TW";
      }
    } catch (_) {
      isFeatureEnabled = true;
    }
  }
  refreshState();

  if (globalThis.chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (changes.apiKeys && areaName === keyArea) {
        providersWithKey = keyedProviders(changes.apiKeys.newValue);
        resolveProvider();
      }
      if (areaName !== "sync") return;
      if (changes.keyStorage) { refreshState(); return; }
      if (changes.apiProvider) storedProvider = changes.apiProvider.newValue || "builtin";
      if (changes.apiProvider) resolveProvider();
      if (changes.targetLang) {
        activeTargetLanguage = BUILTIN_TARGETS[changes.targetLang.newValue]
          ? changes.targetLang.newValue
          : "zh-TW";
      }
      if (changes.isEnabled) {
        isFeatureEnabled = changes.isEnabled.newValue !== false;
      }
      if (changes.isEnabled && !isFeatureEnabled) {
        hideButton();
        hidePopover();
      }
    });
  }

  // ----------------------------------------------------------------------
  // 拖拉 (位置一律使用 fixed 座標，避免 scroll 問題)
  // ----------------------------------------------------------------------
  let drag = null;

  function clampToViewport(left, top) {
    const rect = pop.getBoundingClientRect();
    const maxLeft = window.innerWidth - rect.width - 8;
    const maxTop = window.innerHeight - rect.height - 8;
    return {
      left: Math.max(8, Math.min(left, maxLeft)),
      top: Math.max(8, Math.min(top, maxTop)),
    };
  }

  function onDragMove(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    e.preventDefault();
    const x = e.clientX - drag.offsetX;
    const y = e.clientY - drag.offsetY;
    const { left, top } = clampToViewport(x, y);
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
    pop.style.right = "auto";
    pop.style.bottom = "auto";
  }

  function onDragEnd(e) {
    if (!drag || (e && e.pointerId !== drag.pointerId)) return;
    const pointerId = drag.pointerId;
    drag = null;
    if (handle.hasPointerCapture?.(pointerId)) {
      handle.releasePointerCapture(pointerId);
    }
  }

  function onDragStart(e) {
    // 點到關閉/複製按鈕時不啟動拖拉
    if (drag || e.button !== 0 || e.target.closest(".ctx-icon-btn")) return;
    const rect = pop.getBoundingClientRect();
    drag = {
      pointerId: e.pointerId,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };
    handle.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  handle.addEventListener("pointerdown", onDragStart);
  handle.addEventListener("pointermove", onDragMove);
  handle.addEventListener("pointerup", onDragEnd);
  handle.addEventListener("pointercancel", onDragEnd);
  handle.addEventListener("lostpointercapture", onDragEnd);

  // ----------------------------------------------------------------------
  // 顯示與隱藏
  // ----------------------------------------------------------------------
  const prefersReducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  function hidePopover() {
    onDragEnd();
    popoverAnimation?.cancel();
    popoverAnimation = null;
    pop.style.display = "none";
    pop.setAttribute("aria-hidden", "true");
  }

  function hideButton() {
    buttonAnimation?.cancel();
    buttonAnimation = null;
    btn.style.display = "none";
  }

  function showButton() {
    btn.style.display = "inline-flex";
    if (prefersReducedMotion() || !btn.animate) return;
    buttonAnimation?.cancel();
    buttonAnimation = btn.animate(
      [
        { opacity: 0, transform: "translateY(4px) scale(0.94)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 160, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }
    );
  }

  function showPopoverAt(clientX, clientY) {
    pop.style.display = "block";
    pop.setAttribute("aria-hidden", "false");
    // 先放到接近選取的位置
    pop.style.left = `${clientX - 24}px`;
    pop.style.top = `${clientY + 14}px`;
    pop.style.right = "auto";
    pop.style.bottom = "auto";
    // 再 clamp 一次到視窗內
    requestAnimationFrame(() => {
      const rect = pop.getBoundingClientRect();
      const { left, top } = clampToViewport(rect.left, rect.top);
      pop.style.left = `${left}px`;
      pop.style.top = `${top}px`;
      animatePopoverFrom(clientX, clientY);
    });
  }

  function animatePopoverFrom(clientX, clientY) {
    if (prefersReducedMotion() || !pop.animate) return;

    const rect = pop.getBoundingClientRect();
    const originX = Math.max(12, Math.min(clientX - rect.left, rect.width - 12));
    const originY = Math.max(0, Math.min(clientY - rect.top, rect.height));
    pop.style.setProperty("--ctx-origin-x", `${originX}px`);
    pop.style.setProperty("--ctx-origin-y", `${originY}px`);

    popoverAnimation?.cancel();
    popoverAnimation = pop.animate(
      [
        { opacity: 0, transform: "scale(0.96)" },
        { opacity: 1, transform: "scale(1)" },
      ],
      {
        duration: 180,
        easing: "cubic-bezier(0.23, 1, 0.32, 1)",
      }
    );
    popoverAnimation.addEventListener(
      "finish",
      () => { popoverAnimation = null; },
      { once: true }
    );
  }

  function setBody(html) {
    body.innerHTML = html;
    body.scrollTop = 0;
    requestAnimationFrame(keepPopoverInViewport);
  }

  function keepPopoverInViewport() {
    if (pop.getAttribute("aria-hidden") !== "false" || drag) return;
    const rect = pop.getBoundingClientRect();
    const { left, top } = clampToViewport(rect.left, rect.top);
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  }

  window.addEventListener("resize", keepPopoverInViewport);

  function setCopyEnabled(enabled) {
    copyBtn.disabled = !enabled;
    resetCopyButton();
  }

  function resetCopyButton() {
    clearTimeout(copyResetTimer);
    copyBtn.innerHTML = ICONS.copy;
    delete copyBtn.dataset.state;
    copyBtn.title = t("copyTranslation");
    copyBtn.setAttribute("aria-label", t("copyTranslation"));
  }

  const CJK_RE = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\uf900-\ufaff]/;
  const SENSE_NUMS = ["①", "②", "③", "④", "⑤", "⑥"];

  function sourceBlock() {
    if (!currentSelection || isWordLookup(currentSelection)) return "";
    const latin = CJK_RE.test(currentSelection) ? "" : " is-latin";
    return `<div class="ctx-label">${t("labelSource")}</div><div class="ctx-source${latin}">${escapeHtml(currentSelection)}</div>`;
  }

  function headwordBlock() {
    const meta = currentSourceName ? t("wordLookupFrom", [currentSourceName]) : t("wordLookup");
    return `<span class="ctx-headword">${escapeHtml(currentSelection)}</span><span class="ctx-headword-meta">${escapeHtml(meta)}</span>`;
  }

  // 「值得的；有價值的」→ ① 值得的 ② 有價值的
  function sensesBlock(text) {
    const parts = String(text).split(/\s*[；;]\s*/).map((part) => part.trim()).filter(Boolean);
    if (parts.length < 2 || parts.length > SENSE_NUMS.length) {
      return `<span class="ctx-senses"><span class="ctx-sense"><span>${escapeHtml(text)}</span></span></span>`;
    }
    const items = parts
      .map((part, i) => `<span class="ctx-sense"><span class="ctx-sense-num">${SENSE_NUMS[i]}</span><span>${escapeHtml(part)}</span></span>`)
      .join("");
    return `<span class="ctx-senses">${items}</span>`;
  }

  function showLoading(message = t("loadingDefault")) {
    revealPopover();
    currentResult = "";
    copyText = "";
    setCopyEnabled(false);
    const lead = isWordLookup(currentSelection)
      ? `<div class="ctx-word">${headwordBlock()}</div>`
      : `${sourceBlock()}<div class="ctx-label">${t("labelTranslation")}</div>`;
    setBody(`
      ${lead}
      <div class="ctx-skeleton" aria-hidden="true"><i></i><i></i><i></i></div>
      <span class="ctx-loading-text" id="ctx-loading-text">${escapeHtml(message)}</span>
    `);
  }

  function updateLoading(message) {
    const element = body.querySelector("#ctx-loading-text");
    if (element) element.textContent = message;
  }

  function revealPopover() {
    pop.style.display = "block";
    pop.setAttribute("aria-hidden", "false");
  }

  function isWordLookup(text) {
    const s = String(text || "").trim();
    if (!s || /[\n\r]/.test(s)) return false;
    if (s.length > 48) return false;
    if ((s.match(/[.!?。！？]/g) || []).length > 1) return false;
    if (/\s/.test(s)) return s.split(/\s+/).filter(Boolean).length <= 2;
    return s.length <= 12;
  }

  function formatWordResult(text) {
    const raw = String(text || "").trim();
    const transMatch = raw.match(
      /【(?:翻譯|译|Translation)】\s*([\s\S]*?)(?=\n*【|$)/i
    );
    const ctxMatch = raw.match(
      /【(?:上下文|解釋|Context)】\s*([\s\S]*)/i
    );
    const trans = (transMatch?.[1] || "").trim();
    const ctxLine = (ctxMatch?.[1] || "").trim();

    let html = `<div class="ctx-word">${headwordBlock()}`;
    if (trans || ctxLine) {
      copyText = trans || ctxLine;
      if (trans) html += sensesBlock(trans);
      if (ctxLine) {
        html += `<div class="ctx-label ctx-label-note">${t("contextNote")}</div><span class="ctx-note">${escapeHtml(ctxLine)}</span>`;
      }
    } else {
      copyText = raw;
      html += sensesBlock(raw);
    }
    html += "</div>";
    return html;
  }

  function showResult(text) {
    currentResult = text;
    copyText = text;
    revealPopover();
    const html = isWordLookup(currentSelection)
      ? formatWordResult(text)
      : `${sourceBlock()}<div class="ctx-label">${t("labelTranslation")}</div><div class="ctx-result">${escapeHtml(text)}</div>`;
    setBody(html);
    setCopyEnabled(Boolean(copyText));
  }

  function showError(msg) {
    currentResult = "";
    copyText = "";
    revealPopover();
    setCopyEnabled(false);
    setBody(`
      <div class="ctx-error" role="alert">
        <span class="ctx-error-title">${t("errTitle")}</span>
        <span class="ctx-error-text">${escapeHtml(msg || t("errUnknown"))}</span>
      </div>
    `);
  }

  // ----------------------------------------------------------------------
  // 選取偵測
  // ----------------------------------------------------------------------
  function elementOfTarget(t) {
    if (t instanceof Element) return t;
    if (t instanceof Node && t.parentElement) return t.parentElement;
    return null;
  }

  // 翻譯按鈕放在選取範圍最後一行的結尾，也就是滑鼠放開的位置附近
  function selectionAnchor(range, e) {
    const rects = range ? [...range.getClientRects()].filter((r) => r.width || r.height) : [];
    const last = rects[rects.length - 1] || range?.getBoundingClientRect();
    if (last && (last.width || last.height)) return { x: last.right, y: last.bottom };
    return { x: e.clientX, y: e.clientY };
  }

  document.addEventListener("mouseup", async (e) => {
    if (!e.isTrusted) return;
    const target = elementOfTarget(e.target);
    if (!target) return;
    // 點到自己的浮窗就跳過
    if (target.closest(`#${IDS.btn}`) || target.closest(`#${IDS.pop}`) || target.closest(`#${IDS.bar}`)) return;

    await refreshState();
    if (!isFeatureEnabled) return;

    const sel = window.getSelection();
    const { text, context } = captureSelection(sel);

    if (!text) {
      hideButton();
      savedRange = null;
      return;
    }

    currentSelection = text;
    currentContext = context;

    const range = sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
    const anchor = selectionAnchor(range, e);

    btn.style.left = `${anchor.x + 6}px`;
    btn.style.top = `${anchor.y + 8}px`;
    showButton();
    requestAnimationFrame(() => {
      const buttonRect = btn.getBoundingClientRect();
      const left = Math.max(8, Math.min(buttonRect.left, window.innerWidth - buttonRect.width - 8));
      const top = Math.max(8, Math.min(buttonRect.top, window.innerHeight - buttonRect.height - 8));
      btn.style.left = `${left}px`;
      btn.style.top = `${top}px`;
    });
    hidePopover();
  });

  document.addEventListener("mousedown", (e) => {
    if (isTranslating) return;
    const t = elementOfTarget(e.target);
    if (!t) return;
    if (!t.closest(`#${IDS.pop}`) && !t.closest(`#${IDS.btn}`)) {
      hidePopover();
    }
  });

  // ----------------------------------------------------------------------
  // 翻譯按鈕點擊
  // ----------------------------------------------------------------------
  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    e.preventDefault();

    // 只回應使用者真的點擊或按鍵；網頁腳本呼叫 btn.click() 不會觸發翻譯，
    // 避免惡意網頁用你的 API 金鑰大量送出請求。
    if (!e.isTrusted) return;

    const buttonRect = btn.getBoundingClientRect();
    const anchorX = buttonRect.left || e.clientX;
    const anchorY = buttonRect.bottom || e.clientY;

    if (!currentSelection.trim()) {
      showPopoverAt(anchorX, anchorY);
      showError(t("errNoSelection"));
      return;
    }

    hideButton();
    showPopoverAt(anchorX, anchorY);
    const provider = activeProvider;
    setHeader(provider);
    showLoading(provider === "builtin" ? t("loadingBuiltin") : t("loadingAI"));

    // 點擊翻譯時選取可能已消失，用儲存的 Range 重新擷取上下文
    if (savedRange) {
      currentContext = extractContextFromRange(savedRange, currentSelection);
    }

    isTranslating = true;
    let handled = false;

    const finish = (fn) => {
      if (handled) return;
      handled = true;
      isTranslating = false;
      fn();
    };

    const timeoutId = setTimeout(() => {
      finish(() => showError(t("errTimeout")));
    }, provider === "builtin" ? 300000 : 18000);

    try {
      if (provider === "builtin") {
        const text = await translateWithBuiltin(
          currentSelection,
          currentContext,
          activeTargetLanguage
        );
        clearTimeout(timeoutId);

        if (!text) {
          finish(() => showError(t("errEmptyBuiltin")));
        } else {
          incrementBuiltinUsage().catch(() => {});
          finish(() => showResult(text));
        }
        return;
      }

      const response = await chrome.runtime.sendMessage({
        action: "translate",
        text: currentSelection,
        context: currentContext,
      });

      clearTimeout(timeoutId);

      if (!response) {
        finish(() => showError(t("errNoResponse")));
        return;
      }

      if (response.success) {
        const text = String(response.data ?? "").trim();
        if (!text) {
          finish(() => showError(t("errEmptyAI")));
        } else {
          finish(() => showResult(text));
        }
      } else {
        finish(() => showError(response.error || t("errGeneric")));
      }
    } catch (error) {
      clearTimeout(timeoutId);
      const msg = String(error?.message || error);
      if (msg.includes("Extension context invalidated")) {
        finish(() =>
          showError(t("errExtensionUpdated"))
        );
      } else {
        finish(() => showError(msg));
      }
    }
  });

  // ----------------------------------------------------------------------
  // 關閉 / 複製
  // ----------------------------------------------------------------------
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    hidePopover();
    hideButton();
  });

  copyBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (!copyText) return;
    try {
      await navigator.clipboard.writeText(copyText);
      clearTimeout(copyResetTimer);
      copyBtn.innerHTML = ICONS.check;
      copyBtn.dataset.state = "success";
      copyBtn.title = t("copied");
      copyBtn.setAttribute("aria-label", t("copied"));
      copyResetTimer = setTimeout(resetCopyButton, 1400);
    } catch (_) {}
  });

  // 防止氣泡內點擊冒泡關掉自己
  pop.addEventListener("mousedown", (e) => e.stopPropagation());

  // ----------------------------------------------------------------------
  // 全頁翻譯（右鍵選單）
  // 跟著設定走：本機翻譯用 Chrome 內建翻譯在裝置上處理；選了 AI 模型（且已儲存金鑰）
  // 就把段落分批送到該服務商，一次一批、附上前後段落當上下文。
  // 每個段落的譯文放在 <ctx-tr> 元素裡；「譯文」模式暫時清空原文的文字節點，
  // 「對照」模式保留原文、譯文顯示在下方；「還原」把一切復原。
  // 只翻譯捲動到附近的段落，之後動態載入的內容也會接著翻。
  // ----------------------------------------------------------------------
  const PB = `#${IDS.bar}`;
  const pageStyle = document.createElement("style");
  pageStyle.id = IDS.pageStyle;
  pageStyle.textContent = `
    ctx-tr { display: inline; font: inherit; color: inherit; letter-spacing: inherit; text-transform: none; }
    ctx-tr .ctx-tr-links { font-size: .88em; opacity: .85; white-space: normal; }
    html.ctx-page-bi ctx-tr {
      display: block; margin: .35em 0 0; padding: 0 0 0 .65em;
      border-left: 2px solid rgba(200, 55, 45, .55); opacity: .92;
    }

    ${PB} {
      --pb-paper: #fbf8f1; --pb-paper-2: #efe9dc; --pb-ink: #1b1a17; --pb-ink-2: #5c574d;
      --pb-vermilion: #c8372d; --pb-seal-text: #fbf7ef; --pb-focus: rgba(200, 55, 45, .38);
      all: initial; position: fixed; z-index: 2147483646; right: 16px; bottom: 16px;
      display: none; align-items: center; gap: 10px; box-sizing: border-box;
      max-width: calc(100vw - 32px); min-height: 46px; padding: 7px 7px 7px 10px;
      color: var(--pb-ink); background: var(--pb-paper); border: 1px solid var(--pb-ink); border-radius: 4px;
      box-shadow: 0 1px 0 rgba(27, 26, 23, .06), 0 16px 34px -16px rgba(60, 40, 20, .5);
      font-family: -apple-system, BlinkMacSystemFont, "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif;
      font-size: 12.5px; line-height: 1.35; -webkit-font-smoothing: antialiased;
    }
    ${PB} * { box-sizing: border-box; margin: 0; padding: 0; border: 0; background: none; font: inherit; color: inherit; letter-spacing: normal; text-transform: none; }
    ${PB} svg { display: block; width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; }
    ${PB} .ctx-pb-seal { flex: none; width: 24px; height: 24px; display: grid; place-items: center; border-radius: 3px; transform: rotate(-4deg);
      color: var(--pb-seal-text); background: var(--pb-vermilion);
      font: 900 14px/1 "Iowan Old Style", "Songti TC", "Noto Serif TC", "PMingLiU", serif; }
    ${PB} .ctx-pb-text { display: flex; flex-direction: column; min-width: 0; }
    ${PB} .ctx-pb-title { font: 700 13.5px/1.3 "Iowan Old Style", "Songti TC", "Noto Serif TC", "PMingLiU", serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    ${PB} .ctx-pb-sub { margin-top: 1px; color: var(--pb-ink-2); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    ${PB} button { cursor: pointer; height: 28px; border-radius: 3px; white-space: nowrap; font-weight: 600; }
    ${PB} button:focus-visible { outline: 3px solid var(--pb-focus); outline-offset: 1px; }
    ${PB} .ctx-pb-seg { flex: none; display: flex; border: 1px solid var(--pb-ink); border-radius: 3px; overflow: hidden; }
    ${PB} .ctx-pb-seg button { border-radius: 0; padding: 0 10px; height: 26px; }
    ${PB} .ctx-pb-seg button[aria-pressed="true"] { color: var(--pb-paper); background: var(--pb-ink); }
    ${PB} .ctx-pb-btn { flex: none; padding: 0 11px; border: 1px solid var(--pb-ink); }
    ${PB} .ctx-pb-btn.primary { color: var(--pb-seal-text); background: var(--pb-vermilion); border-color: var(--pb-vermilion); }
    ${PB} .ctx-pb-x { flex: none; width: 28px; display: grid; place-items: center; color: var(--pb-ink-2); }
    ${PB}[data-kind="error"] .ctx-pb-title, ${PB}[data-kind="retry"] .ctx-pb-title, ${PB}[data-kind="failed"] .ctx-pb-title { color: var(--pb-vermilion); }
    @media (hover: hover) and (pointer: fine) {
      ${PB} .ctx-pb-seg button[aria-pressed="false"]:hover, ${PB} .ctx-pb-btn:not(.primary):hover, ${PB} .ctx-pb-x:hover { background: var(--pb-paper-2); color: var(--pb-ink); }
    }
    @media (prefers-color-scheme: dark) {
      ${PB} { --pb-paper: #211f1b; --pb-paper-2: #2e2b26; --pb-ink: #ede6d8; --pb-ink-2: #b4ac9c;
        --pb-vermilion: #e0604c; --pb-seal-text: #1a1815; --pb-focus: rgba(238, 122, 102, .45);
        box-shadow: 0 16px 34px -14px rgba(0, 0, 0, .75); }
      html.ctx-page-bi ctx-tr { border-left-color: rgba(238, 122, 102, .6); }
    }
  `;
  (document.head || document.documentElement).appendChild(pageStyle);

  const PAGE_SKIP = [
    "script", "style", "noscript", "template", "textarea", "input", "select", "option", "button",
    "code", "pre", "kbd", "samp", "svg", "math", "iframe", "canvas", "video", "audio", "ctx-tr",
    "[contenteditable='']", "[contenteditable='true']", "[translate='no']", ".notranslate",
    `#${IDS.btn}`, `#${IDS.pop}`, `#${IDS.bar}`,
  ].join(",");

  // AI 模式下不翻網站本身的框架：選單、導覽、頁首頁尾、側欄。這些每頁都一樣，翻了只是花錢。
  // 例外：文章（article）裡的側欄、主內容（article / main）裡的頁首頁尾，通常是內容的一部分，照樣翻。
  const AI_SKIP_ALWAYS = [
    "nav", "[role='navigation']", "[role='menu']", "[role='menubar']", "[role='search']",
    "[aria-hidden='true']", ".sidebar", "#sidebar", ".breadcrumb", ".breadcrumbs",
  ].join(",");
  const AI_SKIP_OUTSIDE_ARTICLE = "aside, [role='complementary']";
  const AI_SKIP_OUTSIDE_MAIN = "header, footer, [role='banner'], [role='contentinfo']";

  function isSiteChrome(el) {
    if (el.closest(AI_SKIP_ALWAYS)) return true;
    const side = el.closest(AI_SKIP_OUTSIDE_ARTICLE);
    if (side && !side.closest("article")) return true;
    const frame = el.closest(AI_SKIP_OUTSIDE_MAIN);
    return !!frame && !frame.closest("article, main, [role='main']");
  }

  const page = {
    active: false, starting: false, token: 0, mode: "translated",
    engine: "builtin", source: "", knownSource: "", target: "", translator: null, failed: [], lastError: "",
    inflight: new Map(), translators: new Map(), detector: null, skippedOther: 0,
    foreignOnly: false, knownForeignOnly: false, checking: 0,
    entries: [], queued: new WeakSet(), pending: new Map(), queue: [], running: 0, done: 0,
    io: null, mo: null, barState: null,
  };
  const displayCache = new WeakMap();

  function isBlockLevel(el) {
    if (displayCache.has(el)) return displayCache.get(el);
    const d = getComputedStyle(el).display;
    const block = !(d.startsWith("inline") || d === "contents" || d.startsWith("ruby"));
    displayCache.set(el, block);
    return block;
  }

  function blockOf(el) {
    while (el && el !== document.body && el !== document.documentElement) {
      if (isBlockLevel(el)) return el;
      el = el.parentElement;
    }
    return null;
  }

  // 把文字節點依「最近的區塊元素」分組，每組就是一個翻譯單位（通常是一個段落）
  function collectBlocks(root, { fallback = false } = {}) {
    const groups = new Map();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!/\S/.test(node.data)) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent || parent.closest(PAGE_SKIP)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let node;
    while ((node = walker.nextNode())) {
      const block = blockOf(node.parentElement);
      if (!block || page.queued.has(block)) continue;
      if (!groups.has(block)) groups.set(block, []);
      groups.get(block).push(node);
    }
    const items = [];
    const chromeItems = [];
    const skipChrome = page.engine !== "builtin";
    for (const [block, nodes] of groups) {
      const text = squash(nodes.map((n) => n.data).join("")).trim();
      if (text.length < 2 || !/\p{L}/u.test(text)) continue;
      // 目標是中文時，已經是中文的段落就不用翻
      if (page.target.startsWith("zh") && /^[\p{Script=Han}\p{P}\p{S}\p{N}\s]+$/u.test(text)) continue;
      (skipChrome && isSiteChrome(block) ? chromeItems : items).push(describeLinks({ block, nodes, text }));
    }
    // 整頁都被當成框架（結構很特別的網站）時，還是照常翻，免得什麼都沒翻
    return fallback && !items.length ? chromeItems : items;
  }

  // 段落裡的連結：譯文模式會清空原文，所以要在譯文裡放「代理連結」，點了就觸發原本的連結。
  // - 整段就是一個連結（標題、選單、清單項目）：譯文直接放進那個連結裡。
  // - 段落中夾著連結：AI 模式在文字裡用 ⟦1⟧…⟦/1⟧ 標出連結，請模型保留在譯文對應的位置；
  //   本機模式另外翻譯連結文字，再到整段譯文裡找出對應的字。找不到的連結附在譯文後面。
  const LINK_MAX = 9;
  const MARK_RE = /⟦(\d+)⟧([\s\S]*?)⟦\/\1⟧/g;
  const stripMarks = (text) => String(text || "").replace(/⟦\/?\d+⟧/g, "");

  function describeLinks(item) {
    const anchors = item.nodes.map((n) => n.parentElement?.closest("a[href]") || null);
    const inside = (a) => a && item.block.contains(a);
    item.host = item.block;
    item.links = [];
    if (anchors[0] && anchors.every((a) => a === anchors[0])) {
      if (inside(anchors[0])) item.host = anchors[0];
      return item;
    }
    let marked = "";
    let open = 0;
    item.nodes.forEach((n, i) => {
      const a = inside(anchors[i]) ? anchors[i] : null;
      let idx = a ? item.links.indexOf(a) + 1 : 0;
      if (a && !idx && item.links.length < LINK_MAX) { item.links.push(a); idx = item.links.length; }
      if (idx !== open) {
        if (open) marked += `⟦/${open}⟧`;
        if (idx) marked += `⟦${idx}⟧`;
        open = idx;
      }
      marked += n.data;
    });
    if (open) marked += `⟦/${open}⟧`;
    if (item.links.length) {
      item.marked = squash(marked).trim();
      item.linkTexts = item.links.map((a) => squash(a.textContent).trim());
    }
    return item;
  }

  // AI 送出（和快取）用帶連結標記的文字；本機翻譯用純文字
  const requestText = (item) => (page.engine !== "builtin" && item.marked) || item.text;

  function proxyLink(original, text) {
    const a = document.createElement("a");
    a.className = "ctx-tr-link";
    a.setAttribute("href", original.getAttribute("href") || "#");
    if (original.target) a.target = original.target;
    if (original.rel) a.rel = original.rel;
    a.textContent = text;
    a.addEventListener("click", (e) => {
      // 一般點擊交給原本的連結處理（網站自己的事件、單頁應用的路由）；Ctrl/Cmd 點擊照瀏覽器預設開新分頁
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      original.click();
    });
    return a;
  }

  function appendLinkChips(el, pairs) {
    if (!pairs.length) return;
    const wrap = document.createElement("span");
    wrap.className = "ctx-tr-links";
    wrap.append(" ↗ ");
    pairs.forEach(([a, text], i) => {
      if (i) wrap.append(" · ");
      wrap.append(proxyLink(a, text));
    });
    el.append(wrap);
  }

  function fillTranslation(el, item, result) {
    const text = String(result.text || "");
    const links = item.links || [];
    if (!links.length) { el.textContent = stripMarks(text); return; }

    if (MARK_RE.test(text)) {
      MARK_RE.lastIndex = 0;
      const used = new Set();
      let last = 0;
      let m;
      while ((m = MARK_RE.exec(text))) {
        el.append(stripMarks(text.slice(last, m.index)));
        const a = links[Number(m[1]) - 1];
        if (a && !used.has(a)) { el.append(proxyLink(a, stripMarks(m[2]))); used.add(a); }
        else el.append(stripMarks(m[2]));
        last = MARK_RE.lastIndex;
      }
      el.append(stripMarks(text.slice(last)));
      appendLinkChips(el, links.map((a, i) => [a, item.linkTexts[i]]).filter(([a]) => !used.has(a)));
      return;
    }

    const plain = stripMarks(text);
    const own = result.links || [];
    const found = [];
    const missing = [];
    let pos = 0;
    links.forEach((a, i) => {
      const t = String(own[i] || "").trim();
      const at = t ? plain.indexOf(t, pos) : -1;
      if (at >= 0) { found.push([at, at + t.length, a]); pos = at + t.length; }
      else missing.push([a, t || item.linkTexts[i]]);
    });
    let last = 0;
    for (const [start, end, a] of found) {
      el.append(plain.slice(last, start));
      el.append(proxyLink(a, plain.slice(start, end)));
      last = end;
    }
    el.append(plain.slice(last));
    appendLinkChips(el, missing);
  }

  function watch(items) {
    for (const item of items) {
      page.queued.add(item.block);
      page.pending.set(item.block, item);
      page.io.observe(item.block);
    }
  }

  // 翻過的段落記在這一頁的記憶體裡：還原後再翻、或同一段文字重複出現，都直接套用，不再送出請求。
  // 換了翻譯引擎或譯文語言就分開記。重新整理頁面後會清空。
  const pageCache = new Map();
  const PAGE_CACHE_LIMIT = 3000;
  const cacheKey = (engine, target, text) => `${engine}\u0001${target}\u0001${text}`;

  function cacheSet(engine, target, text, translated) {
    if (pageCache.size >= PAGE_CACHE_LIMIT) pageCache.delete(pageCache.keys().next().value);
    pageCache.set(cacheKey(engine, target, text), translated);
  }

  function applyCached() {
    if (!page.queue.length) return;
    const rest = [];
    for (const item of page.queue) {
      const cached = pageCache.get(cacheKey(page.engine, page.target, requestText(item)));
      if (cached) applyItem(item, cached);
      else rest.push(item);
    }
    if (rest.length !== page.queue.length) {
      page.queue = rest;
      updateProgress();
    }
  }

  function pump() {
    applyCached();
    if (page.engine !== "builtin") { pumpAI(); return; }
    while (page.running < 3 && page.queue.length) {
      const item = page.queue.shift();
      const token = page.token;
      const { engine, target } = page;
      page.running++;
      translateBuiltinItem(item, token)
        .then((result) => {
          if (!result) return;
          cacheSet(engine, target, item.text, result);
          if (token === page.token) applyItem(item, result);
        })
        .catch(() => {})
        .finally(() => {
          if (token !== page.token) return;
          page.running--;
          updateProgress();
          pump();
        });
    }
  }

  // 本機：逐段偵測語言。英文頁裡夾著日文引文時，日文那段用日文→譯文語言的翻譯器，
  // 而不是整頁的語言。已經是譯文語言的段落略過；沒有現成語言套件的語言也先略過（不能在背景下載）。
  async function sourceOf(text) {
    let source = page.source;
    if (page.detector && text.length >= 12) {
      try {
        const [top] = await page.detector.detect(text);
        if (top?.confidence >= 0.6) source = normalizeLanguageCode(top.detectedLanguage) || source;
      } catch (_) {}
    }
    if (sameLanguage(source, page.target)) return "";
    return source;
  }

  // 繁中、簡中互相不算「外文」：逐段翻譯本來就略過中文→中文
  function sameLanguage(a, b) {
    return a === b || (a.startsWith("zh") && b.startsWith("zh"));
  }

  // 沒有語言偵測模型時，用文字的書寫系統粗略判斷一段是不是外文。
  // 拉丁字母以「字」為單位，大約四個字母算一個，避免中文段落裡夾幾個英文單字就被當成英文。
  const SCRIPTS = [
    ["han", /[\u3400-\u9fff\uf900-\ufaff]/g, 1], ["kana", /[\u3040-\u30ff]/g, 3], ["hangul", /[\uac00-\ud7af]/g, 1],
    ["cyrillic", /[\u0400-\u04ff]/g, 0.25], ["thai", /[\u0e00-\u0e7f]/g, 0.25], ["latin", /[A-Za-z\u00c0-\u024f]/g, 0.25],
  ];
  const SCRIPT_LANGUAGE = { han: "zh", kana: "ja", hangul: "ko", cyrillic: "ru", thai: "th", latin: "en" };

  function mainScript(text) {
    let best = "", score = 0;
    for (const [name, re, weight] of SCRIPTS) {
      const n = (text.match(re) || []).length * weight;
      if (n > score) { best = name; score = n; }
    }
    return best;
  }

  function targetScripts(target) {
    if (target.startsWith("zh")) return ["han"];
    return { ja: ["han", "kana"], ko: ["hangul", "han"], ru: ["cyrillic"], th: ["thai"] }[target] || ["latin"];
  }

  // 這一段如果是譯文語言以外的語言，回傳那個語言；拿不準就當作不是外文，不翻
  async function foreignLanguageOf(text, detector) {
    if (text.length < 12) return "";
    if (detector) {
      try {
        const [top] = await detector.detect(text);
        if (!(top?.confidence >= 0.6)) return "";
        const lang = normalizeLanguageCode(top.detectedLanguage);
        return lang && lang !== "und" && !sameLanguage(lang, page.target) ? lang : "";
      } catch (_) {}
    }
    const script = mainScript(text);
    return script && !targetScripts(page.target).includes(script) ? SCRIPT_LANGUAGE[script] : "";
  }

  async function availableDetector() {
    try {
      if ("LanguageDetector" in globalThis && (await LanguageDetector.availability()) === "available") {
        return await LanguageDetector.create();
      }
    } catch (_) {}
    return null;
  }

  // 頁面本身已經是譯文語言時（例如中文頁面裡夾著英文段落），找出外文段落最常見的語言；沒有就回傳空字串
  async function findForeign(items) {
    const detector = await availableDetector();
    const counts = new Map();
    try {
      for (const item of items.slice(0, 300)) {
        const lang = await foreignLanguageOf(item.text, detector);
        if (lang) counts.set(lang, (counts.get(lang) || 0) + 1);
      }
    } finally {
      detector?.destroy?.();
    }
    return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  }

  // 段落進到畫面附近就排進翻譯佇列；只翻外文段落時，先確認這段是外文，順便記下它的語言
  function enqueue(item) {
    if (!page.foreignOnly) {
      page.queue.push(item);
      return;
    }
    const token = page.token;
    page.checking++;
    foreignLanguageOf(item.text, page.detector).then((lang) => {
      if (token !== page.token) return;
      page.checking--;
      if (lang) {
        item.source = lang;
        page.queue.push(item);
        pump();
      }
      updateProgress();
    });
  }

  function translatorFor(source) {
    if (!page.translators.has(source)) {
      page.translators.set(source, (async () => {
        try {
          const options = { sourceLanguage: source, targetLanguage: page.target };
          if ((await Translator.availability(options)) !== "available") return null;
          return await Translator.create(options);
        } catch (_) {
          return null;
        }
      })());
    }
    return page.translators.get(source);
  }

  async function translateBuiltinItem(item, token) {
    const source = item.source || await sourceOf(item.text);
    if (!source) return null;
    const translator = await translatorFor(source);
    if (!translator) {
      if (token === page.token) page.skippedOther++;
      return null;
    }
    const text = String((await translator.translate(item.text)) || "").trim();
    if (!text) return null;
    const links = [];
    for (const t of item.linkTexts || []) links.push(String((await translator.translate(t)) || "").trim());
    return { text, links };
  }

  // AI：把相鄰段落湊成一批（最多 12 段、約 2,400 字），同時最多 2 批在途
  const AI_BATCH_ITEMS = 12;
  const AI_BATCH_CHARS = 2400;
  const AI_CONCURRENCY = 2;

  // 回傳這一批要送出的文字（不重複）；同樣的文字已經在途中的，就排在那一批後面等結果
  function takeBatch() {
    const texts = [];
    let chars = 0;
    while (page.queue.length && texts.length < AI_BATCH_ITEMS) {
      const next = page.queue[0];
      const text = requestText(next);
      const waiting = page.inflight.get(text);
      if (waiting) {
        waiting.push(page.queue.shift());
        continue;
      }
      if (texts.length && chars + text.length > AI_BATCH_CHARS) break;
      page.queue.shift();
      page.inflight.set(text, [next]);
      texts.push(text);
      chars += text.length;
    }
    return texts;
  }

  async function requestBatch(texts) {
    const res = await chrome.runtime.sendMessage({ action: "translateBatch", texts, title: document.title.slice(0, 200) });
    if (!res?.success) throw new Error(res?.error || t("errBatch"));
    return res.data;
  }

  const isRetryable = (message) => /rate|quota|exhaust|overload|busy|逾時|超时|timeout|timed out|\b429\b|\b50\d\b/i.test(String(message || ""));
  const pageErrorText = (error) => {
    const message = String(error?.message || error || t("errBatch"));
    if (/context invalidated|receiving end/i.test(message)) return t("errExtensionUpdated");
    return message.length > 120 ? `${message.slice(0, 120)}…` : message;
  };

  function pumpAI() {
    while (page.running < AI_CONCURRENCY && page.queue.length) {
      const texts = takeBatch();
      if (!texts.length) continue;
      const token = page.token;
      const { engine, target } = page;
      const takeWaiting = (text) => {
        const items = page.inflight.get(text) || [];
        page.inflight.delete(text);
        return items;
      };
      page.running++;
      (async () => {
        let out;
        try {
          out = await requestBatch(texts);
        } catch (error) {
          // 額度、忙碌、逾時這類暫時性錯誤，等一下自動再試一次
          if (token !== page.token || !isRetryable(error?.message)) throw error;
          await new Promise((resolve) => setTimeout(resolve, 2500));
          if (token !== page.token) return;
          out = await requestBatch(texts);
        }
        // 已經付費取得的譯文，就算使用者中途按了還原也先記起來
        texts.forEach((text, i) => {
          const translated = String(out?.[i] || "").trim();
          if (translated) cacheSet(engine, target, text, { text: translated });
        });
        if (token !== page.token) return;
        texts.forEach((text, i) => {
          const translated = String(out?.[i] || "").trim();
          const items = takeWaiting(text);
          if (translated) items.forEach((item) => applyItem(item, { text: translated }));
        });
      })()
        .catch((error) => {
          if (token !== page.token) return;
          texts.forEach((text) => page.failed.push(...takeWaiting(text)));
          page.lastError = pageErrorText(error);
        })
        .finally(() => {
          if (token !== page.token) return;
          page.running--;
          if (page.failed.length) renderBar();
          else updateProgress();
          pump();
        });
    }
  }

  function retryFailed() {
    if (!page.active || !page.failed.length) return;
    page.queue.unshift(...page.failed);
    page.failed = [];
    page.lastError = "";
    renderBar();
    pump();
  }

  function applyItem(item, result) {
    const host = item.host || item.block;
    if (!host.isConnected) return;
    const el = document.createElement("ctx-tr");
    el.setAttribute("translate", "no");
    el.setAttribute("lang", page.target);
    fillTranslation(el, item, result);
    host.appendChild(el);
    item.el = el;
    item.originals = item.nodes.map((n) => n.data);
    if (page.mode === "translated") item.nodes.forEach((n) => { n.data = ""; });
    page.entries.push(item);
    page.done++;
  }

  function setMode(mode) {
    page.mode = mode;
    document.documentElement.classList.toggle("ctx-page-bi", mode === "bilingual");
    for (const item of page.entries) {
      item.nodes.forEach((n, i) => { n.data = mode === "translated" ? "" : item.originals[i]; });
    }
    renderBar();
  }

  function restorePage() {
    page.token++;
    page.active = false;
    page.io?.disconnect();
    page.mo?.disconnect();
    page.queue = [];
    page.running = 0;
    page.checking = 0;
    page.foreignOnly = false;
    page.failed = [];
    page.lastError = "";
    page.inflight = new Map();
    page.pending.clear();
    for (const item of page.entries) {
      item.nodes.forEach((n, i) => { n.data = item.originals[i]; });
      item.el?.remove();
    }
    const hadTranslations = page.entries.length > 0;
    page.entries = [];
    page.queued = new WeakSet();
    page.done = 0;
    document.documentElement.classList.remove("ctx-page-bi");
    for (const pending of page.translators.values()) pending.then((t) => t?.destroy?.(), () => {});
    page.translators = new Map();
    page.translator = null;
    page.detector?.destroy?.();
    page.detector = null;
    barMessage("info", hadTranslations ? t("pageRestored") : t("pageCancelled"));
  }

  // -------- status bar
  let bar = null;
  let barTimer = null;

  function ensureBar() {
    if (bar?.isConnected) return bar;
    bar = document.createElement("div");
    bar.id = IDS.bar;
    bar.setAttribute("role", "status");
    bar.setAttribute("aria-live", "polite");
    bar.addEventListener("mousedown", (e) => e.stopPropagation());
    bar.addEventListener("click", onBarClick);
    document.documentElement.appendChild(bar);
    return bar;
  }

  function hideBar() {
    clearTimeout(barTimer);
    if (bar) bar.style.display = "none";
  }

  function barMessage(kind, title, sub = "") {
    page.barState = { kind, title, sub };
    renderBar();
  }

  const pageBusy = () => page.running > 0 || page.queue.length > 0 || page.checking > 0;
  const engineName = () => (page.engine === "builtin" ? t("engineBuiltinShort") : PROVIDER_NAMES[page.engine] || t("aiModel"));

  function progressText() {
    const busy = pageBusy();
    let text = t(busy ? "pageProgressBusy" : "pageProgress", [engineName(), String(page.done)]);
    if (page.skippedOther) text += t("pageSkipped", [String(page.skippedOther)]);
    if (page.failed.length && !busy) text += t("pageFailedCount", [String(page.failed.length), page.lastError]);
    return text;
  }

  function renderBar() {
    if (page.active) {
      const target = targetName();
      const source = page.foreignOnly ? "" : languageName(page.source);
      const showRetry = page.failed.length > 0 && !pageBusy();
      page.barState = !page.done && showRetry
        ? { kind: "failed", title: t("pageFailedTitle"), sub: `${engineName()}: ${page.lastError}`, retry: true }
        : { kind: "progress", title: page.foreignOnly ? t("pageForeignDirection", [target]) : source ? `${source} → ${target}` : t("directionTo", [target]), sub: progressText(), retry: showRetry };
    }
    const s = page.barState;
    if (!s) return;
    const b = ensureBar();
    clearTimeout(barTimer);
    let actions = "";
    if (s.kind === "progress" || s.kind === "failed") {
      actions = `
        ${s.retry ? `<button type="button" class="ctx-pb-btn primary" data-act="retryFailed">${t("retry")}</button>` : ""}
        ${s.kind === "progress" ? `<span class="ctx-pb-seg" role="group" aria-label="${t("viewMode")}">
          <button type="button" data-act="translated" aria-pressed="${page.mode === "translated"}">${t("viewTranslated")}</button>
          <button type="button" data-act="bilingual" aria-pressed="${page.mode === "bilingual"}">${t("viewBilingual")}</button>
        </span>` : ""}
        <button type="button" class="ctx-pb-btn" data-act="restore">${s.kind === "failed" ? t("cancel") : t("restore")}</button>`;
    } else if (s.kind === "download" || s.kind === "retry") {
      actions = `<button type="button" class="ctx-pb-btn primary" data-act="download">${s.kind === "retry" ? t("tryAgain") : t("downloadAndTranslate")}</button>`;
    }
    b.innerHTML = `
      <span class="ctx-pb-seal" aria-hidden="true">文</span>
      <span class="ctx-pb-text"><span class="ctx-pb-title">${escapeHtml(s.title)}</span>${s.sub ? `<span class="ctx-pb-sub" title="${escapeHtml(s.sub)}">${escapeHtml(s.sub)}</span>` : ""}</span>
      ${actions}
      <button type="button" class="ctx-pb-x" data-act="close" title="${t("close")}" aria-label="${t("close")}">${ICONS.close}</button>`;
    b.dataset.kind = s.kind;
    b.style.display = "flex";
    if (s.kind === "info") barTimer = setTimeout(hideBar, 3200);
  }

  function updateProgress() {
    const sub = bar?.querySelector(".ctx-pb-sub");
    if (page.active && sub) sub.textContent = progressText();
  }

  function onBarClick(e) {
    // 只接受使用者真正的點擊，網頁上的程式不能代按（例如「重試」會送出請求）
    if (!e.isTrusted) return;
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (!act) return;
    e.stopPropagation();
    if (act === "close") hideBar();
    else if (act === "restore") restorePage();
    else if (act === "retryFailed") retryFailed();
    else if (act === "download") startPageTranslation({ gesture: true, source: page.knownSource, foreignOnly: page.knownForeignOnly });
    else if (act === "translated" || act === "bilingual") setMode(act);
  }

  // -------- start
  async function detectPageLanguage(sample, gesture, allowDownload = true) {
    try {
      if ("LanguageDetector" in globalThis) {
        const availability = await LanguageDetector.availability();
        if (availability === "available" || (allowDownload && (gesture || navigator.userActivation?.isActive))) {
          // 偵測模型若要下載，顯示進度；卡住超過 15 秒就改用網頁標示的語言，不讓狀態列一直停在準備中
          const detecting = (async () => {
            const detector = await LanguageDetector.create({
              monitor(m) {
                m.addEventListener("downloadprogress", (event) => {
                  barMessage("working", t("loadingDetectorProgress", [String(Math.round(event.loaded * 100))]));
                });
              },
            });
            const [top] = await detector.detect(sample);
            detector.destroy?.();
            return top?.confidence >= 0.4 ? normalizeLanguageCode(top.detectedLanguage) : "";
          })();
          detecting.catch(() => {});
          const detected = await Promise.race([detecting, new Promise((resolve) => setTimeout(() => resolve(""), 15000))]);
          if (detected) return detected;
        }
      }
    } catch (_) {}
    return pageLanguage();
  }

  async function startPageTranslation({ gesture = false, source: knownSource = "", foreignOnly = false } = {}) {
    if (page.active) { renderBar(); return; }
    if (page.starting) return;
    page.starting = true;
    try {
      await refreshState();
      // 設定選了 AI 模型且已儲存金鑰，就用 AI；否則用 Chrome 內建翻譯
      const engine = activeProvider;
      if (engine === "builtin" && !("Translator" in globalThis)) {
        barMessage("error", t("pageNeedsBuiltin"), t("pageNeedsBuiltinSub"));
        return;
      }
      page.target = BUILTIN_TARGETS[activeTargetLanguage] || "zh-Hant";
      page.engine = engine;
      const targetLabel = targetName();
      barMessage("working", t("pagePreparing"));

      const items = collectBlocks(document.body, { fallback: true });
      if (!items.length) {
        barMessage("info", t("pageNothing"));
        return;
      }
      const sample = items.slice(0, 60).map((i) => i.text).join("\n").slice(0, 2500);
      if (engine !== "builtin") {
        // AI 會自己判斷原文語言；這裡只在不必下載模型時偵測，用來顯示方向。
        // 頁面本身已經是譯文語言時，只把夾在裡面的外文段落送出去
        const source = await detectPageLanguage(sample, false, false);
        if (source && sameLanguage(source, page.target)) {
          const foreign = await findForeign(items);
          if (!foreign) {
            barMessage("info", t("pageAlready", [targetLabel]));
            return;
          }
          page.detector?.destroy?.();
          page.detector = await availableDetector();
          beginPage(engine, foreign, items, true);
          return;
        }
        beginPage(engine, source, items);
        return;
      }

      // 從下載提示按進來時已經知道語言，直接建立翻譯器，趁使用者這一下點擊還有效
      let source = knownSource;
      let onlyForeign = Boolean(knownSource && foreignOnly);
      if (!source) {
        source = await detectPageLanguage(sample, gesture);
        if (!source) {
          if (!gesture) barMessage("download", t("pageNeedDetector"), t("pageNeedDetectorSub"));
          else barMessage("error", t("pageUnknownLang"));
          return;
        }
        // 頁面本身已經是譯文語言：只翻夾在裡面的外文段落，先用最常見的那個外文建立翻譯器
        if (sameLanguage(source, page.target)) {
          source = await findForeign(items);
          if (!source) {
            barMessage("info", t("pageAlready", [targetLabel]));
            return;
          }
          onlyForeign = true;
        }
      }

      const options = { sourceLanguage: source, targetLanguage: page.target };
      let availability = "unavailable";
      try { availability = await Translator.availability(options); } catch (_) {}
      if (availability === "unavailable") {
        barMessage("error", t("pagePairUnsupported", [languageName(source), targetLabel]));
        return;
      }
      // 語言套件還沒下載時，Chrome 要求由使用者親手按一下才能開始下載
      const askToDownload = () => {
        page.knownSource = source;
        page.knownForeignOnly = onlyForeign;
        barMessage("download", t("pageFirstTime", [languageName(source)]), t("pageFirstTimeSub"));
      };
      if (availability !== "available" && !navigator.userActivation?.isActive) {
        askToDownload();
        return;
      }
      if (availability !== "available") barMessage("working", t("pagePackDownloading"));
      try {
        // 下載超過 60 秒都沒有任何進度，就當作失敗，讓使用者可以重試
        let lastProgress = Date.now();
        let watchdog = null;
        const creating = Translator.create({
          ...options,
          monitor(m) {
            m.addEventListener("downloadprogress", (event) => {
              lastProgress = Date.now();
              barMessage("working", t("pagePackProgress", [String(Math.round(event.loaded * 100))]));
            });
          },
        });
        const stalled = new Promise((_, reject) => {
          watchdog = setInterval(() => {
            if (Date.now() - lastProgress > 60000) reject(new Error("stalled"));
          }, 2000);
        });
        try {
          page.translator = await Promise.race([creating, stalled]);
        } catch (error) {
          creating.then((late) => late?.destroy?.(), () => {});
          throw error;
        } finally {
          clearInterval(watchdog);
        }
      } catch (error) {
        if (error?.name === "NotAllowedError") {
          askToDownload();
        } else {
          page.knownSource = source;
          page.knownForeignOnly = onlyForeign;
          barMessage("retry", t("pagePackFailed"), t("pagePackFailedSub"));
        }
        return;
      }

      page.translators = new Map([[source, Promise.resolve(page.translator)]]);
      page.detector = null;
      try {
        if ("LanguageDetector" in globalThis && (await LanguageDetector.availability()) === "available") {
          page.detector = await LanguageDetector.create();
        }
      } catch (_) {}
      beginPage("builtin", source, items, onlyForeign);
    } finally {
      page.starting = false;
    }
  }

  function beginPage(engine, source, items, foreignOnly = false) {
    page.engine = engine;
    page.active = true;
    page.source = source;
    page.foreignOnly = foreignOnly;
    page.checking = 0;
    page.token++;
    page.done = 0;
    page.failed = [];
    page.lastError = "";
    page.inflight = new Map();
    page.skippedOther = 0;
    page.mode = "translated";
    document.documentElement.classList.remove("ctx-page-bi");
    page.io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        page.io.unobserve(entry.target);
        const item = page.pending.get(entry.target);
        page.pending.delete(entry.target);
        if (item) enqueue(item);
      }
      pump();
      updateProgress();
    }, { rootMargin: "700px 0px" });
    watch(items);

    // 之後動態載入的內容（無限捲動、單頁應用）也接著翻
    let added = [];
    let rescanTimer = null;
    page.mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const n of m.addedNodes) {
          if (n.nodeType === 1 && n.localName !== "ctx-tr" && !n.closest?.(`#${IDS.bar}, #${IDS.pop}, #${IDS.btn}`)) added.push(n);
        }
      }
      if (!added.length) return;
      clearTimeout(rescanTimer);
      rescanTimer = setTimeout(() => {
        const roots = added.filter((n) => n.isConnected); added = [];
        if (page.active) roots.forEach((root) => watch(collectBlocks(root)));
      }, 500);
    });
    page.mo.observe(document.body, { childList: true, subtree: true });
    renderBar();
  }

  if (globalThis.chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (sender?.id && sender.id !== chrome.runtime.id) return false;
      if (msg?.action === "translatePage") {
        startPageTranslation();
        sendResponse({ ok: true });
      }
      return false;
    });
  }

  // ESC 關閉
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      hidePopover();
      hideButton();
    }
  });
})();
