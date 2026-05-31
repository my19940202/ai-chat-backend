import { NextRequest } from 'next/server'
import { execute, queryOne } from '@/lib/d1'
import { jsonResponse, parseUserIdFromToken } from '@/lib/auth'
import { buildObjectKey, getPublicUrl, getR2Bucket } from '@/lib/r2'
import { buildQuotaSummary, ensureQuotaCountersFresh } from '@/lib/quota'

const MAX_AVATAR_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

interface UserRow {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
  created_at: number
  last_login_at: number | null
  plan_tier?: string
  plan_status?: string
  daily_standard_used?: number
  monthly_standard_used?: number
  monthly_premium_used?: number
  credit?: number
}

function sanitizeUser(row: UserRow) {
  const quota = buildQuotaSummary(row as Record<string, unknown>)
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

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')
  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null
  const userId = token ? parseUserIdFromToken(token) : null

  if (!userId) {
    return jsonResponse({ error: '未授权' }, 401, origin)
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file')

    if (!file || typeof file === 'string') {
      return jsonResponse({ error: '请上传图片文件' }, 400, origin)
    }

    const blob = file as File
    const contentType = blob.type || 'application/octet-stream'

    if (!ALLOWED_TYPES.has(contentType)) {
      return jsonResponse({ error: '仅支持 JPG、PNG、WebP、GIF 格式' }, 400, origin)
    }

    if (blob.size > MAX_AVATAR_SIZE) {
      return jsonResponse({ error: '图片大小不能超过 5MB' }, 400, origin)
    }

    const ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg'
    const objectKey = buildObjectKey({
      type: 'avatars',
      userId,
      fileName: `avatar.${ext}`,
    })

    const bucket = await getR2Bucket()
    const buffer = await blob.arrayBuffer()

    await bucket.put(objectKey, buffer, {
      httpMetadata: { contentType },
    })

    const avatarUrl = getPublicUrl(objectKey)

    await execute('UPDATE users SET avatar_url = ? WHERE id = ?', [avatarUrl, userId])

    const user = (await queryOne(
      `SELECT id, email, name, avatar_url, created_at, last_login_at,
              plan_tier, plan_status, daily_standard_used, monthly_standard_used,
              monthly_premium_used, credit
       FROM users WHERE id = ?`,
      [userId],
    )) as UserRow | null

    if (!user) {
      return jsonResponse({ error: '用户不存在' }, 404, origin)
    }

    const refreshed = (await ensureQuotaCountersFresh(
      user as Record<string, unknown>,
    )) as UserRow

    return jsonResponse(
      {
        avatar_url: avatarUrl,
        user: sanitizeUser(refreshed),
      },
      200,
      origin,
    )
  } catch (err: unknown) {
    console.error('[api/user/avatar] error', err)
    const message = err instanceof Error ? err.message : '上传失败'
    return jsonResponse({ error: message }, 500, origin)
  }
}
