// 免費 AI Worker：次數上限、失敗退還、CORS、模型回覆清理。Workers AI 用假的；次數用真正的 SQLite（node:sqlite）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import worker, { QuotaCounter, cleanReply, ipGroup } from "../src/index.js";

const EXT = "chrome-extension://abcdefghijklmnopabcdefghijklmnop";
const INSTALL = "11111111-2222-3333-4444-555555555555";

function fakeState() {
  const db = new DatabaseSync(":memory:");
  return {
    storage: {
      sql: {
        exec(query, ...params) {
          const stmt = db.prepare(query);
          const rows = /^\s*select/i.test(query) ? stmt.all(...params) : (stmt.run(...params), []);
          return { toArray: () => rows, one: () => rows[0] };
        },
      },
    },
  };
}

function makeEnv(overrides = {}) {
  const quota = new QuotaCounter(fakeState());
  const calls = [];
  const env = {
    MODEL: "@cf/qwen/qwen3-30b-a3b-fp8",
    FALLBACK_MODEL: "@cf/google/gemma-4-26b-a4b-it",
    DAILY_LIMIT: "10",
    IP_DAILY_LIMIT: "50",
    GLOBAL_DAILY_LIMIT: "1500",
    EXTENSION_IDS: "",
    AI: { run: async (model, input) => { calls.push({ model, input }); return { response: "<think>\n\n</think>\n\n譯文" }; } },
    QUOTA: { idFromName: (n) => n, get: () => ({ fetch: (url, init) => quota.fetch(new Request(url, init)) }) },
    ...overrides,
  };
  return { env, calls, quota };
}

const post = (env, body, { origin = EXT, ip = "203.0.113.7" } = {}) =>
  worker.fetch(new Request("https://free.example/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin, "CF-Connecting-IP": ip },
    body: JSON.stringify(body),
  }), env);

const ask = (text = "bank", extra = {}) => ({ text, context: "She waited on the bank until the river calmed.", target: "zh-TW", installId: INSTALL, ...extra });

test("翻譯成功：回傳譯文和剩下的次數，提示詞照擴充功能的格式", async () => {
  const { env, calls } = makeEnv();
  const res = await post(env, ask());
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), EXT);
  assert.deepEqual(await res.json(), { translation: "譯文", remaining: 9, limit: 10 });
  assert.equal(calls[0].model, "@cf/qwen/qwen3-30b-a3b-fp8");
  const prompt = calls[0].input.messages[1].content;
  assert.match(prompt, /【翻譯】/);
  assert.match(prompt, /Traditional Chinese/);
  assert.match(prompt, /\/no_think$/);
});

test("每個安裝每天 10 次，第 11 次回 429", async () => {
  const { env, calls } = makeEnv();
  for (let i = 0; i < 10; i++) assert.equal((await post(env, ask())).status, 200);
  const res = await post(env, ask());
  assert.equal(res.status, 429);
  assert.deepEqual(await res.json(), { error: "quota", remaining: 0, limit: 10 });
  assert.equal(calls.length, 10);
  // 別的安裝不受影響
  assert.equal((await post(env, ask("bank", { installId: "99999999-2222-3333-4444-555555555555" }))).status, 200);
});

test("同一個 IP 換安裝 ID 也有上限", async () => {
  const { env } = makeEnv({ IP_DAILY_LIMIT: "3" });
  for (let i = 0; i < 3; i++) assert.equal((await post(env, ask("bank", { installId: `aaaaaaaa-000${i}` }))).status, 200);
  assert.equal((await post(env, ask("bank", { installId: "aaaaaaaa-0009" }))).status, 429);
  assert.equal((await post(env, ask("bank", { installId: "aaaaaaaa-0009" }), { ip: "198.51.100.1" })).status, 200);
});

test("模型失敗時換備用模型；都失敗就退還次數", async () => {
  let fail = 2;
  const { env, calls } = makeEnv();
  env.AI.run = async (model, input) => { calls.push({ model, input }); if (fail-- > 0) throw new Error("boom"); return { response: "ok" }; };
  const res = await post(env, ask());
  assert.equal(res.status, 503);
  assert.equal((await res.json()).remaining, 10);
  assert.deepEqual(calls.map((c) => c.model), ["@cf/qwen/qwen3-30b-a3b-fp8", "@cf/google/gemma-4-26b-a4b-it"]);
  // 備用模型不加 /no_think
  assert.doesNotMatch(calls[1].input.messages[1].content, /no_think/);
  const ok = await post(env, ask());
  assert.equal((await ok.json()).remaining, 9);
});

test("Workers AI 免費額度用完：回 exhausted，不再試備用模型", async () => {
  const { env, calls } = makeEnv();
  env.AI.run = async (model) => { calls.push({ model }); throw new Error("4006: you have used up your daily free allocation of 10,000 neurons"); };
  const res = await post(env, ask());
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error, "exhausted");
  assert.equal(calls.length, 1);
});

test("只接受 Chrome 擴充功能；有設定 EXTENSION_IDS 時只接受那些", async () => {
  const { env } = makeEnv();
  assert.equal((await post(env, ask(), { origin: "https://evil.example" })).status, 403);
  assert.equal((await post(env, ask(), { origin: "" })).status, 403);
  const limited = makeEnv({ EXTENSION_IDS: "ppppppppppppppppppppppppppppppppp".slice(0, 32) }).env;
  assert.equal((await post(limited, ask())).status, 403);
  const pre = await worker.fetch(new Request("https://free.example/translate", { method: "OPTIONS", headers: { Origin: EXT } }), env);
  assert.equal(pre.status, 204);
  assert.match(pre.headers.get("Access-Control-Allow-Methods"), /POST/);
});

test("檢查輸入：語言、長度、安裝 ID", async () => {
  const { env, calls } = makeEnv();
  assert.equal((await post(env, ask("bank", { target: "xx" }))).status, 400);
  assert.equal((await post(env, ask("bank", { installId: "x" }))).status, 400);
  assert.equal((await post(env, ask("  "))).status, 400);
  assert.equal((await post(env, ask("a".repeat(2001)))).status, 413);
  assert.equal(calls.length, 0);
});

test("只有 POST /translate；其他路徑一律 404（不提供可以無限呼叫的查詢）", async () => {
  const { env } = makeEnv();
  const q = await worker.fetch(new Request(`https://free.example/quota?installId=${INSTALL}`, { headers: { Origin: EXT } }), env);
  assert.equal(q.status, 404);
  const get = await worker.fetch(new Request("https://free.example/translate", { headers: { Origin: EXT } }), env);
  assert.equal(get.status, 404);
});

test("隔天重新計算，前一天的紀錄刪掉", async () => {
  const quota = new QuotaCounter(fakeState());
  const call = async (body) => (await quota.fetch(new Request("https://quota/", { method: "POST", body: JSON.stringify(body) }))).json();
  const keys = [{ key: "i:x", limit: 1 }];
  assert.equal((await call({ op: "take", day: "2026-10-14", keys })).ok, true);
  assert.equal((await call({ op: "take", day: "2026-10-14", keys })).ok, false);
  assert.deepEqual(await call({ op: "take", day: "2026-10-15", keys }), { ok: true, remaining: 0 });
  assert.equal(quota.sql.exec("SELECT count(*) AS n FROM usage WHERE day = '2026-10-14'").toArray()[0].n, 0);
});

test("清掉模型回覆裡的思考與程式碼框", () => {
  assert.equal(cleanReply({ response: "<think>hmm</think>\n河岸" }), "河岸");
  assert.equal(cleanReply({ choices: [{ message: { content: "```\n河岸\n```" } }] }), "河岸");
  assert.equal(cleanReply({ response: "<think>never closed" }), "");
});

test("IPv6 同一段 /56 算同一個來源，換位址、換 /64 也躲不掉 IP 上限", async () => {
  assert.equal(ipGroup("2001:db8:abcd:12:1:2:3:4"), "2001:0db8:abcd:0000::/56");
  assert.equal(ipGroup("2001:DB8:abcd:00ff::99"), "2001:0db8:abcd:0000::/56");
  assert.equal(ipGroup("2001:db8:abcd:1200::1"), "2001:0db8:abcd:1200::/56");
  assert.equal(ipGroup("2001:db8::1"), "2001:0db8:0000:0000::/56");
  assert.equal(ipGroup("::ffff:203.0.113.9"), "203.0.113.9");
  assert.equal(ipGroup("203.0.113.9"), "203.0.113.9");
  const { env } = makeEnv({ IP_DAILY_LIMIT: "3" });
  for (let i = 0; i < 3; i++) {
    assert.equal((await post(env, ask("bank", { installId: `bbbbbbbb-000${i}` }), { ip: `2001:db8:abcd:${i + 1}::1` })).status, 200);
  }
  assert.equal((await post(env, ask("bank", { installId: "bbbbbbbb-0009" }), { ip: "2001:db8:abcd:ff:ffff::7" })).status, 429);
  assert.equal((await post(env, ask("bank", { installId: "bbbbbbbb-0009" }), { ip: "2001:db8:abcd:100::1" })).status, 200);
});

test("不存原始 IP：只存加了隨機鹽值的雜湊，鹽值不寫進儲存空間", async () => {
  const { env, quota } = makeEnv();
  await post(env, ask(), { ip: "198.51.100.23" });
  const rows = quota.sql.exec("SELECT key FROM usage").toArray().map((r) => r.key);
  assert.deepEqual(rows.map((k) => k.split(":")[0]).sort(), ["global", "i", "ip"]);
  assert.ok(rows.every((k) => !k.includes("198.51.100")));
  const ipKey = rows.find((k) => k.startsWith("ip:"));
  assert.match(ipKey, /^ip:[0-9a-f]{32}$/);
  // 只用日期當鹽就能被暴力反推；確認雜湊不是 sha256(日期|IP)
  const day = new Date().toISOString().slice(0, 10);
  const { createHash } = await import("node:crypto");
  assert.notEqual(ipKey, `ip:${createHash("sha256").update(`${day}|198.51.100.23`).digest("hex").slice(0, 32)}`);
  // 資料庫裡只有次數表，沒有鹽值；任何一列都不含鹽值
  const tables = quota.sql.exec("SELECT name FROM sqlite_master WHERE type = 'table'").toArray().map((r) => r.name);
  assert.deepEqual(tables, ["usage"]);
  const dump = JSON.stringify(quota.sql.exec("SELECT * FROM usage").toArray());
  assert.ok(!dump.includes(quota.salt));
  const next = await quota.fetch(new Request("https://quota/", { method: "POST", body: JSON.stringify({ op: "peek", day: "2099-01-01", keys: [{ key: "i:x", limit: 1 }] }) }));
  assert.equal(next.status, 200);
  assert.equal(quota.sql.exec("SELECT count(*) AS n FROM usage").toArray()[0].n, 0);
  assert.notEqual(quota.saltDay, new Date().toISOString().slice(0, 10));
});

test("太大的請求直接拒絕，不解析", async () => {
  const { env, calls } = makeEnv();
  const res = await post(env, ask("bank", { context: "x".repeat(20000) }));
  assert.equal(res.status, 413);
  assert.equal(calls.length, 0);
});

test("模型回空白（例如被提示詞操縱）不退次數，也不再換模型多花一次", async () => {
  const { env, calls } = makeEnv();
  env.AI.run = async (model, input) => { calls.push({ model, input }); return { response: "<think>forever" }; };
  const res = await post(env, ask());
  assert.equal(res.status, 502);
  assert.deepEqual(await res.json(), { error: "empty", remaining: 9, limit: 10 });
  assert.equal(calls.length, 1);
});

test("模型故障退還使用者的次數，但全站總數不退", async () => {
  const { env, quota } = makeEnv();
  env.AI.run = async () => { throw new Error("boom"); };
  assert.equal((await post(env, ask())).status, 503);
  const day = new Date().toISOString().slice(0, 10);
  const row = (key) => quota.sql.exec("SELECT count FROM usage WHERE day = ? AND key = ?", day, key).toArray()[0]?.count ?? 0;
  assert.equal(row(`i:${INSTALL}`), 0);
  assert.equal(row("global"), 1);
});

test("全站每天的總上限：到了就回 exhausted，不扣使用者自己的次數", async () => {
  const { env, calls } = makeEnv({ GLOBAL_DAILY_LIMIT: "2" });
  assert.equal((await post(env, ask("bank", { installId: "cccccccc-0001" }), { ip: "192.0.2.1" })).status, 200);
  assert.equal((await post(env, ask("bank", { installId: "cccccccc-0002" }), { ip: "192.0.2.2" })).status, 200);
  const res = await post(env, ask("bank", { installId: "cccccccc-0003" }), { ip: "192.0.2.3" });
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { error: "exhausted", limit: 10 });
  assert.equal(calls.length, 2);
});

test("每分鐘的上限：Rate Limiting 拒絕時不扣次數、不呼叫模型", async () => {
  const seen = [];
  const { env, calls, quota } = makeEnv({ RATE_LIMITER: { limit: async ({ key }) => { seen.push(key); return { success: false }; } } });
  const res = await post(env, ask(), { ip: "2001:db8:abcd:12::5" });
  assert.equal(res.status, 429);
  assert.equal((await res.json()).error, "rate_limited");
  assert.deepEqual(seen, ["2001:0db8:abcd:0000::/56"]);
  assert.equal(calls.length, 0);
  assert.equal(quota.sql.exec("SELECT count(*) AS n FROM usage").toArray()[0].n, 0);
});

test("IPv6 每段 /48 也有上限：同一個通道帳號換 /56 也躲不掉", async () => {
  const { env } = makeEnv({ NET_DAILY_LIMIT: "3" });
  for (let i = 0; i < 3; i++) {
    assert.equal((await post(env, ask("bank", { installId: `dddddddd-000${i}` }), { ip: `2001:db8:abcd:${i}00::1` })).status, 200);
  }
  assert.equal((await post(env, ask("bank", { installId: "dddddddd-0009" }), { ip: "2001:db8:abcd:f00::1" })).status, 429);
  assert.equal((await post(env, ask("bank", { installId: "dddddddd-0009" }), { ip: "2001:db8:abce:100::1" })).status, 200);
  // IPv4 沒有 /48 這一層
  assert.equal((await post(env, ask("bank", { installId: "dddddddd-0010" }), { ip: "198.51.100.200" })).status, 200);
});

test("設定 IP_SALT 時：IP 雜湊用密鑰算，伺服器重新啟動後 IP 上限照樣有效", async () => {
  const { env, quota } = makeEnv({ IP_SALT: "test-secret", IP_DAILY_LIMIT: "2" });
  assert.equal((await post(env, ask("bank", { installId: "eeeeeeee-0001" }), { ip: "203.0.113.50" })).status, 200);
  quota.salt = ""; // 模擬 Durable Object 被關掉重開：記憶體裡的鹽值不見了
  assert.equal((await post(env, ask("bank", { installId: "eeeeeeee-0002" }), { ip: "203.0.113.50" })).status, 200);
  assert.equal((await post(env, ask("bank", { installId: "eeeeeeee-0003" }), { ip: "203.0.113.50" })).status, 429);
  const day = new Date().toISOString().slice(0, 10);
  const { createHash } = await import("node:crypto");
  const expected = `ip:${createHash("sha256").update(`test-secret|${day}|203.0.113.50`).digest("hex").slice(0, 32)}`;
  const keys = quota.sql.exec("SELECT key FROM usage").toArray().map((r) => r.key);
  assert.ok(keys.includes(expected));
  assert.ok(!JSON.stringify(keys).includes("203.0.113"));
});
