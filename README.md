# 隨選翻譯 — Context Translator

一款輕巧的 Chrome 擴充功能。在任何網頁選取文字後，點一下「翻譯選取內容」，即可從可拖曳的浮窗取得譯文。預設使用 Chrome 內建翻譯，不需要 API 金鑰。

## 功能特色

- **免金鑰翻譯**：Chrome 138 以上的桌面版可在裝置上下載語言套件並直接翻譯。
- **資料留在裝置上**：使用 Chrome 內建翻譯時，選取內容不會送到遠端模型。
- **進階上下文翻譯**：選用外部模型時，會連同選取文字所在段落分析，減少單字多義與指代錯誤。
- **Apple 式精緻介面**：玻璃材質只用於浮動功能層，搭配即時按壓回饋、來源感知浮窗與流暢拖曳，並支援明暗模式、高對比、減少透明度及減少動態效果。
- **可拖曳結果視窗**：拖曳頂部即可移動，位置會自動限制在可見範圍內。
- **多模型支援**：外部模型為選配，且每個服務商分開保存 API 金鑰。
  - Google Gemini（`gemini-2.0-flash`）
  - MiniMax（`MiniMax-M2.5`）
  - Kimi / Moonshot（`moonshot-v1-8k`）
  - OpenAI（`gpt-4o-mini`）
  - DeepSeek V4 Flash（`deepseek-v4-flash`，關閉思考模式以降低延遲與用量）
  - Claude / Anthropic（`claude-haiku-4-5`）
- **多種譯文語言**：繁體中文、簡體中文、英文、韓文、法文、德文與西班牙文。
- **操作便利**：一鍵複製譯文、`Esc` 關閉、開關即時保存，以及每日使用量統計。
- **無障礙支援**：完整的鍵盤焦點、狀態提示與輔助技術標籤。

## 檔案結構

| 檔案 | 用途 |
|---|---|
| `manifest.json` | Chrome Manifest V3 設定 |
| `background.js` | 模型 API 路由與提示詞 |
| `content.js` | 網頁選字、翻譯按鈕、結果浮窗與拖曳互動 |
| `popup.html` / `popup.js` | 模型、API 金鑰、譯文語言與功能開關設定 |
| `icons/` | 擴充功能與工具列圖示（16、32、48、128px） |

## 安裝

1. 在 Chrome 開啟 `chrome://extensions/`。
2. 開啟右上角的「開發人員模式」。
3. 點選「載入未封裝項目」，並選擇本專案資料夾。
4. 點擊工具列圖示並確認翻譯方式。預設的 Chrome 內建翻譯不需要填寫 API 金鑰。

## 使用方式

1. 在任意網頁選取要翻譯的文字。
2. 點擊出現的「翻譯選取內容」按鈕。
3. 在結果浮窗查看譯文；可拖曳頂部移動，或使用複製與關閉按鈕。

## 選配的 API 金鑰

只有選擇外部模型時才需要 API 金鑰。這些模型可提供更完整的上下文說明。

| 服務商 | 申請位置 |
|---|---|
| Gemini | https://aistudio.google.com/app/apikey |
| MiniMax | https://platform.minimaxi.com/ |
| Kimi | https://platform.moonshot.cn/ |
| OpenAI | https://platform.openai.com/api-keys |
| DeepSeek | https://platform.deepseek.com/ |
| Claude | https://console.anthropic.com/ |

API 金鑰只會儲存在 `chrome.storage.sync`，不會傳送給所選模型服務商以外的第三方。

## 常見問題

**沒有出現翻譯按鈕？**

重新載入擴充功能後，請刷新原本已開啟的網頁，並確認「選字翻譯」開關為開啟狀態。

**擴充功能更新後無法翻譯？**

刷新目前頁面，讓最新版的內容腳本重新載入。

**翻譯失敗？**

- Chrome 內建翻譯需要桌面版 Chrome 138 以上；首次使用時需連線下載語言套件。
- 若使用外部模型，請確認目前模型與 API 金鑰相符。
- 檢查網路、API 額度與帳號餘額。
- Claude 從瀏覽器直接呼叫時，需要帳號允許瀏覽器存取。

## License

MIT
