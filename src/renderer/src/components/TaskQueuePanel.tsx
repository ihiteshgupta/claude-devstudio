import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '../stores/appStore'
import { useToast } from './Toast'
import type {
  QueuedTask,
  TaskType,
  AutonomyLevel,
  TaskStatus,
  ApprovalGate
} from '@shared/types'

interface TaskQueuePanelProps {
  projectPath: string
}

const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: 'bg-zinc-600',
  queued: 'bg-yellow-600',
  running: 'bg-blue-500 animate-pulse',
  waiting_approval: 'bg-orange-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  cancelled: 'bg-zinc-500',
  skipped: 'bg-zinc-400'
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pending',
  queued: 'Queued',
  running: 'Running',
  waiting_approval: 'Awaiting Approval',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
  skipped: 'Skipped'
}

const AUTONOMY_LABELS: Record<AutonomyLevel, string> = {
  auto: 'Automatic',
  approval_gates: 'Approval Gates',
  supervised: 'Supervised'
}

const AUTONOMY_DESCRIPTIONS: Record<AutonomyLevel, string> = {
  auto: 'Execute without stops',
  approval_gates: 'Pause at checkpoints',
  supervised: 'Require approval before and after'
}

const TASK_TYPE_ICONS: Record<TaskType, string> = {
  'code-generation': 'code',
  'code-review': 'search',
  testing: 'flask',
  documentation: 'book',
  'security-audit': 'shield-alt',
  deployment: 'rocket',
  refactoring: 'sync',
  'bug-fix': 'bug',
  'tech-decision': 'lightbulb',
  decomposition: 'project-diagram'
}

const TASK_TYPE_COLORS: Record<TaskType, string> = {
  'code-generation': 'text-blue-400',
  'code-review': 'text-purple-400',
  testing: 'text-green-400',
  documentation: 'text-cyan-400',
  'security-audit': 'text-red-400',
  deployment: 'text-orange-400',
  refactoring: 'text-yellow-400',
  'bug-fix': 'text-pink-400',
  'tech-decision': 'text-amber-400',
  decomposition: 'text-indigo-400'
}

export function TaskQueuePanel({ projectPath }: TaskQueuePanelProps): JSX.Element {
  const { currentProject } = useAppStore()
  const toast = useToast()

  const [tasks, setTasks] = useState<QueuedTask[]>([])
  const [selectedTask, setSelectedTask] = useState<QueuedTask | null>(null)
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalGate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isQueueRunning, setIsQueueRunning] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [executionLog, setExecutionLog] = useState<string[]>([])

  // Form state
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newTaskType, setNewTaskType] = useState<TaskType>('code-generation')
  const [newAutonomy, setNewAutonomy] = useState<AutonomyLevel>('supervised')

  // Load tasks
  const loadTasks = useCallback(async () => {
    if (!currentProject) return
    setIsLoading(true)
    try {
      const queuedTasks = await window.electronAPI.taskQueue.list(currentProject.id)
      setTasks(queuedTasks)

      // Load pending approvals
      const approvals: ApprovalGate[] = []
      for (const task of queuedTasks) {
        if (task.status === 'waiting_approval') {
          const taskApprovals = await window.electronAPI.taskQueue.getApprovals(task.id)
          approvals.push(...taskApprovals.filter((a: ApprovalGate) => a.status === 'pending'))
        }
      }
      setPendingApprovals(approvals)
    } catch (error) {
      console.error('Failed to load tasks:', error)
      toast.error('Load Failed', 'Could not load task queue')
    } finally {
      setIsLoading(false)
    }
  }, [currentProject, toast])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  // Subscribe to task events
  useEffect(() => {
    const cleanup = window.electronAPI.taskQueue.onEvent((event) => {
      setExecutionLog((prev) => [
        `[${new Date().toLocaleTimeString()}] ${event.type}: ${event.taskId}`,
        ...prev.slice(0, 99)
      ])

      if (
        event.type === 'task-completed' ||
        event.type === 'task-failed' ||
        event.type === 'task-cancelled' ||
        event.type === 'task-approval-required'
      ) {
        loadTasks()
      }

      if (event.type === 'queue-paused' || event.type === 'queue-resumed') {
        setIsQueueRunning(event.type === 'queue-resumed')
      }
    })

    return cleanup
  }, [loadTasks])

  // Enqueue task
  const handleEnqueueTask = async (): Promise<void> => {
    if (!currentProject || !newTitle.trim()) return

    try {
      await window.electronAPI.taskQueue.enqueue({
        projectId: currentProject.id,
        title: newTitle,
        description: newDescription || undefined,
        taskType: newTaskType,
        autonomyLevel: newAutonomy
      })

      setNewTitle('')
      setNewDescription('')
      setNewTaskType('code-generation')
      setNewAutonomy('supervised')
      setShowCreateForm(false)
      loadTasks()
      toast.success('Enqueued', 'Task added to queue')
    } catch (error) {
      console.error('Failed to enqueue task:', error)
      toast.error('Enqueue Failed', 'Could not add task to queue')
    }
  }

  // Start queue
  const handleStartQueue = async (): Promise<void> => {
    if (!currentProject) return

    try {
      setIsQueueRunning(true)
      await window.electronAPI.taskQueue.start(currentProject.id, projectPath)
    } catch (error) {
      console.error('Failed to start queue:', error)
      setIsQueueRunning(false)
      toast.error('Start Failed', 'Could not start task queue')
    }
  }

  // Pause/Resume queue
  const handleTogglePause = async (): Promise<void> => {
    try {
      if (isQueueRunning) {
        await window.electronAPI.taskQueue.pause()
        setIsQueueRunning(false)
        toast.info('Paused', 'Task queue paused')
      } else {
        await window.electronAPI.taskQueue.resume()
        setIsQueueRunning(true)
        toast.info('Resumed', 'Task queue resumed')
      }
    } catch (error) {
      console.error('Failed to toggle pause:', error)
    }
  }

  // Cancel task
  const handleCancelTask = async (taskId: string): Promise<void> => {
    try {
      await window.electronAPI.taskQueue.cancel(taskId)
      loadTasks()
      toast.success('Cancelled', 'Task cancelled')
    } catch (error) {
      console.error('Failed to cancel task:', error)
      toast.error('Cancel Failed', 'Could not cancel task')
    }
  }

  // Approve gate
  const handleApproveGate = async (gateId: string): Promise<void> => {
    try {
      await window.electronAPI.taskQueue.approve(gateId, 'user')
      loadTasks()
      toast.success('Approved', 'Task approved')
    } catch (error) {
      console.error('Failed to approve:', error)
      toast.error('Approve Failed', 'Could not approve task')
    }
  }

  // Reject gate
  const handleRejectGate = async (gateId: string): Promise<void> => {
    try {
      await window.electronAPI.taskQueue.reject(gateId, 'user', 'Rejected by user')
      loadTasks()
      toast.success('Rejected', 'Task rejected')
    } catch (error) {
      console.error('Failed to reject:', error)
      toast.error('Reject Failed', 'Could not reject task')
    }
  }

  // Update autonomy level
  const handleAutonomyChange = async (taskId: string, level: AutonomyLevel): Promise<void> => {
    try {
      await window.electronAPI.taskQueue.updateAutonomy(taskId, level)
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, autonomyLevel: level } : t))
      )
    } catch (error) {
      console.error('Failed to update autonomy:', error)
      toast.error('Update Failed', 'Could not update autonomy level')
    }
  }

  // Group tasks
  const pendingTasks = tasks.filter((t) => ['pending', 'queued'].includes(t.status))
  const runningTasks = tasks.filter((t) => t.status === 'running')
  const waitingTasks = tasks.filter((t) => t.status === 'waiting_approval')
  const completedTasks = tasks.filter((t) => ['completed', 'failed', 'cancelled'].includes(t.status))

  // Render task card
  const renderTaskCard = (task: QueuedTask): JSX.Element => (
    <div
      key={task.id}
      className={`border border-zinc-800 rounded-lg p-4 cursor-pointer transition-all hover:border-zinc-700 ${
        selectedTask?.id === task.id ? 'ring-2 ring-blue-500' : ''
      }`}
      onClick={() => setSelectedTask(task)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <i className={`fas fa-${TASK_TYPE_ICONS[task.taskType]} ${TASK_TYPE_COLORS[task.taskType]}`} />
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-white truncate">{task.title}</h4>
            {task.description && (
              <p className="text-xs text-zinc-500 truncate mt-0.5">{task.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[task.status]}`} />
          <span className="text-xs text-zinc-400">{STATUS_LABELS[task.status]}</span>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2">
          <select
            value={task.autonomyLevel}
            onChange={(e) => {
              e.stopPropagation()
              handleAutonomyChange(task.id, e.target.value as AutonomyLevel)
            }}
            onClick={(e) => e.stopPropagation()}
            className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-300"
          >
            {Object.entries(AUTONOMY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          {task.estimatedDuration && (
            <span className="text-xs text-zinc-500">
              ~{Math.ceil(task.estimatedDuration / 60)}m
            </span>
          )}
        </div>
        {task.status === 'pending' || task.status === 'queued' ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleCancelTask(task.id)
            }}
            className="text-xs text-red-400 hover:text-red-300"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  )

  return (
    <div className="flex flex-1 h-full bg-zinc-950">
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Task Queue</h2>
            <p className="text-sm text-zinc-500">
              {pendingTasks.length} pending, {runningTasks.length} running
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Queue controls */}
            {tasks.some((t) => ['pending', 'queued'].includes(t.status)) && (
              <div className="flex items-center gap-2">
                {!isQueueRunning ? (
                  <button
                    onClick={handleStartQueue}
                    className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-1.5 px-4 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <i className="fas fa-play text-xs" />
                    Start
                  </button>
                ) : (
                  <button
                    onClick={handleTogglePause}
                    className="bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium py-1.5 px-4 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <i className="fas fa-pause text-xs" />
                    Pause
                  </button>
                )}
              </div>
            )}

            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-1.5 px-4 rounded-lg transition-colors flex items-center gap-2"
            >
              <i className="fas fa-plus text-xs" />
              Add Task
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <i className="fas fa-spinner fa-spin text-2xl text-zinc-500" />
            </div>
          ) : (
            <>
              {/* Pending Approvals */}
              {pendingApprovals.length > 0 && (
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                  <h3 className="font-semibold text-orange-400 mb-3 flex items-center gap-2">
                    <i className="fas fa-exclamation-circle" />
                    Pending Approvals ({pendingApprovals.length})
                  </h3>
                  <div className="space-y-3">
                    {pendingApprovals.map((gate) => {
                      const task = tasks.find((t) => t.id === gate.taskId)
                      return (
                        <div key={gate.id} className="bg-zinc-900 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium text-white">{gate.title}</h4>
                              {gate.description && (
                                <p className="text-sm text-zinc-400 mt-1">{gate.description}</p>
                              )}
                              {task && (
                                <p className="text-xs text-zinc-500 mt-1">
                                  Task: {task.title}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleRejectGate(gate.id)}
                                className="bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm py-1.5 px-3 rounded-lg transition-colors"
                              >
                                Reject
                              </button>
                              <button
                                onClick={() => handleApproveGate(gate.id)}
                                className="bg-green-600 hover:bg-green-700 text-white text-sm py-1.5 px-3 rounded-lg transition-colors"
                              >
                                Approve
                              </button>
                            </div>
                          </div>
                          {gate.reviewData && (
                            <pre className="mt-3 p-2 bg-zinc-800 rounded text-xs text-zinc-300 max-h-32 overflow-auto">
                              {gate.reviewData}
                            </pre>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Running Tasks */}
              {runningTasks.length > 0 && (
                <div>
                  <h3 className="font-semibold text-blue-400 mb-3 flex items-center gap-2">
                    <i className="fas fa-spinner fa-spin" />
                    Running ({runningTasks.length})
                  </h3>
                  <div className="space-y-2">
                    {runningTasks.map(renderTaskCard)}
                  </div>
                </div>
              )}

              {/* Waiting Tasks */}
              {waitingTasks.length > 0 && (
                <div>
                  <h3 className="font-semibold text-orange-400 mb-3 flex items-center gap-2">
                    <i className="fas fa-clock" />
                    Waiting Approval ({waitingTasks.length})
                  </h3>
                  <div className="space-y-2">
                    {waitingTasks.map(renderTaskCard)}
                  </div>
                </div>
              )}

              {/* Pending/Queued Tasks */}
              {pendingTasks.length > 0 && (
                <div>
                  <h3 className="font-semibold text-zinc-400 mb-3 flex items-center gap-2">
                    <i className="fas fa-list" />
                    Queue ({pendingTasks.length})
                  </h3>
                  <div className="space-y-2">
                    {pendingTasks.map(renderTaskCard)}
                  </div>
                </div>
              )}

              {/* Completed Tasks */}
              {completedTasks.length > 0 && (
                <div>
                  <h3 className="font-semibold text-zinc-500 mb-3 flex items-center gap-2">
                    <i className="fas fa-check-circle" />
                    Completed ({completedTasks.length})
                  </h3>
                  <div className="space-y-2">
                    {completedTasks.slice(0, 10).map(renderTaskCard)}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {tasks.length === 0 && (
                <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
                  <i className="fas fa-tasks text-4xl mb-4 opacity-50" />
                  <p>No tasks in queue</p>
                  <p className="text-sm mt-1">Add tasks to get started</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      {selectedTask && (
        <div className="w-96 border-l border-zinc-800 flex flex-col">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <h3 className="font-semibold text-white truncate">{selectedTask.title}</h3>
            <button
              onClick={() => setSelectedTask(null)}
              className="p-1 hover:bg-zinc-800 rounded"
            >
              <i className="fas fa-times text-zinc-400" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Status */}
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Status</label>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${STATUS_COLORS[selectedTask.status]}`} />
                <span className="text-white">{STATUS_LABELS[selectedTask.status]}</span>
              </div>
            </div>

            {/* Task Type */}
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Type</label>
              <div className="flex items-center gap-2">
                <i className={`fas fa-${TASK_TYPE_ICONS[selectedTask.taskType]} ${TASK_TYPE_COLORS[selectedTask.taskType]}`} />
                <span className="text-white capitalize">{selectedTask.taskType.replace('-', ' ')}</span>
              </div>
            </div>

            {/* Autonomy */}
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Autonomy Level</label>
              <p className="text-white">{AUTONOMY_LABELS[selectedTask.autonomyLevel]}</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {AUTONOMY_DESCRIPTIONS[selectedTask.autonomyLevel]}
              </p>
            </div>

            {/* Agent Type */}
            {selectedTask.agentType && (
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Agent</label>
                <span className="text-white capitalize">{selectedTask.agentType}</span>
              </div>
            )}

            {/* Priority */}
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Priority</label>
              <span className="text-white">{selectedTask.priority}</span>
            </div>

            {/* Description */}
            {selectedTask.description && (
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Description</label>
                <p className="text-zinc-300 text-sm whitespace-pre-wrap">
                  {selectedTask.description}
                </p>
              </div>
            )}

            {/* Output */}
            {selectedTask.outputData && (
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Output</label>
                <pre className="text-xs text-zinc-300 bg-zinc-900 p-3 rounded-lg overflow-auto max-h-48">
                  {typeof selectedTask.outputData === 'string'
                    ? selectedTask.outputData
                    : JSON.stringify(selectedTask.outputData, null, 2)}
                </pre>
              </div>
            )}

            {/* Error */}
            {selectedTask.errorMessage && (
              <div>
                <label className="text-xs text-red-500 block mb-1">Error</label>
                <pre className="text-xs text-red-300 bg-red-900/20 p-3 rounded-lg overflow-auto max-h-32">
                  {selectedTask.errorMessage}
                </pre>
              </div>
            )}

            {/* Timing */}
            <div className="text-xs text-zinc-500 pt-4 border-t border-zinc-800 space-y-1">
              <p>Created: {new Date(selectedTask.createdAt).toLocaleString()}</p>
              {selectedTask.startedAt && (
                <p>Started: {new Date(selectedTask.startedAt).toLocaleString()}</p>
              )}
              {selectedTask.completedAt && (
                <p>Completed: {new Date(selectedTask.completedAt).toLocaleString()}</p>
              )}
              {selectedTask.actualDuration && (
                <p>Duration: {Math.ceil(selectedTask.actualDuration / 60)}m</p>
              )}
            </div>
          </div>

          {/* Execution Log */}
          {executionLog.length > 0 && (
            <div className="p-4 border-t border-zinc-800">
              <label className="text-xs text-zinc-500 block mb-2">Recent Events</label>
              <div className="bg-zinc-900 rounded-lg p-2 max-h-32 overflow-auto">
                {executionLog.slice(0, 10).map((log, i) => (
                  <p key={i} className="text-xs text-zinc-400 font-mono">
                    {log}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 w-full max-w-md mx-4">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="font-semibold text-white">Add Task to Queue</h3>
              <button
                onClick={() => setShowCreateForm(false)}
                className="p-1 hover:bg-zinc-800 rounded"
              >
                <i className="fas fa-times text-zinc-400" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Title *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Enter task title..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Description</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Enter task description..."
                  rows={3}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Task Type</label>
                <select
                  value={newTaskType}
                  onChange={(e) => setNewTaskType(e.target.value as TaskType)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value="code-generation">Code Generation</option>
                  <option value="code-review">Code Review</option>
                  <option value="testing">Testing</option>
                  <option value="documentation">Documentation</option>
                  <option value="security-audit">Security Audit</option>
                  <option value="deployment">Deployment</option>
                  <option value="refactoring">Refactoring</option>
                  <option value="bug-fix">Bug Fix</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Autonomy Level</label>
                <div className="space-y-2">
                  {Object.entries(AUTONOMY_LABELS).map(([value, label]) => (
                    <label
                      key={value}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        newAutonomy === value
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-zinc-700 hover:border-zinc-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="autonomy"
                        value={value}
                        checked={newAutonomy === value}
                        onChange={(e) => setNewAutonomy(e.target.value as AutonomyLevel)}
                        className="mt-0.5"
                      />
                      <div>
                        <span className="text-sm text-white font-medium">{label}</span>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {AUTONOMY_DESCRIPTIONS[value as AutonomyLevel]}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-zinc-800 flex justify-end gap-2">
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEnqueueTask}
                disabled={!newTitle.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Add to Queue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
