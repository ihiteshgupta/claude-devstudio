import { useState } from 'react'
import type { TodoItem } from '@shared/types'

interface TodoListProps {
  todos: TodoItem[]
  isStreaming?: boolean
}

const STATUS_CONFIG = {
  pending: {
    icon: '○',
    color: 'text-muted-foreground',
    bg: 'bg-secondary/30',
    label: 'Pending'
  },
  in_progress: {
    icon: '◐',
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10',
    label: 'In Progress'
  },
  completed: {
    icon: '●',
    color: 'text-green-400',
    bg: 'bg-green-400/10',
    label: 'Completed'
  }
}

export function TodoList({ todos, isStreaming }: TodoListProps): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(true)

  if (!todos || todos.length === 0) return <></>

  const completedCount = todos.filter(t => t.status === 'completed').length
  const inProgressCount = todos.filter(t => t.status === 'in_progress').length
  const totalCount = todos.length

  return (
    <div className="mb-3 border border-border/50 rounded-lg overflow-hidden bg-secondary/30">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary/50 transition-colors"
      >
        <svg
          className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <span className="font-medium text-foreground">Tasks</span>
          {isStreaming && (
            <span className="flex gap-1 ml-1">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          )}
        </span>
        <div className="ml-auto flex items-center gap-2 text-xs">
          <span className="text-green-400">{completedCount}</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-muted-foreground">{totalCount}</span>
          {inProgressCount > 0 && (
            <span className="text-yellow-400 text-xs">({inProgressCount} active)</span>
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-border/50">
          {todos.map((todo, index) => {
            const config = STATUS_CONFIG[todo.status]
            return (
              <div
                key={todo.id || index}
                className={`flex items-start gap-2 px-3 py-2 border-b border-border/30 last:border-b-0 ${config.bg}`}
              >
                <span className={`mt-0.5 text-sm ${config.color}`} title={config.label}>
                  {config.icon}
                </span>
                <span className={`text-sm flex-1 ${
                  todo.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'
                }`}>
                  {todo.content}
                </span>
                {todo.status === 'in_progress' && (
                  <span className="flex-shrink-0">
                    <span className="inline-flex gap-0.5">
                      <span className="w-1 h-1 bg-yellow-400 rounded-full animate-pulse" />
                      <span className="w-1 h-1 bg-yellow-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                      <span className="w-1 h-1 bg-yellow-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                    </span>
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Progress bar */}
      <div className="h-1 bg-secondary">
        <div
          className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-300"
          style={{ width: `${(completedCount / totalCount) * 100}%` }}
        />
      </div>
    </div>
  )
}
