import { EventEmitter } from 'events'
import { taskQueueService } from './task-queue.service'
import { approvalResolverService } from './approval-resolver.service'
import { databaseService } from './database.service'
import type { AutonomyLevel, QueuedTask, TaskStatus } from '@shared/types'

interface AutonomousConfig {
  projectId: string
  projectPath: string
  defaultAutonomyLevel: AutonomyLevel
  checkIntervalMs: number
  autoApproveThreshold: number // Quality score 0-100 to auto-approve
  maxIdleMinutes: number // Stop after this many minutes with no work
  enableAutoApproval: boolean
}

interface ExecutionStats {
  tasksCompleted: number
  tasksFailed: number
  tasksAutoApproved: number
  tasksManualApproval: number
  totalRunTimeMs: number
  lastActivityAt: Date
  errors: Array<{ taskId: string; error: string; timestamp: Date }>
}

interface AutonomousState {
  isRunning: boolean
  isPaused: boolean
  startedAt: Date | null
  config: AutonomousConfig | null
  stats: ExecutionStats
}

class AutonomousExecutorService extends EventEmitter {
  private state: AutonomousState = {
    isRunning: false,
    isPaused: false,
    startedAt: null,
    config: null,
    stats: this.createEmptyStats()
  }

  private watchdogInterval: NodeJS.Timeout | null = null
  private monitorInterval: NodeJS.Timeout | null = null

  /**
   * Create empty stats object
   */
  private createEmptyStats(): ExecutionStats {
    return {
      tasksCompleted: 0,
      tasksFailed: 0,
      tasksAutoApproved: 0,
      tasksManualApproval: 0,
      totalRunTimeMs: 0,
      lastActivityAt: new Date(),
      errors: []
    }
  }

  /**
   * Start continuous autonomous execution
   */
  async startContinuous(config: AutonomousConfig): Promise<void> {
    if (this.state.isRunning) {
      throw new Error('Autonomous executor is already running')
    }

    this.state = {
      isRunning: true,
      isPaused: false,
      startedAt: new Date(),
      config,
      stats: this.createEmptyStats()
    }

    this.emit('autonomous-started', { config, startedAt: this.state.startedAt })

    // Start watchdog for stuck tasks
    this.startWatchdog(config.projectId)

    // Start monitoring loop
    this.startMonitor(config)

    // Subscribe to task queue events
    this.subscribeToTaskEvents()

    try {
      await this.runContinuousLoop(config)
    } finally {
      this.cleanup()
    }
  }

  /**
   * Main continuous execution loop
   */
  private async runContinuousLoop(config: AutonomousConfig): Promise<void> {
    while (this.state.isRunning && !this.state.isPaused) {
      try {
        // Check for pending approval gates that can be auto-resolved
        if (config.enableAutoApproval) {
          await this.processAutoApprovals(config)
        }

        // Check if task queue is running
        if (!taskQueueService.isQueueRunning()) {
          // Check if there's work to do
          const hasPendingWork = this.hasPendingWork(config.projectId)

          if (hasPendingWork) {
            // Start the task queue
            await taskQueueService.startQueue(config.projectId, {
              projectPath: config.projectPath
            })
          } else {
            // Check idle timeout
            const idleMs = Date.now() - this.state.stats.lastActivityAt.getTime()
            const maxIdleMs = config.maxIdleMinutes * 60 * 1000

            if (idleMs > maxIdleMs) {
              this.emit('autonomous-idle-timeout', {
                idleMinutes: config.maxIdleMinutes,
                stats: this.state.stats
              })
              this.state.isRunning = false
              break
            }
          }
        }

        // Wait before next iteration
        await this.sleep(config.checkIntervalMs)

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        this.emit('autonomous-error', { error: errorMessage })
        this.state.stats.errors.push({
          taskId: 'executor',
          error: errorMessage,
          timestamp: new Date()
        })

        // Continue running despite errors
        await this.sleep(config.checkIntervalMs * 2)
      }
    }
  }

  /**
   * Process approval gates that can be auto-approved
   */
  private async processAutoApprovals(config: AutonomousConfig): Promise<void> {
    const db = databaseService.getDb()

    // Get pending approval gates
    const pendingGates = db.prepare(`
      SELECT ag.*, tq.task_type, tq.output_data
      FROM approval_gates ag
      JOIN task_queue tq ON tq.id = ag.task_id
      WHERE ag.status = 'pending'
      AND tq.project_id = ?
    `).all(config.projectId) as Array<{
      id: string
      task_id: string
      gate_type: string
      task_type: string
      output_data: string | null
    }>

    for (const gate of pendingGates) {
      try {
        const assessment = await approvalResolverService.assessForAutoApproval(
          gate.task_id,
          gate.output_data ? JSON.parse(gate.output_data) : null
        )

        if (assessment.canAutoApprove && assessment.qualityScore >= config.autoApproveThreshold) {
          // Auto-approve
          taskQueueService.approveGate(
            gate.id,
            'autonomous-executor',
            `Auto-approved: Quality score ${assessment.qualityScore}%, Risk: ${assessment.riskLevel}`
          )
          this.state.stats.tasksAutoApproved++
          this.state.stats.lastActivityAt = new Date()

          this.emit('auto-approved', {
            gateId: gate.id,
            taskId: gate.task_id,
            assessment
          })
        } else {
          this.state.stats.tasksManualApproval++
          this.emit('manual-approval-required', {
            gateId: gate.id,
            taskId: gate.task_id,
            assessment
          })
        }
      } catch (error) {
        console.error(`Failed to process approval gate ${gate.id}:`, error)
      }
    }
  }

  /**
   * Check if there's pending work in the queue
   */
  private hasPendingWork(projectId: string): boolean {
    const pending = taskQueueService.listTasks(projectId, { status: 'pending' })
    const queued = taskQueueService.listTasks(projectId, { status: 'queued' })
    return pending.length > 0 || queued.length > 0
  }

  /**
   * Start watchdog for stuck tasks
   */
  private startWatchdog(projectId: string): void {
    this.watchdogInterval = setInterval(() => {
      this.checkForStuckTasks(projectId)
    }, 60000) // Check every minute
  }

  /**
   * Check for tasks stuck in running state
   */
  private checkForStuckTasks(projectId: string): void {
    const runningTasks = taskQueueService.listTasks(projectId, { status: 'running' })
    const now = Date.now()

    for (const task of runningTasks) {
      if (!task.startedAt) continue

      const runningTime = now - task.startedAt.getTime()
      const timeout = (task.estimatedDuration || 300) * 2 * 1000 // 2x estimated or 10 min

      if (runningTime > timeout) {
        this.emit('task-stuck', {
          taskId: task.id,
          runningTimeMs: runningTime,
          timeoutMs: timeout
        })

        // Force cancel and re-queue with enriched context
        this.handleStuckTask(task)
      }
    }
  }

  /**
   * Handle a stuck task
   */
  private handleStuckTask(task: QueuedTask): void {
    const db = databaseService.getDb()

    // Cancel current execution
    taskQueueService.cancelTask(task.id)

    // Check retry count
    if (task.retryCount < task.maxRetries) {
      // Enrich context and re-queue
      const enrichedInput = {
        ...(task.inputData || {}),
        context: `${task.inputData?.context || ''}\n\nNote: Previous attempt timed out after ${task.estimatedDuration || 300}s. Please be more concise or break down the task.`,
        previousErrors: [
          ...(task.inputData?.previousErrors || []),
          `Timeout after ${Math.floor((Date.now() - (task.startedAt?.getTime() || Date.now())) / 1000)}s`
        ]
      }

      db.prepare(`
        UPDATE task_queue
        SET status = 'pending',
            retry_count = retry_count + 1,
            input_data = ?,
            error_message = 'Task timed out, retrying with enriched context'
        WHERE id = ?
      `).run(JSON.stringify(enrichedInput), task.id)

      this.emit('task-retried', { taskId: task.id, reason: 'timeout' })
    } else {
      // Mark as failed
      taskQueueService.updateTaskStatus(task.id, 'failed', {
        errorMessage: 'Task exceeded maximum timeout after all retries'
      })
      this.state.stats.tasksFailed++
    }
  }

  /**
   * Start progress monitor
   */
  private startMonitor(config: AutonomousConfig): void {
    this.monitorInterval = setInterval(() => {
      if (this.state.startedAt) {
        this.state.stats.totalRunTimeMs = Date.now() - this.state.startedAt.getTime()
      }

      this.emit('autonomous-progress', {
        stats: this.state.stats,
        isRunning: this.state.isRunning,
        isPaused: this.state.isPaused
      })
    }, 30000) // Every 30 seconds
  }

  /**
   * Subscribe to task queue events
   */
  private subscribeToTaskEvents(): void {
    taskQueueService.on('task-event', (event) => {
      this.state.stats.lastActivityAt = new Date()

      if (event.type === 'task-completed') {
        this.state.stats.tasksCompleted++
      } else if (event.type === 'task-failed') {
        this.state.stats.tasksFailed++
        this.state.stats.errors.push({
          taskId: event.taskId,
          error: String(event.data?.error || 'Unknown error'),
          timestamp: new Date()
        })
      }

      // Forward event
      this.emit('task-event', event)
    })
  }

  /**
   * Pause autonomous execution
   */
  pause(): void {
    this.state.isPaused = true
    taskQueueService.pauseQueue()
    this.emit('autonomous-paused', { stats: this.state.stats })
  }

  /**
   * Resume autonomous execution
   */
  resume(): void {
    this.state.isPaused = false
    taskQueueService.resumeQueue()
    this.emit('autonomous-resumed', { stats: this.state.stats })
  }

  /**
   * Stop autonomous execution
   */
  stop(): void {
    this.state.isRunning = false
    taskQueueService.stopQueue()
    this.cleanup()
    this.emit('autonomous-stopped', { stats: this.state.stats })
  }

  /**
   * Get current state
   */
  getState(): AutonomousState {
    return { ...this.state }
  }

  /**
   * Get execution statistics
   */
  getStats(): ExecutionStats {
    return { ...this.state.stats }
  }

  /**
   * Check if running
   */
  isRunning(): boolean {
    return this.state.isRunning
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval)
      this.watchdogInterval = null
    }
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval)
      this.monitorInterval = null
    }
    taskQueueService.removeAllListeners('task-event')
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export const autonomousExecutorService = new AutonomousExecutorService()
