import { execute, genId, queryOne } from '@/lib/d1'

/** @typedef {'free' | 'pro' | 'max'} PlanTier */
/** @typedef {'standard' | 'premium'} QuotaType */

export const PLAN_LIMITS = {
  free: {
    dailyStandard: 10,
    monthlyStandard: null,
    monthlyPremium: 0,
    unlimited: false,
  },
  pro: {
    dailyStandard: null,
    monthlyStandard: 2000,
    monthlyPremium: 100,
    unlimited: false,
  },
  max: {
    dailyStandard: null,
    monthlyStandard: null,
    monthlyPremium: null,
    unlimited: true,
  },
}

const PREMIUM_MODEL_PATTERNS = [
  /gpt-4(?!\.1-mini|-mini)/i,
  /gpt-5/i,
  /claude.*sonnet/i,
  /gemini.*pro/i,
  /grok/i,
  /o1/i,
  /o3/i,
]

const STANDARD_MODEL_PATTERNS = [
  /haiku/i,
  /flash-lite/i,
  /flash(?!.*pro)/i,
  /mini/i,
  /deepseek/i,
  /gpt-4\.1-mini/i,
  /gpt-4o-mini/i,
]

/**
 * 根据 model id 判断额度类型
 * @param {string | undefined | null} model
 * @returns {QuotaType}
 */
export function getQuotaTypeForModel(model) {
  const normalized = (model || '').toLowerCase()
  if (!normalized) return 'standard'

  if (PREMIUM_MODEL_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return 'premium'
  }
  if (STANDARD_MODEL_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return 'standard'
  }

  // 默认按高级模型处理，避免绕过限制
  return 'premium'
}

function startOfUtcDay(ts) {
  const d = new Date(ts)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

function startOfUtcMonth(ts) {
  const d = new Date(ts)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)
}

/**
 * @param {Record<string, unknown>} userRow
 * @returns {Promise<Record<string, unknown>>}
 */
export async function ensureQuotaCountersFresh(userRow) {
  const now = Date.now()
  const dayStart = startOfUtcDay(now)
  const monthStart = startOfUtcMonth(now)
  const updates = []
  const params = []

  const lastDaily = Number(userRow.last_daily_reset_at || 0)
  const lastMonthly = Number(userRow.last_monthly_reset_at || 0)

  if (lastDaily < dayStart) {
    updates.push('daily_standard_used = 0', 'last_daily_reset_at = ?')
    params.push(dayStart)
  }

  if (lastMonthly < monthStart) {
    updates.push(
      'monthly_standard_used = 0',
      'monthly_premium_used = 0',
      'last_monthly_reset_at = ?',
    )
    params.push(monthStart)
  }

  if (updates.length === 0) {
    return userRow
  }

  params.push(userRow.id)
  await execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params)

  const refreshed = await queryOne(
    `SELECT id, plan_tier, plan_status, daily_standard_used, monthly_standard_used,
            monthly_premium_used, last_daily_reset_at, last_monthly_reset_at, credit
     FROM users WHERE id = ?`,
    [userRow.id],
  )

  return refreshed || userRow
}

/**
 * @param {Record<string, unknown>} userRow
 * @param {QuotaType} quotaType
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function checkQuota(userRow, quotaType) {
  const tier = /** @type {PlanTier} */ (userRow.plan_tier || 'free')
  const limits = PLAN_LIMITS[tier] || PLAN_LIMITS.free

  if (limits.unlimited) {
    return { allowed: true }
  }

  if (quotaType === 'premium') {
    if (tier === 'free') {
      return { allowed: false, reason: 'Free 套餐不支持高级模型，请升级 Pro 或 Max' }
    }
    const used = Number(userRow.monthly_premium_used || 0)
    const cap = limits.monthlyPremium
    if (cap != null && used >= cap) {
      return { allowed: false, reason: '本月高级模型额度已用完，请升级套餐或下月再试' }
    }
    return { allowed: true }
  }

  if (tier === 'free') {
    const used = Number(userRow.daily_standard_used || 0)
    const cap = limits.dailyStandard
    if (cap != null && used >= cap) {
      return { allowed: false, reason: '今日普通模型额度已用完，请明天再试或升级套餐' }
    }
    return { allowed: true }
  }

  if (tier === 'pro') {
    const used = Number(userRow.monthly_standard_used || 0)
    const cap = limits.monthlyStandard
    if (cap != null && used >= cap) {
      return { allowed: false, reason: '本月普通模型额度已用完，请升级 Max 或下月再试' }
    }
    return { allowed: true }
  }

  return { allowed: true }
}

/**
 * @param {string} userId
 * @param {string} model
 * @param {QuotaType} quotaType
 * @param {PlanTier} planTier
 */
export async function recordUsage(userId, model, quotaType, planTier) {
  const now = Date.now()

  if (quotaType === 'standard') {
    if (planTier === 'free') {
      await execute(
        'UPDATE users SET daily_standard_used = daily_standard_used + 1 WHERE id = ?',
        [userId],
      )
    } else if (planTier === 'pro') {
      await execute(
        'UPDATE users SET monthly_standard_used = monthly_standard_used + 1 WHERE id = ?',
        [userId],
      )
    }
  } else if (quotaType === 'premium' && planTier === 'pro') {
    await execute(
      'UPDATE users SET monthly_premium_used = monthly_premium_used + 1 WHERE id = ?',
      [userId],
    )
  }

  await execute(
    `INSERT INTO usage_history (id, user_id, model, quota_type, plan_tier, source, created_at)
     VALUES (?, ?, ?, ?, ?, 'chat', ?)`,
    [genId(), userId, model, quotaType, planTier, now],
  )
}

/**
 * @param {Record<string, unknown>} userRow
 */
export function buildQuotaSummary(userRow) {
  const tier = /** @type {PlanTier} */ (userRow.plan_tier || 'free')
  const limits = PLAN_LIMITS[tier] || PLAN_LIMITS.free

  return {
    plan_tier: tier,
    plan_status: userRow.plan_status || 'active',
    daily_standard_used: Number(userRow.daily_standard_used || 0),
    monthly_standard_used: Number(userRow.monthly_standard_used || 0),
    monthly_premium_used: Number(userRow.monthly_premium_used || 0),
    credit: Number(userRow.credit || 0),
    limits: {
      daily_standard: limits.dailyStandard,
      monthly_standard: limits.monthlyStandard,
      monthly_premium: limits.monthlyPremium,
      unlimited: limits.unlimited,
    },
  }
}
