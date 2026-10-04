  if (globalThis.chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (sender?.id && sender.id !== chrome.runtime.id) return false;
      if (msg?.action === "translatePage") {
        startPageTranslation();
        sendResponse({ ok: true });
      }
      return false;
    });
  }

  // ESC 關閉
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      hidePopover();
      hideButton();
    }
  });
