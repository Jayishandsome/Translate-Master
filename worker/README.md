# 免費 AI 翻譯伺服器（Cloudflare Worker）

沒有 API 金鑰的使用者，在設定選「免費 AI」後，選字翻譯每天可以用 AI 翻 10 次，查單字一樣有語境說明；用完自動改用本機翻譯。這個資料夾就是處理這件事的伺服器，放在 Cloudflare Workers 的免費方案上就能跑。

## 它做什麼

- 接收擴充功能送來的：選取的文字、前後各約 200 字、譯文語言、一組隨機的安裝 ID。
- 防濫用的上限：
  - 每個安裝每天 10 次；
  - 同一個 IP 每天最多 50 次（擋「移除再安裝」換新 ID）；IPv6 以同一段 /56 網路算同一個來源，換位址也躲不掉；每段 IPv6 /48 每天最多 150 次（免費的 IPv6 通道一個帳號就有一整段 /48）；
  - 整個服務每天最多 1,500 次，保護 Workers AI 的免費額度（改付費方案時也是費用上限）；
  - 每個 IP 每分鐘最多 20 個請求（Cloudflare Rate Limiting），擋短時間大量請求。
- 次數記在 SQLite Durable Object，只有當天的次數，換日就刪掉。不存原始 IP，只存雜湊；雜湊用的密鑰 `IP_SALT` 存在 Cloudflare 的加密設定（Secret）裡，寫入後讀不回來，也不在儲存空間或備份裡，所以存下來的雜湊無法還原成 IP。（沒設定 `IP_SALT` 時改用只放在記憶體的隨機鹽值，一樣無法還原，但伺服器閒置重開後 IP 的計數會重來。）
- 交給 Workers AI 翻譯：預設 Qwen3 30B（中文很好、很便宜），故障時換 Gemma 4 26B。模型故障會退還使用者的次數；模型回空白（可能是被提示詞操縱）不退，避免有人免費消耗額度。
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
openssl rand -hex 32 | npx wrangler secret put IP_SALT   # IP 雜湊用的密鑰：隨機產生、直接存進 Cloudflare，不會顯示出來
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
| `GLOBAL_DAILY_LIMIT` | `1500` | 整個服務每天最多幾次；到了就當天暫停，使用者改用本機翻譯 |
| `NET_DAILY_LIMIT` | `150` | 每段 IPv6 /48 每天最多幾次 |
| `MODEL` | `@cf/qwen/qwen3-30b-a3b-fp8` | 主要模型 |
| `FALLBACK_MODEL` | `@cf/google/gemma-4-26b-a4b-it` | 主要模型失敗時用的備用模型 |
| `EXTENSION_IDS` | 空白 | 只接受這些擴充功能 ID（逗號分隔）；空白表示任何擴充功能都可以 |

每分鐘的上限在 `wrangler.toml` 的 `[[ratelimits]]`（`limit` 次數、`period` 只能是 10 或 60 秒）。

用量可以在 Cloudflare 後台的「AI → Workers AI」查看。

## 測試

在專案根目錄：

```bash
npm run test:worker
```

用假的 Workers AI 和真正的 SQLite 測試次數上限、失敗退還、跨日清除、只接受擴充功能等。
