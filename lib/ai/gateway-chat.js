import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getEnv } from '@/lib/env';

/**
 * Cloudflare AI Gateway 统一聊天封装（Plan B：env.AI.run 一招打天下）
 *
 * 通过 env.AI.run(model, params, { gateway: { id } }) 同时支持：
 *  - Workers AI 自家模型：'@cf/meta/llama-3.1-8b-instruct'、'@cf/moonshotai/kimi-k2.5' 等
 *  - 第三方模型（走 AI Gateway Unified Billing，从 CF 充值的 credits 扣费）：
 *      'openai/gpt-4.1-mini'、'openai/gpt-4.1'
 *      'anthropic/claude-3-5-sonnet-latest'
 *      'google/gemini-2.0-flash'
 *
 * 流式返回统一规范化为 OpenAI 兼容 SSE：
 *   data: {"choices":[{"delta":{"content":"..."}}]}\n\n
 *   data: [DONE]\n\n
 */

async function getAIBinding() {
  const ctx = await getCloudflareContext();
  const ai = ctx?.env?.AI;
  if (!ai || typeof ai.run !== 'function') {
    throw new Error('AI binding 未找到，请检查 wrangler.jsonc 中的 "ai" 配置');
  }
  return ai;
}

/**
 * 流式聊天
 * @param {Array<{role:'user'|'assistant'|'system', content:string}>} messages
 * @param {Object} opts { model, temperature, maxTokens, gatewayId }
 * @returns {Promise<ReadableStream<Uint8Array>>}
 */
export async function streamChatCompletion(messages, opts = {}) {
  const model = opts.model || getEnv('DEFAULT_MODEL', 'openai/gpt-4.1-mini');
  const temperature = typeof opts.temperature === 'number' ? opts.temperature : 0.7;
  const maxTokens = opts.maxTokens || 2048;
  const gatewayId = opts.gatewayId || getEnv('AI_GATEWAY_ID', 'ai-chat');

  const ai = await getAIBinding();

  // 同一套参数能同时被 Workers AI 与第三方 provider 接受
  const params = {
    messages,
    stream: true,
    max_tokens: maxTokens,
    temperature,
  };

  const upstream = await ai.run(model, params, {
    gateway: { id: gatewayId },
  });

  // upstream 为 ReadableStream<Uint8Array>，不同 provider 的事件字段不一样，
  // 统一规范化成 OpenAI 兼容 SSE
  return normalizeSSEStream(upstream);
}

/**
 * 非流式单次调用（用于标题生成等辅助场景）
 * 返回纯文本字符串
 */
export async function chatCompletion(messages, opts = {}) {
  const model = opts.model || getEnv('DEFAULT_MODEL', 'openai/gpt-4.1-mini');
  const gatewayId = opts.gatewayId || getEnv('AI_GATEWAY_ID', 'ai-chat');

  const ai = await getAIBinding();

  const res = await ai.run(
    model,
    {
      messages,
      stream: false,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 256,
    },
    { gateway: { id: gatewayId } }
  );

  return extractNonStreamingText(res);
}

// ---------------------------------------------------------------------------
// 内部工具
// ---------------------------------------------------------------------------

/**
 * 规范化 SSE 流：
 *  - Workers AI:    data: {"response":"...","p":"..."}\n\n
 *  - OpenAI:        data: {"choices":[{"delta":{"content":"..."}}]}\n\n
 *  - Anthropic:     data: {"type":"content_block_delta","delta":{"text":"..."}}\n\n
 *  - Gemini:        data: {"candidates":[{"content":{"parts":[{"text":"..."}]}}]}\n\n
 *
 * 统一输出 OpenAI 兼容格式，并在末尾固定发一次 [DONE]
 */
function normalizeSSEStream(upstream) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = '';

  const transform = new TransformStream({
    transform(chunk, controller) {
      buffer +=
        typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });

      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const ev of events) {
        const out = normalizeEvent(ev);
        if (out) controller.enqueue(encoder.encode(out));
      }
    },
    flush(controller) {
      if (buffer.trim()) {
        const out = normalizeEvent(buffer);
        if (out) controller.enqueue(encoder.encode(out));
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
    },
  });

  return upstream.pipeThrough(transform);
}

function normalizeEvent(eventText) {
  let delta = '';
  for (const rawLine of eventText.split('\n')) {
    const line = rawLine.trimStart();
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') continue;

    try {
      const obj = JSON.parse(data);
      delta += extractDelta(obj);
    } catch {
      // 不是 JSON，忽略（部分 provider 会发送注释/keep-alive 行）
    }
  }
  if (!delta) return null;
  return `data: ${JSON.stringify({
    choices: [{ delta: { content: delta } }],
  })}\n\n`;
}

function extractDelta(obj) {
  // OpenAI / Unified Billing OpenAI 路由
  const oai = obj?.choices?.[0]?.delta?.content;
  if (typeof oai === 'string') return oai;

  // Workers AI 文本流（@cf/...）
  if (typeof obj?.response === 'string') return obj.response;

  // Anthropic 流式 content_block_delta
  if (obj?.type === 'content_block_delta' && typeof obj?.delta?.text === 'string') {
    return obj.delta.text;
  }
  if (typeof obj?.delta?.text === 'string') return obj.delta.text;

  // Google Gemini 流式
  const gem = obj?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof gem === 'string') return gem;

  return '';
}

/**
 * 非流式响应取文本，兼容多 provider 返回
 */
function extractNonStreamingText(res) {
  if (!res) return '';
  if (typeof res === 'string') return res;

  // OpenAI 兼容
  const oai = res?.choices?.[0]?.message?.content;
  if (typeof oai === 'string') return oai;

  // Workers AI
  if (typeof res?.response === 'string') return res.response;

  // Anthropic（content 数组）
  if (Array.isArray(res?.content)) {
    return res.content
      .map((p) => (typeof p?.text === 'string' ? p.text : ''))
      .join('');
  }

  // Gemini
  const gem = res?.candidates?.[0]?.content?.parts
    ?.map((p) => p?.text || '')
    .join('');
  if (typeof gem === 'string') return gem;

  return '';
}
