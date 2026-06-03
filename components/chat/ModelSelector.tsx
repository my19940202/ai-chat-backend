'use client'

import { ChevronDown } from 'lucide-react'

const MODELS = [
  { value: 'google/gemini-3-flash', label: 'Gemini 3 Flash (普通)' },
  { value: 'openai/gpt-5.4-mini', label: 'GPT-5.4 mini (普通)' },
  { value: 'anthropic/claude-haiku-4.5', label: 'Claude 4.5 Haiku (普通)' },
  { value: 'openai/gpt-5.5', label: 'GPT-5.5 (高级)' },
  { value: 'anthropic/claude-sonnet-4.6', label: 'Claude 4.6 Sonnet (高级)' },
  { value: 'google/gemini-3.1-pro', label: 'Gemini 3.1 Pro (高级)' },
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
