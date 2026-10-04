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
