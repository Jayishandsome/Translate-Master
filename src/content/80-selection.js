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
          if (isWordLookup(currentSelection)) {
            const lookup = currentSelection;
            explainInContext(lookup, currentContext, lastBuiltinSource, activeTargetLanguage)
              .then((found) => {
                // 使用者已經關掉浮窗或換了別的字，就不更新
                if (!found || lookup !== currentSelection || pop.getAttribute("aria-hidden") !== "false") return;
                modeLabel.textContent = t("modeNano");
                showResult(found.note ? `【翻譯】${found.sense}\n【上下文】${found.note}` : `【翻譯】${found.sense}`);
              })
              .catch(() => {});
          }
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
