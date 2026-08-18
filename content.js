// 隨選翻譯 — 網頁選字與翻譯浮窗

(() => {
  const IDS = {
    style: "ctx-trans-style",
    btn: "ctx-trans-floating-btn",
    pop: "ctx-trans-popover",
  };

  // 清掉舊版殘留節點 (避免擴充更新後重複)
  Object.values(IDS).forEach((id) => document.getElementById(id)?.remove());

  // 與設定視窗一致的暖紙張、深墨色編輯工具風格。
  const style = document.createElement("style");
  style.id = IDS.style;
  style.textContent = `
    #${IDS.btn}, #${IDS.pop} {
      font-family: "Avenir Next", "PingFang TC", "Microsoft JhengHei", sans-serif;
      color: #26211d;
      box-sizing: border-box;
      -webkit-font-smoothing: antialiased;
    }
    #${IDS.btn} *, #${IDS.pop} * { box-sizing: border-box; }

    #${IDS.btn} {
      position: fixed;
      z-index: 2147483647;
      display: none;
      align-items: center;
      min-height: 34px;
      padding: 0 11px;
      color: #fffaf2;
      background: #26211d;
      border: 1px solid #26211d;
      border-left: 3px solid #c15b2f;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(38, 33, 29, 0.18);
      cursor: pointer;
      font-size: 12px;
      font-weight: 650;
      line-height: 1;
      user-select: none;
      transition: background 140ms ease;
    }
    #${IDS.btn}:hover {
      background: #3a332d;
    }
    #${IDS.btn}:focus-visible {
      outline: 3px solid rgba(180, 83, 9, 0.28);
      outline-offset: 3px;
    }
    #${IDS.pop} {
      position: fixed;
      z-index: 2147483647;
      display: none;
      width: 332px;
      max-width: calc(100vw - 16px);
      background: #fffdf8;
      border: 1px solid #50483f;
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(38, 33, 29, 0.18);
      font-size: 13px;
      overflow: hidden;
    }

    .ctx-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      min-height: 46px;
      padding: 8px 9px 8px 13px;
      background: #26211d;
      color: #fffaf2;
      border-bottom: 3px solid #b45309;
      cursor: grab;
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
      font-size: 13px;
      font-weight: 650;
      line-height: 1.25;
    }
    .ctx-title-sub {
      display: block;
      margin-top: 1px;
      font-size: 10px;
      font-weight: 500;
      opacity: 0.72;
    }

    .ctx-header-actions { display: flex; gap: 4px; }
    .ctx-icon-btn {
      width: 30px;
      height: 30px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #fffaf2;
      background: transparent;
      border: 0;
      border-radius: 3px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 650;
      line-height: 1;
      padding: 0;
      font-family: inherit;
      transition: background 140ms ease;
    }
    .ctx-icon-btn:hover { background: rgba(255, 250, 242, 0.12); }
    .ctx-icon-btn:focus-visible {
      outline: 2px solid rgba(255, 255, 255, 0.72);
      outline-offset: 1px;
    }

    .ctx-body {
      padding: 15px 16px 16px;
      max-height: min(320px, calc(100vh - 84px));
      overflow-y: auto;
      color: #26211d;
      line-height: 1.72;
      white-space: pre-wrap;
      word-wrap: break-word;
      background: #fffdf8;
    }
    .ctx-body::-webkit-scrollbar { width: 7px; }
    .ctx-body::-webkit-scrollbar-track { background: #f1ebe2; }
    .ctx-body::-webkit-scrollbar-thumb { background: #b7aa9a; border-radius: 4px; }

    .ctx-result {
      font-size: 14px;
      font-weight: 500;
      line-height: 1.75;
    }
    .ctx-result.ctx-result-word { font-weight: 500; }
    .ctx-result.ctx-result-word .ctx-line-trans {
      display: block;
      margin-bottom: 12px;
      padding: 2px 0 10px 11px;
      color: #7c350b;
      background: transparent;
      border-left: 3px solid #b45309;
      font-size: 15px;
      font-weight: 650;
    }
    .ctx-result.ctx-result-word .ctx-line-ctx {
      display: block;
      font-weight: 500;
      font-size: 12px;
      line-height: 1.7;
      color: #655c53;
    }
    .ctx-line-label {
      display: block;
      margin-bottom: 4px;
      color: #85796d;
      font-size: 10px;
      font-weight: 650;
    }

    .ctx-error {
      padding: 11px 12px;
      color: #8d2f22;
      background: #fff1e9;
      border: 1px solid #e6b9a8;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      line-height: 1.6;
    }
    .ctx-error::before {
      content: "提示：";
      font-weight: 650;
    }

    .ctx-loading {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 44px;
      color: #655c53;
      font-size: 12px;
      font-weight: 500;
    }
    .ctx-spinner {
      width: 18px;
      height: 18px;
      border: 2.5px solid #d8c4ad;
      border-top-color: #b45309;
      border-radius: 50%;
      animation: ctxSpin 0.75s linear infinite;
      flex-shrink: 0;
    }
    @keyframes ctxSpin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) {
      #${IDS.btn}, #${IDS.btn} *, #${IDS.pop}, #${IDS.pop} * { transition: none !important; }
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
  btn.textContent = "翻譯選取內容";
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
        <button type="button" class="ctx-icon-btn" id="ctx-copy-btn" title="複製譯文" aria-label="複製譯文">⧉</button>
        <button type="button" class="ctx-icon-btn" id="ctx-close-btn" title="關閉翻譯結果" aria-label="關閉翻譯結果">×</button>
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
    if (!drag) return;
    e.preventDefault();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - drag.offsetX;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - drag.offsetY;
    const { left, top } = clampToViewport(x, y);
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
    pop.style.right = "auto";
    pop.style.bottom = "auto";
  }

  function onDragEnd() {
    drag = null;
    document.removeEventListener("mousemove", onDragMove);
    document.removeEventListener("mouseup", onDragEnd);
    document.removeEventListener("touchmove", onDragMove);
    document.removeEventListener("touchend", onDragEnd);
  }

  function onDragStart(e) {
    // 點到關閉/複製按鈕時不啟動拖拉
    if (e.target.closest(".ctx-icon-btn")) return;
    const rect = pop.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    drag = {
      offsetX: clientX - rect.left,
      offsetY: clientY - rect.top,
    };
    document.addEventListener("mousemove", onDragMove);
    document.addEventListener("mouseup", onDragEnd);
    document.addEventListener("touchmove", onDragMove, { passive: false });
    document.addEventListener("touchend", onDragEnd);
  }

  handle.addEventListener("mousedown", onDragStart);
  handle.addEventListener("touchstart", onDragStart, { passive: true });

  // ----------------------------------------------------------------------
  // 顯示與隱藏
  // ----------------------------------------------------------------------
  function hidePopover() {
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
    });
  }

  function setBody(html) {
    body.innerHTML = html;
  }

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
      const old = copyBtn.textContent;
      copyBtn.textContent = "✓";
      copyBtn.setAttribute("aria-label", "譯文已複製");
      setTimeout(() => {
        copyBtn.textContent = old;
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
