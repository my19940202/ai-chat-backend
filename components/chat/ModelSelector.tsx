'use client'

import { ChevronDown } from 'lucide-react'

// 第三方模型走 AI Gateway Unified Billing（用 CF 充值的 credits 扣费）
// Workers AI 模型（@cf/...）走 Workers AI 自家计费
const MODELS = [
  { value: 'openai/gpt-4.1-mini', label: 'GPT-4.1 mini (OpenAI · Unified)' },
  { value: 'openai/gpt-4.1', label: 'GPT-4.1 (OpenAI · Unified)' },
  { value: 'anthropic/claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet (Anthropic · Unified)' },
  { value: 'google/gemini-2.0-flash', label: 'Gemini 2.0 Flash (Google · Unified)' },
  { value: '@cf/meta/llama-3.1-8b-instruct', label: 'Llama 3.1 8B (Workers AI)' },
  { value: '@cf/moonshotai/kimi-k2.5', label: 'Kimi K2.5 (Workers AI)' },
]

interface Props {
  value: string
  onChange: (model: string) => void
  disabled?: boolean
}

export default function ModelSelector({ value, onChange, disabled }: Props) {
  return (
    <div className="dropdown dropdown-end">
      <div
        tabIndex={0}
        role="button"
        className="btn btn-sm btn-ghost gap-1 text-xs normal-case"
        aria-disabled={disabled}
      >
        {MODELS.find(m => m.value === value)?.label || value}
        <ChevronDown className="w-3 h-3" />
      </div>
      <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box z-[1] w-64 p-1 shadow">
        {MODELS.map(m => (
          <li key={m.value}>
            <button
              className={value === m.value ? 'active' : ''}
              onClick={() => onChange(m.value)}
              disabled={disabled}
            >
              {m.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
