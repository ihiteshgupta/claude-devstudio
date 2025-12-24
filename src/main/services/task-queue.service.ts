import { EventEmitter } from 'events'
import { databaseService } from './database.service'
import { claudeService } from './claude.service'
import type {
  QueuedTask,
  TaskType,
  AutonomyLevel,
  TaskStatus,
  TaskInputData,
  TaskOutputData,
  AgentType,
  ApprovalGate,
  GateType,
  GateStatus,
  TaskQueueEvent
} from '@shared/types'

interface EnqueueTaskInput {
  projectId: string
  roadmapItemId?: string
  parentTaskId?: string
  title: string
  description?: string
  taskType: TaskType
  autonomyLevel?: AutonomyLevel
  agentType?: AgentType
  priority?: number
  inputData?: TaskInputData
  estimatedDuration?: number
}

interface TaskQueueOptions {
  projectPath: string
  onEvent?: (event: TaskQueueEvent) => void
}

class TaskQueueService extends EventEmitter {
  private isRunning = false
  private isPaused = false
  private currentTaskId: string | null = null
  private projectPath: string | null = null

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Emit task queue event
   */
  private emitEvent(type: TaskQueueEvent['type'], taskId: string, data?: unknown): void {
    const event: TaskQueueEvent = {
      type,
      taskId,
      data,
      timestamp: new Date()
    }
    this.emit('task-event', event)
  }

  /**
   * List all tasks for a project
   */
  listTasks(projectId: string, options?: { status?: TaskStatus }): QueuedTask[] {
    const db = databaseService.getDb()

    let query = `SELECT * FROM task_queue WHERE project_id = ?`
    const params: string[] = [projectId]

    if (options?.status) {
      query += ` AND status = ?`
      params.push(options.status)
    }

    query += ` ORDER BY priority DESC, created_at ASC`

    const rows = db.prepare(query).all(...params) as TaskRow[]
    return rows.map(this.rowToTask)
  }

  /**
   * Get a single task by ID
   */
  getTask(id: string): QueuedTask | null {
    const db = databaseService.getDb()
    const row = db.prepare('SELECT * FROM task_queue WHERE id = ?').get(id) as TaskRow | undefined
    return row ? this.rowToTask(row) : null
  }

  /**
   * Get tasks with their subtasks (hierarchical)
   */
  getTasksHierarchy(projectId: string): QueuedTask[] {
    const allTasks = this.listTasks(projectId)
    const taskMap = new Map<string, QueuedTask>()
    const rootTasks: QueuedTask[] = []

    // First pass: create map
    for (const task of allTasks) {
      taskMap.set(task.id, { ...task, subtasks: [] })
    }

    // Second pass: build hierarchy
    for (const task of allTasks) {
      const mappedTask = taskMap.get(task.id)!
      if (task.parentTaskId && taskMap.has(task.parentTaskId)) {
        const parent = taskMap.get(task.parentTaskId)!
        parent.subtasks = parent.subtasks || []
        parent.subtasks.push(mappedTask)
      } else {
        rootTasks.push(mappedTask)
      }
    }

    return rootTasks
  }

  /**
   * Enqueue a new task
   */
  enqueueTask(input: EnqueueTaskInput): QueuedTask {
    const db = databaseService.getDb()
    const now = new Date().toISOString()
    const id = this.generateId('task')

    const autonomyLevel = input.autonomyLevel || 'supervised'
    const approvalRequired = autonomyLevel !== 'auto'

    db.prepare(`
      INSERT INTO task_queue (
        id, project_id, roadmap_item_id, parent_task_id, title, description,
        task_type, autonomy_level, status, agent_type, priority, input_data,
        approval_required, estimated_duration, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.projectId,
      input.roadmapItemId || null,
      input.parentTaskId || null,
      input.title,
      input.description || null,
      input.taskType,
      autonomyLevel,
      'pending',
      input.agentType || null,
      input.priority || 50,
      input.inputData ? JSON.stringify(input.inputData) : null,
      approvalRequired ? 1 : 0,
      input.estimatedDuration || null,
      now
    )

    const task = this.getTask(id)!
    this.emitEvent('task-queued', id, task)
    return task
  }

  /**
   * Update task status
   */
  updateTaskStatus(id: string, status: TaskStatus, data?: Partial<QueuedTask>): QueuedTask | null {
    const existing = this.getTask(id)
    if (!existing) return null

    const db = databaseService.getDb()
    const now = new Date().toISOString()

    const updates: string[] = ['status = ?']
    const params: (string | number | null)[] = [status]

    if (status === 'running' && !existing.startedAt) {
      updates.push('started_at = ?')
      params.push(now)
    }

    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      updates.push('completed_at = ?')
      params.push(now)

      // Calculate actual duration
      if (existing.startedAt) {
        const startTime = new Date(existing.startedAt).getTime()
        const endTime = new Date(now).getTime()
        const duration = Math.floor((endTime - startTime) / 1000)
        updates.push('actual_duration = ?')
        params.push(duration)
      }
    }

    if (data?.outputData) {
      updates.push('output_data = ?')
      params.push(JSON.stringify(data.outputData))
    }

    if (data?.errorMessage) {
      updates.push('error_message = ?')
      params.push(data.errorMessage)
    }

    params.push(id)
    db.prepare(`UPDATE task_queue SET ${updates.join(', ')} WHERE id = ?`).run(...params)

    return this.getTask(id)
  }

  /**
   * Update task autonomy level
   */
  updateAutonomyLevel(id: string, level: AutonomyLevel): QueuedTask | null {
    const db = databaseService.getDb()
    const approvalRequired = level !== 'auto' ? 1 : 0

    db.prepare('UPDATE task_queue SET autonomy_level = ?, approval_required = ? WHERE id = ?')
      .run(level, approvalRequired, id)

    return this.getTask(id)
  }

  /**
   * Cancel a task
   */
  cancelTask(id: string): boolean {
    const task = this.getTask(id)
    if (!task) return false

    if (task.status === 'running') {
      // Cancel current execution
      claudeService.cancelCurrent()
    }

    this.updateTaskStatus(id, 'cancelled')
    this.emitEvent('task-cancelled', id)
    return true
  }

  /**
   * Reorder task priority
   */
  reorderTask(id: string, priority: number): QueuedTask | null {
    const db = databaseService.getDb()
    db.prepare('UPDATE task_queue SET priority = ? WHERE id = ?').run(priority, id)
    return this.getTask(id)
  }

  /**
   * Create an approval gate for a task
   */
  createApprovalGate(
    taskId: string,
    gateType: GateType,
    title: string,
    description?: string,
    reviewData?: string
  ): ApprovalGate {
    const db = databaseService.getDb()
    const now = new Date().toISOString()
    const id = this.generateId('gate')

    db.prepare(`
      INSERT INTO approval_gates (
        id, task_id, gate_type, title, description, status,
        requires_review, review_data, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      taskId,
      gateType,
      title,
      description || null,
      'pending',
      1,
      reviewData || null,
      now
    )

    // Update task to waiting for approval
    this.updateTaskStatus(taskId, 'waiting_approval')
    db.prepare('UPDATE task_queue SET approval_checkpoint = ? WHERE id = ?').run(id, taskId)

    return this.getApprovalGate(id)!
  }

  /**
   * Get an approval gate
   */
  getApprovalGate(id: string): ApprovalGate | null {
    const db = databaseService.getDb()
    const row = db.prepare('SELECT * FROM approval_gates WHERE id = ?').get(id) as ApprovalGateRow | undefined
    return row ? this.rowToGate(row) : null
  }

  /**
   * List approval gates for a task
   */
  listApprovalGates(taskId: string): ApprovalGate[] {
    const db = databaseService.getDb()
    const rows = db.prepare('SELECT * FROM approval_gates WHERE task_id = ? ORDER BY created_at DESC')
      .all(taskId) as ApprovalGateRow[]
    return rows.map(this.rowToGate)
  }

  /**
   * Approve a gate
   */
  approveGate(id: string, approvedBy: string, notes?: string): ApprovalGate | null {
    const gate = this.getApprovalGate(id)
    if (!gate) return null

    const db = databaseService.getDb()
    const now = new Date().toISOString()

    db.prepare(`
      UPDATE approval_gates
      SET status = ?, approved_by = ?, approval_notes = ?, resolved_at = ?
      WHERE id = ?
    `).run('approved', approvedBy, notes || null, now, id)

    // Resume the task
    const task = this.getTask(gate.taskId)
    if (task) {
      this.updateTaskStatus(gate.taskId, 'queued')
      this.emitEvent('task-approval-required', gate.taskId, { approved: true })
    }

    return this.getApprovalGate(id)
  }

  /**
   * Reject a gate
   */
  rejectGate(id: string, rejectedBy: string, notes?: string): ApprovalGate | null {
    const gate = this.getApprovalGate(id)
    if (!gate) return null

    const db = databaseService.getDb()
    const now = new Date().toISOString()

    db.prepare(`
      UPDATE approval_gates
      SET status = ?, approved_by = ?, approval_notes = ?, resolved_at = ?
      WHERE id = ?
    `).run('rejected', rejectedBy, notes || null, now, id)

    // Cancel the task
    const task = this.getTask(gate.taskId)
    if (task) {
      this.updateTaskStatus(gate.taskId, 'cancelled', { errorMessage: 'Rejected at approval gate' })
      this.emitEvent('task-cancelled', gate.taskId, { rejected: true })
    }

    return this.getApprovalGate(id)
  }

  /**
   * Check if task dependencies are satisfied
   */
  private areDependenciesSatisfied(taskId: string): boolean {
    const db = databaseService.getDb()

    const dependencies = db.prepare(`
      SELECT t.id, t.status
      FROM task_dependencies d
      JOIN task_queue t ON t.id = d.depends_on_task_id
      WHERE d.task_id = ? AND d.dependency_type = 'blocks'
    `).all(taskId) as { id: string; status: string }[]

    return dependencies.every(d => d.status === 'completed')
  }

  /**
   * Get next task to execute
   */
  private getNextTask(projectId: string): QueuedTask | null {
    const db = databaseService.getDb()

    // Get pending or queued tasks ordered by priority
    const tasks = db.prepare(`
      SELECT * FROM task_queue
      WHERE project_id = ? AND status IN ('pending', 'queued')
      ORDER BY priority DESC, created_at ASC
    `).all(projectId) as TaskRow[]

    for (const row of tasks) {
      const task = this.rowToTask(row)
      if (this.areDependenciesSatisfied(task.id)) {
        // Check if needs approval before starting
        if (task.autonomyLevel === 'supervised' && task.status === 'pending') {
          // Create pre-execution approval gate
          this.createApprovalGate(
            task.id,
            'manual',
            `Approve: ${task.title}`,
            'Review task before execution',
            JSON.stringify(task.inputData)
          )
          return null // Wait for approval
        }
        return task
      }
    }

    return null
  }

  /**
   * Start the execution loop
   */
  async startQueue(projectId: string, options: TaskQueueOptions): Promise<void> {
    if (this.isRunning) {
      throw new Error('Queue is already running')
    }

    this.isRunning = true
    this.isPaused = false
    this.projectPath = options.projectPath

    this.emit('queue-started', projectId)

    try {
      await this.runExecutionLoop(projectId)
    } finally {
      this.isRunning = false
      this.currentTaskId = null
      this.projectPath = null
    }
  }

  /**
   * Main execution loop
   */
  private async runExecutionLoop(projectId: string): Promise<void> {
    while (this.isRunning && !this.isPaused) {
      const task = this.getNextTask(projectId)

      if (!task) {
        // No tasks ready, check if any pending
        const pending = this.listTasks(projectId, { status: 'pending' })
        const queued = this.listTasks(projectId, { status: 'queued' })
        const waiting = this.listTasks(projectId, { status: 'waiting_approval' })

        if (pending.length === 0 && queued.length === 0 && waiting.length === 0) {
          // All done
          this.isRunning = false
          this.emit('queue-completed', projectId)
          return
        }

        // Wait a bit before checking again
        await this.sleep(1000)
        continue
      }

      this.currentTaskId = task.id
      await this.executeTask(task)
      this.currentTaskId = null
    }
  }

  /**
   * Execute a single task
   */
  private async executeTask(task: QueuedTask): Promise<void> {
    this.updateTaskStatus(task.id, 'running')
    this.emitEvent('task-started', task.id, task)

    try {
      const output = await this.runAgentTask(task)

      // Check if needs post-execution approval (approval_gates mode)
      if (task.autonomyLevel === 'approval_gates') {
        this.createApprovalGate(
          task.id,
          'review',
          `Review: ${task.title}`,
          'Review task output before proceeding',
          output
        )
        return // Will be completed after approval
      }

      this.updateTaskStatus(task.id, 'completed', {
        outputData: { result: output }
      })
      this.emitEvent('task-completed', task.id, { output })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Check retry count
      if (task.retryCount < task.maxRetries) {
        const db = databaseService.getDb()
        db.prepare('UPDATE task_queue SET retry_count = retry_count + 1 WHERE id = ?').run(task.id)
        this.updateTaskStatus(task.id, 'pending')
        return
      }

      this.updateTaskStatus(task.id, 'failed', { errorMessage })
      this.emitEvent('task-failed', task.id, { error: errorMessage })
    }
  }

  /**
   * Run agent task using Claude CLI
   */
  private runAgentTask(task: QueuedTask): Promise<string> {
    return new Promise((resolve, reject) => {
      const sessionId = `task_${task.id}`
      let output = ''
      let completed = false

      // Build the prompt from input data
      const prompt = this.buildTaskPrompt(task)

      const handleStream = (data: { sessionId: string; content: string }): void => {
        if (data.sessionId === sessionId) {
          output += data.content
          this.emitEvent('task-progress', task.id, { output })
        }
      }

      const handleComplete = (data: { sessionId: string; content: string }): void => {
        if (data.sessionId === sessionId && !completed) {
          completed = true
          cleanup()
          resolve(data.content || output)
        }
      }

      const handleError = (data: { sessionId: string; error: string }): void => {
        if (data.sessionId === sessionId && !completed) {
          completed = true
          cleanup()
          reject(new Error(data.error))
        }
      }

      const cleanup = (): void => {
        claudeService.removeListener('stream', handleStream)
        claudeService.removeListener('complete', handleComplete)
        claudeService.removeListener('error', handleError)
      }

      claudeService.on('stream', handleStream)
      claudeService.on('complete', handleComplete)
      claudeService.on('error', handleError)

      claudeService
        .sendMessage({
          sessionId,
          message: prompt,
          projectPath: this.projectPath!,
          agentType: task.agentType || 'developer'
        })
        .catch((error) => {
          if (!completed) {
            completed = true
            cleanup()
            reject(error)
          }
        })
    })
  }

  /**
   * Build prompt from task data
   */
  private buildTaskPrompt(task: QueuedTask): string {
    let prompt = task.description || task.title

    if (task.inputData) {
      if (task.inputData.prompt) {
        prompt = task.inputData.prompt
      }
      if (task.inputData.context) {
        prompt = `Context:\n${task.inputData.context}\n\nTask:\n${prompt}`
      }
      if (task.inputData.parentOutput) {
        prompt = `Previous output:\n${task.inputData.parentOutput}\n\n${prompt}`
      }
    }

    return prompt
  }

  /**
   * Pause the queue
   */
  pauseQueue(): void {
    this.isPaused = true
    this.emitEvent('queue-paused', this.currentTaskId || '')
  }

  /**
   * Resume the queue
   */
  resumeQueue(): void {
    this.isPaused = false
    this.emitEvent('queue-resumed', this.currentTaskId || '')
  }

  /**
   * Stop the queue
   */
  stopQueue(): void {
    this.isRunning = false
    if (this.currentTaskId) {
      claudeService.cancelCurrent()
      this.updateTaskStatus(this.currentTaskId, 'cancelled')
    }
  }

  /**
   * Check if queue is running
   */
  isQueueRunning(): boolean {
    return this.isRunning
  }

  /**
   * Check if queue is paused
   */
  isQueuePaused(): boolean {
    return this.isPaused
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Convert database row to QueuedTask
   */
  private rowToTask(row: TaskRow): QueuedTask {
    return {
      id: row.id,
      projectId: row.project_id,
      roadmapItemId: row.roadmap_item_id || undefined,
      parentTaskId: row.parent_task_id || undefined,
      title: row.title,
      description: row.description || undefined,
      taskType: row.task_type as TaskType,
      autonomyLevel: row.autonomy_level as AutonomyLevel,
      status: row.status as TaskStatus,
      agentType: row.agent_type as AgentType | undefined,
      priority: row.priority,
      inputData: row.input_data ? JSON.parse(row.input_data) : undefined,
      outputData: row.output_data ? JSON.parse(row.output_data) : undefined,
      errorMessage: row.error_message || undefined,
      approvalRequired: row.approval_required === 1,
      approvalCheckpoint: row.approval_checkpoint || undefined,
      approvedBy: row.approved_by || undefined,
      approvedAt: row.approved_at ? new Date(row.approved_at) : undefined,
      estimatedDuration: row.estimated_duration || undefined,
      actualDuration: row.actual_duration || undefined,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      createdAt: new Date(row.created_at),
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined
    }
  }

  /**
   * Convert database row to ApprovalGate
   */
  private rowToGate(row: ApprovalGateRow): ApprovalGate {
    return {
      id: row.id,
      taskId: row.task_id,
      gateType: row.gate_type as GateType,
      title: row.title,
      description: row.description || undefined,
      status: row.status as GateStatus,
      requiresReview: row.requires_review === 1,
      reviewData: row.review_data || undefined,
      approvedBy: row.approved_by || undefined,
      approvalNotes: row.approval_notes || undefined,
      createdAt: new Date(row.created_at),
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined
    }
  }
}

// Database row types
interface TaskRow {
  id: string
  project_id: string
  roadmap_item_id: string | null
  parent_task_id: string | null
  title: string
  description: string | null
  task_type: string
  autonomy_level: string
  status: string
  agent_type: string | null
  priority: number
  input_data: string | null
  output_data: string | null
  error_message: string | null
  approval_required: number
  approval_checkpoint: string | null
  approved_by: string | null
  approved_at: string | null
  estimated_duration: number | null
  actual_duration: number | null
  retry_count: number
  max_retries: number
  created_at: string
  started_at: string | null
  completed_at: string | null
}

interface ApprovalGateRow {
  id: string
  task_id: string
  gate_type: string
  title: string
  description: string | null
  status: string
  requires_review: number
  review_data: string | null
  approved_by: string | null
  approval_notes: string | null
  created_at: string
  resolved_at: string | null
}

export const taskQueueService = new TaskQueueService()
