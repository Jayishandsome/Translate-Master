// 隨選翻譯 — 設定視窗
// 設定即時儲存；API 金鑰則要按「儲存」（或 Enter）才會寫入。存好時右下角會「蓋章」。

const KEYS = [
  "apiProvider",
  "apiKeys",
  "targetLang",
  "isEnabled",
  "usageDate",
  "usageCount",
];

const AI_PROVIDERS = {
  gemini: {
    vendor: "Google",
    placeholder: "貼上 Google AI Studio 金鑰",
    keyUrl: "https://aistudio.google.com/app/apikey",
  },
  openai: {
    vendor: "OpenAI",
    placeholder: "貼上 OpenAI API 金鑰",
    keyUrl: "https://platform.openai.com/api-keys",
  },
  claude: {
    vendor: "Anthropic",
    placeholder: "貼上 Anthropic API 金鑰",
    keyUrl: "https://console.anthropic.com/",
  },
  deepseek: {
    vendor: "DeepSeek",
    placeholder: "貼上 DeepSeek API 金鑰",
    keyUrl: "https://platform.deepseek.com/",
  },
  kimi: {
    vendor: "Moonshot",
    placeholder: "貼上 Kimi API 金鑰",
    keyUrl: "https://platform.kimi.ai/",
  },
  minimax: {
    vendor: "MiniMax",
    placeholder: "貼上 MiniMax API 金鑰",
    keyUrl: "https://platform.minimax.io/",
  },
};

const storage = {
  get(keys) {
    return new Promise((resolve) => {
      if (globalThis.chrome?.storage?.sync) {
        chrome.storage.sync.get(keys, (result) => resolve(result || {}));
        return;
      }

      const result = {};
      keys.forEach((key) => {
        const value = localStorage.getItem(key);
        if (value === null) return;
        try {
          result[key] = JSON.parse(value);
        } catch {
          result[key] = value;
        }
      });
      resolve(result);
    });
  },

  set(data) {
    return new Promise((resolve) => {
      if (globalThis.chrome?.storage?.sync) {
        chrome.storage.sync.set(data, resolve);
        return;
      }

      Object.entries(data).forEach(([key, value]) => {
        localStorage.setItem(key, JSON.stringify(value));
      });
      resolve();
    });
  },
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function showSaved(message = "已存") {
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
  const languageSelect = document.getElementById("lang-select");

  let isEnabled = true;
  let currentProvider = "builtin";
  let lastAiProvider = "gemini";
  let apiKeys = {};
  let savedKey = "";          // 目前服務商已儲存的金鑰
  let savedLabelTimer = null;

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  const renderToggle = () => {
    toggleSwitch.classList.toggle("on", isEnabled);
    toggleSwitch.setAttribute("aria-checked", String(isEnabled));
    document.body.classList.toggle("is-paused", !isEnabled);
    appState.textContent = isEnabled
      ? "選取文字後，旁邊會出現翻譯按鈕"
      : "已暫停。選取文字時不會出現翻譯按鈕";
  };

  const isKeyDirty = () => apiKeyInput.value.trim() !== savedKey;

  const renderKeyState = () => {
    const meta = AI_PROVIDERS[lastAiProvider];
    const dirty = isKeyDirty();
    if (dirty) {
      clearTimeout(savedLabelTimer);
      saveKeyButton.classList.remove("is-saved");
      saveKeyButton.textContent = "儲存";
    }
    saveKeyButton.disabled = !dirty;
    saveKeyButton.classList.toggle("is-dirty", dirty);
    apiKeyHelp.classList.toggle("is-warning", dirty || !savedKey);
    apiKeyHelp.textContent = dirty
      ? "金鑰還沒儲存，按「儲存」後才會生效。"
      : savedKey
      ? `金鑰只存在你的 Chrome 同步空間，只會傳給 ${meta.vendor}。`
      : "填入金鑰並儲存前，翻譯會暫時使用 Chrome 內建翻譯。";
  };

  const resetKeyVisibility = () => {
    apiKeyInput.type = "password";
    visibilityButton.setAttribute("aria-pressed", "false");
    visibilityButton.setAttribute("aria-label", "顯示 API 金鑰");
    visibilityButton.textContent = "顯示";
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
    apiKeyInput.placeholder = meta.placeholder;
    keyLink.href = meta.keyUrl;
    keyLink.setAttribute("aria-label", `到 ${meta.vendor} 取得 API 金鑰`);
    renderKeyState();
  };

  // ------------------------------------------------------------------
  // Save helpers
  // ------------------------------------------------------------------

  const saveProvider = async () => {
    await storage.set({ apiProvider: currentProvider });
    showSaved();
  };

  const saveKey = async () => {
    if (!isKeyDirty()) return;
    const provider = lastAiProvider;
    const value = apiKeyInput.value.trim();
    const latest = await storage.get(["apiKeys"]);
    apiKeys = latest.apiKeys || {};
    apiKeys[provider] = value;
    await storage.set({ apiKeys });
    savedKey = value;
    apiKeyInput.value = value;
    renderKeyState();
    saveKeyButton.classList.add("is-saved");
    saveKeyButton.textContent = value ? "已儲存" : "已清除";
    clearTimeout(savedLabelTimer);
    savedLabelTimer = setTimeout(() => {
      saveKeyButton.classList.remove("is-saved");
      saveKeyButton.textContent = "儲存";
    }, 1600);
    showSaved(value ? "已存" : "已清除");
  };

  // ------------------------------------------------------------------
  // Load
  // ------------------------------------------------------------------

  const version = globalThis.chrome?.runtime?.getManifest?.().version;
  if (version) document.getElementById("edition").textContent = `v${version}`;

  const result = await storage.get(KEYS);

  apiKeys = result.apiKeys || {};
  const storedProvider = result.apiProvider === "builtin" || AI_PROVIDERS[result.apiProvider]
    ? result.apiProvider
    : "builtin";
  currentProvider = storedProvider === "builtin" || apiKeys[storedProvider]
    ? storedProvider
    : "builtin";
  if (currentProvider !== result.apiProvider) {
    await storage.set({ apiProvider: currentProvider });
  }

  lastAiProvider = AI_PROVIDERS[currentProvider]
    ? currentProvider
    : Object.keys(AI_PROVIDERS).find((id) => apiKeys[id]) || "gemini";
  savedKey = apiKeys[lastAiProvider] || "";
  apiKeyInput.value = savedKey;

  const supportedLanguages = [...languageSelect.options].map((option) => option.value);
  const storedLanguage = supportedLanguages.includes(result.targetLang)
    ? result.targetLang
    : "zh-TW";
  languageSelect.value = storedLanguage;
  if (storedLanguage !== result.targetLang && result.targetLang) {
    await storage.set({ targetLang: storedLanguage });
  }

  isEnabled = result.isEnabled !== false;
  renderToggle();
  renderEngine();

  const usage = result.usageDate === today() ? Math.max(0, Number(result.usageCount) || 0) : 0;
  document.getElementById("quota-text").textContent = String(usage);

  // ------------------------------------------------------------------
  // Events
  // ------------------------------------------------------------------

  toggleSwitch.addEventListener("click", async () => {
    isEnabled = !isEnabled;
    renderToggle();
    await storage.set({ isEnabled });
    showSaved(isEnabled ? "開" : "停");
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
    const latest = await storage.get(["apiKeys"]);
    apiKeys = latest.apiKeys || {};
    savedKey = apiKeys[lastAiProvider] || "";
    apiKeyInput.value = savedKey;
    resetKeyVisibility();
    renderEngine();
    await saveProvider();
  });

  apiKeyInput.addEventListener("input", renderKeyState);
  apiKeyInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); saveKey(); }
  });
  saveKeyButton.addEventListener("click", saveKey);

  visibilityButton.addEventListener("click", () => {
    const shouldShow = apiKeyInput.type === "password";
    apiKeyInput.type = shouldShow ? "text" : "password";
    visibilityButton.setAttribute("aria-pressed", String(shouldShow));
    visibilityButton.setAttribute("aria-label", shouldShow ? "隱藏 API 金鑰" : "顯示 API 金鑰");
    visibilityButton.textContent = shouldShow ? "隱藏" : "顯示";
  });

  languageSelect.addEventListener("change", async () => {
    await storage.set({ targetLang: languageSelect.value });
    showSaved();
  });
});
