  function resolveProvider() {
    activeProvider = storedProvider === "builtin" || storedProvider === "free" || providersWithKey.has(storedProvider)
      ? storedProvider
      : "builtin";
  }

  // 內容腳本跑在每一個網頁裡，所以不讀、也不接收 API 金鑰本身：
  // 只讀背景程式算好的「哪些服務商有金鑰」（storage.local 的 keyedProviders）。
  // 也不註冊 storage.onChanged（那會把金鑰的變動送進每個網頁），改成每次要用時重新讀取。
  async function refreshState() {
    try {
      if (chrome?.storage?.sync) {
        const s = await chrome.storage.sync.get(["isEnabled", "apiProvider", "targetLang"]);
        const { keyedProviders } = await chrome.storage.local.get("keyedProviders");
        isFeatureEnabled = s.isEnabled !== false;
        storedProvider = s.apiProvider || "builtin";
        providersWithKey = new Set(Array.isArray(keyedProviders) ? keyedProviders : []);
        resolveProvider();
        activeTargetLanguage = BUILTIN_TARGETS[s.targetLang] ? s.targetLang : "zh-TW";
      }
    } catch (_) {
      isFeatureEnabled = true;
    }
  }
  refreshState();
