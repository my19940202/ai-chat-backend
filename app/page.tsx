'use client'

import { useState, useEffect, useCallback } from 'react'
import { Menu, X } from 'lucide-react'
import ChatSidebar from '@/components/chat/ChatSidebar'
import ChatWindow from '@/components/chat/ChatWindow'
import ChatInput from '@/components/chat/ChatInput'
import ModelSelector from '@/components/chat/ModelSelector'

interface Conversation {
  id: string
  title: string
  model?: string
  updated_at: number
}

interface Message {
  id?: string
  role: 'user' | 'assistant'
  content: string
  created_at?: number
}

const DEFAULT_MODEL = 'openai/gpt-4.1-mini'
const USER_ID = 'demo-user'

export default function AIChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [model, setModel] = useState(DEFAULT_MODEL)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loadingConvos, setLoadingConvos] = useState(true)

  // 加载会话列表
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch(`/api/conversations?userId=${USER_ID}`)
      const data = await res.json()
      setConversations(data.conversations || [])
    } catch (e) {
      console.error('加载会话失败', e)
    } finally {
      setLoadingConvos(false)
    }
  }, [])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  // 加载指定会话的消息
  const loadConversation = async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}?userId=${USER_ID}`)
      const data = await res.json()
      if (data.conversation) {
        setCurrentId(id)
        setMessages(data.messages || [])
        setModel(data.conversation.model || DEFAULT_MODEL)
        setStreamingText('')
      }
    } catch (e) {
      console.error('加载会话详情失败', e)
    }
  }

  // 新建对话
  const handleNewChat = async () => {
    setCurrentId(null)
    setMessages([])
    setStreamingText('')
    setModel(DEFAULT_MODEL)
  }

  // 删除对话
  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
      await loadConversations()
      if (currentId === id) {
        setCurrentId(null)
        setMessages([])
      }
    } catch (e) {
      console.error('删除失败', e)
    }
  }

  // 发送消息（核心流式逻辑）
  const handleSend = async (text: string) => {
    if (!text.trim() || isStreaming) return

    const userMessage: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setStreamingText('')
    setIsStreaming(true)

    try {
      const payload = {
        conversationId: currentId || undefined,
        messages: newMessages,
        model,
        userId: USER_ID,
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.text()
        throw new Error(err || '请求失败')
      }

      // 从响应头拿到服务端创建的 conversationId
      const serverConvId = res.headers.get('X-Conversation-Id')
      if (serverConvId && !currentId) {
        setCurrentId(serverConvId)
      }

      // 流式读取 SSE
      const reader = res.body?.getReader()
      if (!reader) throw new Error('无响应流')

      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''

        for (const part of parts) {
          if (!part.trim()) continue
          const lines = part.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim()
              if (data === '[DONE]') continue
              try {
                const json = JSON.parse(data)
                const delta = json.choices?.[0]?.delta?.content
                if (delta) {
                  fullText += delta
                  setStreamingText(fullText)
                }
              } catch {}
            }
          }
        }
      }

      // 流结束，刷新消息列表 + 会话列表
      if (fullText.trim()) {
        const assistantMsg: Message = { role: 'assistant', content: fullText.trim() }
        setMessages([...newMessages, assistantMsg])
        setStreamingText('')
      }

      // 刷新侧边栏（标题可能已自动更新）
      await loadConversations()

      // 如果是新会话，加载完整历史
      if (serverConvId && !currentId) {
        await loadConversation(serverConvId)
      }
    } catch (err: any) {
      console.error('发送失败', err)
      alert('发送失败：' + (err.message || err))
      // 回滚最后一条 user 消息
      setMessages(messages)
    } finally {
      setIsStreaming(false)
      setStreamingText('')
    }
  }

  // 切换模型
  const handleModelChange = (newModel: string) => {
    setModel(newModel)
    // 可选：立即更新当前会话的默认模型
    if (currentId) {
      fetch(`/api/conversations/${currentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: undefined, model: newModel }),
      }).catch(() => {})
    }
  }

  return (
    <div className="chat-container">
      {/* Top Navbar */}
      <div className="navbar bg-base-200 border-b border-base-300 px-4 min-h-14">
        <div className="flex-1 flex items-center gap-3">
          <button
            className="btn btn-ghost btn-sm md:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="font-semibold text-lg">AI Chat</div>
          <div className="text-xs text-base-content/50 hidden sm:block">Cloudflare Workers + D1 + AI Gateway</div>
        </div>

        <div className="flex items-center gap-2">
          <ModelSelector value={model} onChange={handleModelChange} disabled={isStreaming} />
          <div className="text-xs px-2 py-1 rounded bg-base-300 text-base-content/70 hidden sm:block">
            {USER_ID}
          </div>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className={`${sidebarOpen ? 'flex' : 'hidden'} md:flex flex-col border-r border-base-300 bg-base-200`}>
          <ChatSidebar
            conversations={conversations}
            currentId={currentId}
            onSelect={loadConversation}
            onNew={handleNewChat}
            onDelete={handleDelete}
            loading={loadingConvos}
          />
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <ChatWindow
            messages={messages}
            isStreaming={isStreaming}
            streamingText={streamingText}
          />
          <ChatInput onSend={handleSend} disabled={isStreaming} />
        </div>
      </div>
    </div>
  )
}
