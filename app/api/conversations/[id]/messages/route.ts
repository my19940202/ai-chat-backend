import { NextRequest, NextResponse } from 'next/server'
import { getD1 } from '@/lib/d1'

/**
 * GET /api/conversations/[id]/messages
 * 仅返回消息列表（轻量）
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const db = await getD1()
    const res = await db
      .prepare(`SELECT id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`)
      .bind(id)
      .all()
    return NextResponse.json({ messages: res.results || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
