/**
 * Unified LLM Client — supports Google Gemini and Groq
 * Features: structured JSON output, retry with backoff, metrics tracking
 * 
 * Groq free tier: 12,000 TPM, 30 RPM — we use conservative token limits
 * and inter-stage delays to stay well within bounds.
 */

const PROVIDERS = {
  GEMINI: 'gemini',
  GEMMA: 'gemma',
  GROQ: 'groq',
};

// Per-stage max_tokens for Groq (keeps each call within free-tier TPM)
const GROQ_TOKEN_LIMITS = {
  'intent-extraction': 2000,
  'system-design': 3000,
  'schema-generation': 4000,
  'refinement-cycle-1': 4000,
  'refinement-cycle-2': 4000,
  'refinement-cycle-3': 4000,
  'default': 3000,
};

// Token/cost tracking
let metrics = {
  totalCalls: 0,
  totalTokensIn: 0,
  totalTokensOut: 0,
  totalLatencyMs: 0,
  callHistory: [],
};

export function getMetrics() {
  return { ...metrics };
}

export function resetMetrics() {
  metrics = {
    totalCalls: 0,
    totalTokensIn: 0,
    totalTokensOut: 0,
    totalLatencyMs: 0,
    callHistory: [],
  };
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Sanitize API key — strip non-ASCII chars, whitespace, and invisible Unicode
 */
function sanitizeApiKey(key) {
  if (!key) return '';
  return key.replace(/[^\x20-\x7E]/g, '').trim();
}

/**
 * Strip Gemma 4 thinking tags and extract JSON from response text.
 * Gemma 4 outputs <think>...</think> before its actual JSON answer.
 * Also handles cases where JSON is embedded in markdown code blocks.
 */
function extractJsonFromGemmaResponse(text) {
  if (!text) return text;

  // 1. Strip <think>...</think> blocks (Gemma 4 reasoning traces)
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // 2. Strip markdown code fences  ```json ... ``` or ``` ... ```
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

  // 3. If still not starting with { or [, find the first JSON object/array
  if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
    const jsonStart = cleaned.search(/[\[{]/);
    if (jsonStart !== -1) {
      cleaned = cleaned.slice(jsonStart);
    }
  }

  // 4. Find the matching closing bracket to handle trailing text
  if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
    const opener = cleaned[0];
    const closer = opener === '{' ? '}' : ']';
    let depth = 0;
    let inString = false;
    let escape = false;
    let end = -1;

    for (let i = 0; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (escape) { escape = false; continue; }
      if (ch === '\\' && inString) { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === opener) depth++;
      else if (ch === closer) {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }

    if (end !== -1) {
      cleaned = cleaned.slice(0, end + 1);
    }
  }

  return cleaned;
}

/**
 * Call Gemini/Gemma API with structured JSON output
 */
async function callGemini(apiKey, prompt, systemPrompt, jsonSchema, temperature = 0.1, modelOverride = null) {
  const cleanKey = sanitizeApiKey(apiKey);
  const model = modelOverride || 'gemini-2.0-flash';
  const isGemma = model.startsWith('gemma');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;

  const body = {
    contents: [
      ...(systemPrompt ? [
        { role: 'user', parts: [{ text: `SYSTEM INSTRUCTIONS: ${systemPrompt}` }] },
        { role: 'model', parts: [{ text: 'Understood. I will follow these instructions precisely.' }] }
      ] : []),
      { role: 'user', parts: [{ text: prompt }] },
    ],
    generationConfig: {
      temperature,
      maxOutputTokens: 8192,
      // Gemma 4 supports responseMimeType but thinking output can prefix it,
      // so we handle JSON extraction manually for Gemma.
      responseMimeType: 'application/json',
      // Only pass responseSchema for non-Gemma models
      ...(!isGemma && jsonSchema ? { responseSchema: jsonSchema } : {}),
    },
  };

  // For Gemma 4: disable thinking mode to avoid <think> prefixes breaking JSON parse.
  // thinkingConfig with budget=0 turns thinking off.
  if (isGemma) {
    body.generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    if (response.status === 429) {
      const retryMatch = err.match(/"retryDelay":\s*"(\d+)s"/);
      const waitSec = retryMatch ? parseInt(retryMatch[1]) + 5 : 60;
      throw new RateLimitError(`Gemini rate limit hit — waiting ${waitSec}s`, waitSec);
    }
    throw new Error(`Gemini API error (${response.status}): ${err}`);
  }

  const data = await response.json();

  if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
    const finishReason = data.candidates?.[0]?.finishReason;
    if (finishReason === 'MAX_TOKENS') {
      throw new Error('Response truncated — output token limit reached. Try a simpler prompt.');
    }
    throw new Error(`Gemini returned empty response${finishReason ? ` (reason: ${finishReason})` : ''}`);
  }

  let text = data.candidates[0].content.parts[0].text;

  // For Gemma: strip thinking tags and extract clean JSON
  if (isGemma) {
    text = extractJsonFromGemmaResponse(text);
  }

  const tokensIn = data.usageMetadata?.promptTokenCount || 0;
  const tokensOut = data.usageMetadata?.candidatesTokenCount || 0;

  return { text, tokensIn, tokensOut };
}

/**
 * Call Groq API with JSON mode
 */
async function callGroq(apiKey, prompt, systemPrompt, jsonSchema, temperature = 0.1, stageName = 'default') {
  const url = 'https://api.groq.com/openai/v1/chat/completions';

  const messages = [];
  if (systemPrompt) {
    const trimmedSystem = systemPrompt.length > 500
      ? systemPrompt.slice(0, 500) + '\n[Follow ALL rules above strictly. Output valid JSON only. Every UI component MUST have a unique non-null "id" field.]'
      : systemPrompt;
    messages.push({ role: 'system', content: trimmedSystem });
  }

  let enhancedPrompt = prompt;
  if (enhancedPrompt.length > 3000) {
    const jsonStart = enhancedPrompt.indexOf('{');
    const jsonEnd = enhancedPrompt.lastIndexOf('}');
    if (jsonStart > 0 && jsonEnd > jsonStart) {
      try {
        const jsonPart = enhancedPrompt.slice(jsonStart, jsonEnd + 1);
        const parsed = JSON.parse(jsonPart);
        const compact = JSON.stringify(parsed);
        enhancedPrompt = enhancedPrompt.slice(0, jsonStart) + compact + enhancedPrompt.slice(jsonEnd + 1);
      } catch (e) {
        // If parsing fails, just continue
      }
    }
  }

  if (jsonSchema) {
    const requiredFields = jsonSchema.required || Object.keys(jsonSchema.properties || {});
    enhancedPrompt += `\n\nRespond with valid JSON containing these top-level keys: ${requiredFields.join(', ')}. Follow the structure described above precisely.`;
  }

  messages.push({ role: 'user', content: enhancedPrompt });

  const maxTokens = GROQ_TOKEN_LIMITS[stageName] || GROQ_TOKEN_LIMITS['default'];

  const body = {
    model: 'llama-3.1-8b-instant',
    messages,
    temperature,
    response_format: { type: 'json_object' },
    max_tokens: maxTokens,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sanitizeApiKey(apiKey)}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    if (response.status === 429) {
      const retryMatch = err.match(/try again in ([\d.]+)s/i);
      const waitSec = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) + 5 : 60;
      throw new RateLimitError(`Groq rate limit hit — waiting ${waitSec}s`, waitSec);
    }
    throw new Error(`Groq API error (${response.status}): ${err}`);
  }

  const data = await response.json();

  if (!data.choices?.[0]?.message?.content) {
    throw new Error('Groq returned empty response');
  }

  const text = data.choices[0].message.content;
  const tokensIn = data.usage?.prompt_tokens || 0;
  const tokensOut = data.usage?.completion_tokens || 0;

  return { text, tokensIn, tokensOut };
}

/**
 * Custom error class for rate limits
 */
class RateLimitError extends Error {
  constructor(message, waitSeconds) {
    super(message);
    this.name = 'RateLimitError';
    this.waitSeconds = waitSeconds;
  }
}

/**
 * Main LLM call with retry logic
 */
export async function callLLM({
  provider = PROVIDERS.GEMINI,
  apiKey,
  prompt,
  systemPrompt = '',
  jsonSchema = null,
  temperature = 0.1,
  maxRetries = 5,
  stageName = 'unknown',
}) {
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      let delay;
      if (lastError instanceof RateLimitError) {
        delay = Math.max(lastError.waitSeconds * 1000, 45000);
        console.log(`[LLM] Rate limit hit for ${stageName}. Waiting ${Math.round(delay / 1000)}s before retry ${attempt}/${maxRetries}...`);
      } else {
        delay = Math.min(1000 * Math.pow(2, attempt - 1), 15000);
        console.log(`[LLM] Retry ${attempt}/${maxRetries} for ${stageName} after ${delay}ms...`);
      }
      await sleep(delay);
    }

    const startTime = Date.now();

    try {
      let result;

      if (provider === PROVIDERS.GEMINI) {
        result = await callGemini(apiKey, prompt, systemPrompt, jsonSchema, temperature);
      } else if (provider === PROVIDERS.GEMMA) {
        result = await callGemini(apiKey, prompt, systemPrompt, jsonSchema, temperature, 'gemma-4-26b-a4b-it');
      } else if (provider === PROVIDERS.GROQ) {
        result = await callGroq(apiKey, prompt, systemPrompt, jsonSchema, temperature, stageName);
      } else {
        throw new Error(`Unknown provider: ${provider}`);
      }

      const latencyMs = Date.now() - startTime;

      // Parse JSON
      let parsed;
      try {
        parsed = JSON.parse(result.text);
      } catch (parseErr) {
        // Try to extract JSON from the response (handles any remaining wrapper text)
        const extracted = extractJsonFromGemmaResponse(result.text);
        try {
          parsed = JSON.parse(extracted);
        } catch {
          // Last resort: find any JSON object in the text
          const jsonMatch = result.text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error(`Failed to parse JSON from LLM response: ${parseErr.message}\nRaw (first 200 chars): ${result.text.slice(0, 200)}`);
          }
        }
      }

      // Track metrics
      const callRecord = {
        stageName,
        provider,
        attempt,
        latencyMs,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        success: true,
        timestamp: new Date().toISOString(),
      };

      metrics.totalCalls++;
      metrics.totalTokensIn += result.tokensIn;
      metrics.totalTokensOut += result.tokensOut;
      metrics.totalLatencyMs += latencyMs;
      metrics.callHistory.push(callRecord);

      return {
        data: parsed,
        metrics: callRecord,
      };

    } catch (error) {
      lastError = error;
      const latencyMs = Date.now() - startTime;

      metrics.callHistory.push({
        stageName,
        provider,
        attempt,
        latencyMs,
        tokensIn: 0,
        tokensOut: 0,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });

      // Don't retry on auth errors
      if (error.message.includes('401') || error.message.includes('403')) {
        throw new Error(`Authentication failed for ${provider}: ${error.message}`);
      }

      console.error(`[LLM] Attempt ${attempt} failed for ${stageName}:`, error.message);
    }
  }

  throw new Error(`LLM call failed after ${maxRetries + 1} attempts for ${stageName}: ${lastError?.message}`);
}

export { PROVIDERS };
