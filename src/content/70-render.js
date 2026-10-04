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
