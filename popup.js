// 隨選翻譯 — 設定視窗
// 設定即時儲存；API 金鑰則要按「儲存」（或 Enter）才會寫入。存好時右下角會「蓋章」。
// 介面文字都在 _locales/ 裡，依 Chrome 的介面語言顯示。

const t = (key, subs) => globalThis.chrome?.i18n?.getMessage(key, subs) || key;

const AI_PROVIDERS = {
  gemini: { vendor: "Google", keyUrl: "https://aistudio.google.com/app/apikey" },
  openai: { vendor: "OpenAI", keyUrl: "https://platform.openai.com/api-keys" },
  claude: { vendor: "Anthropic", keyUrl: "https://console.anthropic.com/" },
  deepseek: { vendor: "DeepSeek", keyUrl: "https://platform.deepseek.com/" },
  kimi: { vendor: "Moonshot", keyUrl: "https://platform.kimi.ai/" },
  minimax: { vendor: "MiniMax", keyUrl: "https://platform.minimax.io/" },
};

// 譯文語言：用各語言自己的寫法顯示，任何介面語言的使用者都認得
const TARGET_LANGUAGES = [
  ["zh-TW", "繁體中文"], ["zh-CN", "简体中文"], ["en", "English"], ["ja", "日本語"], ["ko", "한국어"],
  ["fr", "Français"], ["de", "Deutsch"], ["es", "Español"], ["pt", "Português"], ["it", "Italiano"],
  ["ru", "Русский"], ["vi", "Tiếng Việt"], ["th", "ไทย"], ["id", "Bahasa Indonesia"],
];

const sync = chrome.storage.sync;
const local = chrome.storage.local;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function applyI18n() {
  document.documentElement.lang = t("htmlLang");
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const text = t(el.dataset.i18n);
    if (text !== el.dataset.i18n) el.textContent = text;
  });
}

function showSaved(message = t("stampSaved")) {
  const element = document.getElementById("status-msg");
  element.textContent = message;
  element.classList.remove("show");
  // 重新觸發蓋章動畫
  void element.offsetWidth;
  element.classList.add("show");
  clearTimeout(showSaved.timeout);
  showSaved.timeout = setTimeout(() => element.classList.remove("show"), 1600);
}

document.addEventListener("DOMContentLoaded", async () => {
  applyI18n();

  const toggleSwitch = document.getElementById("toggle-switch");
  const appState = document.getElementById("app-state");
  const engineMode = document.getElementById("engine-mode");
  const engineRadios = [...engineMode.querySelectorAll('input[name="engine"]')];
  const builtinInfo = document.getElementById("builtin-info");
  const aiFields = document.getElementById("ai-fields");
  const providerSelect = document.getElementById("provider-select");
  const apiKeyInput = document.getElementById("api-key");
  const apiKeyHelp = document.getElementById("api-key-help");
  const keyLink = document.getElementById("key-link");
  const visibilityButton = document.getElementById("key-visibility");
  const saveKeyButton = document.getElementById("key-save");
  const keyLocal = document.getElementById("key-local");
  const advanced = document.getElementById("advanced");
  const modelInput = document.getElementById("model-input");
  const languageSelect = document.getElementById("lang-select");
  const helpLink = document.getElementById("help-link");

  let isEnabled = true;
  let currentProvider = "builtin";
  let lastAiProvider = "gemini";
  let keyStorage = "sync";      // 金鑰跟著 Chrome 同步（sync），或只存在這台電腦（local）
  let savedKey = "";            // 目前服務商已儲存的金鑰
  let customModels = {};
  let defaultModels = {};
  let savedLabelTimer = null;

  const keyArea = () => (keyStorage === "local" ? local : sync);
  const readKeys = async () => (await keyArea().get("apiKeys")).apiKeys || {};

  for (const [code, name] of TARGET_LANGUAGES) languageSelect.add(new Option(name, code));

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  const renderToggle = () => {
    toggleSwitch.classList.toggle("on", isEnabled);
    toggleSwitch.setAttribute("aria-checked", String(isEnabled));
    document.body.classList.toggle("is-paused", !isEnabled);
    appState.textContent = isEnabled ? t("toggleOnDesc") : t("toggleOffDesc");
  };

  const isKeyDirty = () => apiKeyInput.value.trim() !== savedKey;

  const renderKeyState = () => {
    const meta = AI_PROVIDERS[lastAiProvider];
    const dirty = isKeyDirty();
    if (dirty) {
      clearTimeout(savedLabelTimer);
      saveKeyButton.classList.remove("is-saved");
      saveKeyButton.textContent = t("save");
    }
    saveKeyButton.disabled = !dirty;
    saveKeyButton.classList.toggle("is-dirty", dirty);
    apiKeyHelp.classList.toggle("is-warning", dirty || !savedKey);
    apiKeyHelp.textContent = dirty
      ? t("keyUnsaved")
      : savedKey
      ? t(keyStorage === "local" ? "keyStoredLocal" : "keyStoredSync", [meta.vendor])
      : t("keyMissing");
  };

  const renderVisibility = (shown) => {
    apiKeyInput.type = shown ? "text" : "password";
    visibilityButton.setAttribute("aria-pressed", String(shown));
    visibilityButton.setAttribute("aria-label", t(shown ? "hideKeyLabel" : "showKeyLabel"));
    visibilityButton.textContent = t(shown ? "hide" : "show");
  };

  const renderModel = () => {
    modelInput.value = customModels[lastAiProvider] || "";
    modelInput.placeholder = defaultModels[lastAiProvider] || "";
  };

  const renderEngine = () => {
    const usesBuiltin = currentProvider === "builtin";
    const mode = usesBuiltin ? "builtin" : "ai";
    engineMode.dataset.value = mode;
    engineRadios.forEach((radio) => { radio.checked = radio.value === mode; });
    builtinInfo.hidden = !usesBuiltin;
    aiFields.hidden = usesBuiltin;

    const meta = AI_PROVIDERS[lastAiProvider];
    providerSelect.value = lastAiProvider;
    apiKeyInput.placeholder = t("keyPlaceholder", [meta.vendor]);
    keyLink.href = meta.keyUrl;
    keyLink.setAttribute("aria-label", t("getKeyLabel", [meta.vendor]));
    keyLocal.checked = keyStorage === "local";
    renderKeyState();
    renderModel();
  };

  // ------------------------------------------------------------------
  // Save helpers
  // ------------------------------------------------------------------

  const saveProvider = async () => {
    await sync.set({ apiProvider: currentProvider });
    showSaved();
  };

  const saveKey = async () => {
    if (!isKeyDirty()) return;
    const value = apiKeyInput.value.trim();
    const keys = await readKeys();
    if (value) keys[lastAiProvider] = value;
    else delete keys[lastAiProvider];
    await keyArea().set({ apiKeys: keys });
    savedKey = value;
    apiKeyInput.value = value;
    renderKeyState();
    saveKeyButton.classList.add("is-saved");
    saveKeyButton.textContent = t(value ? "keySavedButton" : "keyClearedButton");
    clearTimeout(savedLabelTimer);
    savedLabelTimer = setTimeout(() => {
      saveKeyButton.classList.remove("is-saved");
      saveKeyButton.textContent = t("save");
    }, 1600);
    showSaved(t(value ? "stampSaved" : "stampCleared"));
  };

  // 換儲存位置：先把金鑰寫到新的地方、記下選擇，再刪掉舊的
  const moveKeys = async (target) => {
    if (target === keyStorage) return;
    const keys = await readKeys();
    const from = keyArea();
    keyStorage = target;
    await keyArea().set({ apiKeys: keys });
    await sync.set({ keyStorage });
    await from.remove("apiKeys");
    renderKeyState();
    showSaved();
  };

  const saveModel = async () => {
    const value = modelInput.value.trim();
    if ((customModels[lastAiProvider] || "") === value) return;
    if (value) customModels[lastAiProvider] = value;
    else delete customModels[lastAiProvider];
    await sync.set({ customModels });
    showSaved(t(value ? "stampSaved" : "stampCleared"));
  };

  // ------------------------------------------------------------------
  // Load
  // ------------------------------------------------------------------

  const version = chrome.runtime.getManifest?.().version;
  if (version) document.getElementById("edition").textContent = `v${version}`;

  const result = await sync.get(["apiProvider", "targetLang", "isEnabled", "usageDate", "usageCount", "keyStorage", "customModels"]);
  keyStorage = result.keyStorage === "local" ? "local" : "sync";
  customModels = result.customModels || {};
  const apiKeys = await readKeys();

  // 選了 AI 但還沒有金鑰時，顯示成本機翻譯（翻譯時本來就會先用本機翻譯）
  const storedProvider = result.apiProvider === "builtin" || AI_PROVIDERS[result.apiProvider]
    ? result.apiProvider
    : "builtin";
  currentProvider = storedProvider === "builtin" || apiKeys[storedProvider] ? storedProvider : "builtin";
  if (currentProvider !== result.apiProvider) await sync.set({ apiProvider: currentProvider });

  lastAiProvider = AI_PROVIDERS[currentProvider]
    ? currentProvider
    : Object.keys(AI_PROVIDERS).find((id) => apiKeys[id]) || "gemini";
  savedKey = apiKeys[lastAiProvider] || "";
  apiKeyInput.value = savedKey;
  advanced.open = Object.values(customModels).some(Boolean);

  const supported = TARGET_LANGUAGES.map(([code]) => code);
  const storedLanguage = supported.includes(result.targetLang) ? result.targetLang : "zh-TW";
  languageSelect.value = storedLanguage;
  if (storedLanguage !== result.targetLang && result.targetLang) await sync.set({ targetLang: storedLanguage });

  isEnabled = result.isEnabled !== false;
  renderToggle();
  renderVisibility(false);
  renderEngine();

  const usage = result.usageDate === today() ? Math.max(0, Number(result.usageCount) || 0) : 0;
  document.getElementById("quota-text").textContent = String(usage);

  // 預設模型名稱由背景程式提供，當作「自訂模型」的提示文字
  chrome.runtime.sendMessage({ action: "getProviders" }).then((reply) => {
    defaultModels = Object.fromEntries(Object.entries(reply?.providers || {}).map(([id, p]) => [id, p.model]));
    renderModel();
  }, () => {});

  // ------------------------------------------------------------------
  // Events
  // ------------------------------------------------------------------

  toggleSwitch.addEventListener("click", async () => {
    isEnabled = !isEnabled;
    renderToggle();
    await sync.set({ isEnabled });
    showSaved(t(isEnabled ? "stampOn" : "stampOff"));
  });

  engineRadios.forEach((radio) => {
    radio.addEventListener("change", async () => {
      if (!radio.checked) return;
      currentProvider = radio.value === "builtin" ? "builtin" : lastAiProvider;
      renderEngine();
      await saveProvider();
    });
  });

  providerSelect.addEventListener("change", async () => {
    lastAiProvider = providerSelect.value;
    currentProvider = lastAiProvider;
    savedKey = (await readKeys())[lastAiProvider] || "";
    apiKeyInput.value = savedKey;
    renderVisibility(false);
    renderEngine();
    await saveProvider();
  });

  apiKeyInput.addEventListener("input", renderKeyState);
  apiKeyInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); saveKey(); }
  });
  saveKeyButton.addEventListener("click", saveKey);
  visibilityButton.addEventListener("click", () => renderVisibility(apiKeyInput.type === "password"));
  keyLocal.addEventListener("change", () => moveKeys(keyLocal.checked ? "local" : "sync"));

  modelInput.addEventListener("change", saveModel);
  modelInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); saveModel(); }
  });

  languageSelect.addEventListener("change", async () => {
    await sync.set({ targetLang: languageSelect.value });
    showSaved();
  });

  helpLink.addEventListener("click", (event) => {
    event.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
    window.close();
  });
});
