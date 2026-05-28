import { getCloudflareContext } from '@opennextjs/cloudflare'

/**
 * 优先从 process.env 读取；本地/空时再读 Cloudflare Worker 的 `env` 绑定
 *（与 `import { env } from "cloudflare:workers"` 在 Worker 中指向同一类绑定；此处通过
 * getCloudflareContext 获取，以兼容 `next dev` 与 opennextjs 构建。）
 */
export function getEnv(name, defaultValue) {
  const fromProcess = process.env[name]
  if (fromProcess != null && fromProcess !== '') {
    return fromProcess
  }
  let workerEnv
  try {
    workerEnv = getCloudflareContext({ async: false }).env
  } catch {
    return defaultValue
  }
  const v = workerEnv?.[name]
  if (v == null || v === '') {
    return defaultValue
  }
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    return String(v)
  }
  return defaultValue
}
