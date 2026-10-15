// 隨選翻譯 — 免費 AI 翻譯的 Cloudflare Worker
//
// 沒有 API 金鑰的使用者，選字翻譯每天可以用 AI 翻 DAILY_LIMIT 次（預設 10 次）。
// 擴充功能把選取的文字、前後文、譯文語言和一組隨機的安裝 ID 送到這裡；
// 這裡先扣次數，再交給 Cloudflare Workers AI 翻譯，失敗就把次數還回去。
//
// - 只記每天的次數：安裝 ID、IP 的雜湊、全部加起來的總數。IP 雜湊用的密鑰放在 Cloudflare 的加密設定
//   （Secret：IP_SALT，寫入後讀不回來）；沒設定時改用只放在記憶體的隨機鹽值。兩種都不在儲存空間或備份裡，
//   所以存下來的雜湊無法還原成 IP；雜湊也加上日期，隔天就對不起來。
// - 不記錄、不保存任何要翻譯的文字。
// - 只接受 Chrome 擴充功能送來的請求（EXTENSION_IDS 有填就只接受那些擴充功能）。
// - 防濫用：每個安裝、每個 IP（IPv6 以 /56 計，另外每段 /48 也有上限）、整個服務每天都有上限，
//   另外每個 IP 每分鐘也有上限。
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

    if (url.pathname !== "/translate" || request.method !== "POST") return json({ error: "not_found" }, 404, cors);

    // 每個 IP 每分鐘的上限（Cloudflare 的 Rate Limiting），擋短時間大量請求；放在扣次數之前
    const ip = request.headers.get("CF-Connecting-IP") || "";
    if (env.RATE_LIMITER) {
      const { success } = await env.RATE_LIMITER.limit({ key: ipGroup(ip) }).catch(() => ({ success: true }));
      if (!success) return json({ error: "rate_limited" }, 429, cors);
    }
    return translate(request, env, cors, ip);
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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
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
  // 整個服務每天最多幾次：Workers AI 免費額度約可翻 1,200～2,000 次，留一點餘裕；付費方案時也是費用上限
  global: Math.max(1, Number(env.GLOBAL_DAILY_LIMIT) || 1500),
  // IPv6 每段 /48 每天最多幾次：免費的 IPv6 通道（例如 Hurricane Electric）一個帳號就給一整段 /48（256 段 /56）
  net: Math.max(1, Number(env.NET_DAILY_LIMIT) || 150),
});

async function sha256(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function ipv6Hex(value) {
  const compressed = value.includes("::");
  const [head, tail = ""] = value.split("::");
  const left = head ? head.split(":") : [];
  const right = compressed && tail ? tail.split(":") : [];
  const groups = compressed
    ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right]
    : left;
  return groups.slice(0, 4).map((g) => (parseInt(g, 16) || 0).toString(16).padStart(4, "0"));
}

// IPv6 /48；IPv4 沒有這一層，回傳空字串
export function netGroup(ip) {
  const value = String(ip || "").trim().toLowerCase();
  if (!value.includes(":") || /^::ffff:\d+\.\d+\.\d+\.\d+$/.test(value)) return "";
  const hex = ipv6Hex(value);
  return `${hex[0]}:${hex[1]}:${hex[2]}::/48`;
}

// IPv6 一個家庭通常分到一整段 /56（256 個 /64），可以一直換位址；所以 IPv6 用前 56 位元當作同一個來源
export function ipGroup(ip) {
  const value = String(ip || "").trim().toLowerCase();
  if (!value.includes(":")) return value || "unknown";
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return mapped[1];
  const hex = ipv6Hex(value);
  return `${hex[0]}:${hex[1]}:${hex[2]}:${hex[3].slice(0, 2)}00::/56`;
}

// 次數記在同一個 Durable Object 裡（SQLite），一次只處理一個請求，不會算錯
async function counter(env, body) {
  const stub = env.QUOTA.get(env.QUOTA.idFromName("daily-quota"));
  const res = await stub.fetch("https://quota/", { method: "POST", body: JSON.stringify(body) });
  return res.json();
}

// 第一個一定是這個安裝的次數（回傳的剩餘次數以它為準）。IP 不直接存，只存雜湊：
// 有設定 IP_SALT（Cloudflare 的加密設定）就在這裡用它算；沒有的話交給 Durable Object 用記憶體裡的鹽值算。
async function quotaKeys(env, installId, ip, day) {
  const { install, ip: ipLimit, net: netLimit, global } = limits(env);
  const sources = [{ ip: ipGroup(ip), limit: ipLimit, kind: "ip" }];
  const net = netGroup(ip);
  if (net) sources.push({ ip: `net:${net}`, limit: netLimit, kind: "net" });
  const hashed = env.IP_SALT
    ? await Promise.all(sources.map(async (k) => ({
      key: `ip:${(await sha256(`${env.IP_SALT}|${day}|${k.ip}`)).slice(0, 32)}`, limit: k.limit, kind: k.kind,
    })))
    : sources;
  return [
    { key: `i:${installId}`, limit: install, kind: "install" },
    ...hashed,
    { key: "global", limit: global, kind: "global" },
  ];
}

const validInstallId = (id) => /^[A-Za-z0-9-]{8,64}$/.test(String(id || ""));

async function translate(request, env, cors, ip = request.headers.get("CF-Connecting-IP") || "") {
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
  const keys = await quotaKeys(env, body.installId, ip, day);
  const { install } = limits(env);
  const taken = await counter(env, { op: "take", day, keys });
  if (!taken.ok) {
    // 整個服務今天的上限到了：不是使用者自己的次數用完
    if (taken.reason === "global") return json({ error: "exhausted", limit: install }, 503, cors);
    return json({ error: "quota", remaining: 0, limit: install }, 429, cors);
  }

  let translation;
  try {
    translation = await runModel(env, buildPrompt(text, context, target));
  } catch (error) {
    // 模型回空白（例如提示詞故意讓它只「思考」）不退次數，避免免費消耗額度；
    // 模型故障才退還使用者自己的次數（安裝、IP），整個服務的總數不退
    if (error?.empty) return json({ error: "empty", remaining: taken.remaining, limit: install }, 502, cors);
    await counter(env, { op: "refund", day, keys: keys.filter((k) => k.kind !== "global") }).catch(() => {});
    // Workers AI 免費額度（每天 10,000 Neurons）整個帳號用完時，會回這類錯誤
    const exhausted = /neuron|allocation|4006|daily free/i.test(String(error?.message || error));
    return json({ error: exhausted ? "exhausted" : "model", remaining: taken.remaining + 1, limit: install }, 503, cors);
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
      // 回空白多半是提示詞造成的，換模型也一樣，直接結束
      throw Object.assign(new Error(`empty reply from ${model}`), { empty: true });
    } catch (error) {
      if (error?.empty) throw error;
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
    // 舊版把鹽值存在資料表裡（會進備份）；現在只放記憶體
    this.sql.exec("DROP TABLE IF EXISTS salts");
    this.cleanedDay = "";
    this.salt = "";
    this.saltDay = "";
  }

  // 每天一個隨機鹽值，只放在記憶體：不寫進儲存空間，所以存下來的 IP 雜湊無法還原。
  // Durable Object 閒置被關掉時鹽值會換新，當天 IP 的計數等於重來；安裝和總數的上限不受影響。
  saltFor(day) {
    if (this.saltDay !== day || !this.salt) {
      this.salt = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
      this.saltDay = day;
    }
    return this.salt;
  }

  // { ip } 換成 { key: "ip:<雜湊>" }；原始 IP 不寫進儲存空間
  async resolveKeys(day, keys) {
    const salt = this.saltFor(day);
    return Promise.all(keys.map(async (k) => (k.ip === undefined
      ? k
      : { key: `ip:${(await sha256(`${salt}|${k.ip}`)).slice(0, 32)}`, limit: k.limit, kind: k.kind })));
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
    // 換日之後第一個請求，順手刪掉前一天的紀錄
    if (this.cleanedDay !== day) {
      this.sql.exec("DELETE FROM usage WHERE day <> ?", day);
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
      const blocked = keys.findIndex((k, i) => counts[i] >= k.limit);
      if (blocked >= 0) return json({ ok: false, remaining: 0, reason: keys[blocked].kind || "quota" });
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
