import { useState } from 'react'
import type { SubAgentAction } from '@shared/types'
import {
  Search,
  ClipboardList,
  Zap,
  ChevronRight,
  Check,
  X
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface SubAgentPanelProps {
  actions: SubAgentAction[]
  isStreaming?: boolean
}

const STATUS_CONFIG: Record<string, { Icon: LucideIcon | null; color: string; bg: string; borderColor: string }> = {
  running: {
    Icon: null,
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    borderColor: 'border-blue-400/30'
  },
  completed: {
    Icon: Check,
    color: 'text-green-400',
    bg: 'bg-green-400/10',
    borderColor: 'border-green-400/30'
  },
  failed: {
    Icon: X,
    color: 'text-red-400',
    bg: 'bg-red-400/10',
    borderColor: 'border-red-400/30'
  }
}

const AGENT_TYPE_CONFIG: Record<string, { Icon: LucideIcon; color: string; label: string; description: string }> = {
  Explore: {
    Icon: Search,
    color: 'text-blue-400',
    label: 'Exploring',
    description: 'Searching codebase'
  },
  Plan: {
    Icon: ClipboardList,
    color: 'text-green-400',
    label: 'Planning',
    description: 'Designing approach'
  },
  Task: {
    Icon: Zap,
    color: 'text-yellow-400',
    label: 'Task',
    description: 'Running sub-agent'
  }
}

export function SubAgentPanel({ actions, isStreaming }: SubAgentPanelProps): JSX.Element {
  const [expandedActions, setExpandedActions] = useState<Set<string>>(new Set())

  if (!actions || actions.length === 0) return <></>

  const toggleAction = (id: string): void => {
    setExpandedActions((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const runningCount = actions.filter((a) => a.status === 'running').length
  const completedCount = actions.filter((a) => a.status === 'completed').length

  return (
    <div className="mb-3 border border-border/50 rounded-lg overflow-hidden bg-secondary/30">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 text-sm border-b border-border/30">
        <Zap className="w-4 h-4 text-cyan-400" />
        <span className="font-medium text-foreground">Sub-Agents</span>
        {isStreaming && runningCount > 0 && (
          <span className="flex gap-1 ml-1">
            <span
              className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce"
              style={{ animationDelay: '0ms' }}
            />
            <span
              className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce"
              style={{ animationDelay: '150ms' }}
            />
            <span
              className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce"
              style={{ animationDelay: '300ms' }}
            />
          </span>
        )}
        <div className="ml-auto flex items-center gap-2 text-xs">
          {runningCount > 0 && <span className="text-blue-400">{runningCount} running</span>}
          <span className="text-green-400">{completedCount}</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-muted-foreground">{actions.length}</span>
        </div>
      </div>

      {/* Action list */}
      <div className="divide-y divide-border/30">
        {actions.map((action) => {
          const statusConfig = STATUS_CONFIG[action.status]
          const typeConfig = AGENT_TYPE_CONFIG[action.type]
          const isExpanded = expandedActions.has(action.id)

          return (
            <div key={action.id} className={`${statusConfig.bg}`}>
              <button
                onClick={() => toggleAction(action.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary/50 transition-colors"
              >
                {/* Expand arrow */}
                {action.result && (
                  <ChevronRight
                    className={`w-3 h-3 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  />
                )}

                {/* Agent type icon */}
                <typeConfig.Icon className={`w-4 h-4 ${typeConfig.color}`} />

                {/* Description */}
                <span className="flex-1 text-left truncate">
                  <span className="font-medium">{typeConfig.label}:</span>{' '}
                  <span className="text-muted-foreground">{action.description}</span>
                </span>

                {/* Status */}
                <span className={`flex-shrink-0 ${statusConfig.color}`}>
                  {action.status === 'running' ? (
                    <span className="inline-flex gap-0.5">
                      <span className="w-1 h-1 bg-current rounded-full animate-pulse" />
                      <span
                        className="w-1 h-1 bg-current rounded-full animate-pulse"
                        style={{ animationDelay: '150ms' }}
                      />
                      <span
                        className="w-1 h-1 bg-current rounded-full animate-pulse"
                        style={{ animationDelay: '300ms' }}
                      />
                    </span>
                  ) : statusConfig.Icon ? (
                    <statusConfig.Icon className="w-4 h-4" />
                  ) : null}
                </span>
              </button>

              {/* Expanded result */}
              {isExpanded && action.result && (
                <div className="px-3 pb-2">
                  <div className="bg-background/50 rounded p-2 text-xs font-mono text-muted-foreground max-h-32 overflow-y-auto whitespace-pre-wrap">
                    {action.result}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-secondary">
        <div
          className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-300"
          style={{ width: `${(completedCount / actions.length) * 100}%` }}
        />
      </div>
    </div>
  )
}
