// 隨選翻譯 — 設定視窗

const KEYS = [
  "apiProvider",
  "apiKeys",
  "targetLang",
  "isEnabled",
  "usageDate",
  "usageCount",
];

const PROVIDER_META = {
  builtin: { model: "免金鑰，本機處理", placeholder: "" },
  gemini: { model: "Gemini 2.0 Flash", placeholder: "輸入 Google AI API 金鑰" },
  minimax: { model: "MiniMax M2.5", placeholder: "輸入 MiniMax API 金鑰" },
  kimi: { model: "Moonshot v1 8K", placeholder: "輸入 Moonshot API 金鑰" },
  openai: { model: "GPT-4o mini", placeholder: "輸入 OpenAI API 金鑰" },
  deepseek: { model: "V4 Flash · 快速省錢", placeholder: "輸入 DeepSeek API 金鑰" },
  claude: { model: "Claude Haiku 4.5", placeholder: "輸入 Anthropic API 金鑰" },
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

function showStatus(message, tone = "success") {
  const element = document.getElementById("status-msg");
  element.textContent = message;
  element.classList.toggle("warning", tone === "warning");
  element.classList.add("show");
  clearTimeout(showStatus.timeout);
  showStatus.timeout = setTimeout(() => element.classList.remove("show"), 2200);
}

function renderUsage(used) {
  const safeUsed = Math.max(0, used);
  document.getElementById("quota-text").textContent = `${safeUsed} 次`;
}

document.addEventListener("DOMContentLoaded", async () => {
  const apiKeyInput = document.getElementById("api-key");
  const apiKeyField = document.getElementById("api-key-field");
  const builtinInfo = document.getElementById("builtin-info");
  const providerSelect = document.getElementById("provider-select");
  const languageSelect = document.getElementById("lang-select");
  const toggleSwitch = document.getElementById("toggle-switch");
  const appState = document.getElementById("app-state");
  const saveButton = document.getElementById("save-btn");
  const visibilityButton = document.getElementById("key-visibility");
  const modelNote = document.getElementById("model-note");

  let isEnabled = true;
  let currentProvider = "builtin";
  let apiKeys = {};

  const renderProvider = () => {
    const meta = PROVIDER_META[currentProvider] || PROVIDER_META.builtin;
    const usesBuiltin = currentProvider === "builtin";

    modelNote.textContent = meta.model;
    apiKeyInput.placeholder = meta.placeholder;
    apiKeyField.hidden = usesBuiltin;
    builtinInfo.hidden = !usesBuiltin;
  };

  const renderToggle = () => {
    toggleSwitch.classList.toggle("on", isEnabled);
    toggleSwitch.setAttribute("aria-checked", String(isEnabled));
    toggleSwitch.setAttribute("aria-label", isEnabled ? "暫停選字翻譯" : "開啟選字翻譯");
    appState.textContent = isEnabled ? "選字翻譯已開啟" : "選字翻譯已暫停";
  };

  toggleSwitch.addEventListener("click", async () => {
    isEnabled = !isEnabled;
    renderToggle();
    await storage.set({ isEnabled });
    showStatus(isEnabled ? "選字翻譯已開啟" : "選字翻譯已暫停");
  });

  visibilityButton.addEventListener("click", () => {
    const shouldShow = apiKeyInput.type === "password";
    apiKeyInput.type = shouldShow ? "text" : "password";
    visibilityButton.setAttribute("aria-pressed", String(shouldShow));
    visibilityButton.setAttribute("aria-label", shouldShow ? "隱藏 API 金鑰" : "顯示 API 金鑰");
    visibilityButton.textContent = shouldShow ? "隱藏" : "顯示";
  });

  const result = await storage.get(KEYS);

  apiKeys = result.apiKeys || {};
  const storedProvider = PROVIDER_META[result.apiProvider] ? result.apiProvider : "builtin";
  currentProvider = storedProvider === "builtin" || apiKeys[storedProvider]
    ? storedProvider
    : "builtin";
  if (currentProvider !== result.apiProvider) {
    await storage.set({ apiProvider: currentProvider });
  }
  providerSelect.value = currentProvider;
  apiKeyInput.value = apiKeys[currentProvider] || "";

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
  renderProvider();

  let usage = Number(result.usageCount) || 0;
  if (result.usageDate !== today()) usage = 0;
  renderUsage(usage);

  providerSelect.addEventListener("change", async () => {
    currentProvider = providerSelect.value;
    const latest = await storage.get(["apiKeys"]);
    apiKeys = latest.apiKeys || {};
    apiKeyInput.value = apiKeys[currentProvider] || "";
    apiKeyInput.type = "password";
    visibilityButton.setAttribute("aria-pressed", "false");
    visibilityButton.setAttribute("aria-label", "顯示 API 金鑰");
    visibilityButton.textContent = "顯示";
    renderProvider();
  });

  saveButton.addEventListener("click", async () => {
    const provider = providerSelect.value;
    const apiKey = apiKeyInput.value.trim();
    const targetLang = languageSelect.value;

    saveButton.disabled = true;
    saveButton.textContent = "正在儲存…";
    saveButton.setAttribute("aria-busy", "true");

    try {
      const latest = await storage.get(["apiKeys"]);
      apiKeys = latest.apiKeys || {};
      if (provider !== "builtin") apiKeys[provider] = apiKey;

      await storage.set({
        apiProvider: provider,
        apiKeys,
        targetLang,
        isEnabled,
      });

      const needsKey = provider !== "builtin" && !apiKey;
      showStatus(
        needsKey ? "設定已儲存，使用此模型前仍需填入 API 金鑰" : "設定已儲存",
        needsKey ? "warning" : "success"
      );
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "儲存設定";
      saveButton.removeAttribute("aria-busy");
    }
  });
});
