'use client'

import { ChevronDown } from 'lucide-react'

const MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o mini (via AI Gateway)' },
  { value: '@cf/meta/llama-3.1-8b-instruct', label: 'Llama 3.1 8B (Workers AI)' },
  { value: 'gpt-4o', label: 'GPT-4o (via AI Gateway)' },
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
