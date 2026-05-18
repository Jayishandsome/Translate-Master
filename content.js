// ============================================================================
// 翻訳 — Content Script
// 黑白動漫風選字翻譯浮窗，支援拖拉
// ============================================================================

(() => {
  const IDS = {
    style: "ctx-trans-style",
    btn: "ctx-trans-floating-btn",
    pop: "ctx-trans-popover",
  };

  // 清掉舊版殘留節點 (避免擴充更新後重複)
  Object.values(IDS).forEach((id) => document.getElementById(id)?.remove());

  // ----------------------------------------------------------------------
  // 樣式：黑白動漫/漫畫氣泡風
  // ----------------------------------------------------------------------
  const style = document.createElement("style");
  style.id = IDS.style;
  style.textContent = `
    #${IDS.btn}, #${IDS.pop} {
      font-family: "Yu Gothic", "Hiragino Sans", "Noto Sans JP",
                   "Microsoft JhengHei", -apple-system, BlinkMacSystemFont, sans-serif;
      color: #0a0a0a;
      box-sizing: border-box;
    }
    #${IDS.btn} *, #${IDS.pop} * { box-sizing: border-box; }

    /* ========================= 浮動翻譯按鈕 ========================= */
    #${IDS.btn} {
      position: fixed;
      z-index: 2147483647;
      display: none;
      align-items: center;
      gap: 4px;
      padding: 3px 7px 3px 5px;
      background: #fff;
      border: 2px solid #0a0a0a;
      border-radius: 0;
      box-shadow: 2px 2px 0 #0a0a0a;
      cursor: pointer;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.8px;
      user-select: none;
      transition: transform 0.08s ease, box-shadow 0.08s ease;
    }
    #${IDS.btn}:hover {
      background: #0a0a0a;
      color: #fff;
    }
    #${IDS.btn}:active {
      transform: translate(2px, 2px);
      box-shadow: 0 0 0 #0a0a0a;
    }
    #${IDS.btn} .ctx-btn-kanji {
      font-size: 11px;
      font-weight: 900;
      writing-mode: vertical-rl;
      line-height: 1;
      padding: 0 1px;
      border-right: 1.5px solid currentColor;
      margin-right: 3px;
    }

    /* ========================= 翻譯氣泡視窗 ========================= */
    #${IDS.pop} {
      position: fixed;
      z-index: 2147483647;
      width: 248px;
      max-width: 88vw;
      background: #fff;
      border: 2px solid #0a0a0a;
      box-shadow: 4px 4px 0 #0a0a0a;
      display: none;
      font-size: 12px;
      overflow: hidden;
    }

    /* 漫畫式對話框裝飾線（已移除右下角折角） */

    .ctx-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 8px;
      background: #0a0a0a;
      color: #fff;
      cursor: grab;
      user-select: none;
      border-bottom: 2px solid #0a0a0a;
    }
    .ctx-header:active { cursor: grabbing; }

    .ctx-title-group {
      display: flex;
      align-items: baseline;
      gap: 5px;
      overflow: hidden;
    }
    .ctx-title-kanji {
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.5px;
    }
    .ctx-title-sub {
      font-size: 7px;
      font-weight: 700;
      letter-spacing: 2px;
      opacity: 0.65;
      text-transform: uppercase;
    }

    .ctx-header-actions { display: flex; gap: 3px; }
    .ctx-icon-btn {
      width: 17px;
      height: 17px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #fff;
      color: #0a0a0a;
      border: 1.5px solid #fff;
      cursor: pointer;
      font-size: 10px;
      font-weight: 900;
      line-height: 1;
      padding: 0;
      font-family: inherit;
    }
    .ctx-icon-btn:hover { background: #0a0a0a; color: #fff; }

    /* 標題下的雙線裝飾 (manga panel divider) */
    .ctx-divider {
      height: 4px;
      background:
        repeating-linear-gradient(
          90deg,
          #0a0a0a 0 4px,
          transparent 4px 8px
        );
      border-bottom: 1.5px solid #0a0a0a;
    }

    .ctx-body {
      padding: 8px 10px;
      max-height: 200px;
      overflow-y: auto;
      line-height: 1.7;
      white-space: pre-wrap;
      word-wrap: break-word;
      background: #fff;
    }
    .ctx-body::-webkit-scrollbar { width: 8px; }
    .ctx-body::-webkit-scrollbar-track { background: #fff; border-left: 1.5px solid #0a0a0a; }
    .ctx-body::-webkit-scrollbar-thumb { background: #0a0a0a; }

    .ctx-result {
      background: transparent;
      padding: 4px 0;
      border: none;
      box-shadow: none;
      font-size: 12px;
      font-weight: 800;
      line-height: 1.65;
      letter-spacing: 0.2px;
    }
    .ctx-result.ctx-result-word {
      font-weight: 600;
    }
    .ctx-result.ctx-result-word .ctx-line-trans {
      display: block;
      font-weight: 800;
      margin-bottom: 6px;
    }
    .ctx-result.ctx-result-word .ctx-line-ctx {
      display: block;
      font-weight: 500;
      font-size: 11px;
      line-height: 1.6;
      opacity: 0.92;
    }

    .ctx-error {
      padding: 6px 8px;
      background: #fff;
      border: 1.5px solid #0a0a0a;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1px;
    }
    .ctx-error::before {
      content: "⚠ エラー ";
      font-weight: 900;
      margin-right: 4px;
    }

    .ctx-loading {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 2px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1.5px;
    }
    .ctx-spinner {
      width: 13px;
      height: 13px;
      border: 2.5px solid #0a0a0a;
      border-top-color: transparent;
      border-radius: 50%;
      animation: ctxSpin 0.7s linear infinite;
      flex-shrink: 0;
    }
    @keyframes ctxSpin { to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(style);

  // ----------------------------------------------------------------------
  // DOM: 浮動按鈕 + 翻譯氣泡
  // ----------------------------------------------------------------------
  const btn = document.createElement("button");
  btn.id = IDS.btn;
  btn.type = "button";
  btn.innerHTML = `<span class="ctx-btn-kanji">訳</span><span>TRANSLATE</span>`;
  document.documentElement.appendChild(btn);

  const pop = document.createElement("div");
  pop.id = IDS.pop;
  pop.innerHTML = `
    <div class="ctx-header" id="ctx-drag-handle">
      <div class="ctx-title-group">
        <span class="ctx-title-kanji">翻訳</span>
        <span class="ctx-title-sub">honyaku</span>
      </div>
      <div class="ctx-header-actions">
        <button type="button" class="ctx-icon-btn" id="ctx-copy-btn" title="複製">⧉</button>
        <button type="button" class="ctx-icon-btn" id="ctx-close-btn" title="關閉">×</button>
      </div>
    </div>
    <div class="ctx-divider"></div>
    <div class="ctx-body" id="ctx-body"></div>
  `;
  document.documentElement.appendChild(pop);

  const body = pop.querySelector("#ctx-body");
  const closeBtn = pop.querySelector("#ctx-close-btn");
  const copyBtn = pop.querySelector("#ctx-copy-btn");
  const handle = pop.querySelector("#ctx-drag-handle");

  // ----------------------------------------------------------------------
  // 狀態
  // ----------------------------------------------------------------------
  let currentSelection = "";
  let currentContext = "";
  let savedRange = null;
  let isFeatureEnabled = true;
  let currentResult = "";
  let isTranslating = false;

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

  function safeChrome(fn, fallback) {
    try {
      return fn();
    } catch (_) {
      return fallback;
    }
  }

  async function refreshState() {
    try {
      if (chrome?.storage?.sync) {
        const s = await chrome.storage.sync.get(["isEnabled"]);
        isFeatureEnabled = s.isEnabled !== false;
      }
    } catch (_) {
      isFeatureEnabled = true;
    }
  }
  refreshState();

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
  }

  function hideButton() {
    btn.style.display = "none";
  }

  function showPopoverAt(clientX, clientY) {
    pop.style.display = "block";
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

  function showLoading() {
    revealPopover();
    setBody(`
      <div class="ctx-loading">
        <div class="ctx-spinner"></div>
        <span>翻訳中・・・</span>
      </div>
    `);
  }

  function revealPopover() {
    pop.style.display = "block";
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
      /【(?:翻譯|译|訳|Translation)】\s*([\s\S]*?)(?=\n*【|$)/i
    );
    const ctxMatch = raw.match(
      /【(?:上下文|文脈|解釋|Context)】\s*([\s\S]*)/i
    );
    const trans = (transMatch?.[1] || "").trim();
    const ctxLine = (ctxMatch?.[1] || "").trim();

    if (trans || ctxLine) {
      let html = '<div class="ctx-result ctx-result-word">';
      if (trans) {
        html += `<span class="ctx-line-trans">【翻譯】${escapeHtml(trans)}</span>`;
      }
      if (ctxLine) {
        html += `<span class="ctx-line-ctx">【上下文】${escapeHtml(ctxLine)}</span>`;
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
    showLoading();
    refreshState();

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
    }, 18000);

    try {
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
          finish(() => showError("翻譯結果為空，請換一段文字或檢查 API 設定"));
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
      setTimeout(() => (copyBtn.textContent = old), 900);
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
