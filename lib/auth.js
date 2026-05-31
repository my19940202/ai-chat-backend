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

const DEFAULT_ORIGINS = ['https://ai.aizeten.me']

function getAllowedOrigins() {
  const fromEnv = process.env.CORS_ALLOWED_ORIGINS
  if (!fromEnv) return DEFAULT_ORIGINS
  return fromEnv.split(',').map((o) => o.trim()).filter(Boolean)
}

/**
 * @param {string | null | undefined} requestOrigin
 * @returns {Record<string, string>}
 */
export function resolveCorsOrigin(requestOrigin) {
  if (!requestOrigin) return null
  return getAllowedOrigins().includes(requestOrigin) ? requestOrigin : null
}

/**
 * @param {string | null | undefined} requestOrigin
 * @returns {Record<string, string>}
 */
export function corsHeaders(requestOrigin) {
  const allowed = resolveCorsOrigin(requestOrigin)
  if (!allowed) return { Vary: 'Origin' }
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export function jsonResponse(data, status = 200, requestOrigin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(requestOrigin),
    },
  })
}
