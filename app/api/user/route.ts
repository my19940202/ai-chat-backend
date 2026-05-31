import { NextRequest } from 'next/server'
import { execute, genId, queryOne } from '@/lib/d1'
import {
  createToken,
  hashPassword,
  jsonResponse,
  parseUserIdFromToken,
} from '@/lib/auth'
import { buildQuotaSummary, ensureQuotaCountersFresh } from '@/lib/quota'

interface UserRow {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
  password_hash: string | null
  created_at: number
  last_login_at: number | null
  plan_tier?: string
  plan_status?: string
  daily_standard_used?: number
  monthly_standard_used?: number
  monthly_premium_used?: number
  last_daily_reset_at?: number | null
  last_monthly_reset_at?: number | null
  credit?: number
}

interface UserActionBody {
  action: 'register' | 'login' | 'updateProfile'
  email?: string
  password?: string
  name?: string
  avatar_url?: string
}

const USER_SELECT_FIELDS = `
  id, email, name, avatar_url, created_at, last_login_at,
  plan_tier, plan_status, daily_standard_used, monthly_standard_used,
  monthly_premium_used, last_daily_reset_at, last_monthly_reset_at, credit
`

function sanitizeUser(row: UserRow) {
  const quota = buildQuotaSummary(row as unknown as Record<string, unknown>)
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatar_url: row.avatar_url,
    created_at: row.created_at,
    last_login_at: row.last_login_at,
    ...quota,
  }
}

async function getUserById(userId: string) {
  const user = (await queryOne(
    `SELECT ${USER_SELECT_FIELDS} FROM users WHERE id = ?`,
    [userId],
  )) as UserRow | null

  if (!user) return null
  return (await ensureQuotaCountersFresh(
    user as unknown as Record<string, unknown>,
  )) as unknown as UserRow
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

  const user = await getUserById(userId)

  if (!user) {
    return jsonResponse({ error: '用户不存在' }, 404, origin)
  }

  return jsonResponse({ user: sanitizeUser(user) }, 200, origin)
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')
  try {
    const body = (await req.json()) as UserActionBody
    const { action, email, password, name, avatar_url } = body

    if (action === 'updateProfile') {
      const authHeader = req.headers.get('Authorization')
      const token = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7)
        : null
      const userId = token ? parseUserIdFromToken(token) : null

      if (!userId) {
        return jsonResponse({ error: '未授权' }, 401, origin)
      }

      const updates: string[] = []
      const params: unknown[] = []

      if (name !== undefined) {
        updates.push('name = ?')
        params.push(name?.trim() || null)
      }
      if (avatar_url !== undefined) {
        updates.push('avatar_url = ?')
        params.push(avatar_url || null)
      }

      if (updates.length === 0) {
        return jsonResponse({ error: '没有可更新的字段' }, 400, origin)
      }

      params.push(userId)
      await execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params)

      const user = await getUserById(userId)
      if (!user) {
        return jsonResponse({ error: '用户不存在' }, 404, origin)
      }

      return jsonResponse({ user: sanitizeUser(user) }, 200, origin)
    }

    if (!action || !email || !password) {
      return jsonResponse({ error: '缺少必要参数' }, 400, origin)
    }

    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail || password.length < 6) {
      return jsonResponse({ error: '邮箱无效或密码至少 6 位' }, 400, origin)
    }

    const passwordHash = await hashPassword(password)
    const now = Date.now()
    const dayStart = Date.UTC(
      new Date(now).getUTCFullYear(),
      new Date(now).getUTCMonth(),
      new Date(now).getUTCDate(),
    )
    const monthStart = Date.UTC(
      new Date(now).getUTCFullYear(),
      new Date(now).getUTCMonth(),
      1,
    )

    if (action === 'register') {
      const existing = await queryOne(
        'SELECT id FROM users WHERE email = ?',
        [normalizedEmail],
      )

      if (existing) {
        return jsonResponse({ error: '该邮箱已注册' }, 409, origin)
      }

      const userId = genId()

      await execute(
        `INSERT INTO users (
          id, email, name, password_hash, created_at, last_login_at,
          plan_tier, plan_status, daily_standard_used, monthly_standard_used,
          monthly_premium_used, last_daily_reset_at, last_monthly_reset_at, credit
        ) VALUES (?, ?, ?, ?, ?, ?, 'free', 'active', 0, 0, 0, ?, ?, 0)`,
        [
          userId,
          normalizedEmail,
          name?.trim() || null,
          passwordHash,
          now,
          now,
          dayStart,
          monthStart,
        ],
      )

      const token = createToken(userId)
      return jsonResponse({
        token,
        user: {
          id: userId,
          email: normalizedEmail,
          name: name?.trim() || null,
          avatar_url: null,
          created_at: now,
          plan_tier: 'free',
          plan_status: 'active',
          daily_standard_used: 0,
          monthly_standard_used: 0,
          monthly_premium_used: 0,
          credit: 0,
          limits: {
            daily_standard: 10,
            monthly_standard: null,
            monthly_premium: 0,
            unlimited: false,
          },
        },
      }, 200, origin)
    }

    if (action === 'login') {
      const user = await queryOne(
        `SELECT id, email, name, avatar_url, password_hash, created_at,
                plan_tier, plan_status, daily_standard_used, monthly_standard_used,
                monthly_premium_used, last_daily_reset_at, last_monthly_reset_at, credit
         FROM users WHERE email = ?`,
        [normalizedEmail],
      ) as UserRow | null

      if (!user || !user.password_hash || user.password_hash !== passwordHash) {
        return jsonResponse({ error: '邮箱或密码错误' }, 401, origin)
      }

      await execute('UPDATE users SET last_login_at = ? WHERE id = ?', [now, user.id])

      const refreshed = await getUserById(user.id)
      const token = createToken(user.id)
      return jsonResponse({ token, user: sanitizeUser(refreshed || user) }, 200, origin)
    }

    return jsonResponse({ error: '未知 action' }, 400, origin)
  } catch (err: unknown) {
    console.error('[api/user] error', err)
    const message = err instanceof Error ? err.message : '服务器错误'
    return jsonResponse({ error: message }, 500, origin)
  }
}
