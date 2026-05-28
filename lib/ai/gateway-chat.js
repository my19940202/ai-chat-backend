import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getEnv } from '@/lib/env';

/**
 * Cloudflare AI Gateway + Workers AI 聊天封装
 * 支持：
 *  - AI Gateway 代理的 OpenAI 兼容模型（推荐，支持 BYOK / 统一限速 / 日志）
 *  - 直接调用 Workers AI 文本模型（@cf/...）
 *
 * 流式返回：ReadableStream<Uint8Array>（SSE 格式，data: {...}\n\n）
 */

/**
 * 获取 AI Gateway 实例（通过 env.AI）
 */
async function getAIGateway(gatewayId) {
  const ctx = await getCloudflareContext();
  const ai = ctx?.env?.AI;
  if (!ai || typeof ai.gateway !== 'function') {
    throw new Error('AI binding 未找到或不支持 gateway，请确认 wrangler.jsonc 中配置了 "ai" 绑定');
  }
  return ai.gateway(gatewayId || getEnv('AI_GATEWAY_ID', 'default'));
}

/**
 * 流式聊天（优先尝试 AI Gateway OpenAI 兼容端点）
 * 如果没有 OPENAI_API_KEY 或 gateway 不可用，则回退到 Workers AI 直连。
 *
 * @param {Array<{role: 'user'|'assistant'|'system', content: string}>} messages
 * @param {Object} opts
 * @returns {Promise<ReadableStream<Uint8Array>>}
 */
export async function streamChatCompletion(messages, opts = {}) {
  const model = opts.model || getEnv('DEFAULT_MODEL', 'gpt-4o-mini');
  const temperature = typeof opts.temperature === 'number' ? opts.temperature : 0.7;
  const maxTokens = opts.maxTokens || 2048;
  const gatewayId = opts.gatewayId || getEnv('AI_GATEWAY_ID', 'ai-chat');
  const userId = opts.userId || 'anonymous';

  const apiKey = getEnv('OPENAI_API_KEY', '');

  // 优先走 AI Gateway（OpenAI 兼容）
  if (apiKey && gatewayId) {
    try {
      const gateway = await getAIGateway(gatewayId);
      const resp = await gateway.fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: true,
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        console.warn('[gateway-chat] AI Gateway 返回非 200，尝试回退 Workers AI:', resp.status, errText);
        throw new Error(`Gateway error ${resp.status}`);
      }

      // 直接透传 SSE 流（OpenAI 格式）
      return resp.body;
    } catch (e) {
      console.warn('[gateway-chat] Gateway 失败，回退 Workers AI:', e.message);
    }
  }

  // 回退：直接 Workers AI 文本模型（@cf/meta/llama-3.1-8b-instruct 等）
  return streamWorkersAIChat(messages, { model, temperature, maxTokens, userId });
}

/**
 * 使用 Workers AI 直连流式生成（@cf/... 模型）
 */
async function streamWorkersAIChat(messages, opts) {
  const ctx = await getCloudflareContext();
  const ai = ctx?.env?.AI;
  if (!ai || typeof ai.run !== 'function') {
    throw new Error('AI binding 未找到：无法调用 Workers AI');
  }

  // 将 messages 转为 prompt（简单拼接，生产建议用更好模板）
  const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n') + '\nassistant:';

  const model = opts.model && opts.model.startsWith('@cf/')
    ? opts.model
    : '@cf/meta/llama-3.1-8b-instruct';

  const stream = await ai.run(model, {
    prompt,
    stream: true,
    temperature: opts.temperature,
    max_tokens: opts.maxTokens,
  }, {
    gateway: { id: getEnv('AI_GATEWAY_ID', 'default') },
  });

  // Workers AI 流式（stream: true）返回的是 SSE 格式：
  //   data: {"response":"很","p":"abc"}\n\n
  //   data: [DONE]\n\n
  // 这里把每个 SSE 事件解析出来，提取 response/delta，重新封装成 OpenAI 兼容的 delta 格式。
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const emitDelta = (controller, delta) => {
    if (!delta) return;
    controller.enqueue(
      encoder.encode(
        `data: ${JSON.stringify({ choices: [{ delta: { content: delta } }] })}\n\n`
      )
    );
  };

  const parseSSEEvent = (eventText) => {
    // 一个 SSE event 可能有多行 data:
    const deltas = [];
    for (const line of eventText.split('\n')) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const obj = JSON.parse(data);
        const d = obj.response ?? obj.delta ?? obj.choices?.[0]?.delta?.content ?? '';
        if (d) deltas.push(d);
      } catch {
        // 不是 JSON，按纯文本处理
        deltas.push(data);
      }
    }
    return deltas.join('');
  };

  return new ReadableStream({
    async start(controller) {
      try {
        if (stream && typeof stream.getReader === 'function') {
          const reader = stream.getReader();
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += typeof value === 'string'
              ? value
              : decoder.decode(value, { stream: true });

            // 按 SSE 事件边界切分（\n\n）
            const events = buffer.split('\n\n');
            buffer = events.pop() || '';

            for (const event of events) {
              if (!event.trim()) continue;
              emitDelta(controller, parseSSEEvent(event));
            }
          }
          // 处理收尾残留
          if (buffer.trim()) emitDelta(controller, parseSSEEvent(buffer));
        } else if (stream && typeof stream.response === 'string') {
          // 非流式 fallback：{ response: '...' }
          emitDelta(controller, stream.response);
        } else {
          const fallback = typeof stream === 'string' ? stream : '';
          if (fallback) emitDelta(controller, fallback);
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (err) {
        console.error('[streamWorkersAIChat] error', err);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });
}

/**
 * 非流式单次调用（用于标题生成等辅助场景）
 */
export async function chatCompletion(messages, opts = {}) {
  const model = opts.model || getEnv('DEFAULT_MODEL', 'gpt-4o-mini');
  const gatewayId = opts.gatewayId || getEnv('AI_GATEWAY_ID', 'ai-chat');
  const apiKey = getEnv('OPENAI_API_KEY', '');

  if (apiKey && gatewayId) {
    try {
      const gateway = await getAIGateway(gatewayId);
      const resp = await gateway.fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: opts.temperature ?? 0.3,
          max_tokens: opts.maxTokens ?? 256,
          stream: false,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        return data.choices?.[0]?.message?.content || '';
      }
    } catch (e) {
      console.warn('[chatCompletion] gateway failed, fallback', e.message);
    }
  }

  // Workers AI fallback (非流)
  const ctx = await getCloudflareContext();
  const ai = ctx?.env?.AI;
  const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n') + '\nassistant:';
  const res = await ai.run('@cf/meta/llama-3.1-8b-instruct', { prompt, temperature: 0.3, max_tokens: 256 });
  return res?.response || '';
}
