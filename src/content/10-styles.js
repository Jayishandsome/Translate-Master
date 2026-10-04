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
