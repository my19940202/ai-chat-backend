import { NextRequest } from 'next/server'
import { execute, genId, queryOne } from '@/lib/d1'
import {
  createToken,
  hashPassword,
  jsonResponse,
  parseUserIdFromToken,
} from '@/lib/auth'

interface UserRow {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
  password_hash: string | null
  created_at: number
  last_login_at: number | null
}

interface UserActionBody {
  action: 'register' | 'login'
  email?: string
  password?: string
  name?: string
}

function sanitizeUser(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatar_url: row.avatar_url,
  }
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin')
  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null
  const userId = token ? parseUserIdFromToken(token) : null

  if (!userId) {
    return jsonResponse({ error: '未授权' }, 401, origin)
  }

  const user = await queryOne(
    'SELECT id, email, name, avatar_url, created_at, last_login_at FROM users WHERE id = ?',
    [userId],
  ) as UserRow | null

  if (!user) {
    return jsonResponse({ error: '用户不存在' }, 404, origin)
  }

  return jsonResponse({ user: sanitizeUser(user) }, 200, origin)
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')
  try {
    const body = (await req.json()) as UserActionBody
    const { action, email, password, name } = body

    if (!action || !email || !password) {
      return jsonResponse({ error: '缺少必要参数' }, 400, origin)
    }

    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail || password.length < 6) {
      return jsonResponse({ error: '邮箱无效或密码至少 6 位' }, 400, origin)
    }

    const passwordHash = await hashPassword(password)

    if (action === 'register') {
      const existing = await queryOne(
        'SELECT id FROM users WHERE email = ?',
        [normalizedEmail],
      )

      if (existing) {
        return jsonResponse({ error: '该邮箱已注册' }, 409, origin)
      }

      const userId = genId()
      const now = Date.now()

      await execute(
        `INSERT INTO users (id, email, name, password_hash, created_at, last_login_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, normalizedEmail, name?.trim() || null, passwordHash, now, now],
      )

      const token = createToken(userId)
      return jsonResponse({
        token,
        user: {
          id: userId,
          email: normalizedEmail,
          name: name?.trim() || null,
          avatar_url: null,
        },
      }, 200, origin)
    }

    if (action === 'login') {
      const user = await queryOne(
        'SELECT id, email, name, avatar_url, password_hash FROM users WHERE email = ?',
        [normalizedEmail],
      ) as UserRow | null

      if (!user || !user.password_hash || user.password_hash !== passwordHash) {
        return jsonResponse({ error: '邮箱或密码错误' }, 401, origin)
      }

      const now = Date.now()
      await execute('UPDATE users SET last_login_at = ? WHERE id = ?', [now, user.id])

      const token = createToken(user.id)
      return jsonResponse({ token, user: sanitizeUser(user) }, 200, origin)
    }

    return jsonResponse({ error: '未知 action' }, 400, origin)
  } catch (err: unknown) {
    console.error('[api/user] error', err)
    const message = err instanceof Error ? err.message : '服务器错误'
    return jsonResponse({ error: message }, 500, origin)
  }
}
