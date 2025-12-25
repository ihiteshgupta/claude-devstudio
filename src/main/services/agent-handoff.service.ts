import { EventEmitter } from 'events'
import { databaseService } from './database.service'
import { taskQueueService } from './task-queue.service'
import type {
  AgentType,
  AgentHandoff,
  HandoffPipeline,
  HandoffType,
  HandoffStatus,
  HandoffItemType,
  TaskType
} from '@shared/types'

/**
 * Agent Handoff Service
 *
 * Coordinates work handoffs between AI agents in multi-agent workflows.
 * Tracks ownership, manages handoff pipelines, and auto-creates tasks
 * for receiving agents.
 */

// ============================================
// Service-specific Types
// ============================================

interface CreateHandoffParams {
  projectId: string
  itemId: string
  itemType: HandoffItemType
  fromAgent: AgentType
  toAgent?: AgentType // Auto-detect from pipeline if not specified
  message?: string
  contextData?: Record<string, unknown>
  autoCreateTask?: boolean
}

interface HandoffRow {
  id: string
  project_id: string
  item_id: string
  item_type: string
  from_agent: string
  to_agent: string
  handoff_type: string
  status: string
  message: string | null
  context_data: string | null
  created_at: string
  accepted_at: string | null
  completed_at: string | null
}

// ============================================
// Pre-defined Handoff Pipelines
// ============================================

const HANDOFF_PIPELINES: HandoffPipeline[] = [
  {
    id: 'story-implementation',
    name: 'Story Implementation Pipeline',
    description: 'Product Owner → Developer → Tester → Security',
    agents: ['product-owner', 'developer', 'tester', 'security'],
    itemTypes: ['story' as HandoffItemType]
  },
  {
    id: 'code-review',
    name: 'Code Review Pipeline',
    description: 'Developer → Security → Tester',
    agents: ['developer', 'security', 'tester'],
    itemTypes: ['code-review' as HandoffItemType]
  },
  {
    id: 'bug-fix',
    name: 'Bug Fix Pipeline',
    description: 'Tester → Developer → Tester',
    agents: ['tester', 'developer', 'tester'],
    itemTypes: ['task' as HandoffItemType]
  },
  {
    id: 'feature-complete',
    name: 'Feature Completion Pipeline',
    description: 'Developer → Tester → Security → Documentation → DevOps',
    agents: ['developer', 'tester', 'security', 'documentation', 'devops'],
    itemTypes: ['roadmap' as HandoffItemType, 'story' as HandoffItemType]
  },
  {
    id: 'documentation',
    name: 'Documentation Pipeline',
    description: 'Developer → Documentation → Product Owner',
    agents: ['developer', 'documentation', 'product-owner'],
    itemTypes: ['story' as HandoffItemType, 'roadmap' as HandoffItemType]
  },
  {
    id: 'security-review',
    name: 'Security Review Pipeline',
    description: 'Developer → Security → DevOps',
    agents: ['developer', 'security', 'devops'],
    itemTypes: ['code-review' as HandoffItemType, 'task' as HandoffItemType]
  }
]

// ============================================
// Agent Handoff Service Class
// ============================================

class AgentHandoffService extends EventEmitter {
  constructor() {
    super()
    this.initDatabase()
  }

  /**
   * Initialize database tables
   */
  private initDatabase(): void {
    const db = databaseService.getDb()

    // Agent handoffs table
    db.exec(`
      CREATE TABLE IF NOT EXISTS agent_handoffs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        item_type TEXT NOT NULL,
        from_agent TEXT NOT NULL,
        to_agent TEXT NOT NULL,
        handoff_type TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        message TEXT,
        context_data TEXT,
        created_at TEXT NOT NULL,
        accepted_at TEXT,
        completed_at TEXT
      )
    `)

    // Create indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_handoffs_project ON agent_handoffs(project_id);
      CREATE INDEX IF NOT EXISTS idx_handoffs_item ON agent_handoffs(item_id);
      CREATE INDEX IF NOT EXISTS idx_handoffs_status ON agent_handoffs(status);
      CREATE INDEX IF NOT EXISTS idx_handoffs_to_agent ON agent_handoffs(to_agent);
    `)
  }

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * Get all defined handoff pipelines
   */
  getPipelines(): HandoffPipeline[] {
    return HANDOFF_PIPELINES
  }

  /**
   * Get a specific pipeline by ID
   */
  getPipeline(pipelineId: string): HandoffPipeline | null {
    return HANDOFF_PIPELINES.find((p) => p.id === pipelineId) || null
  }

  /**
   * Find appropriate pipeline for item type
   */
  private findPipelineForItem(itemType: HandoffItemType): HandoffPipeline | null {
    return HANDOFF_PIPELINES.find((p) => p.itemTypes.includes(itemType)) || null
  }

  /**
   * Get next agent in pipeline
   */
  private getNextAgent(
    fromAgent: AgentType,
    pipeline: HandoffPipeline
  ): AgentType | null {
    const currentIndex = pipeline.agents.indexOf(fromAgent)
    if (currentIndex === -1 || currentIndex === pipeline.agents.length - 1) {
      return null // Not in pipeline or is last agent
    }
    return pipeline.agents[currentIndex + 1]
  }

  /**
   * Initiate a handoff from one agent to another
   */
  async initiateHandoff(params: CreateHandoffParams): Promise<AgentHandoff> {
    const db = databaseService.getDb()
    const now = new Date().toISOString()
    const id = this.generateId('handoff')

    // Auto-detect next agent if not specified
    let toAgent = params.toAgent
    if (!toAgent) {
      const pipeline = this.findPipelineForItem(params.itemType)
      if (pipeline) {
        const nextAgent = this.getNextAgent(params.fromAgent, pipeline)
        if (nextAgent) {
          toAgent = nextAgent
        }
      }
    }

    if (!toAgent) {
      throw new Error(
        `Cannot determine next agent for handoff. Please specify toAgent explicitly.`
      )
    }

    // Create handoff record
    db.prepare(`
      INSERT INTO agent_handoffs (
        id, project_id, item_id, item_type, from_agent, to_agent,
        handoff_type, status, message, context_data, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      params.projectId,
      params.itemId,
      params.itemType,
      params.fromAgent,
      toAgent,
      params.toAgent ? 'manual' : 'auto',
      'pending',
      params.message || null,
      params.contextData ? JSON.stringify(params.contextData) : null,
      now
    )

    const handoff = this.getHandoff(id)!

    // Emit event
    this.emit('handoff-created', handoff)

    // Auto-create task for receiving agent if requested
    if (params.autoCreateTask !== false) {
      await this.createHandoffTask(handoff)
    }

    return handoff
  }

  /**
   * Create a task in the queue for the receiving agent
   */
  private async createHandoffTask(handoff: AgentHandoff): Promise<void> {
    try {
      const taskTitle = `${handoff.itemType} handoff: ${handoff.itemId}`
      const taskDescription = handoff.message || `Work handed off from ${handoff.fromAgent}`

      taskQueueService.enqueueTask({
        projectId: handoff.projectId,
        title: taskTitle,
        description: taskDescription,
        taskType: this.mapItemTypeToTaskType(handoff.itemType),
        agentType: handoff.toAgent,
        autonomyLevel: 'supervised',
        priority: 60, // Medium-high priority for handoffs
        inputData: {
          handoffId: handoff.id,
          itemId: handoff.itemId,
          itemType: handoff.itemType,
          fromAgent: handoff.fromAgent,
          context: JSON.stringify(handoff.contextData || {})
        }
      })

      this.emit('handoff-task-created', {
        handoffId: handoff.id,
        toAgent: handoff.toAgent
      })
    } catch (error) {
      console.error('Failed to create handoff task:', error)
    }
  }

  /**
   * Map item type to task type
   */
  private mapItemTypeToTaskType(itemType: HandoffItemType): TaskType {
    const mapping: Record<HandoffItemType, TaskType> = {
      story: 'code-generation',
      task: 'code-generation',
      roadmap: 'code-generation',
      'test-case': 'testing',
      'code-review': 'code-review'
    }
    return mapping[itemType] || 'code-generation'
  }

  /**
   * Accept a handoff (receiving agent acknowledges)
   */
  async acceptHandoff(handoffId: string, agentType: AgentType): Promise<void> {
    const handoff = this.getHandoff(handoffId)
    if (!handoff) {
      throw new Error(`Handoff ${handoffId} not found`)
    }

    if (handoff.toAgent !== agentType) {
      throw new Error(
        `Handoff is for ${handoff.toAgent}, not ${agentType}`
      )
    }

    if (handoff.status !== 'pending') {
      throw new Error(`Handoff is already ${handoff.status}`)
    }

    const db = databaseService.getDb()
    const now = new Date().toISOString()

    db.prepare(`
      UPDATE agent_handoffs
      SET status = 'accepted', accepted_at = ?
      WHERE id = ?
    `).run(now, handoffId)

    this.emit('handoff-accepted', {
      handoffId,
      agentType,
      timestamp: new Date()
    })
  }

  /**
   * Complete a handoff (work is done)
   */
  async completeHandoff(handoffId: string, outputData?: unknown): Promise<void> {
    const handoff = this.getHandoff(handoffId)
    if (!handoff) {
      throw new Error(`Handoff ${handoffId} not found`)
    }

    if (handoff.status === 'completed') {
      throw new Error('Handoff is already completed')
    }

    const db = databaseService.getDb()
    const now = new Date().toISOString()

    // Update context data with output if provided
    let updatedContext = handoff.contextData || {}
    if (outputData) {
      updatedContext = {
        ...updatedContext,
        output: outputData,
        completedBy: handoff.toAgent
      }
    }

    db.prepare(`
      UPDATE agent_handoffs
      SET status = 'completed', completed_at = ?, context_data = ?
      WHERE id = ?
    `).run(now, JSON.stringify(updatedContext), handoffId)

    this.emit('handoff-completed', {
      handoffId,
      fromAgent: handoff.fromAgent,
      toAgent: handoff.toAgent,
      outputData,
      timestamp: new Date()
    })

    // Check if there's a next agent in the pipeline
    const pipeline = this.findPipelineForItem(handoff.itemType)
    if (pipeline) {
      const nextAgent = this.getNextAgent(handoff.toAgent, pipeline)
      if (nextAgent) {
        // Auto-initiate next handoff in pipeline
        await this.initiateHandoff({
          projectId: handoff.projectId,
          itemId: handoff.itemId,
          itemType: handoff.itemType,
          fromAgent: handoff.toAgent,
          toAgent: nextAgent,
          message: `Automated handoff from ${handoff.toAgent}`,
          contextData: updatedContext,
          autoCreateTask: true
        })
      }
    }
  }

  /**
   * Reject a handoff
   */
  async rejectHandoff(
    handoffId: string,
    agentType: AgentType,
    reason?: string
  ): Promise<void> {
    const handoff = this.getHandoff(handoffId)
    if (!handoff) {
      throw new Error(`Handoff ${handoffId} not found`)
    }

    if (handoff.toAgent !== agentType) {
      throw new Error(`Handoff is for ${handoff.toAgent}, not ${agentType}`)
    }

    const db = databaseService.getDb()
    const now = new Date().toISOString()

    db.prepare(`
      UPDATE agent_handoffs
      SET status = 'rejected', completed_at = ?, message = ?
      WHERE id = ?
    `).run(now, reason || handoff.message, handoffId)

    this.emit('handoff-rejected', {
      handoffId,
      agentType,
      reason,
      timestamp: new Date()
    })
  }

  /**
   * Get a single handoff by ID
   */
  getHandoff(id: string): AgentHandoff | null {
    const db = databaseService.getDb()
    const row = db
      .prepare('SELECT * FROM agent_handoffs WHERE id = ?')
      .get(id) as HandoffRow | undefined

    return row ? this.rowToHandoff(row) : null
  }

  /**
   * Get pending handoffs for an agent
   */
  getPendingHandoffs(projectId: string, agentType: AgentType): AgentHandoff[] {
    const db = databaseService.getDb()
    const rows = db
      .prepare(`
        SELECT * FROM agent_handoffs
        WHERE project_id = ? AND to_agent = ? AND status = 'pending'
        ORDER BY created_at ASC
      `)
      .all(projectId, agentType) as HandoffRow[]

    return rows.map(this.rowToHandoff)
  }

  /**
   * Get handoff history for an item
   */
  getItemHistory(itemId: string): AgentHandoff[] {
    const db = databaseService.getDb()
    const rows = db
      .prepare(`
        SELECT * FROM agent_handoffs
        WHERE item_id = ?
        ORDER BY created_at ASC
      `)
      .all(itemId) as HandoffRow[]

    return rows.map(this.rowToHandoff)
  }

  /**
   * Get all handoffs for a project
   */
  getProjectHandoffs(
    projectId: string,
    options?: {
      status?: HandoffStatus
      agentType?: AgentType
      itemType?: HandoffItemType
    }
  ): AgentHandoff[] {
    const db = databaseService.getDb()
    let query = 'SELECT * FROM agent_handoffs WHERE project_id = ?'
    const params: (string | AgentType | HandoffItemType)[] = [projectId]

    if (options?.status) {
      query += ' AND status = ?'
      params.push(options.status)
    }

    if (options?.agentType) {
      query += ' AND (from_agent = ? OR to_agent = ?)'
      params.push(options.agentType, options.agentType)
    }

    if (options?.itemType) {
      query += ' AND item_type = ?'
      params.push(options.itemType)
    }

    query += ' ORDER BY created_at DESC'

    const rows = db.prepare(query).all(...params) as HandoffRow[]
    return rows.map(this.rowToHandoff)
  }

  /**
   * Get current owner of an item (last agent who accepted handoff)
   */
  getCurrentOwner(itemId: string): AgentType | null {
    const history = this.getItemHistory(itemId)
    if (history.length === 0) return null

    // Find most recent accepted or completed handoff
    const activeHandoff = history
      .reverse()
      .find((h) => h.status === 'accepted' || h.status === 'completed')

    return activeHandoff ? activeHandoff.toAgent : null
  }

  /**
   * Check if item is currently in a handoff pipeline
   */
  isInPipeline(itemId: string): boolean {
    const db = databaseService.getDb()
    const row = db
      .prepare(`
        SELECT COUNT(*) as count FROM agent_handoffs
        WHERE item_id = ? AND status IN ('pending', 'accepted')
      `)
      .get(itemId) as { count: number }

    return row.count > 0
  }

  /**
   * Get handoff statistics for a project
   */
  getHandoffStats(projectId: string): {
    totalHandoffs: number
    byStatus: Record<HandoffStatus, number>
    byAgent: Record<string, { sent: number; received: number }>
    avgCompletionTime: number
  } {
    const db = databaseService.getDb()
    const rows = db
      .prepare('SELECT * FROM agent_handoffs WHERE project_id = ?')
      .all(projectId) as HandoffRow[]

    const stats = {
      totalHandoffs: rows.length,
      byStatus: {
        pending: 0,
        accepted: 0,
        completed: 0,
        rejected: 0,
        expired: 0
      } as Record<HandoffStatus, number>,
      byAgent: {} as Record<string, { sent: number; received: number }>,
      avgCompletionTime: 0
    }

    let totalCompletionTime = 0
    let completedCount = 0

    for (const row of rows) {
      // Count by status
      stats.byStatus[row.status as HandoffStatus]++

      // Count by agent
      if (!stats.byAgent[row.from_agent]) {
        stats.byAgent[row.from_agent] = { sent: 0, received: 0 }
      }
      if (!stats.byAgent[row.to_agent]) {
        stats.byAgent[row.to_agent] = { sent: 0, received: 0 }
      }
      stats.byAgent[row.from_agent].sent++
      stats.byAgent[row.to_agent].received++

      // Calculate completion time
      if (row.status === 'completed' && row.completed_at) {
        const created = new Date(row.created_at).getTime()
        const completed = new Date(row.completed_at).getTime()
        totalCompletionTime += completed - created
        completedCount++
      }
    }

    if (completedCount > 0) {
      stats.avgCompletionTime = Math.floor(totalCompletionTime / completedCount / 1000) // in seconds
    }

    return stats
  }

  /**
   * Cancel all pending handoffs for an item
   */
  cancelItemHandoffs(itemId: string): number {
    const db = databaseService.getDb()
    const result = db
      .prepare(`
        UPDATE agent_handoffs
        SET status = 'expired'
        WHERE item_id = ? AND status = 'pending'
      `)
      .run(itemId)

    if (result.changes > 0) {
      this.emit('handoffs-cancelled', { itemId, count: result.changes })
    }

    return result.changes
  }

  /**
   * Convert database row to AgentHandoff
   */
  private rowToHandoff(row: HandoffRow): AgentHandoff {
    return {
      id: row.id,
      projectId: row.project_id,
      itemId: row.item_id,
      itemType: row.item_type as HandoffItemType,
      fromAgent: row.from_agent as AgentType,
      toAgent: row.to_agent as AgentType,
      handoffType: row.handoff_type as HandoffType,
      status: row.status as HandoffStatus,
      message: row.message || undefined,
      contextData: row.context_data ? JSON.parse(row.context_data) : undefined,
      createdAt: new Date(row.created_at),
      acceptedAt: row.accepted_at ? new Date(row.accepted_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined
    }
  }
}

// ============================================
// Singleton Export
// ============================================

export const agentHandoffService = new AgentHandoffService()
