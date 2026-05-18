# 翻訳 — Contextual Translator

黑白動漫風的 Chrome 擴充功能：在任何網頁選取文字，按下浮動「訳 TRANSLATE」按鈕，
即可在可拖拉的漫畫氣泡視窗中讀到由 LLM 翻譯的結果。

## 特色

- **黑白動漫 / 漫畫風 UI**：粗黑邊框、硬陰影、半色調 (halftone) 點陣、日式直書點綴 (翻訳・honyaku)
- **可拖拉翻譯視窗**：抓住頂部 `翻訳` 標題列即可拖移，會自動約束在視窗範圍內
- **多模型支援**：每家 provider 各自儲存獨立 API Key
  - Google **Gemini** (`gemini-2.0-flash`)
  - **MiniMax** (`MiniMax-Text-01`)
  - **Kimi** / Moonshot (`moonshot-v1-8k`)
  - **OpenAI** (`gpt-4o-mini`)
  - **DeepSeek** (`deepseek-chat`)
  - **Claude** / Anthropic (`claude-haiku-4-5`)
- **多目標語言**：繁中、簡中、日、英、韓、法、德、西
- **上下文輔助翻譯**：把選取字所在段落作為 context 送進模型，避免單字誤譯
- **一鍵複製翻譯結果** / **ESC 關閉** / **使用量計數**

## 檔案結構

| 檔案 | 用途 |
|---|---|
| `manifest.json` | Chrome MV3 設定 |
| `background.js` | 多家 API 的路由 / 呼叫 |
| `content.js` | 網頁選字、浮動按鈕、可拖拉翻譯氣泡 |
| `popup.html` / `popup.js` | 設定頁 (provider / API key / 目標語言 / 開關) |

## 安裝 (開發者模式)

1. Chrome 開啟 `chrome://extensions/`
2. 開啟右上角 **開發人員模式**
3. 點 **載入未封裝項目**，選擇此資料夾
4. 工具列圖示 → 設定 provider 與 API Key → 儲存

## 使用

1. 在任意網頁選取文字
2. 點擊跳出的 **訳 TRANSLATE** 按鈕
3. 在漫畫氣泡視窗中查看翻譯
   - 抓頂部標題列可拖移
   - `⧉` 複製、`×` 關閉、`ESC` 收起

## API Key 申請

| Provider | 申請位置 |
|---|---|
| Gemini | https://aistudio.google.com/app/apikey |
| MiniMax | https://platform.minimaxi.com/ |
| Kimi | https://platform.moonshot.cn/ |
| OpenAI | https://platform.openai.com/api-keys |
| DeepSeek | https://platform.deepseek.com/ |
| Claude | https://console.anthropic.com/ |

> Key 僅存在 `chrome.storage.sync`（本機/Google 帳號同步），絕不上傳到第三方。

## 安全提醒

- 不要把 API Key 提交到 git
- 若 Key 曾外洩請立即在 provider 後台 revoke 並重發
- `Claude` 從瀏覽器直接呼叫會帶 `anthropic-dangerous-direct-browser-access`，僅建議個人使用

## 常見問題

**沒有跳出翻譯按鈕？**
重新載入擴充功能後，務必刷新網頁（`Ctrl + F5`）。已開啟「起動 / ENABLE」開關。

**`extension context invalidated`？**
擴充剛更新、舊腳本還在跑。刷新頁面即可。

**翻譯失敗？**
- 確認 provider 與該 provider 的 Key 對得起來（每家 key 是分開存的）
- 檢查網路 / 額度 / 帳號餘額
- Claude provider 需要該帳號已開通且未被瀏覽器直連限制

## License

MIT (可自行替換)
