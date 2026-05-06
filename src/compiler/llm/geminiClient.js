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
 * Fixes: "String contains non ISO-8859-1 code point" fetch errors
 */
function sanitizeApiKey(key) {
  if (!key) return '';
  // Remove all non-printable-ASCII characters (keep only 0x20-0x7E)
  return key.replace(/[^\x20-\x7E]/g, '').trim();
}

/**
 * Call Gemini/Gemma API with structured JSON output
 * Both use the same Google generativelanguage endpoint, just different model IDs
 */
async function callGemini(apiKey, prompt, systemPrompt, jsonSchema, temperature = 0.1, modelOverride = null) {
  const cleanKey = sanitizeApiKey(apiKey);
  const model = modelOverride || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;

  const body = {
    contents: [
      ...(systemPrompt ? [{ role: 'user', parts: [{ text: `SYSTEM INSTRUCTIONS: ${systemPrompt}` }] }, { role: 'model', parts: [{ text: 'Understood. I will follow these instructions precisely.' }] }] : []),
      { role: 'user', parts: [{ text: prompt }] },
    ],
    generationConfig: {
      temperature,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
      // Gemma models may struggle with complex responseSchema, so skip it
      ...(!model.startsWith('gemma') && jsonSchema ? { responseSchema: jsonSchema } : {}),
    },
  };

  // Note: Gemma 4 26B does NOT support thinkingConfig

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    // Handle rate limiting (429) for Gemini/Gemma API
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

  const text = data.candidates[0].content.parts[0].text;
  const tokensIn = data.usageMetadata?.promptTokenCount || 0;
  const tokensOut = data.usageMetadata?.candidatesTokenCount || 0;

  return { text, tokensIn, tokensOut };
}

/**
 * Call Groq API with JSON mode
 * Uses llama-3.1-8b-instant for much higher free-tier TPM (~131K vs 6K for 70B)
 */
async function callGroq(apiKey, prompt, systemPrompt, jsonSchema, temperature = 0.1, stageName = 'default') {
  const url = 'https://api.groq.com/openai/v1/chat/completions';

  const messages = [];
  if (systemPrompt) {
    // Aggressively trim system prompt for Groq to save tokens
    const trimmedSystem = systemPrompt.length > 500
      ? systemPrompt.slice(0, 500) + '\n[Follow ALL rules above strictly. Output valid JSON only. Every UI component MUST have a unique non-null "id" field.]'
      : systemPrompt;
    messages.push({ role: 'system', content: trimmedSystem });
  }

  // For Groq: DON'T dump full JSON schema into prompt (massive token waste).
  // Instead, describe the expected structure concisely.
  let enhancedPrompt = prompt;
  // Trim the prompt itself if it's too large (e.g., contains huge JSON from prior stages)
  if (enhancedPrompt.length > 3000) {
    // Find the JSON block and compress it
    const jsonStart = enhancedPrompt.indexOf('{');
    const jsonEnd = enhancedPrompt.lastIndexOf('}');
    if (jsonStart > 0 && jsonEnd > jsonStart) {
      try {
        const jsonPart = enhancedPrompt.slice(jsonStart, jsonEnd + 1);
        const parsed = JSON.parse(jsonPart);
        // Re-serialize without indentation to save tokens
        const compact = JSON.stringify(parsed);
        enhancedPrompt = enhancedPrompt.slice(0, jsonStart) + compact + enhancedPrompt.slice(jsonEnd + 1);
      } catch (e) {
        // If parsing fails, just truncate
      }
    }
  }

  if (jsonSchema) {
    // Extract just the top-level required fields as a compact guide
    const requiredFields = jsonSchema.required || Object.keys(jsonSchema.properties || {});
    enhancedPrompt += `\n\nRespond with valid JSON containing these top-level keys: ${requiredFields.join(', ')}. Follow the structure described above precisely.`;
  }

  messages.push({ role: 'user', content: enhancedPrompt });

  // Use stage-specific token limits
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
    // Extract retry-after hint from 429 errors
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
 * Custom error class for rate limits — carries the wait duration
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
 * @param {Object} options
 * @param {string} options.provider - 'gemini' or 'groq'
 * @param {string} options.apiKey - API key
 * @param {string} options.prompt - User prompt
 * @param {string} options.systemPrompt - System instructions
 * @param {Object} options.jsonSchema - JSON Schema for structured output
 * @param {number} options.temperature - Temperature (0.0-1.0)
 * @param {number} options.maxRetries - Max retry attempts
 * @param {string} options.stageName - For metrics tracking
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
      // If last error was a rate limit, wait the specified duration
      let delay;
      if (lastError instanceof RateLimitError) {
        // For rate limits, wait at least 45s or the server-specified time
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
        // Try to extract JSON from the response
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error(`Failed to parse JSON from LLM response: ${parseErr.message}`);
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
