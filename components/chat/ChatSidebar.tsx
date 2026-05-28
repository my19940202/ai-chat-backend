'use client'

import { useState } from 'react'
import { Plus, Trash2, MessageSquare } from 'lucide-react'

interface Conversation {
  id: string
  title: string
  model?: string
  updated_at: number
}

interface Props {
  conversations: Conversation[]
  currentId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  loading?: boolean
}

export default function ChatSidebar({ conversations, currentId, onSelect, onNew, onDelete, loading }: Props) {
  const [deleting, setDeleting] = useState<string | null>(null)

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm('确定删除这个会话吗？')) return
    setDeleting(id)
    await onDelete(id)
    setDeleting(null)
  }

  return (
    <div className="w-72 bg-base-200 border-r border-base-300 flex flex-col h-full">
      <div className="p-4 border-b border-base-300">
        <button
          onClick={onNew}
          className="btn btn-primary w-full gap-2"
        >
          <Plus className="w-4 h-4" />
          新建对话
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading && (
          <div className="text-center text-sm text-base-content/60 py-4">加载中...</div>
        )}

        {conversations.length === 0 && !loading && (
          <div className="text-center text-sm text-base-content/50 py-8">
            暂无对话<br />点击上方按钮开始
          </div>
        )}

        {conversations.map((conv) => (
          <div
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`conversation-item group flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer mb-1 ${
              currentId === conv.id ? 'active' : ''
            }`}
          >
            <MessageSquare className="w-4 h-4 shrink-0 text-base-content/70" />
            <div className="flex-1 min-w-0">
              <div className="truncate text-sm font-medium">
                {conv.title || '未命名对话'}
              </div>
              <div className="text-[10px] text-base-content/50">
                {new Date(conv.updated_at).toLocaleDateString('zh-CN')}
              </div>
            </div>
            <button
              onClick={(e) => handleDelete(e, conv.id)}
              disabled={deleting === conv.id}
              className="btn btn-ghost btn-xs opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="p-3 text-[10px] text-center text-base-content/40 border-t border-base-300">
        AI Chat · Powered by Cloudflare
      </div>
    </div>
  )
}
