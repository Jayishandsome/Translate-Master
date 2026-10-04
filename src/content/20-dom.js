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
