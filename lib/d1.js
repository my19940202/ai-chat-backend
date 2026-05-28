import { getCloudflareContext } from '@opennextjs/cloudflare'

/**
 * 获取 D1 Database 绑定（异步）
 * 必须 await
 */
export async function getD1() {
  const ctx = await getCloudflareContext()
  const db = ctx.env.DB
  if (!db) {
    throw new Error('D1 DB binding 未找到，请检查 wrangler.jsonc 中的 d1_databases 配置')
  }
  return db
}

/**
 * 通用查询执行（带参数化）
 */
export async function execute(sql, params = []) {
  const db = await getD1()
  return db.prepare(sql).bind(...params).run()
}

/**
 * 查询单行
 */
export async function queryOne(sql, params = []) {
  const db = await getD1()
  return db.prepare(sql).bind(...params).first()
}

/**
 * 查询多行
 */
export async function queryAll(sql, params = []) {
  const db = await getD1()
  const res = await db.prepare(sql).bind(...params).all()
  return res.results || []
}

/**
 * 生成简单 id (timestamp + random)
 */
export function genId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
