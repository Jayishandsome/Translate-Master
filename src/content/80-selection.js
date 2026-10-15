  // ----------------------------------------------------------------------
  // 選取偵測
  // ----------------------------------------------------------------------
  function elementOfTarget(t) {
    if (t instanceof Element) return t;
    if (t instanceof Node && t.parentElement) return t.parentElement;
    return null;
  }

  // 翻譯按鈕放在滑鼠放開的那一端：
  // - 從前往後選：放在「最後一個字」的右下方；
  // - 從後往前選：放在「第一個字」的左上方。
  // 不直接用 range.getClientRects() 的最後一塊：三連擊整段、拖過行尾時，最後一塊常常是下一行的開頭或整個元素的框，
  // 按鈕就會跳到別的地方。這裡從選取的兩端往內找第一個看得到的字，量它的位置。
  function lastCharRect(range) {
    const root = range.commonAncestorContainer;
    const walker = document.createTreeWalker(root.nodeType === Node.TEXT_NODE ? root.parentNode : root, NodeFilter.SHOW_TEXT);
    let node = range.endContainer;
    if (node.nodeType !== Node.TEXT_NODE && range.endOffset > 0) {
      node = node.childNodes[range.endOffset - 1] || node;
      while (node.lastChild) node = node.lastChild;
    }
    walker.currentNode = node;
    if (node.nodeType !== Node.TEXT_NODE) node = walker.previousNode();
    for (let steps = 0; node && steps < 500; steps++, node = walker.previousNode()) {
      if (!range.intersectsNode(node)) break;
      const end = node === range.endContainer ? range.endOffset : node.data.length;
      const start = node === range.startContainer ? range.startOffset : 0;
      for (let i = end - 1; i >= start; i--) {
        if (!/\S/.test(node.data[i])) continue;
        const code = node.data.charCodeAt(i);
        const char = document.createRange();
        char.setStart(node, i > start && code >= 0xdc00 && code <= 0xdfff ? i - 1 : i);
        char.setEnd(node, i + 1);
        const rects = [...char.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
        if (rects.length) {
          const rtl = node.parentElement && getComputedStyle(node.parentElement).direction === "rtl";
          return { rect: rects[rects.length - 1], rtl };
        }
        break; // 這個文字節點沒有顯示出來，換前一個
      }
    }
    return null;
  }

  function firstCharRect(range) {
    const root = range.commonAncestorContainer;
    const walker = document.createTreeWalker(root.nodeType === Node.TEXT_NODE ? root.parentNode : root, NodeFilter.SHOW_TEXT);
    let node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) {
      node = node.childNodes[range.startOffset] || node;
      while (node.firstChild) node = node.firstChild;
    }
    walker.currentNode = node;
    if (node.nodeType !== Node.TEXT_NODE) node = walker.nextNode();
    for (let steps = 0; node && steps < 500; steps++, node = walker.nextNode()) {
      if (!range.intersectsNode(node)) {
        if (range.comparePoint(node, 0) < 0) continue; // 還在選取範圍前面
        break;
      }
      const start = node === range.startContainer ? range.startOffset : 0;
      const end = node === range.endContainer ? range.endOffset : node.data.length;
      for (let i = start; i < end; i++) {
        if (!/\S/.test(node.data[i])) continue;
        const code = node.data.charCodeAt(i);
        const char = document.createRange();
        char.setStart(node, i);
        char.setEnd(node, code >= 0xd800 && code <= 0xdbff && i + 1 < end ? i + 2 : i + 1);
        const rects = [...char.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
        if (rects.length) {
          const rtl = node.parentElement && getComputedStyle(node.parentElement).direction === "rtl";
          return { rect: rects[0], rtl };
        }
        break; // 這個文字節點沒有顯示出來，換下一個
      }
    }
    return null;
  }

  // 使用者是不是從後往前拖（焦點在錨點前面）
  function isBackward(sel) {
    if (!sel?.rangeCount || sel.isCollapsed || !sel.anchorNode || !sel.focusNode) return false;
    if (sel.direction === "backward") return true;
    if (sel.direction === "forward") return false;
    try {
      const probe = document.createRange();
      probe.setStart(sel.anchorNode, sel.anchorOffset);
      probe.setEnd(sel.focusNode, sel.focusOffset);
      return probe.collapsed;
    } catch (_) {
      return false;
    }
  }

  const pointerRect = (pointer) => ({ left: pointer.x, right: pointer.x, top: pointer.y, bottom: pointer.y, width: 0, height: 0 });

  function selectionStart(range, pointer) {
    if (range) {
      const found = firstCharRect(range);
      if (found) return found;
      const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
      if (rects.length) return { rect: rects[0], rtl: false };
    }
    if (!pointer) return null;
    return { rect: pointerRect(pointer), rtl: false, pointer: true };
  }

  // 找不到字的位置時（例如選取在輸入框裡），退回整個選取範圍最後一塊有大小的框，再不行就用滑鼠位置
  function selectionEnd(range, pointer) {
    if (range) {
      const found = lastCharRect(range);
      if (found) return found;
      const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
      if (rects.length) return { rect: rects[rects.length - 1], rtl: false };
    }
    if (!pointer) return null;
    return { rect: pointerRect(pointer), rtl: false, pointer: true };
  }

  const BUTTON_GAP_X = 4;
  const BUTTON_GAP_Y = 6;
  let buttonPointer = null;
  let buttonBackward = false; // 這次是從後往前選的
  let buttonSpot = null; // 按鈕應該在的位置（左上角）

  function placeButton() {
    const end = buttonBackward ? selectionStart(savedRange, buttonPointer) : selectionEnd(savedRange, buttonPointer);
    if (!end) return;
    const { rect } = end;
    const w = btn.offsetWidth;
    const h = btn.offsetHeight;
    let x;
    let y;
    if (buttonBackward) {
      // 從後往前選：放在第一個字的左上方；上面放不下（畫面最上面一行）就放在那一行下面
      x = end.rtl ? rect.right + BUTTON_GAP_X : rect.left - w - BUTTON_GAP_X;
      y = rect.top - h - BUTTON_GAP_Y;
      if (y < 8 && rect.bottom + BUTTON_GAP_Y + h <= window.innerHeight - 8) y = rect.bottom + BUTTON_GAP_Y;
    } else {
      // 從前往後選：放在最後一個字的右下方；下面放不下（選到畫面最底下一行）就放在那一行上面
      x = end.rtl ? rect.left - w - BUTTON_GAP_X : rect.right + BUTTON_GAP_X;
      y = rect.bottom + BUTTON_GAP_Y;
      if (y + h > window.innerHeight - 8 && rect.top - h - BUTTON_GAP_Y >= 8) y = rect.top - h - BUTTON_GAP_Y;
    }
    x = Math.max(8, Math.min(x, window.innerWidth - w - 8));
    y = Math.max(8, Math.min(y, window.innerHeight - h - 8));
    btn.style.left = `${x}px`;
    btn.style.top = `${y}px`;
    buttonSpot = { x, y };
    // 選取處捲出畫面時先藏起來，捲回來再出現，不要黏在畫面邊緣
    const offscreen = !end.pointer && (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth);
    btn.style.visibility = offscreen ? "hidden" : "";
  }

  const BUTTON_MIN_VISIBLE_MS = 350;

  // 按鈕在封閉的 Shadow DOM 裡，網頁改不到它本身；只要外層容器沒被動過、按鈕出現夠久，就是使用者看得到的那顆按鈕。
  // 不比對座標：有些網站在 <html> 上設了 zoom 或 transform，座標會不一樣，比對反而會讓按鈕在那些網站失靈。
  function buttonLooksRight() {
    if (!buttonSpot || performance.now() - buttonShownAt < BUTTON_MIN_VISIBLE_MS) return false;
    if (!hostLooksRight()) return false;
    const r = btn.getBoundingClientRect();
    return r.width >= 8 && r.height >= 8;
  }

  // 捲動（包括網頁裡可以捲動的區塊）或改變視窗大小時，按鈕跟著選取的文字移動
  let followFrame = 0;
  function followSelection() {
    if (btn.style.display !== "inline-flex" || followFrame) return;
    followFrame = requestAnimationFrame(() => {
      followFrame = 0;
      if (btn.style.display === "inline-flex") placeButton();
    });
  }
  window.addEventListener("scroll", followSelection, { capture: true, passive: true });
  window.addEventListener("resize", followSelection, { passive: true });

  // 記下按下滑鼠前的選取：放開時選取沒變，代表這一下不是在選字（例如點圖片、點「下一頁」），
  // Chrome 點圖片或按鈕時不會取消原本的選取，不檢查的話每點一下翻頁，按鈕就又跳出來一次。
  let pressed = null;
  document.addEventListener("mousedown", (e) => {
    if (!e.isTrusted) return;
    const sel = window.getSelection();
    pressed = {
      target: elementOfTarget(e.target),
      detail: e.detail,
      text: sel?.toString() || "",
      anchorNode: sel?.anchorNode, anchorOffset: sel?.anchorOffset,
      focusNode: sel?.focusNode, focusOffset: sel?.focusOffset,
    };
  }, true);

  const sameSelectionAsPressed = (sel) => Boolean(pressed) && sel.toString() === pressed.text &&
    sel.anchorNode === pressed.anchorNode && sel.anchorOffset === pressed.anchorOffset &&
    sel.focusNode === pressed.focusNode && sel.focusOffset === pressed.focusOffset;

  // 在按鈕、連結、分頁標籤這類控制項上連點（例如快速點「下一張 ›」），Chrome 會順便選到上面的字，那不是要翻譯的文字
  const CONTROL = "button, a[href], input, select, label, summary, [role='button'], [role='link'], [role='tab'], [role='menuitem'], [role='option'], [role='slider'], [role='switch'], [role='checkbox'], [role='radio']";
  const multiClickOnControl = (e, target) => e.detail >= 2 && Boolean((pressed?.target || target)?.closest?.(CONTROL));

  // 只有數字、符號（頁碼「3 / 10」、時間、箭頭）不用翻譯
  const hasWords = (text) => /\p{L}/u.test(text);

  document.addEventListener("mouseup", async (e) => {
    if (!e.isTrusted) return;
    const target = elementOfTarget(e.target);
    if (!target) return;
    // 點到自己的按鈕、浮窗、狀態列就跳過（Shadow DOM 裡的事件，在外面看到的目標是容器本身）
    if (target === host) return;

    await refreshState();
    if (!isFeatureEnabled) {
      hideButton();
      hidePopover();
      return;
    }

    const sel = window.getSelection();
    // 這一下沒有選出新的文字、是在控制項上連點、或選到的只有數字符號：不出現翻譯按鈕
    if (sameSelectionAsPressed(sel) || multiClickOnControl(e, target) || !hasWords(sel.toString())) {
      hideButton();
      return;
    }
    const { text, context } = captureSelection(sel);

    if (!text) {
      hideButton();
      savedRange = null;
      return;
    }

    currentSelection = text;
    currentContext = context;

    buttonPointer = { x: e.clientX, y: e.clientY };
    buttonBackward = isBackward(sel);
    showButton();
    placeButton();
    hidePopover();
  });

  // 選取被取消（點空白處、點選取的文字、點別的地方）或換成別的文字時，翻譯按鈕跟著消失
  document.addEventListener("selectionchange", () => {
    if (btn.style.display !== "inline-flex") return;
    const text = window.getSelection()?.toString().trim() || "";
    if (!text || text !== currentSelection) hideButton();
  });

  // 按下翻譯按鈕時不要讓網頁的選取被取消（否則按鈕會在點下去的瞬間消失）
  btn.addEventListener("mousedown", (e) => e.preventDefault());

  document.addEventListener("mousedown", (e) => {
    if (isTranslating) return;
    const t = elementOfTarget(e.target);
    if (!t) return;
    if (t !== host) hidePopover();
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
    // 防點擊劫持：按鈕在網頁裡，網頁可以改它的樣式。被拉大、變透明、移位，或剛出現就被點，都不算數
    if (!buttonLooksRight()) return;

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

    // 內建翻譯第一次可能要下載語言套件，給比較長的時間
    const startTimer = (ms) => setTimeout(() => finish(() => showError(t("errTimeout"))), ms);
    let timeoutId = startTimer(provider === "builtin" ? 300000 : 18000);

    // Chrome 內建翻譯；notice 是改用內建翻譯的原因（例如免費 AI 次數用完）
    const translateHere = async (notice = "") => {
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
        finish(() => showResult(text, notice));
      }
    };

    try {
      if (provider === "builtin") {
        await translateHere();
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

      // 免費 AI 不能用時（次數用完、太長、暫時故障），改用 Chrome 內建翻譯，並說明原因
      if (!response.success && response.fallback) {
        clearTimeout(timeoutId);
        timeoutId = startTimer(300000);
        setHeader("builtin");
        showLoading(t("loadingBuiltin"));
        await translateHere(response.error || t("freeFallbackBusy"));
        return;
      }

      if (response.success) {
        const text = String(response.data ?? "").trim();
        if (!text) {
          finish(() => showError(t("errEmptyAI")));
        } else {
          if (response.free) modeLabel.textContent = t("modeFreeLeft", [String(response.free.remaining ?? "")]);
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
