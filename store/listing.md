# Chrome 線上應用程式商店上架資料

上架時逐欄複製貼上用。圖片都在這個資料夾裡。

---

## 一、套件

上傳 `translate-master-3.0.0.zip`（用 `npm run package` 產生在 `dist/`，只包含擴充功能本身的檔案：`manifest.json`、`background.js`、`content.js`、`popup.html`、`popup.js`、`welcome.html`、`welcome.js`、`icons/`、`_locales/`、`LICENSE`）。

> 3.0.0 起名稱和摘要改由 `_locales/` 依語言提供：繁中、簡中、英文各一份，商店會自動帶入。

---

## 二、商店資訊（Store listing）

> 說明文字裡不要列出 AI 服務商的品牌名稱。第一次送審時因為列了六家服務商的名稱，被判定為「關鍵字垃圾內容」（Yellow Argon）而退件。

| 欄位 | 內容 |
|---|---|
| 名稱 | 由 manifest 帶入：隨選翻譯 — Context Translator |
| 摘要 | 由 manifest 帶入：選取網頁文字即可翻譯，也能右鍵翻譯整頁；預設使用 Chrome 內建模型，免 API 金鑰並在裝置上處理。 |
| 類別 | 工具（Tools） |
| 語言 | 中文（繁體） |
| 商店圖示 | `store-icon-128.png`（128×128，圖案 96×96、四周各留 16px 透明邊） |
| 螢幕截圖 | `screenshot-1.png` ～ `screenshot-5.png`（1280×800） |
| 小型宣傳圖塊 | `promo-small-440x280.png` |
| 跑馬燈宣傳圖塊（選填） | `promo-marquee-1400x560.png` |
| 首頁網址 | https://github.com/Jayishandsome/Translate-Master |
| 支援網址 | https://github.com/Jayishandsome/Translate-Master/issues |

### 詳細說明（中文）

```
隨選翻譯讓你讀外文網頁時，不必切換分頁、也不用複製貼上。

【選取文字，就地翻譯】
選取任何一段文字，旁邊就會出現翻譯按鈕。譯文直接顯示在浮窗裡，可以拖曳位置、一鍵複製。

【按右鍵，整頁翻譯】
在網頁上按右鍵，選「全頁翻譯」。只翻你看得到的段落，捲到哪裡、翻到哪裡；之後載入的內容也會接著翻。段落裡的連結翻譯後一樣點得到。可以切換「譯文」或「對照」，讓原文和譯文逐段並列；按「還原」就恢復原樣。

【查單字，也看上下文】
接上 AI 模型時，查單字會依照句子判斷詞義，並附上簡短的語境說明。例如「river bank」裡的 bank 會翻成「河岸」，而不是「銀行」。

【預設在你的裝置上翻譯】
預設使用 Chrome 內建翻譯（桌面版 Chrome 138 以上），不需要 API 金鑰，文字不會離開你的電腦。

【也能接上你的 AI 模型】
需要更貼近語境的譯文時，可以改用你自己的 AI 服務商 API 金鑰（支援 6 家主流服務商，在設定裡選擇）。金鑰只存在你的瀏覽器，請求直接送到你選的服務商。

【其他特色】
・自動偵測原文語言，不用先切換設定
・14 種譯文語言，介面有繁體中文、簡體中文和英文
・安裝後有說明頁，教用法並檢查你的 Chrome 能不能用本機翻譯
・紙本字典風介面，支援深色模式、鍵盤操作與減少動態效果
・免費、開放原始碼

【隱私】
開發者沒有伺服器，不收集任何資料。使用 AI 模型時，只有你按下翻譯的文字會送到你選的服務商。
隱私權政策：https://jayishandsome.github.io/Translate-Master/privacy.html
原始碼：https://github.com/Jayishandsome/Translate-Master
```

### Detailed description (English, optional second language)

```
Context Translator lets you read foreign-language pages without switching tabs or copying and pasting.

SELECT TO TRANSLATE
Select any text and a Translate button appears next to it. The translation shows up in a small card you can drag or copy.

TRANSLATE THE WHOLE PAGE
Right-click a page and choose “Translate full page”. Only the paragraphs you can see are translated, and more follow as you scroll, including content that loads later. Links inside paragraphs stay clickable. Switch between translation-only and side-by-side views, or restore the original page in one click.

WORDS IN CONTEXT
With an AI model, looking up a word takes its sentence into account and adds a short note on the meaning in context — “bank” in “river bank” is translated as the riverside, not the financial institution.

ON-DEVICE BY DEFAULT
Uses Chrome's built-in translation (desktop Chrome 138 or later). No API key needed, and your text never leaves your computer.

BRING YOUR OWN AI MODEL
For more context-aware translations, optionally use your own API key from one of six major AI providers, chosen in the settings. The key stays in your browser and requests go straight to the provider you choose.

ALSO
• Detects the source language automatically
• 14 target languages; interface in English, Traditional Chinese and Simplified Chinese
• A welcome page shows how to use it and checks whether your Chrome supports on-device translation
• Paper-dictionary design with dark mode, keyboard support and reduced motion
• Free and open source

PRIVACY
The developer runs no servers and collects no data. With an AI model, only the text you choose to translate is sent to the provider you picked.
Privacy policy: https://jayishandsome.github.io/Translate-Master/privacy.html
Source code: https://github.com/Jayishandsome/Translate-Master
```

---

## 三、隱私權做法（Privacy practices）

### 單一用途說明

```
在使用者瀏覽的網頁上，翻譯使用者選取的文字，或在使用者要求時翻譯整個頁面，並把譯文直接顯示在頁面上。
```

English:

```
Translates text the user selects on a web page, or the whole page when the user asks, and shows the translation in place on the page.
```

### 權限理由

| 權限 | 填寫內容 |
|---|---|
| `storage` | 保存使用者的設定（選字翻譯開關、翻譯引擎、譯文語言、每日翻譯次數）以及使用者自行輸入的 AI 服務商 API 金鑰。資料只存在 chrome.storage.sync，不會傳給開發者。 |
| `contextMenus` | 在網頁的右鍵選單加入「全頁翻譯」，讓使用者翻譯目前的頁面。 |
| `activeTab` | 使用者點選右鍵選單的「全頁翻譯」時，如果該分頁是在安裝或更新擴充功能前就開著、還沒有內容腳本，需要暫時取得這個分頁的存取權，才能開始翻譯。只在使用者操作的那一個分頁有效。 |
| `scripting` | 與 activeTab 搭配，用 chrome.scripting.executeScript 把擴充功能套件內附的 content.js 注入上述分頁。不會注入或執行任何遠端程式碼。 |
| 主機權限（6 家 AI 服務商的 API 網域） | 使用者在設定中選用 AI 模型並按下翻譯時，背景程式需要呼叫該服務商的 API 取得譯文。只列出 Gemini、OpenAI、Anthropic、DeepSeek、Kimi、MiniMax 的 API 網域，不存取其他網站。 |
| 內容腳本（所有網站） | 使用者可能在任何網頁上選取文字，因此內容腳本需要在所有網頁上偵測選取、顯示翻譯按鈕與譯文，並在使用者要求時翻譯整頁。網頁內容只在本機讀取，除非使用者選用 AI 模型並觸發翻譯，否則不會送出。 |

### 遠端程式碼

選「**否，我沒有使用遠端程式碼**」。所有 JavaScript 都包含在套件裡；AI 服務商回傳的只有文字，一律以純文字顯示，不會被當成程式碼執行。

### 資料使用（勾選要收集的資料類型）

| 類別 | 勾選 | 說明 |
|---|---|---|
| 網站內容（Website content） | ✅ | 使用者選用 AI 模型並觸發翻譯時，選取的文字或頁面段落會送到使用者自己選的 AI 服務商以取得譯文。本機翻譯模式不會送出。 |
| 驗證資訊（Authentication information） | ✅ | 使用者自行輸入的 API 金鑰存在瀏覽器中，呼叫對應服務商時放在請求標頭送出。開發者收不到。 |
| 個人識別資訊、健康資訊、財務和付款資訊、個人通訊、位置、網路記錄、使用者活動 | ☐ | 不收集。 |

> 這兩項資料都不會傳給開發者，只會應使用者要求送到使用者選的 AI 服務商。勾選是為了如實揭露「資料會離開裝置」這件事；寧可多揭露，也不要少揭露，審核比較不會被退回。

接著勾選三項聲明：

- ✅ 我不會將使用者資料出售或轉移給第三方（核准的用途除外）。
- ✅ 我不會將使用者資料用於或轉移至與本項目單一用途無關的用途。
- ✅ 我不會將使用者資料用於或轉移至判斷信用評等或借貸用途。

### 隱私權政策網址

```
https://jayishandsome.github.io/Translate-Master/privacy.html
```

---

## 四、發布設定

| 欄位 | 建議 |
|---|---|
| 公開範圍 | 公開 |
| 發布地區 | 所有地區 |
| 價格 | 免費 |

### 給審核人員的測試說明（選填）

```
No account or sign-in is needed.

1. On desktop Chrome 138 or later, open any English web page (for example https://en.wikipedia.org/wiki/Coffee).
2. Select a sentence and click the “文 翻譯” (Translate) button that appears next to it. The translation appears in a small card. The first time, Chrome may download a language pack.
3. Right-click an empty area of the page and choose “全頁翻譯” (Translate full page). Paragraphs are translated in place; use the bar at the bottom right to switch to side-by-side view (對照) or restore the page (還原).
4. Optional AI mode: open the toolbar popup, choose “AI 模型”, pick a provider and paste your own API key, then click 儲存 (Save). AI mode is optional; the default on-device mode needs no key.
```
