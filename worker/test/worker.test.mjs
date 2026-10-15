// 免費 AI Worker：次數上限、失敗退還、CORS、模型回覆清理。Workers AI 用假的；次數用真正的 SQLite（node:sqlite）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import worker, { QuotaCounter, cleanReply } from "../src/index.js";

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
    EXTENSION_IDS: "",
    AI: { run: async (model, input) => { calls.push({ model, input }); return { response: "<think>\n\n</think>\n\n譯文" }; } },
    QUOTA: { idFromName: (n) => n, get: () => ({ fetch: (url, init) => quota.fetch(new Request(url, init)) }) },
    ...overrides,
  };
  return { env, calls };
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

test("查詢剩下的次數不會扣次數", async () => {
  const { env } = makeEnv();
  await post(env, ask());
  const q = () => worker.fetch(new Request(`https://free.example/quota?installId=${INSTALL}`, { headers: { Origin: EXT } }), env);
  assert.deepEqual(await (await q()).json(), { remaining: 9, limit: 10 });
  assert.deepEqual(await (await q()).json(), { remaining: 9, limit: 10 });
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
