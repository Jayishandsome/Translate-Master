  function keyedProviders(keys) {
    return new Set(Object.keys(keys || {}).filter((k) => String(keys[k] || "").trim()));
  }

  function resolveProvider() {
    activeProvider = storedProvider === "builtin" || providersWithKey.has(storedProvider) ? storedProvider : "builtin";
  }

  // API 金鑰可能跟著 Chrome 同步（sync），也可能只存在這台電腦（local）
  let keyArea = "sync";

  async function refreshState() {
    try {
      if (chrome?.storage?.sync) {
        const s = await chrome.storage.sync.get(["isEnabled", "apiProvider", "apiKeys", "targetLang", "keyStorage"]);
        isFeatureEnabled = s.isEnabled !== false;
        storedProvider = s.apiProvider || "builtin";
        keyArea = s.keyStorage === "local" ? "local" : "sync";
        const keys = keyArea === "local" ? (await chrome.storage.local.get("apiKeys")).apiKeys : s.apiKeys;
        providersWithKey = keyedProviders(keys);
        resolveProvider();
        activeTargetLanguage = BUILTIN_TARGETS[s.targetLang] ? s.targetLang : "zh-TW";
      }
    } catch (_) {
      isFeatureEnabled = true;
    }
  }
  refreshState();

  if (globalThis.chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (changes.apiKeys && areaName === keyArea) {
        providersWithKey = keyedProviders(changes.apiKeys.newValue);
        resolveProvider();
      }
      if (areaName !== "sync") return;
      if (changes.keyStorage) { refreshState(); return; }
      if (changes.apiProvider) storedProvider = changes.apiProvider.newValue || "builtin";
      if (changes.apiProvider) resolveProvider();
      if (changes.targetLang) {
        activeTargetLanguage = BUILTIN_TARGETS[changes.targetLang.newValue]
          ? changes.targetLang.newValue
          : "zh-TW";
      }
      if (changes.isEnabled) {
        isFeatureEnabled = changes.isEnabled.newValue !== false;
      }
      if (changes.isEnabled && !isFeatureEnabled) {
        hideButton();
        hidePopover();
      }
    });
  }
