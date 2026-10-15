# 免費 AI 翻譯伺服器（Cloudflare Worker）

沒有 API 金鑰的使用者，在設定選「免費 AI」後，選字翻譯每天可以用 AI 翻 10 次，查單字一樣有語境說明；用完自動改用本機翻譯。這個資料夾就是處理這件事的伺服器，放在 Cloudflare Workers 的免費方案上就能跑。

## 它做什麼

- 接收擴充功能送來的：選取的文字、前後各約 200 字、譯文語言、一組隨機的安裝 ID。
- 每個安裝每天 10 次；同一個 IP 每天最多 50 次（擋「移除再安裝」換新 ID）。次數記在 SQLite Durable Object，只有當天的次數，換日就刪掉。IP 只存加上日期的雜湊值。
- 交給 Workers AI 翻譯：預設 Qwen3 30B（中文很好、很便宜），失敗時換 Gemma 4 26B。翻譯失敗會把次數退還。
- 不記錄、不保存任何要翻譯的文字和譯文。
- 只接受 Chrome 擴充功能送來的請求；上架後可以限定只接受你的擴充功能（見下方）。

## 費用

- Workers AI 的免費額度是每天 10,000 Neurons，整個 Cloudflare 帳號共用，UTC 0 點（台灣、香港早上 8 點）重置。
- 一次選字翻譯大約 5～8 Neurons，所以每天大約可以翻 1,200～2,000 次，約等於 120～200 位每天用滿 10 次的使用者。
- 額度用完時，伺服器回「暫時不能用」，擴充功能這次自動改用本機翻譯，隔天恢復。
- 使用者多了，可以升級 Workers 付費方案（每月 5 美元起），超出免費額度的部分每 1,000 Neurons 0.011 美元，一次翻譯大約 0.0001 美元。

## 第一次部署

需要 Node.js 和一個免費的 Cloudflare 帳號。

```bash
cd worker
npx wrangler login      # 打開瀏覽器登入 Cloudflare 並按「允許」
npx wrangler deploy
```

第一次用 workers.dev 時，Cloudflare 會請你取一個子網域。部署完會印出網址，例如：

```
https://translate-master-free.你的子網域.workers.dev
```

把這個網址填進擴充功能 `background.js` 最上面的 `FREE_AI.endpoint`，重新打包（`npm run package`）。設定視窗就會出現「免費 AI」。

## 上架之後：只接受你的擴充功能

擴充功能上架後有固定的 ID（商店網址最後那串 32 個英文字母）。填進 `wrangler.toml` 的 `EXTENSION_IDS`，再執行一次 `npx wrangler deploy`，伺服器就只接受你的擴充功能送來的請求。

自己用「載入未封裝項目」測試時，擴充功能的 ID 不一樣，可以一起填，用逗號分開。

## 調整

改 `wrangler.toml` 的 `[vars]`，再 `npx wrangler deploy`：

| 設定 | 預設 | 說明 |
|---|---|---|
| `DAILY_LIMIT` | `10` | 每個安裝每天幾次（擴充功能 `background.js` 的 `FREE_AI.dailyLimit` 只是顯示用，請一起改） |
| `IP_DAILY_LIMIT` | `50` | 同一個 IP 每天最多幾次；公司、學校共用網路時是大家一起算 |
| `MODEL` | `@cf/qwen/qwen3-30b-a3b-fp8` | 主要模型 |
| `FALLBACK_MODEL` | `@cf/google/gemma-4-26b-a4b-it` | 主要模型失敗時用的備用模型 |
| `EXTENSION_IDS` | 空白 | 只接受這些擴充功能 ID（逗號分隔）；空白表示任何擴充功能都可以 |

用量可以在 Cloudflare 後台的「AI → Workers AI」查看。

## 測試

在專案根目錄：

```bash
npm run test:worker
```

用假的 Workers AI 和真正的 SQLite 測試次數上限、失敗退還、跨日清除、只接受擴充功能等。
