import { NextRequest, NextResponse } from 'next/server'
import { getD1, queryAll, execute, genId } from '@/lib/d1'

const DEFAULT_USER = 'demo-user'

/**
 * GET /api/conversations?userId=xxx
 * 返回当前用户的最近 50 条会话
 */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId') || DEFAULT_USER
  try {
    const convos = await queryAll(
      `SELECT id, title, model, created_at, updated_at
       FROM conversations
       WHERE user_id = ?
       ORDER BY updated_at DESC
       LIMIT 50`,
      [userId]
    )
    return NextResponse.json({ conversations: convos })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

/**
 * POST /api/conversations
 * body: { title?, model?, userId? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const userId = body.userId || DEFAULT_USER
    const title = body.title || '新对话'
    const model = body.model || 'gpt-4o-mini'

    const id = genId()
    const now = Date.now()

    await execute(
      `INSERT INTO conversations (id, user_id, title, model, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, userId, title, model, now, now]
    )

    return NextResponse.json({ id, title, model, created_at: now, updated_at: now })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
