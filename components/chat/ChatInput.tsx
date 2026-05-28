'use client'

import { useState, KeyboardEvent } from 'react'
import { Send, Loader2 } from 'lucide-react'

interface Props {
  onSend: (text: string) => void
  disabled?: boolean
  placeholder?: string
}

export default function ChatInput({ onSend, disabled, placeholder = '输入消息，按 Enter 发送，Shift+Enter 换行...' }: Props) {
  const [text, setText] = useState('')

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t border-base-300 bg-base-100 p-4">
      <div className="max-w-3xl mx-auto flex gap-3 items-end">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="chat-input textarea textarea-bordered flex-1 text-sm leading-relaxed py-3 px-4"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          className="btn btn-primary btn-square"
        >
          {disabled ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
      <div className="max-w-3xl mx-auto mt-2 text-[10px] text-base-content/40 text-center">
        内容由 AI 生成 · 通过 Cloudflare AI Gateway 代理
      </div>
    </div>
  )
}
