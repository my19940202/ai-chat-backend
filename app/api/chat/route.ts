import { NextRequest } from 'next/server'
import { getD1, execute, genId, queryOne } from '@/lib/d1'
import { streamChatCompletion, chatCompletion } from '@/lib/ai/gateway-chat'
import { corsHeaders, parseUserIdFromToken } from '@/lib/auth'
import {
  checkQuota,
  ensureQuotaCountersFresh,
  getQuotaTypeForModel,
  recordUsage,
} from '@/lib/quota'

// export const runtime = 'edge' // 推荐在 CF Workers / OpenNext 上使用 edge runtime

interface ChatRequest {
  conversationId?: string
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  model?: string
  userId?: string
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')
  try {
    const body = (await req.json()) as ChatRequest
    const authHeader = req.headers.get('Authorization')
    const tokenUserId = authHeader?.startsWith('Bearer ')
      ? parseUserIdFromToken(authHeader.slice(7))
      : null
    const { conversationId, messages, model, userId = tokenUserId ?? 'demo-user' } = body
    const effectiveModel = model || 'openai/gpt-4.1-mini'

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages 不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      })
    }

    const quotaType = getQuotaTypeForModel(effectiveModel)
    let planTier = 'free'

    if (userId && userId !== 'demo-user') {
      const userRow = await queryOne(
        `SELECT id, plan_tier, plan_status, daily_standard_used, monthly_standard_used,
                monthly_premium_used, last_daily_reset_at, last_monthly_reset_at, credit
         FROM users WHERE id = ?`,
        [userId],
      )

      if (userRow) {
        const freshUser = await ensureQuotaCountersFresh(userRow as Record<string, unknown>)
        planTier = String(freshUser.plan_tier || 'free')
        const quotaCheck = checkQuota(freshUser as Record<string, unknown>, quotaType)
        if (!quotaCheck.allowed) {
          return new Response(JSON.stringify({ error: quotaCheck.reason }), {
            status: 429,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
          })
        }
      }
    }

    const db = await getD1()
    let convId = conversationId

    // 1. 没有 conversationId → 创建新会话
    if (!convId) {
      convId = genId()
      const now = Date.now()
      await execute(
        `INSERT INTO conversations (id, user_id, title, model, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [convId, userId, '新对话', effectiveModel, now, now]
      )
    }

    // 2. 保存最后一条 user 消息（如果有）
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
    if (lastUserMsg) {
      const msgId = genId()
      await execute(
        `INSERT INTO messages (id, conversation_id, role, content, created_at)
         VALUES (?, ?, 'user', ?, ?)`,
        [msgId, convId, lastUserMsg.content, Date.now()]
      )
    }

    // 3. 启动流式生成
    const stream = await streamChatCompletion(messages, {
      model: effectiveModel,
      userId,
    })

    // 4. 包装流：一边透传给客户端，一边在结束时保存 assistant 完整回复 + 更新会话时间
    let fullAssistantText = ''

    const transform = new TransformStream({
      transform(chunk, controller) {
        controller.enqueue(chunk)

        // 尝试从 SSE chunk 中提取 delta 文本（简单解析）
        try {
          const text = new TextDecoder().decode(chunk)
          const lines = text.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim()
              if (data === '[DONE]') continue
              const json = JSON.parse(data)
              const delta = json.choices?.[0]?.delta?.content
              if (delta) fullAssistantText += delta
            }
          }
        } catch {
          // 忽略解析错误（Workers AI fallback 格式可能不同）
        }
      },
      async flush() {
        // 保存 assistant 消息 + 更新会话 updated_at
        if (fullAssistantText.trim()) {
          const msgId = genId()
          await execute(
            `INSERT INTO messages (id, conversation_id, role, content, created_at)
             VALUES (?, ?, 'assistant', ?, ?)`,
            [msgId, convId, fullAssistantText.trim(), Date.now()]
          ).catch(console.error)

          await execute(
            `UPDATE conversations SET updated_at = ? WHERE id = ?`,
            [Date.now(), convId]
          ).catch(console.error)

          if (userId && userId !== 'demo-user') {
            await recordUsage(
              userId,
              effectiveModel,
              quotaType,
              planTier as 'free' | 'pro' | 'max',
            ).catch(console.error)
          }

          // 自动生成标题（仅当标题还是“新对话”且有内容时）
          const conv = await db.prepare('SELECT title FROM conversations WHERE id = ?').bind(convId).first<{ title: string }>()
          if (conv?.title === '新对话' && messages.length >= 2) {
            const titlePrompt = [
              { role: 'system', content: '用 8-12 个字简洁概括以下对话的主题，直接返回标题，不要解释。' },
              { role: 'user', content: messages.slice(0, 3).map(m => m.content).join('\n') }
            ]
            chatCompletion(titlePrompt, { maxTokens: 32 })
              .then(title => {
                if (title && title.length > 2) {
                  execute(`UPDATE conversations SET title = ? WHERE id = ?`, [title.trim().slice(0, 60), convId]).catch(() => {})
                }
              })
              .catch(() => {})
          }
        }
      }
    })

    const transformed = stream.pipeThrough(transform)

    return new Response(transformed, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Conversation-Id': convId,
        ...corsHeaders(origin),
      },
    })
  } catch (err: any) {
    console.error('[api/chat] error', err)
    return new Response(JSON.stringify({ error: err.message || '服务器错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    })
  }
}
