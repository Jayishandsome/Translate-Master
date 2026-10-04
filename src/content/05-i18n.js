  // ----------------------------------------------------------------------
  // 介面文字：都在 _locales/ 裡，依 Chrome 的介面語言顯示
  // ----------------------------------------------------------------------
  const t = (key, subs) => globalThis.chrome?.i18n?.getMessage(key, subs) || key;
  const uiLanguage = globalThis.chrome?.i18n?.getUILanguage?.() || "zh-TW";
