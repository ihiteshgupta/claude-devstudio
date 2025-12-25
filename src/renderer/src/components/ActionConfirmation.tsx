/**
 * Action Confirmation Component
 *
 * Displays extracted actions from agent responses and allows
 * the user to approve, reject, or edit them before execution.
 */

import { useState, useCallback } from 'react'
import {
  Check,
  X,
  AlertTriangle,
  BookOpen,
  ListTodo,
  Map,
  TestTube,
  FileCode,
  Terminal,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Edit3,
  Copy,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

// Types matching the action-parser.service
export type ActionType =
  | 'create-story'
  | 'create-task'
  | 'create-roadmap-item'
  | 'create-test'
  | 'create-file'
  | 'run-command'
  | 'update-item'
  | 'link-items'

export interface ExtractedAction {
  id: string
  type: ActionType
  title: string
  description?: string
  metadata: Record<string, unknown>
  confidence: number
  sourceText: string
  status: 'proposed' | 'approved' | 'rejected' | 'executed'
}

export interface DuplicateCheckResult {
  hasDuplicate: boolean
  matches: Array<{
    id: string
    title: string
    type: string
    similarity: number
  }>
}

export interface ActionWithDuplicates extends ExtractedAction {
  duplicateCheck?: DuplicateCheckResult
}

export interface ExecutionResult {
  actionId: string
  success: boolean
  createdItemId?: string
  createdItemType?: string
  error?: string
  duplicateFound?: {
    id: string
    title: string
    similarity: number
  }
}

interface ActionConfirmationProps {
  actions: ActionWithDuplicates[]
  projectId: string
  onActionExecuted?: (result: ExecutionResult) => void
  onActionRejected?: (actionId: string) => void
  onDismiss?: () => void
}

const ACTION_TYPE_INFO: Record<ActionType, { icon: typeof BookOpen; label: string; color: string }> = {
  'create-story': { icon: BookOpen, label: 'User Story', color: 'text-blue-400' },
  'create-task': { icon: ListTodo, label: 'Task', color: 'text-purple-400' },
  'create-roadmap-item': { icon: Map, label: 'Roadmap Item', color: 'text-green-400' },
  'create-test': { icon: TestTube, label: 'Test Case', color: 'text-amber-400' },
  'create-file': { icon: FileCode, label: 'File', color: 'text-cyan-400' },
  'run-command': { icon: Terminal, label: 'Command', color: 'text-red-400' },
  'update-item': { icon: Edit3, label: 'Update', color: 'text-orange-400' },
  'link-items': { icon: Copy, label: 'Link', color: 'text-pink-400' },
}

export function ActionConfirmation({
  actions,
  projectId,
  onActionExecuted,
  onActionRejected,
  onDismiss,
}: ActionConfirmationProps): JSX.Element | null {
  const [expanded, setExpanded] = useState(true)
  const [actionStates, setActionStates] = useState<Record<string, {
    status: 'pending' | 'executing' | 'success' | 'error' | 'rejected'
    result?: ExecutionResult
  }>>({})

  const handleApprove = useCallback(async (action: ActionWithDuplicates) => {
    setActionStates(prev => ({
      ...prev,
      [action.id]: { status: 'executing' }
    }))

    try {
      const result = await window.electronAPI.actions.execute(
        {
          id: action.id,
          type: action.type,
          title: action.title,
          description: action.description,
          metadata: action.metadata,
          confidence: action.confidence,
          sourceText: action.sourceText,
          status: 'approved'
        },
        projectId,
        { skipDuplicateCheck: false, forceCreate: false }
      )

      setActionStates(prev => ({
        ...prev,
        [action.id]: {
          status: result.success ? 'success' : 'error',
          result
        }
      }))

      onActionExecuted?.(result)
    } catch (error) {
      setActionStates(prev => ({
        ...prev,
        [action.id]: {
          status: 'error',
          result: {
            actionId: action.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      }))
    }
  }, [projectId, onActionExecuted])

  const handleReject = useCallback((actionId: string) => {
    setActionStates(prev => ({
      ...prev,
      [actionId]: { status: 'rejected' }
    }))
    // Notify parent component about rejection
    onActionRejected?.(actionId)
  }, [onActionRejected])

  const handleApproveAll = useCallback(async () => {
    const pendingActions = actions.filter(a =>
      !actionStates[a.id] || actionStates[a.id].status === 'pending'
    )

    for (const action of pendingActions) {
      await handleApprove(action)
    }
  }, [actions, actionStates, handleApprove])

  const handleRejectAll = useCallback(() => {
    const newStates: typeof actionStates = {}
    for (const action of actions) {
      if (!actionStates[action.id] || actionStates[action.id].status === 'pending') {
        newStates[action.id] = { status: 'rejected' }
        // Notify parent about each rejection
        onActionRejected?.(action.id)
      }
    }
    setActionStates(prev => ({ ...prev, ...newStates }))
  }, [actions, actionStates, onActionRejected])

  // Filter out actions that are already processed
  const pendingCount = actions.filter(a =>
    !actionStates[a.id] || actionStates[a.id].status === 'pending'
  ).length

  const successCount = actions.filter(a =>
    actionStates[a.id]?.status === 'success'
  ).length

  if (actions.length === 0) return null

  return (
    <div className="mt-4 border border-primary/30 rounded-xl bg-primary/5 overflow-hidden">
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-primary/10 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-primary/20">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h4 className="text-sm font-medium">
              Detected Actions
            </h4>
            <p className="text-xs text-muted-foreground">
              {actions.length} action{actions.length !== 1 ? 's' : ''} found
              {successCount > 0 && ` • ${successCount} completed`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); handleApproveAll() }}
                className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Check className="w-3 h-3" />
                Approve All
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleRejectAll() }}
                className="px-3 py-1.5 text-xs bg-secondary hover:bg-secondary/80 text-muted-foreground rounded-lg transition-colors flex items-center gap-1.5"
              >
                <X className="w-3 h-3" />
                Dismiss
              </button>
            </>
          )}
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Actions List */}
      {expanded && (
        <div className="border-t border-primary/20">
          {actions.map((action) => (
            <ActionItem
              key={action.id}
              action={action}
              state={actionStates[action.id]}
              onApprove={() => handleApprove(action)}
              onReject={() => handleReject(action.id)}
            />
          ))}
        </div>
      )}

      {/* Footer - Show when all done */}
      {pendingCount === 0 && actions.length > 0 && (
        <div className="px-4 py-2 border-t border-primary/20 bg-primary/5 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            All actions processed
          </p>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-xs text-primary hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  )
}

interface ActionItemProps {
  action: ActionWithDuplicates
  state?: { status: string; result?: ExecutionResult }
  onApprove: () => void
  onReject: () => void
}

function ActionItem({ action, state, onApprove, onReject }: ActionItemProps): JSX.Element {
  const [showDetails, setShowDetails] = useState(false)
  const typeInfo = ACTION_TYPE_INFO[action.type]
  const Icon = typeInfo?.icon || BookOpen

  const hasDuplicate = action.duplicateCheck?.hasDuplicate
  const isProcessed = state?.status && state.status !== 'pending'

  return (
    <div className={`px-4 py-3 border-b border-primary/10 last:border-b-0 ${
      isProcessed ? 'opacity-70' : ''
    }`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`p-2 rounded-lg bg-card ${typeInfo?.color || 'text-muted-foreground'}`}>
          <Icon className="w-4 h-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${typeInfo?.color || 'text-muted-foreground'}`}>
              {typeInfo?.label || action.type}
            </span>
            <ConfidenceBadge confidence={action.confidence} />
            {hasDuplicate && (
              <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Possible duplicate
              </span>
            )}
          </div>

          <h5 className="font-medium text-sm mt-1 truncate">
            {action.title}
          </h5>

          {action.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {action.description}
            </p>
          )}

          {/* Duplicate Warning */}
          {hasDuplicate && action.duplicateCheck?.matches && (
            <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-xs text-amber-400">
                Similar items found:
              </p>
              <ul className="mt-1 space-y-1">
                {action.duplicateCheck.matches.slice(0, 2).map((match) => (
                  <li key={match.id} className="text-xs text-muted-foreground flex items-center gap-2">
                    <span className="truncate flex-1">{match.title}</span>
                    <span className="text-amber-400">
                      {Math.round(match.similarity * 100)}% match
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Details toggle */}
          {(action.metadata && Object.keys(action.metadata).length > 0) && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-muted-foreground hover:text-foreground mt-2 flex items-center gap-1"
            >
              {showDetails ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              {showDetails ? 'Hide' : 'Show'} details
            </button>
          )}

          {showDetails && action.metadata && (
            <div className="mt-2 p-2 bg-card rounded-lg text-xs font-mono">
              <pre className="text-muted-foreground overflow-x-auto">
                {JSON.stringify(action.metadata, null, 2)}
              </pre>
            </div>
          )}

          {/* Execution result */}
          {state?.result && (
            <div className={`mt-2 p-2 rounded-lg text-xs ${
              state.result.success
                ? 'bg-green-500/10 text-green-400'
                : 'bg-red-500/10 text-red-400'
            }`}>
              {state.result.success ? (
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3" />
                  Created {state.result.createdItemType}: {state.result.createdItemId?.slice(0, 8)}...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <XCircle className="w-3 h-3" />
                  {state.result.error}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          {state?.status === 'executing' ? (
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          ) : state?.status === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-green-400" />
          ) : state?.status === 'error' ? (
            <XCircle className="w-5 h-5 text-red-400" />
          ) : state?.status === 'rejected' ? (
            <span className="text-xs text-muted-foreground">Dismissed</span>
          ) : (
            <>
              <button
                onClick={onReject}
                className="p-1.5 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={onApprove}
                className="p-1.5 bg-green-600 hover:bg-green-700 rounded-lg transition-colors text-white"
                title="Create"
              >
                <Check className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ConfidenceBadge({ confidence }: { confidence: number }): JSX.Element {
  const percentage = Math.round(confidence * 100)
  let colorClass = 'bg-green-500/20 text-green-400'

  if (percentage < 50) {
    colorClass = 'bg-red-500/20 text-red-400'
  } else if (percentage < 70) {
    colorClass = 'bg-amber-500/20 text-amber-400'
  }

  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${colorClass}`}>
      {percentage}%
    </span>
  )
}
