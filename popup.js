// ============================================================================
// 翻訳 — Popup Settings
// ============================================================================

const KEYS = [
  "apiProvider",
  "apiKeys",
  "targetLang",
  "isEnabled",
  "usageDate",
  "usageCount",
  "usageLimit",
];

const storage = {
  get(keys) {
    return new Promise((resolve) => {
      if (chrome?.storage?.sync) {
        chrome.storage.sync.get(keys, (r) => resolve(r || {}));
      } else {
        const result = {};
        keys.forEach((k) => {
          const v = localStorage.getItem(k);
          if (v !== null) {
            try { result[k] = JSON.parse(v); } catch { result[k] = v; }
          }
        });
        resolve(result);
      }
    });
  },
  set(data) {
    return new Promise((resolve) => {
      if (chrome?.storage?.sync) {
        chrome.storage.sync.set(data, () => resolve());
      } else {
        Object.entries(data).forEach(([k, v]) =>
          localStorage.setItem(k, JSON.stringify(v))
        );
        resolve();
      }
    });
  },
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function showStatus(msg) {
  const el = document.getElementById("status-msg");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(showStatus._t);
  showStatus._t = setTimeout(() => el.classList.remove("show"), 1600);
}

function renderQuota(used, limit) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  document.getElementById("quota-text").textContent = pct + "%";
  document.getElementById("quota-bar-inner").style.width = pct + "%";
}

document.addEventListener("DOMContentLoaded", async () => {
  const apiKeyInput = document.getElementById("api-key");
  const providerSelect = document.getElementById("provider-select");
  const langSelect = document.getElementById("lang-select");
  const toggleSwitch = document.getElementById("toggle-switch");
  const saveBtn = document.getElementById("save-btn");
  const footerStamp = document.getElementById("footer-stamp");

  let isEnabled = true;
  let currentProvider = "gemini";
  let apiKeys = {};

  const setToggleUI = () => {
    toggleSwitch.classList.toggle("on", isEnabled);
    toggleSwitch.setAttribute("aria-checked", String(isEnabled));
  };

  toggleSwitch.addEventListener("click", () => {
    isEnabled = !isEnabled;
    setToggleUI();
  });
  toggleSwitch.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      isEnabled = !isEnabled;
      setToggleUI();
    }
  });

  // 載入既有設定
  const result = await storage.get(KEYS);

  currentProvider = result.apiProvider || "gemini";
  apiKeys = result.apiKeys || {};
  providerSelect.value = currentProvider;
  langSelect.value = result.targetLang || "zh-TW";
  apiKeyInput.value = apiKeys[currentProvider] || "";

  isEnabled = result.isEnabled !== false;
  setToggleUI();

  let usage = Number(result.usageCount) || 0;
  if (result.usageDate !== today()) usage = 0;
  renderQuota(usage, Number(result.usageLimit) || 100);

  footerStamp.textContent = isEnabled ? "承" : "停";

  // 切換 provider → 顯示對應已存的 key
  providerSelect.addEventListener("change", async () => {
    currentProvider = providerSelect.value;
    const r = await storage.get(["apiKeys"]);
    apiKeys = r.apiKeys || {};
    apiKeyInput.value = apiKeys[currentProvider] || "";
  });

  // 儲存
  saveBtn.addEventListener("click", async () => {
    const provider = providerSelect.value;
    const apiKey = apiKeyInput.value.trim();
    const targetLang = langSelect.value;

    const r = await storage.get(["apiKeys"]);
    apiKeys = r.apiKeys || {};
    apiKeys[provider] = apiKey;

    await storage.set({
      apiProvider: provider,
      apiKeys,
      targetLang,
      isEnabled,
    });

    footerStamp.textContent = isEnabled ? "承" : "停";
    showStatus(apiKey ? "保存しました ・ SAVED" : "鍵が空 ・ KEY EMPTY");
  });
});
