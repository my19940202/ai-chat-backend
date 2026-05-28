import { genId } from '@/lib/d1'

/**
 * SHA-256 密码哈希（Cloudflare Workers Web Crypto 兼容）
 */
export async function hashPassword(password) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 生成简单 token：userId:randomHash
 */
export function createToken(userId) {
  return `${userId}:${genId()}`
}

/**
 * 从 token 解析 userId（MVP 简单方案）
 */
export function parseUserIdFromToken(token) {
  if (!token || typeof token !== 'string') return null
  const idx = token.indexOf(':')
  if (idx <= 0) return null
  return token.slice(0, idx)
}

export function corsHeaders(origin = '*') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  })
}
