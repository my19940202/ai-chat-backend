import { getCloudflareContext } from '@opennextjs/cloudflare'

/**
 * 获取 R2 Bucket 绑定（异步）
 * 必须用 await，同步模式下 binding 对象可能为 undefined
 */
export async function getR2Bucket() {
  const ctx = await getCloudflareContext()
  const bucket = ctx.env.R2_BUCKET
  if (!bucket) {
    throw new Error('R2_BUCKET binding 未找到，请检查 wrangler.jsonc 中的 r2_buckets 配置')
  }
  return bucket
}

/**
 * 生成存储 key
 * 格式: {type}/{userId}/{timestamp}-{random}.{ext}
 */
export function buildObjectKey({ type = 'uploads', userId = 'anonymous', fileName }) {
  const ext = fileName.split('.').pop()?.toLowerCase() || 'bin'
  const ts = Date.now()
  const rand = Math.random().toString(36).slice(2, 8)
  return `${type}/${userId}/${ts}-${rand}.${ext}`
}

/**
 * 通过 Worker 自身代理访问 R2 文件（用于公开 URL）
 */
export function getPublicUrl(key) {
  return `/api/r2/${key}`
}
