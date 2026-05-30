import { NextRequest, NextResponse } from 'next/server'
import { getD1, execute, queryOne } from '@/lib/d1'
import { parseUserIdFromToken } from '@/lib/auth'

const DEFAULT_USER = 'demo-user'

function resolveUserId(req: NextRequest): string | null {
  const fromQuery = req.nextUrl.searchParams.get('userId')
  if (fromQuery) return fromQuery

  const auth = req.headers.get('Authorization')
  if (auth?.startsWith('Bearer ')) {
    return parseUserIdFromToken(auth.slice(7))
  }
  return null
}

/**
 * GET /api/conversations/[id] → 获取会话详情 + 最近消息
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const userId = resolveUserId(req) || DEFAULT_USER

  try {
    const db = await getD1()
    const conv = await queryOne(
      `SELECT * FROM conversations WHERE id = ? AND user_id = ?`,
      [id, userId]
    )
    if (!conv) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 })
    }

    const messages = await db
      .prepare(`SELECT id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`)
      .bind(id)
      .all()

    return NextResponse.json({ conversation: conv, messages: messages.results || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

/**
 * PATCH /api/conversations/[id] → 更新标题
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const userId = resolveUserId(req) || DEFAULT_USER
  try {
    const { title } = await req.json()
    if (!title) return NextResponse.json({ error: 'title 必填' }, { status: 400 })

    await execute(
      `UPDATE conversations SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
      [title.slice(0, 80), Date.now(), id, userId]
    )
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

/**
 * DELETE /api/conversations/[id]
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const userId = resolveUserId(req) || DEFAULT_USER
  try {
    await execute(`DELETE FROM conversations WHERE id = ? AND user_id = ?`, [id, userId])
    // messages 由外键 CASCADE 自动删除
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
