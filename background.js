// ============================================================================
// 翻訳 — Background Service Worker
// 路由不同的模型 API (Gemini / MiniMax / Kimi / OpenAI / DeepSeek / Claude)
// ============================================================================

const PROVIDERS = {
  gemini: {
    name: "Gemini",
    model: "gemini-2.0-flash",
    endpoint: (key, model) =>
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
  },
  minimax: {
    name: "MiniMax",
    model: "MiniMax-M2.5",
    endpoints: [
      "https://api.minimax.io/v1/text/chatcompletion_v2",
      "https://api.minimaxi.com/v1/text/chatcompletion_v2",
    ],
  },
  kimi: {
    name: "Kimi",
    model: "moonshot-v1-8k",
    endpoint: () => "https://api.moonshot.cn/v1/chat/completions",
  },
  openai: {
    name: "OpenAI",
    model: "gpt-4o-mini",
    endpoint: () => "https://api.openai.com/v1/chat/completions",
  },
  deepseek: {
    name: "DeepSeek",
    model: "deepseek-chat",
    endpoint: () => "https://api.deepseek.com/v1/chat/completions",
  },
  claude: {
    name: "Claude",
    model: "claude-haiku-4-5-20251001",
    endpoint: () => "https://api.anthropic.com/v1/messages",
  },
};

const LANGUAGES = {
  "zh-TW": "Traditional Chinese (繁體中文)",
  "zh-CN": "Simplified Chinese (简体中文)",
  ja: "Japanese (日本語)",
  en: "English",
  ko: "Korean (한국어)",
  fr: "French",
  de: "German",
  es: "Spanish",
};

// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === "translate") {
    (async () => {
      try {
        const result = await handleTranslation(request.text, request.context);
        sendResponse({ success: true, data: result });
        incrementUsageCount().catch(() => {});
      } catch (error) {
        sendResponse({
          success: false,
          error: error?.message || String(error),
        });
      }
    })();
    return true;
  }

  if (request.action === "getProviders") {
    sendResponse({
      providers: Object.fromEntries(
        Object.entries(PROVIDERS).map(([k, v]) => [k, { name: v.name, model: v.model }])
      ),
      languages: LANGUAGES,
    });
    return false;
  }
});

// ---------------------------------------------------------------------------

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function incrementUsageCount() {
  try {
    const today = todayKey();
    const data = await chrome.storage.sync.get(["usageDate", "usageCount"]);
    const next = data.usageDate === today ? (Number(data.usageCount) || 0) + 1 : 1;
    await chrome.storage.sync.set({ usageDate: today, usageCount: next });
  } catch (_) {}
}

async function handleTranslation(selectedText, context) {
  if (!String(selectedText || "").trim()) {
    throw new Error("未選取翻譯文字");
  }

  const data = await chrome.storage.sync.get([
    "apiProvider",
    "apiKeys",
    "targetLang",
  ]);

  const provider = data.apiProvider || "gemini";
  const apiKeys = data.apiKeys || {};
  const apiKey = apiKeys[provider];
  const targetLang = data.targetLang || "zh-TW";

  console.log("handleTranslation:", { provider, apiKey: apiKey ? "***" : "empty", targetLang });

  if (!apiKey) {
    const name = PROVIDERS[provider]?.name || provider;
    throw new Error(`未設定 ${name} 的 API Key`);
  }

  const prompt = buildPrompt(selectedText, context, targetLang);

  switch (provider) {
    case "gemini":
      return await callGemini(apiKey, prompt);
    case "minimax":
      return await callMiniMax(apiKey, prompt);
    case "kimi":
      return await callOpenAICompat(PROVIDERS.kimi, apiKey, prompt);
    case "openai":
      return await callOpenAICompat(PROVIDERS.openai, apiKey, prompt);
    case "deepseek":
      return await callOpenAICompat(PROVIDERS.deepseek, apiKey, prompt);
    case "claude":
      return await callClaude(apiKey, prompt);
    default:
      throw new Error(`未知的 provider: ${provider}`);
  }
}

function extractMessageText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "string" ? part : part?.text || part?.content || ""
      )
      .join("");
  }
  return "";
}

function stripThinkingTags(text) {
  if (!text) return "";
  return String(text)
    .replace(/<think[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*?<\/redacted_thinking>/gi, "")
    .replace(/\(think\)[\s\S]*?\(\/think\)/gi, "")
    .replace(/^\s*[\r\n]+/, "")
    .trim();
}

function extractMiniMaxText(json) {
  if (
    json?.base_resp?.status_code !== undefined &&
    json?.base_resp?.status_code !== 0
  ) {
    throw new Error(
      `MiniMax API 錯誤 ${json.base_resp.status_code}: ${
        json.base_resp.status_msg || "未知錯誤"
      }`
    );
  }

  const msg = json?.choices?.[0]?.message;
  const delta = json?.choices?.[0]?.delta;

  const candidates = [
    stripThinkingTags(extractMessageText(msg?.content)),
    stripThinkingTags(extractMessageText(delta?.content)),
    stripThinkingTags(json?.reply || json?.text || ""),
  ];

  // reasoning_details 是思考過程，僅在沒有正式回覆時才嘗試
  if (!candidates.some((t) => t.trim()) && Array.isArray(msg?.reasoning_details)) {
    candidates.push(
      ...msg.reasoning_details.map((d) => stripThinkingTags(d?.text || ""))
    );
  }

  for (const text of candidates) {
    if (text.trim()) return text.trim();
  }

  return "";
}

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

// ---------------------------------------------------------------------------

async function callGemini(apiKey, prompt) {
  const { model, endpoint } = PROVIDERS.gemini;
  const res = await fetchWithTimeout(
    endpoint(apiKey, model),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 },
      }),
    },
    15000
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini API 錯誤 ${res.status}`);
  }
  const json = await res.json();
  const parts = json?.candidates?.[0]?.content?.parts || [];
  const text = parts
    .map((p) => p?.text || extractMessageText(p))
    .join("")
    .trim();
  if (!text) {
    const reason = json?.candidates?.[0]?.finishReason;
    throw new Error(
      reason && reason !== "STOP"
        ? `Gemini 無法產生翻譯 (${reason})`
        : "Gemini 回應為空"
    );
  }
  return text;
}

async function callMiniMax(apiKey, prompt) {
  const { model, endpoints } = PROVIDERS.minimax;
  let lastError = new Error("MiniMax 回應為空");

  for (const endpoint of endpoints) {
    try {
      const text = await callMiniMaxAt(endpoint, apiKey, prompt, model);
      if (text) return text;
      lastError = new Error("MiniMax 回應為空");
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

async function callMiniMaxAt(endpoint, apiKey, prompt, model) {
  const res = await fetchWithTimeout(
    endpoint,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", name: "user", content: prompt }],
        temperature: 0.7,
        reasoning_split: true,
      }),
    },
    20000
  );

  const text_raw = await res.text();
  if (!res.ok) {
    let err = {};
    try {
      err = JSON.parse(text_raw);
    } catch (_) {}
    const baseMsg = err?.base_resp?.status_msg || err?.error?.message || err?.message;
    throw new Error(
      baseMsg || `MiniMax API 錯誤 ${res.status}: ${text_raw.slice(0, 200)}`
    );
  }

  let json;
  try {
    json = JSON.parse(text_raw);
  } catch (_) {
    throw new Error(`MiniMax 回應格式錯誤: ${text_raw.slice(0, 200)}`);
  }

  const text = extractMiniMaxText(json);
  if (!text) {
    console.warn("MiniMax empty extract:", endpoint, text_raw.slice(0, 500));
    throw new Error("MiniMax 回應為空");
  }
  return text;
}

async function callOpenAICompat({ model, endpoint }, apiKey, prompt) {
  const res = await fetchWithTimeout(
    endpoint(),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      }),
    },
    15000
  );
  console.log("MiniMax raw response status:", res.status);
  const text_raw = await res.text();
  console.log("MiniMax raw response:", text_raw);
  if (!res.ok) {
    let err = {};
    try { err = JSON.parse(text_raw); } catch (_) {}
    throw new Error(
      err.error?.message || err.message || `API 錯誤 ${res.status}: ${text_raw.slice(0, 200)}`
    );
  }
  const json = JSON.parse(text_raw);
  // MiniMax 錯誤格式：base_resp.status_code
  if (json?.base_resp?.status_code !== undefined && json?.base_resp?.status_code !== 0) {
    throw new Error(`MiniMax API 錯誤 ${json?.base_resp?.status_code}: ${json?.base_resp?.status_msg || "未知錯誤"}`);
  }
  // 各家 OpenAI 相容 API 可能的多種回應格式
  const text =
    extractMessageText(json?.choices?.[0]?.message?.content) ||
    json?.choices?.[0]?.text ||
    extractMessageText(json?.data?.choices?.[0]?.message?.content) ||
    json?.data?.text ||
    json?.text ||
    json?.output?.text ||
    json?.result?.text ||
    json?.response?.text ||
    extractMessageText(json?.reply?.content) ||
    extractMessageText(json?.choices?.[0]?.content) ||
    extractMessageText(json?.data?.[0]?.message?.content) ||
    "";
  if (!text) throw new Error(`API 回應為空，回應: ${text_raw.slice(0, 300)}`);
  return text.trim();
}

async function callClaude(apiKey, prompt) {
  const { model, endpoint } = PROVIDERS.claude;
  const res = await fetchWithTimeout(
    endpoint(),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    },
    15000
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Claude API 錯誤 ${res.status}`);
  }
  const json = await res.json();
  const text = json?.content?.[0]?.text || "";
  if (!text) throw new Error("Claude 回應為空");
  return text.trim();
}

// ---------------------------------------------------------------------------

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (e) {
    if (e.name === "AbortError") throw new Error("請求逾時");
    throw e;
  } finally {
    clearTimeout(id);
  }
}
