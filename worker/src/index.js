// 隨選翻譯 — 免費 AI 翻譯的 Cloudflare Worker
//
// 沒有 API 金鑰的使用者，選字翻譯每天可以用 AI 翻 DAILY_LIMIT 次（預設 10 次）。
// 擴充功能把選取的文字、前後文、譯文語言和一組隨機的安裝 ID 送到這裡；
// 這裡先扣次數，再交給 Cloudflare Workers AI 翻譯，失敗就把次數還回去。
//
// - 只記每天的次數：安裝 ID、以及 IP 的雜湊（加上每天隨機產生的鹽值；鹽值換日就跟次數一起刪掉，之後無法還原）。
// - 不記錄、不保存任何要翻譯的文字。
// - 只接受 Chrome 擴充功能送來的請求（EXTENSION_IDS 有填就只接受那些擴充功能）。
//
// 部署方式見 worker/README.md。

const MAX_TEXT = 2000;
const MAX_CONTEXT = 1200;
const MAX_BODY = 16 * 1024;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request.headers.get("Origin") || "", env);
    if (request.method === "OPTIONS") return new Response(null, { status: cors ? 204 : 403, headers: cors || {} });
    if (!cors) return json({ error: "forbidden" }, 403);

    if (url.pathname === "/translate" && request.method === "POST") return translate(request, env, cors);
    if (url.pathname === "/quota" && request.method === "GET") return quota(url, env, cors);
    return json({ error: "not_found" }, 404, cors);
  },
};

// ---------------------------------------------------------------------------

function corsHeaders(origin, env) {
  const m = /^chrome-extension:\/\/([a-p]{32})$/.exec(origin);
  if (!m) return null;
  const allowed = String(env.EXTENSION_IDS || "").split(/[\s,]+/).filter(Boolean);
  if (allowed.length && !allowed.includes(m[1])) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}

const today = () => new Date().toISOString().slice(0, 10);
const limits = (env) => ({
  install: Math.max(1, Number(env.DAILY_LIMIT) || 10),
  ip: Math.max(1, Number(env.IP_DAILY_LIMIT) || 50),
});

async function sha256(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// IPv6 一個家庭或一台主機通常就有一整段 /64 位址，可以一直換；所以 IPv6 用前 64 位元（前 4 組）當作同一個來源
export function ipGroup(ip) {
  const value = String(ip || "").trim().toLowerCase();
  if (!value.includes(":")) return value || "unknown";
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return mapped[1];
  const compressed = value.includes("::");
  const [head, tail = ""] = value.split("::");
  const left = head ? head.split(":") : [];
  const right = compressed && tail ? tail.split(":") : [];
  const groups = compressed
    ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right]
    : left;
  return `${groups.slice(0, 4).map((g) => (parseInt(g, 16) || 0).toString(16)).join(":")}::/64`;
}

// 次數記在同一個 Durable Object 裡（SQLite），一次只處理一個請求，不會算錯
async function counter(env, body) {
  const stub = env.QUOTA.get(env.QUOTA.idFromName("daily-quota"));
  const res = await stub.fetch("https://quota/", { method: "POST", body: JSON.stringify(body) });
  return res.json();
}

// IP 不直接存：交給 Durable Object 用當天的隨機鹽值算雜湊，只存雜湊
function quotaKeys(request, env, installId) {
  const { install, ip: ipLimit } = limits(env);
  return [
    { key: `i:${installId}`, limit: install },
    { ip: ipGroup(request.headers.get("CF-Connecting-IP")), limit: ipLimit },
  ];
}

const validInstallId = (id) => /^[A-Za-z0-9-]{8,64}$/.test(String(id || ""));

async function quota(url, env, cors) {
  const installId = url.searchParams.get("installId");
  if (!validInstallId(installId)) return json({ error: "bad_request" }, 400, cors);
  const { install } = limits(env);
  const { remaining } = await counter(env, { op: "peek", day: today(), keys: [{ key: `i:${installId}`, limit: install }] });
  return json({ remaining, limit: install }, 200, cors);
}

async function translate(request, env, cors) {
  if (Number(request.headers.get("Content-Length") || 0) > MAX_BODY) return json({ error: "too_long" }, 413, cors);
  const raw = await request.text().catch(() => "");
  if (raw.length > MAX_BODY) return json({ error: "too_long" }, 413, cors);
  let body = null;
  try { body = JSON.parse(raw); } catch (_) {}
  const text = String(body?.text ?? "").trim();
  const context = String(body?.context ?? "").slice(0, MAX_CONTEXT);
  const target = String(body?.target ?? "");
  if (!text || !LANGUAGES[target] || !validInstallId(body?.installId)) return json({ error: "bad_request" }, 400, cors);
  if (text.length > MAX_TEXT) return json({ error: "too_long", max: MAX_TEXT }, 413, cors);

  const day = today();
  const keys = quotaKeys(request, env, body.installId);
  const { install } = limits(env);
  const taken = await counter(env, { op: "take", day, keys });
  if (!taken.ok) return json({ error: "quota", remaining: taken.remaining, limit: install }, 429, cors);

  const refund = () => counter(env, { op: "refund", day, keys }).catch(() => {});
  let translation;
  try {
    translation = await runModel(env, buildPrompt(text, context, target));
  } catch (error) {
    await refund();
    // Workers AI 免費額度（每天 10,000 Neurons）整個帳號用完時，會回這類錯誤
    const exhausted = /neuron|allocation|4006|daily free/i.test(String(error?.message || error));
    return json({ error: exhausted ? "exhausted" : "model", remaining: taken.remaining + 1, limit: install }, 503, cors);
  }
  if (!translation) {
    await refund();
    return json({ error: "empty", remaining: taken.remaining + 1, limit: install }, 502, cors);
  }
  return json({ translation, remaining: taken.remaining, limit: install }, 200, cors);
}

// ---------------------------------------------------------------------------
// Workers AI：主要模型失敗時換備用模型；額度用完就不必再試

const SYSTEM = "You are a careful translator. Follow the user's instructions exactly and output only what they ask for.";

export async function runModel(env, prompt) {
  const models = [env.MODEL, env.FALLBACK_MODEL].filter(Boolean);
  let lastError = new Error("no model configured");
  for (const model of models) {
    try {
      // Qwen3 預設會先「思考」，翻譯用不到，用 /no_think 關掉
      const user = /qwen3/i.test(model) ? `${prompt}\n/no_think` : prompt;
      const out = await env.AI.run(model, {
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }],
        max_tokens: 1024,
        temperature: 0.2,
      });
      const text = cleanReply(out);
      if (text) return text;
      lastError = new Error(`empty reply from ${model}`);
    } catch (error) {
      lastError = error;
      if (/neuron|allocation|4006|daily free/i.test(String(error?.message || error))) break;
    }
  }
  throw lastError;
}

export function cleanReply(out) {
  const raw = typeof out === "string" ? out
    : typeof out?.response === "string" ? out.response
    : out?.choices?.[0]?.message?.content ?? out?.result?.response ?? "";
  return String(raw)
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*$/i, "")
    .replace(/^\s*```[a-z]*\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

// ---------------------------------------------------------------------------
// 每天的次數。一個請求同時檢查「這個安裝」和「這個 IP」兩個上限，兩個都沒到才扣。

export class QuotaCounter {
  constructor(state) {
    this.sql = state.storage.sql;
    this.sql.exec(
      "CREATE TABLE IF NOT EXISTS usage (day TEXT NOT NULL, key TEXT NOT NULL, count INTEGER NOT NULL, PRIMARY KEY (day, key))"
    );
    this.sql.exec("CREATE TABLE IF NOT EXISTS salts (day TEXT PRIMARY KEY, salt TEXT NOT NULL)");
    this.cleanedDay = "";
  }

  // 每天一個隨機鹽值；換日時跟前一天的次數一起刪掉，之後就無法從雜湊找回 IP
  saltFor(day) {
    const row = this.sql.exec("SELECT salt FROM salts WHERE day = ?", day).toArray()[0];
    if (row) return row.salt;
    const salt = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
    this.sql.exec("INSERT INTO salts (day, salt) VALUES (?, ?)", day, salt);
    return salt;
  }

  // { ip } 換成 { key: "ip:<雜湊>" }；原始 IP 不寫進儲存空間
  async resolveKeys(day, keys) {
    const salt = this.saltFor(day);
    return Promise.all(keys.map(async (k) => (k.ip === undefined
      ? k
      : { key: `ip:${(await sha256(`${salt}|${k.ip}`)).slice(0, 32)}`, limit: k.limit })));
  }

  count(day, key) {
    const row = this.sql.exec("SELECT count FROM usage WHERE day = ? AND key = ?", day, key).toArray()[0];
    return row ? Number(row.count) : 0;
  }

  async fetch(request) {
    let { op, day, keys } = await request.json();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Array.isArray(keys) || !keys.length) {
      return json({ error: "bad_request" }, 400);
    }
    // 換日之後第一個請求，順手刪掉前一天的紀錄和鹽值
    if (this.cleanedDay !== day) {
      this.sql.exec("DELETE FROM usage WHERE day <> ?", day);
      this.sql.exec("DELETE FROM salts WHERE day <> ?", day);
      this.cleanedDay = day;
    }
    // 雜湊先算好；之後的檢查和寫入都是同步的，中間不會插進別的請求
    keys = await this.resolveKeys(day, keys);
    const first = keys[0];
    if (op === "peek") {
      return json({ remaining: Math.max(0, first.limit - this.count(day, first.key)) });
    }
    if (op === "take") {
      const counts = keys.map((k) => this.count(day, k.key));
      if (keys.some((k, i) => counts[i] >= k.limit)) return json({ ok: false, remaining: 0 });
      const remaining = first.limit - counts[0];
      for (const k of keys) {
        this.sql.exec(
          "INSERT INTO usage (day, key, count) VALUES (?, ?, 1) ON CONFLICT(day, key) DO UPDATE SET count = count + 1",
          day, k.key
        );
      }
      return json({ ok: true, remaining: remaining - 1 });
    }
    if (op === "refund") {
      for (const k of keys) {
        this.sql.exec("UPDATE usage SET count = MAX(count - 1, 0) WHERE day = ? AND key = ?", day, k.key);
      }
      return json({ ok: true });
    }
    return json({ error: "bad_op" }, 400);
  }
}

// ---------------------------------------------------------------------------
// 提示詞：跟擴充功能 background.js 用自己的金鑰時一樣（請兩邊一起改）

const LANGUAGES = {
  "zh-TW": "Traditional Chinese (繁體中文)",
  "zh-CN": "Simplified Chinese (简体中文)",
  en: "English",
  ja: "Japanese (日本語)",
  ko: "Korean (한국어)",
  fr: "French",
  de: "German",
  es: "Spanish",
  pt: "Portuguese",
  it: "Italian",
  ru: "Russian",
  vi: "Vietnamese",
  th: "Thai",
  id: "Indonesian",
};

/** 單字 / 極短詞組：需要上下文解釋 */
function isWordLookup(text) {
  const s = String(text || "").trim();
  if (!s || /[\n\r]/.test(s)) return false;
  if (s.length > 48) return false;
  if ((s.match(/[.!?。！？]/g) || []).length > 1) return false;

  if (/\s/.test(s)) {
    return s.split(/\s+/).filter(Boolean).length <= 2;
  }
  return s.length <= 12;
}

function buildWordPrompt(selected, ctx, langLabel, hasRichContext) {
  return `You are a contextual dictionary assistant.

The user selected a WORD or SHORT PHRASE on a webpage. Explain how it is used in the surrounding passage, then give the best translation.

Write your entire response in ${langLabel}, using EXACTLY this format (keep the 【】 headers):

【翻譯】<best translation of SELECTED in this context — concise>
【上下文】<1-3 short sentences: meaning of SELECTED in THIS passage, why this translation fits; mention other common senses only if helpful>

${
  hasRichContext
    ? "Base the explanation on CONTEXT below."
    : "CONTEXT is limited; give the most likely reading and note uncertainty briefly."
}

Rules:
- Do not translate or quote the full CONTEXT.
- No markdown, bullet lists, or extra sections beyond the two lines above.
- Preserve proper nouns; do not invent facts not supported by CONTEXT.

CONTEXT:
"""
${ctx}
"""

SELECTED:
"""
${selected}
"""`;
}

function buildPhrasePrompt(selected, ctx, langLabel, hasRichContext) {
  return `You are a professional contextual translator.

Task: Translate ONLY the SELECTED text into ${langLabel}.
${
  hasRichContext
    ? `The CONTEXT is the surrounding paragraph/passage. Use it to resolve:
- pronouns and omitted subjects
- word sense / polysemy (e.g. bank, lead, 打)
- tense, tone, and domain (technical vs casual)
Do NOT translate the full CONTEXT — output only the translation of SELECTED.`
    : "No extra surrounding context is available; translate SELECTED directly."
}

Rules:
- Output ONLY the translation of SELECTED — no quotes, labels, notes, or the original text.
- Preserve names, numbers, URLs, and code as-is.
- Match the register of the source (formal/informal).

CONTEXT:
"""
${ctx}
"""

SELECTED (translate this part only):
"""
${selected}
"""`;
}

function buildPrompt(selectedText, context, targetLang) {
  const langLabel = LANGUAGES[targetLang] || LANGUAGES["zh-TW"];
  const selected = String(selectedText || "").trim();
  const ctx = String(context || "").trim() || selected;
  const hasRichContext =
    ctx.length > selected.length + 20 && ctx !== selected;

  if (isWordLookup(selected)) {
    return buildWordPrompt(selected, ctx, langLabel, hasRichContext);
  }
  return buildPhrasePrompt(selected, ctx, langLabel, hasRichContext);
}
