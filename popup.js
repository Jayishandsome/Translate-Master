// 隨選翻譯 — 設定視窗
// 所有變更即時儲存，不需要另外按「儲存」；存好時右下角會「蓋章」。

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
    model: "Gemini 2.0 Flash",
    placeholder: "貼上 Google AI Studio 金鑰",
    keyUrl: "https://aistudio.google.com/app/apikey",
  },
  openai: {
    vendor: "OpenAI",
    model: "GPT-4o mini",
    placeholder: "貼上 OpenAI API 金鑰",
    keyUrl: "https://platform.openai.com/api-keys",
  },
  claude: {
    vendor: "Anthropic",
    model: "Claude Haiku 4.5",
    placeholder: "貼上 Anthropic API 金鑰",
    keyUrl: "https://console.anthropic.com/",
  },
  deepseek: {
    vendor: "DeepSeek",
    model: "V4 Flash · 快速省錢",
    placeholder: "貼上 DeepSeek API 金鑰",
    keyUrl: "https://platform.deepseek.com/",
  },
  kimi: {
    vendor: "Moonshot",
    model: "Moonshot v1 8K",
    placeholder: "貼上 Moonshot API 金鑰",
    keyUrl: "https://platform.moonshot.cn/",
  },
  minimax: {
    vendor: "MiniMax",
    model: "MiniMax M2.5",
    placeholder: "貼上 MiniMax API 金鑰",
    keyUrl: "https://platform.minimaxi.com/",
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
  const modelNote = document.getElementById("model-note");
  const apiKeyInput = document.getElementById("api-key");
  const apiKeyHelp = document.getElementById("api-key-help");
  const keyLink = document.getElementById("key-link");
  const visibilityButton = document.getElementById("key-visibility");
  const languageSelect = document.getElementById("lang-select");

  let isEnabled = true;
  let currentProvider = "builtin";
  let lastAiProvider = "gemini";
  let apiKeys = {};
  let keySaveTimer = null;

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

  const renderKeyHelp = () => {
    const meta = AI_PROVIDERS[lastAiProvider];
    const hasKey = Boolean(apiKeyInput.value.trim());
    apiKeyHelp.classList.toggle("is-warning", !hasKey);
    apiKeyHelp.textContent = hasKey
      ? `金鑰只存在你的 Chrome 同步空間，只會傳給 ${meta.vendor}。`
      : "填入金鑰前，翻譯會暫時使用 Chrome 內建翻譯。";
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
    modelNote.textContent = meta.model;
    apiKeyInput.placeholder = meta.placeholder;
    keyLink.href = meta.keyUrl;
    keyLink.setAttribute("aria-label", `到 ${meta.vendor} 取得 API 金鑰`);
    renderKeyHelp();
  };

  // ------------------------------------------------------------------
  // Save helpers
  // ------------------------------------------------------------------

  const saveProvider = async () => {
    await storage.set({ apiProvider: currentProvider });
    showSaved();
  };

  const saveKey = async () => {
    clearTimeout(keySaveTimer);
    keySaveTimer = null;
    const provider = lastAiProvider;
    const value = apiKeyInput.value.trim();
    const latest = await storage.get(["apiKeys"]);
    apiKeys = latest.apiKeys || {};
    if ((apiKeys[provider] || "") === value) return;
    apiKeys[provider] = value;
    await storage.set({ apiKeys });
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
  apiKeyInput.value = apiKeys[lastAiProvider] || "";

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
      if (keySaveTimer) await saveKey();
      currentProvider = radio.value === "builtin" ? "builtin" : lastAiProvider;
      renderEngine();
      await saveProvider();
    });
  });

  providerSelect.addEventListener("change", async () => {
    if (keySaveTimer) await saveKey();
    lastAiProvider = providerSelect.value;
    currentProvider = lastAiProvider;
    const latest = await storage.get(["apiKeys"]);
    apiKeys = latest.apiKeys || {};
    apiKeyInput.value = apiKeys[lastAiProvider] || "";
    resetKeyVisibility();
    renderEngine();
    await saveProvider();
  });

  apiKeyInput.addEventListener("input", () => {
    renderKeyHelp();
    clearTimeout(keySaveTimer);
    keySaveTimer = setTimeout(saveKey, 500);
  });

  apiKeyInput.addEventListener("blur", () => {
    if (keySaveTimer) saveKey();
  });

  // 關閉視窗前把還沒送出的金鑰寫入
  window.addEventListener("pagehide", () => {
    if (keySaveTimer) saveKey();
  });

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
