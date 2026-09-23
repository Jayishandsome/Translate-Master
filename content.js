// 隨選翻譯 — 網頁選字與翻譯浮窗

(() => {
  const IDS = {
    style: "ctx-trans-style",
    btn: "ctx-trans-floating-btn",
    pop: "ctx-trans-popover",
  };

  // 清掉舊版殘留節點 (避免擴充更新後重複)
  Object.values(IDS).forEach((id) => document.getElementById(id)?.remove());

  // 與設定視窗一致的系統自適應、內容優先介面。
  const style = document.createElement("style");
  style.id = IDS.style;
  style.textContent = `
    #${IDS.btn}, #${IDS.pop} {
      --ctx-surface: #ffffff;
      --ctx-surface-secondary: #f5f5f7;
      --ctx-material: rgba(248, 249, 251, 0.86);
      --ctx-glass-border: rgba(255, 255, 255, 0.72);
      --ctx-glass-highlight: rgba(255, 255, 255, 0.82);
      --ctx-shadow: rgba(15, 23, 42, 0.18);
      --ctx-control: rgba(118, 118, 128, 0.12);
      --ctx-text: #1d1d1f;
      --ctx-secondary: #6e6e73;
      --ctx-border: rgba(60, 60, 67, 0.24);
      --ctx-accent: #007aff;
      --ctx-accent-hover: #0066d6;
      --ctx-accent-glass: rgba(0, 122, 255, 0.86);
      --ctx-accent-foreground: #ffffff;
      --ctx-focus: rgba(0, 122, 255, 0.3);
      --ctx-danger: #c9342f;
      --ctx-danger-bg: #fff2f1;
      --ctx-danger-border: rgba(201, 52, 47, 0.26);
      --ctx-ease-out: cubic-bezier(0.23, 1, 0.32, 1);
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang TC", "Microsoft JhengHei", sans-serif;
      color: var(--ctx-text);
      box-sizing: border-box;
      font-optical-sizing: auto;
      -webkit-font-smoothing: antialiased;
    }
    #${IDS.btn} *, #${IDS.pop} * { box-sizing: border-box; }

    #${IDS.btn} {
      position: fixed;
      z-index: 2147483647;
      display: none;
      align-items: center;
      min-height: 44px;
      padding: 0 14px;
      color: var(--ctx-accent-foreground);
      background: var(--ctx-accent-glass);
      border: 1px solid var(--ctx-glass-border);
      border-radius: 12px;
      box-shadow: inset 0 1px 0 var(--ctx-glass-highlight), 0 2px 8px var(--ctx-shadow);
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      line-height: 1;
      user-select: none;
      transition: background 140ms ease, opacity 140ms ease, transform 120ms var(--ctx-ease-out);
      -webkit-backdrop-filter: saturate(180%) blur(18px);
      backdrop-filter: saturate(180%) blur(18px);
    }
    #${IDS.btn}:active { transform: scale(0.97); }
    #${IDS.btn}:focus-visible {
      outline: 3px solid var(--ctx-focus);
      outline-offset: 3px;
    }
    #${IDS.pop} {
      position: fixed;
      z-index: 2147483647;
      display: none;
      width: 352px;
      max-width: calc(100vw - 16px);
      background: var(--ctx-material);
      border: 1px solid var(--ctx-glass-border);
      border-radius: 14px;
      box-shadow: inset 0 1px 0 var(--ctx-glass-highlight), 0 2px 8px var(--ctx-shadow);
      font-size: 13px;
      overflow: hidden;
      transform-origin: var(--ctx-origin-x, 50%) var(--ctx-origin-y, 0%);
      -webkit-backdrop-filter: saturate(180%) blur(28px);
      backdrop-filter: saturate(180%) blur(28px);
    }

    .ctx-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      min-height: 58px;
      padding: 6px 6px 6px 16px;
      background: rgba(255, 255, 255, 0.2);
      color: var(--ctx-text);
      border-bottom: 1px solid var(--ctx-glass-border);
      box-shadow: inset 0 1px 0 var(--ctx-glass-highlight);
      cursor: grab;
      touch-action: none;
      user-select: none;
    }
    .ctx-header:active { cursor: grabbing; }

    .ctx-title-group {
      display: flex;
      align-items: center;
      overflow: hidden;
    }
    .ctx-title-copy { min-width: 0; }
    .ctx-title-main {
      display: block;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: -0.01em;
      line-height: 1.25;
    }
    .ctx-title-sub {
      display: block;
      margin-top: 1px;
      color: var(--ctx-secondary);
      font-size: 11px;
      font-weight: 400;
    }

    .ctx-header-actions {
      display: flex;
      gap: 0;
      padding: 2px;
      background: var(--ctx-control);
      border: 1px solid var(--ctx-glass-border);
      border-radius: 12px;
      box-shadow: inset 0 1px 0 var(--ctx-glass-highlight);
    }
    .ctx-icon-btn {
      width: 40px;
      height: 40px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--ctx-secondary);
      background: transparent;
      border: 0;
      border-radius: 10px;
      cursor: pointer;
      font-size: 16px;
      font-weight: 600;
      line-height: 1;
      padding: 0;
      font-family: inherit;
      transition: background 140ms ease, color 140ms ease, transform 120ms var(--ctx-ease-out);
    }
    .ctx-icon-btn:active { transform: scale(0.96); }
    .ctx-icon-btn[data-state="success"] { color: var(--ctx-accent); }
    .ctx-icon-btn:focus-visible {
      outline: 3px solid var(--ctx-focus);
      outline-offset: -2px;
    }
    .ctx-icon-btn svg {
      width: 16px;
      height: 16px;
      fill: none;
      stroke: currentColor;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 1.8;
    }

    .ctx-body {
      padding: 16px;
      max-height: min(340px, calc(100vh - 84px));
      overflow-y: auto;
      color: var(--ctx-text);
      line-height: 1.65;
      white-space: pre-wrap;
      word-wrap: break-word;
      background: transparent;
    }
    .ctx-body::-webkit-scrollbar { width: 7px; }
    .ctx-body::-webkit-scrollbar-track { background: var(--ctx-surface-secondary); }
    .ctx-body::-webkit-scrollbar-thumb { background: var(--ctx-border); border-radius: 4px; }

    .ctx-result {
      font-size: 14px;
      font-weight: 400;
      line-height: 1.65;
    }
    .ctx-result.ctx-result-word { font-weight: 400; }
    .ctx-result.ctx-result-word .ctx-line-trans {
      display: block;
      margin-bottom: 12px;
      padding: 0 0 12px;
      color: var(--ctx-text);
      background: transparent;
      border-bottom: 1px solid var(--ctx-border);
      font-size: 16px;
      font-weight: 650;
    }
    .ctx-result.ctx-result-word .ctx-line-ctx {
      display: block;
      font-weight: 400;
      font-size: 12px;
      line-height: 1.7;
      color: var(--ctx-secondary);
    }
    .ctx-line-label {
      display: block;
      margin-bottom: 4px;
      color: var(--ctx-secondary);
      font-size: 11px;
      font-weight: 600;
    }

    .ctx-error {
      padding: 11px 12px;
      color: var(--ctx-danger);
      background: var(--ctx-danger-bg);
      border: 1px solid var(--ctx-danger-border);
      border-radius: 8px;
      font-size: 12px;
      font-weight: 400;
      line-height: 1.6;
    }
    .ctx-error::before {
      content: "提示：";
      font-weight: 600;
    }

    .ctx-loading {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 44px;
      color: var(--ctx-secondary);
      font-size: 12px;
      font-weight: 400;
    }
    .ctx-spinner {
      width: 18px;
      height: 18px;
      border: 2.5px solid var(--ctx-border);
      border-top-color: var(--ctx-accent);
      border-radius: 50%;
      animation: ctxSpin 0.75s linear infinite;
      flex-shrink: 0;
    }
    @keyframes ctxSpin { to { transform: rotate(360deg); } }
    @media (prefers-color-scheme: dark) {
      #${IDS.btn}, #${IDS.pop} {
        --ctx-surface: #1c1c1e;
        --ctx-surface-secondary: #3a3a3c;
        --ctx-material: rgba(28, 28, 30, 0.88);
        --ctx-glass-border: rgba(255, 255, 255, 0.16);
        --ctx-glass-highlight: rgba(255, 255, 255, 0.2);
        --ctx-shadow: rgba(0, 0, 0, 0.34);
        --ctx-control: rgba(118, 118, 128, 0.24);
        --ctx-text: #f5f5f7;
        --ctx-secondary: #aeaeb2;
        --ctx-border: rgba(142, 142, 147, 0.52);
        --ctx-accent: #0a84ff;
        --ctx-accent-hover: #409cff;
        --ctx-accent-glass: rgba(10, 132, 255, 0.86);
        --ctx-accent-foreground: #ffffff;
        --ctx-focus: rgba(10, 132, 255, 0.38);
        --ctx-danger: #ff6961;
        --ctx-danger-bg: rgba(255, 105, 97, 0.1);
        --ctx-danger-border: rgba(255, 105, 97, 0.32);
      }

      .ctx-header { background: rgba(255, 255, 255, 0.04); }
    }
    @media (prefers-contrast: more) {
      #${IDS.btn}, #${IDS.pop} {
        --ctx-material: var(--ctx-surface);
        --ctx-border: rgba(60, 60, 67, 0.62);
        --ctx-glass-border: rgba(60, 60, 67, 0.72);
      }
    }
    @media (prefers-color-scheme: dark) and (prefers-contrast: more) {
      #${IDS.btn}, #${IDS.pop} {
        --ctx-border: rgba(235, 235, 245, 0.72);
        --ctx-glass-border: rgba(235, 235, 245, 0.72);
      }
    }
    @media (hover: hover) and (pointer: fine) {
      #${IDS.btn}:hover { background: var(--ctx-accent-hover); }
      .ctx-icon-btn:hover {
        color: var(--ctx-text);
        background: var(--ctx-control);
      }
    }
    @media (prefers-reduced-transparency: reduce) {
      #${IDS.btn}, #${IDS.pop} {
        -webkit-backdrop-filter: none;
        backdrop-filter: none;
      }
      #${IDS.btn} { background: var(--ctx-accent); }
      #${IDS.pop} { background: var(--ctx-surface); }
      .ctx-header, .ctx-body { background: transparent; }
    }
    @media (prefers-reduced-motion: reduce) {
      #${IDS.btn}, .ctx-icon-btn { transition-duration: 0.01ms; }
      #${IDS.btn}:active, .ctx-icon-btn:active { transform: none; }
      .ctx-spinner { animation-duration: 1.5s; }
    }
  `;
  document.head.appendChild(style);

  // ----------------------------------------------------------------------
  // DOM: 浮動按鈕 + 翻譯氣泡
  // ----------------------------------------------------------------------
  const btn = document.createElement("button");
  btn.id = IDS.btn;
  btn.type = "button";
  btn.setAttribute("aria-label", "翻譯選取內容");
  btn.textContent = "翻譯";
  document.documentElement.appendChild(btn);

  const pop = document.createElement("div");
  pop.id = IDS.pop;
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-label", "翻譯結果");
  pop.setAttribute("aria-hidden", "true");
  pop.innerHTML = `
    <div class="ctx-header" id="ctx-drag-handle">
      <div class="ctx-title-group">
        <span class="ctx-title-copy">
          <span class="ctx-title-main">隨選翻譯</span>
          <span class="ctx-title-sub" id="ctx-mode-label">翻譯結果</span>
        </span>
      </div>
      <div class="ctx-header-actions">
        <button type="button" class="ctx-icon-btn" id="ctx-copy-btn" title="複製譯文" aria-label="複製譯文">
          <svg viewBox="0 0 18 18" aria-hidden="true"><rect x="6" y="5" width="9" height="10" rx="2"></rect><path d="M4 12H3.5A1.5 1.5 0 0 1 2 10.5v-7A1.5 1.5 0 0 1 3.5 2h7A1.5 1.5 0 0 1 12 3.5V4"></path></svg>
        </button>
        <button type="button" class="ctx-icon-btn" id="ctx-close-btn" title="關閉翻譯結果" aria-label="關閉翻譯結果">
          <svg viewBox="0 0 18 18" aria-hidden="true"><path d="M4.5 4.5 13.5 13.5M13.5 4.5 4.5 13.5"></path></svg>
        </button>
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
  const copyIconMarkup = copyBtn.innerHTML;

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
  let isTranslating = false;
  let popoverAnimation = null;
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
    const maxLeft = window.innerWidth - rect.width - 4;
    const maxTop = window.innerHeight - rect.height - 4;
    return {
      left: Math.max(4, Math.min(left, maxLeft)),
      top: Math.max(4, Math.min(top, maxTop)),
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
  function hidePopover() {
    onDragEnd();
    popoverAnimation?.cancel();
    popoverAnimation = null;
    pop.style.display = "none";
    pop.setAttribute("aria-hidden", "true");
  }

  function hideButton() {
    btn.style.display = "none";
  }

  function showPopoverAt(clientX, clientY) {
    pop.style.display = "block";
    pop.setAttribute("aria-hidden", "false");
    // 先放到接近選取的位置
    pop.style.left = `${clientX}px`;
    pop.style.top = `${clientY + 12}px`;
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
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || !pop.animate) return;

    const rect = pop.getBoundingClientRect();
    const originX = Math.max(12, Math.min(clientX - rect.left, rect.width - 12));
    const originY = Math.max(0, Math.min(clientY - rect.top, rect.height));
    pop.style.setProperty("--ctx-origin-x", `${originX}px`);
    pop.style.setProperty("--ctx-origin-y", `${originY}px`);

    popoverAnimation?.cancel();
    popoverAnimation = pop.animate(
      [
        { opacity: 0, transform: "scale(0.97)" },
        { opacity: 1, transform: "scale(1)" },
      ],
      {
        duration: 160,
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

  function showLoading(message = "正在翻譯…") {
    revealPopover();
    setBody(`
      <div class="ctx-loading">
        <div class="ctx-spinner"></div>
        <span id="ctx-loading-text">${escapeHtml(message)}</span>
      </div>
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

    if (trans || ctxLine) {
      let html = '<div class="ctx-result ctx-result-word">';
      if (trans) {
        html += `<span class="ctx-line-trans"><span class="ctx-line-label">譯文</span>${escapeHtml(trans)}</span>`;
      }
      if (ctxLine) {
        html += `<span class="ctx-line-ctx"><span class="ctx-line-label">上下文說明</span>${escapeHtml(ctxLine)}</span>`;
      }
      html += "</div>";
      return html;
    }
    return `<div class="ctx-result ctx-result-word">${escapeHtml(raw)}</div>`;
  }

  function showResult(text) {
    currentResult = text;
    revealPopover();
    const html = isWordLookup(currentSelection)
      ? formatWordResult(text)
      : `<div class="ctx-result">${escapeHtml(text)}</div>`;
    setBody(html);
  }

  function showError(msg) {
    currentResult = "";
    revealPopover();
    setBody(`<div class="ctx-error">${escapeHtml(msg || "Unknown error")}</div>`);
  }

  // ----------------------------------------------------------------------
  // 選取偵測
  // ----------------------------------------------------------------------
  function elementOfTarget(t) {
    if (t instanceof Element) return t;
    if (t instanceof Node && t.parentElement) return t.parentElement;
    return null;
  }

  document.addEventListener("mouseup", async (e) => {
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
    const rect = range ? range.getBoundingClientRect() : null;

    // 用 clientX/Y (fixed 座標)
    const baseX = rect ? rect.right : e.clientX;
    const baseY = rect ? rect.bottom : e.clientY;

    btn.style.display = "inline-flex";
    btn.style.left = `${baseX + 6}px`;
    btn.style.top = `${baseY + 6}px`;
    requestAnimationFrame(() => {
      const buttonRect = btn.getBoundingClientRect();
      const left = Math.max(6, Math.min(buttonRect.left, window.innerWidth - buttonRect.width - 6));
      const top = Math.max(6, Math.min(buttonRect.top, window.innerHeight - buttonRect.height - 6));
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

    if (!currentSelection.trim()) {
      showPopoverAt(e.clientX, e.clientY);
      showError("請先選取要翻譯的文字");
      return;
    }

    hideButton();
    showPopoverAt(e.clientX, e.clientY);
    const provider = activeProvider;
    modeLabel.textContent = provider === "builtin" ? "Chrome 內建翻譯" : "進階上下文翻譯";
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
      finish(() => showError("逾時 — 請稍後再試"));
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
    if (!currentResult) return;
    try {
      await navigator.clipboard.writeText(currentResult);
      clearTimeout(copyResetTimer);
      copyBtn.innerHTML = '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="m3.5 9.5 3.4 3.4 7.6-7.8"></path></svg>';
      copyBtn.dataset.state = "success";
      copyBtn.title = "譯文已複製";
      copyBtn.setAttribute("aria-label", "譯文已複製");
      copyResetTimer = setTimeout(() => {
        copyBtn.innerHTML = copyIconMarkup;
        delete copyBtn.dataset.state;
        copyBtn.title = "複製譯文";
        copyBtn.setAttribute("aria-label", "複製譯文");
      }, 1100);
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
