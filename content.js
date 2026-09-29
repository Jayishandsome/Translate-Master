// 隨選翻譯 — 網頁選字與翻譯浮窗

(() => {
  const IDS = {
    style: "ctx-trans-style",
    btn: "ctx-trans-floating-btn",
    pop: "ctx-trans-popover",
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
  btn.setAttribute("aria-label", "翻譯選取內容");
  btn.innerHTML = '<span class="ctx-seal" aria-hidden="true">文</span><span>翻譯</span>';
  document.documentElement.appendChild(btn);

  const pop = document.createElement("div");
  pop.id = IDS.pop;
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-label", "翻譯結果");
  pop.setAttribute("aria-hidden", "true");
  pop.innerHTML = `
    <div class="ctx-header" id="ctx-drag-handle" title="拖曳移動">
      <span class="ctx-seal" aria-hidden="true">文</span>
      <span class="ctx-title-copy">
        <span class="ctx-title-main" id="ctx-direction-label">翻譯結果</span>
        <span class="ctx-title-sub" id="ctx-mode-label">隨選翻譯</span>
      </span>
      <div class="ctx-header-actions">
        <button type="button" class="ctx-icon-btn" id="ctx-copy-btn" title="複製譯文" aria-label="複製譯文" disabled>${ICONS.copy}</button>
        <button type="button" class="ctx-icon-btn" id="ctx-close-btn" title="關閉（Esc）" aria-label="關閉翻譯結果">${ICONS.close}</button>
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
  let activeTargetLanguage = "zh-TW";
  let currentResult = "";
  let copyText = "";
  let isTranslating = false;
  let popoverAnimation = null;
  let buttonAnimation = null;
  let copyResetTimer = null;

  const BUILTIN_TARGETS = {
    "zh-TW": "zh-Hant",
    "zh-CN": "zh",
    en: "en",
    ko: "ko",
    fr: "fr",
    de: "de",
    es: "es",
  };

  const TARGET_NAMES = {
    "zh-TW": "繁體中文",
    "zh-CN": "简体中文",
    en: "英文",
    ko: "韓文",
    fr: "法文",
    de: "德文",
    es: "西班牙文",
  };

  const PROVIDER_NAMES = {
    builtin: "Chrome 內建翻譯",
    gemini: "Gemini",
    minimax: "MiniMax",
    kimi: "Kimi",
    openai: "OpenAI",
    deepseek: "DeepSeek",
    claude: "Claude",
  };

  let languageNames = null;
  try {
    languageNames = new Intl.DisplayNames(["zh-Hant"], { type: "language" });
  } catch (_) {}

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
    const target = TARGET_NAMES[activeTargetLanguage] || "繁體中文";
    const source = languageName(sourceLanguage);
    currentSourceName = source;
    directionLabel.textContent = source && source !== target ? `${source} → ${target}` : `譯為${target}`;
    modeLabel.textContent = provider === "builtin"
      ? "Chrome 內建翻譯・本機處理"
      : `${PROVIDER_NAMES[provider] || "AI 模型"}・上下文翻譯`;
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

  function extractContextFromRange(range, selectedText) {
    const sel = String(selectedText || "").trim();
    if (!range || !sel) return sel;

    let block = getBlockElement(range.commonAncestorContainer);
    let context = block?.innerText?.trim() || sel;

    // 父層文字過短時，向上擴展到更大區塊
    for (let i = 0; i < 3 && block?.parentElement; i++) {
      if (context.length >= sel.length + 40) break;
      const parent = block.parentElement;
      const parentText = parent.innerText?.trim() || "";
      if (parentText.length > context.length) {
        context = parentText;
        block = parent;
      } else {
        break;
      }
    }

    return context.slice(0, 2000);
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
      throw new Error("此版本的 Chrome 尚未提供內建翻譯。請更新桌面版 Chrome，或在設定中選擇其他翻譯方式。");
    }

    const targetLanguage = BUILTIN_TARGETS[targetCode] || "zh-Hant";
    let detector;
    let translator;

    try {
      updateLoading("正在偵測原文語言…");
      const detectorAvailability = await LanguageDetector.availability();
      if (detectorAvailability === "unavailable") {
        throw new Error("Chrome 無法使用本機語言偵測，請在設定中選擇其他翻譯方式。");
      }

      detector = await LanguageDetector.create({
        monitor(monitor) {
          monitor.addEventListener("downloadprogress", (event) => {
            updateLoading(`正在準備語言偵測 ${Math.round(event.loaded * 100)}%`);
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
        throw new Error("無法判斷原文語言，請選取較完整的句子後再試。");
      }

      setHeader("builtin", sourceLanguage);

      if (sourceLanguage === targetLanguage) return text;

      const translatorOptions = { sourceLanguage, targetLanguage };
      const translatorAvailability = await Translator.availability(translatorOptions);
      if (translatorAvailability === "unavailable") {
        throw new Error("Chrome 尚未支援這組語言，請在設定中選擇其他翻譯方式。");
      }

      if (translatorAvailability !== "available") {
        updateLoading("正在下載本機語言套件…");
      } else {
        updateLoading("正在本機翻譯…");
      }

      translator = await Translator.create({
        ...translatorOptions,
        monitor(monitor) {
          monitor.addEventListener("downloadprogress", (event) => {
            updateLoading(`正在下載本機語言套件 ${Math.round(event.loaded * 100)}%`);
          });
        },
      });

      updateLoading("正在本機翻譯…");
      const result = await translator.translate(text);
      return String(result || "").trim();
    } catch (error) {
      if (error?.name === "NotSupportedError") {
        throw new Error("Chrome 尚未支援這組語言，請在設定中選擇其他翻譯方式。");
      }
      if (error?.name === "NetworkError") {
        throw new Error("語言套件下載失敗，請檢查網路後再試。");
      }
      throw error;
    } finally {
      translator?.destroy?.();
      detector?.destroy?.();
    }
  }

  async function refreshState() {
    try {
      if (chrome?.storage?.sync) {
        const s = await chrome.storage.sync.get(["isEnabled", "apiProvider", "apiKeys", "targetLang"]);
        isFeatureEnabled = s.isEnabled !== false;
        const storedProvider = s.apiProvider || "builtin";
        activeProvider = storedProvider === "builtin" || s.apiKeys?.[storedProvider]
          ? storedProvider
          : "builtin";
        if (activeProvider !== s.apiProvider) {
          chrome.storage.sync.set({ apiProvider: activeProvider }).catch(() => {});
        }
        activeTargetLanguage = BUILTIN_TARGETS[s.targetLang] ? s.targetLang : "zh-TW";
      }
    } catch (_) {
      isFeatureEnabled = true;
    }
  }
  refreshState();

  if (globalThis.chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "sync") return;
      if (changes.apiProvider) activeProvider = changes.apiProvider.newValue || "builtin";
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
    copyBtn.title = "複製譯文";
    copyBtn.setAttribute("aria-label", "複製譯文");
  }

  const CJK_RE = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\uf900-\ufaff]/;
  const SENSE_NUMS = ["①", "②", "③", "④", "⑤", "⑥"];

  function sourceBlock() {
    if (!currentSelection || isWordLookup(currentSelection)) return "";
    const latin = CJK_RE.test(currentSelection) ? "" : " is-latin";
    return `<div class="ctx-label">原文</div><div class="ctx-source${latin}">${escapeHtml(currentSelection)}</div>`;
  }

  function headwordBlock() {
    const meta = currentSourceName ? `${currentSourceName}・單字查詢` : "單字查詢";
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

  function showLoading(message = "正在翻譯…") {
    revealPopover();
    currentResult = "";
    copyText = "";
    setCopyEnabled(false);
    const lead = isWordLookup(currentSelection)
      ? `<div class="ctx-word">${headwordBlock()}</div>`
      : `${sourceBlock()}<div class="ctx-label">譯文</div>`;
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
        html += `<div class="ctx-label ctx-label-note">語境說明</div><span class="ctx-note">${escapeHtml(ctxLine)}</span>`;
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
      : `${sourceBlock()}<div class="ctx-label">譯文</div><div class="ctx-result">${escapeHtml(text)}</div>`;
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
        <span class="ctx-error-title">無法完成翻譯</span>
        <span class="ctx-error-text">${escapeHtml(msg || "發生未知錯誤，請稍後再試")}</span>
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
    if (target.closest(`#${IDS.btn}`) || target.closest(`#${IDS.pop}`)) return;

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
      showError("請先選取要翻譯的文字");
      return;
    }

    hideButton();
    showPopoverAt(anchorX, anchorY);
    const provider = activeProvider;
    setHeader(provider);
    showLoading(provider === "builtin" ? "正在準備本機翻譯…" : "正在理解上下文並翻譯…");

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
      finish(() => showError("等待太久沒有回應，請稍後再試"));
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
          finish(() => showError("翻譯結果為空，請換一段文字後再試"));
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
        finish(() => showError("無法取得翻譯結果，請重新載入擴充功能後再試"));
        return;
      }

      if (response.success) {
        const text = String(response.data ?? "").trim();
        if (!text) {
          finish(() => showError("翻譯結果為空，請換一段文字或檢查模型設定"));
        } else {
          finish(() => showResult(text));
        }
      } else {
        finish(() => showError(response.error || "無法翻譯"));
      }
    } catch (error) {
      clearTimeout(timeoutId);
      const msg = String(error?.message || error);
      if (msg.includes("Extension context invalidated")) {
        finish(() =>
          showError("擴充功能已更新，請重新整理此頁面後再試")
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
      copyBtn.title = "譯文已複製";
      copyBtn.setAttribute("aria-label", "譯文已複製");
      copyResetTimer = setTimeout(resetCopyButton, 1400);
    } catch (_) {}
  });

  // 防止氣泡內點擊冒泡關掉自己
  pop.addEventListener("mousedown", (e) => e.stopPropagation());

  // ESC 關閉
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      hidePopover();
      hideButton();
    }
  });
})();
