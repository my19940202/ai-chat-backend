'use client'

import { useEffect, useRef } from 'react'
import { Bot, User } from 'lucide-react'

interface Message {
  id?: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at?: number
}

interface Props {
  messages: Message[]
  isStreaming: boolean
  streamingText: string
}

export default function ChatWindow({ messages, isStreaming, streamingText }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  const displayMessages = [...messages]
  if (isStreaming && streamingText) {
    displayMessages.push({ role: 'assistant', content: streamingText })
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-base-100">
      {displayMessages.length === 0 && (
        <div className="h-full flex items-center justify-center text-center">
          <div>
            <Bot className="w-12 h-12 mx-auto mb-4 text-primary/70" />
            <h2 className="text-2xl font-semibold mb-2">开始新的对话</h2>
            <p className="text-base-content/60 max-w-sm">
              在下方输入问题，我会通过 Cloudflare AI Gateway 进行智能回复。
            </p>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto space-y-6">
        {displayMessages
          .filter(m => m.role !== 'system')
          .map((msg, idx) => {
            const isUser = msg.role === 'user'
            const isLastStreaming = isStreaming && idx === displayMessages.length - 1 && msg.role === 'assistant'

            return (
              <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-3 max-w-[85%] ${isUser ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${
                    isUser ? 'bg-primary text-primary-content' : 'bg-base-300 text-base-content'
                  }`}>
                    {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div
                    className={`message-bubble ${
                      isUser ? 'message-user' : 'message-assistant'
                    } ${isLastStreaming ? 'streaming-cursor' : ''}`}
                  >
                    {msg.content}
                  </div>
                </div>
              </div>
            )
          })}
      </div>

      <div ref={bottomRef} />
    </div>
  )
}
