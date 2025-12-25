import { EventEmitter } from 'events'
import { databaseService } from './database.service'
import type { AgentType } from '@shared/types'

/**
 * Agent Handoff System
 * Manages real-time agent handoffs between AI agents
 */
export interface AgentHandoff {
  id: string
  projectId: string
  sourceAgent: string
  targetAgent: string
  itemId: string
  itemType: 'story' | 'task' | 'test' | 'code'
  context: {
    summary: string
    outputData?: unknown
    suggestedAction?: string
  }
  status: 'pending' | 'accepted' | 'completed'
  createdAt: string
  acceptedAt?: string
  completedAt?: string
}

/**
 * Agent Conflict Detection
 * Detects and stores conflicts when agents have conflicting recommendations
 */
export interface AgentConflict {
  id: string
  projectId: string
  agents: string[]
  itemId: string
  itemType: string
  conflictType: 'recommendation' | 'action' | 'priority'
  perspectives: Array<{
    agent: string
    position: string
    reasoning: string
  }>
  status: 'pending' | 'resolved'
  resolution?: {
    decision: string
    decidedBy: 'user' | 'auto'
    decidedAt: string
  }
  createdAt: string
  resolvedAt?: string
}

/**
 * Coordination State
 * Tracks which agents are working on what
 */
export interface CoordinationState {
  agentType: AgentType
  itemId: string
  itemType: string
  status: 'idle' | 'working' | 'waiting'
  startedAt: string
}

/**
 * Coordination Event Types
 */
export type CoordinationEventType =
  | 'handoff-initiated'
  | 'handoff-accepted'
  | 'handoff-completed'
  | 'conflict-detected'
  | 'conflict-resolved'
  | 'agent-started'
  | 'agent-finished'

export interface CoordinationEvent {
  type: CoordinationEventType
  data: unknown
  timestamp: Date
}

/**
 * Database row types
 */
interface CoordinationRow {
  id: string
  project_id: string
  coordination_type: string
  source_agent: string
  target_agent: string | null
  item_id: string | null
  item_type: string | null
  status: string
  context: string | null
  created_at: string
  resolved_at: string | null
  resolved_by: string | null
}

class AgentCoordinationService extends EventEmitter {
  /**
   * Initialize database table for agent coordination
   */
  initDatabase(): void {
    const db = databaseService.getDb()

    db.exec(`
      CREATE TABLE IF NOT EXISTS agent_coordination (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        coordination_type TEXT NOT NULL,
        source_agent TEXT NOT NULL,
        target_agent TEXT,
        item_id TEXT,
        item_type TEXT,
        status TEXT DEFAULT 'pending',
        context TEXT,
        created_at TEXT NOT NULL,
        resolved_at TEXT,
        resolved_by TEXT
      )
    `)

    // Create indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_coordination_project ON agent_coordination(project_id);
      CREATE INDEX IF NOT EXISTS idx_coordination_type ON agent_coordination(coordination_type);
      CREATE INDEX IF NOT EXISTS idx_coordination_status ON agent_coordination(status);
      CREATE INDEX IF NOT EXISTS idx_coordination_item ON agent_coordination(item_id);
      CREATE INDEX IF NOT EXISTS idx_coordination_source ON agent_coordination(source_agent);
      CREATE INDEX IF NOT EXISTS idx_coordination_target ON agent_coordination(target_agent);
    `)
  }

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Emit coordination event
   */
  private emitEvent(type: CoordinationEventType, data: unknown): void {
    const event: CoordinationEvent = {
      type,
      data,
      timestamp: new Date()
    }
    this.emit('coordination-event', event)
  }

  // ============ Agent Handoff System ============

  /**
   * Initiate a handoff from one agent to another
   * @param from Source agent type
   * @param to Target agent type
   * @param item Item being handed off
   * @param context Handoff context and data
   * @returns Created handoff
   */
  initiateHandoff(
    from: AgentType,
    to: AgentType,
    item: { id: string; type: 'story' | 'task' | 'test' | 'code'; projectId: string },
    context: {
      summary: string
      outputData?: unknown
      suggestedAction?: string
    }
  ): AgentHandoff {
    const db = databaseService.getDb()
    const now = new Date().toISOString()
    const id = this.generateId('handoff')

    const handoff: AgentHandoff = {
      id,
      projectId: item.projectId,
      sourceAgent: from,
      targetAgent: to,
      itemId: item.id,
      itemType: item.type,
      context,
      status: 'pending',
      createdAt: now
    }

    db.prepare(`
      INSERT INTO agent_coordination (
        id, project_id, coordination_type, source_agent, target_agent,
        item_id, item_type, status, context, created_at
      ) VALUES (?, ?, 'handoff', ?, ?, ?, ?, 'pending', ?, ?)
    `).run(
      id,
      item.projectId,
      from,
      to,
      item.id,
      item.type,
      JSON.stringify(context),
      now
    )

    this.emitEvent('handoff-initiated', handoff)
    return handoff
  }

  /**
   * Accept a handoff (target agent acknowledges)
   * @param handoffId Handoff ID
   * @returns Updated handoff
   */
  acceptHandoff(handoffId: string): AgentHandoff | null {
    const handoff = this.getHandoff(handoffId)
    if (!handoff) return null

    if (handoff.status !== 'pending') {
      throw new Error(`Handoff ${handoffId} is not pending`)
    }

    const db = databaseService.getDb()
    const now = new Date().toISOString()

    db.prepare(`
      UPDATE agent_coordination
      SET status = 'accepted', resolved_at = ?
      WHERE id = ? AND coordination_type = 'handoff'
    `).run(now, handoffId)

    const updated = this.getHandoff(handoffId)
    if (updated) {
      this.emitEvent('handoff-accepted', updated)
    }
    return updated
  }

  /**
   * Complete a handoff (target agent finishes work)
   * @param handoffId Handoff ID
   * @param result Result data from target agent
   * @returns Updated handoff
   */
  completeHandoff(handoffId: string, result?: unknown): AgentHandoff | null {
    const handoff = this.getHandoff(handoffId)
    if (!handoff) return null

    if (handoff.status !== 'accepted') {
      throw new Error(`Handoff ${handoffId} must be accepted before completion`)
    }

    const db = databaseService.getDb()
    const now = new Date().toISOString()

    // Update context with result if provided
    const updatedContext = result
      ? { ...handoff.context, result }
      : handoff.context

    db.prepare(`
      UPDATE agent_coordination
      SET status = 'completed', context = ?, resolved_at = ?, resolved_by = 'auto'
      WHERE id = ? AND coordination_type = 'handoff'
    `).run(JSON.stringify(updatedContext), now, handoffId)

    const updated = this.getHandoff(handoffId)
    if (updated) {
      this.emitEvent('handoff-completed', updated)
    }
    return updated
  }

  /**
   * Get a handoff by ID
   * @param id Handoff ID
   * @returns Handoff or null
   */
  getHandoff(id: string): AgentHandoff | null {
    const db = databaseService.getDb()
    const row = db.prepare(`
      SELECT * FROM agent_coordination
      WHERE id = ? AND coordination_type = 'handoff'
    `).get(id) as CoordinationRow | undefined

    return row ? this.rowToHandoff(row) : null
  }

  /**
   * Get pending handoffs for a specific agent
   * @param projectId Project ID
   * @param agentType Agent type to get handoffs for
   * @returns List of pending handoffs
   */
  getPendingHandoffs(projectId: string, agentType: AgentType): AgentHandoff[] {
    const db = databaseService.getDb()
    const rows = db.prepare(`
      SELECT * FROM agent_coordination
      WHERE project_id = ?
        AND coordination_type = 'handoff'
        AND target_agent = ?
        AND status = 'pending'
      ORDER BY created_at ASC
    `).all(projectId, agentType) as CoordinationRow[]

    return rows.map(row => this.rowToHandoff(row))
  }

  /**
   * Get all handoffs for an item
   * @param itemId Item ID
   * @returns List of handoffs
   */
  getHandoffsForItem(itemId: string): AgentHandoff[] {
    const db = databaseService.getDb()
    const rows = db.prepare(`
      SELECT * FROM agent_coordination
      WHERE item_id = ? AND coordination_type = 'handoff'
      ORDER BY created_at DESC
    `).all(itemId) as CoordinationRow[]

    return rows.map(row => this.rowToHandoff(row))
  }

  /**
   * Get handoff chain (history) for an item
   * Shows the complete flow of an item through different agents
   * @param itemId Item ID
   * @returns Ordered list of handoffs
   */
  getHandoffChain(itemId: string): AgentHandoff[] {
    const db = databaseService.getDb()
    const rows = db.prepare(`
      SELECT * FROM agent_coordination
      WHERE item_id = ? AND coordination_type = 'handoff'
      ORDER BY created_at ASC
    `).all(itemId) as CoordinationRow[]

    return rows.map(row => this.rowToHandoff(row))
  }

  // ============ Conflict Detection ============

  /**
   * Detect conflicts between agent outputs
   * @param projectId Project ID
   * @param itemId Item ID (story, task, etc.)
   * @param agentOutputs Map of agent type to their output/recommendation
   * @returns Detected conflicts (if any)
   */
  detectConflict(
    projectId: string,
    itemId: string,
    agentOutputs: Map<AgentType, { position: string; reasoning: string }>
  ): AgentConflict | null {
    // Simple conflict detection: check for contradictory keywords
    const positions = Array.from(agentOutputs.entries())
    const conflictKeywords = [
      { positive: ['approve', 'accept', 'proceed', 'safe', 'secure'], negative: ['reject', 'deny', 'unsafe', 'vulnerable', 'risk'] },
      { positive: ['implement', 'add', 'create'], negative: ['remove', 'delete', 'skip', "don't"] },
      { positive: ['high priority', 'urgent', 'critical'], negative: ['low priority', 'optional', 'defer'] }
    ]

    // Check for contradictions
    for (const keywords of conflictKeywords) {
      const hasPositive = positions.some(([_, output]) =>
        keywords.positive.some(kw => output.position.toLowerCase().includes(kw))
      )
      const hasNegative = positions.some(([_, output]) =>
        keywords.negative.some(kw => output.position.toLowerCase().includes(kw))
      )

      if (hasPositive && hasNegative) {
        // Conflict detected!
        const conflictType = this.determineConflictType(positions, keywords)
        return this.recordConflict({
          projectId,
          itemId,
          itemType: 'task',
          conflictType,
          agents: Array.from(agentOutputs.keys()),
          perspectives: positions.map(([agent, output]) => ({
            agent,
            position: output.position,
            reasoning: output.reasoning
          }))
        })
      }
    }

    return null
  }

  /**
   * Determine the type of conflict based on keywords
   */
  private determineConflictType(
    positions: Array<[AgentType, { position: string; reasoning: string }]>,
    keywords: { positive: string[]; negative: string[] }
  ): 'recommendation' | 'action' | 'priority' {
    // Check if it's about actions (implement/remove)
    if (keywords.positive.some(kw => ['implement', 'add', 'create'].includes(kw))) {
      return 'action'
    }
    // Check if it's about priority
    if (keywords.positive.some(kw => kw.includes('priority'))) {
      return 'priority'
    }
    // Default to recommendation
    return 'recommendation'
  }

  /**
   * Record a conflict for user resolution
   * @param conflict Conflict data
   * @returns Created conflict
   */
  recordConflict(data: {
    projectId: string
    itemId: string
    itemType: string
    conflictType: 'recommendation' | 'action' | 'priority'
    agents: AgentType[]
    perspectives: Array<{
      agent: string
      position: string
      reasoning: string
    }>
  }): AgentConflict {
    const db = databaseService.getDb()
    const now = new Date().toISOString()
    const id = this.generateId('conflict')

    const conflict: AgentConflict = {
      id,
      projectId: data.projectId,
      agents: data.agents,
      itemId: data.itemId,
      itemType: data.itemType,
      conflictType: data.conflictType,
      perspectives: data.perspectives,
      status: 'pending',
      createdAt: now
    }

    const context = {
      agents: data.agents,
      conflictType: data.conflictType,
      perspectives: data.perspectives,
      itemType: data.itemType
    }

    db.prepare(`
      INSERT INTO agent_coordination (
        id, project_id, coordination_type, source_agent, target_agent,
        item_id, item_type, status, context, created_at
      ) VALUES (?, ?, 'conflict', ?, ?, ?, ?, 'pending', ?, ?)
    `).run(
      id,
      data.projectId,
      data.agents[0] || 'unknown',
      data.agents[1] || null,
      data.itemId,
      data.itemType,
      JSON.stringify(context),
      now
    )

    this.emitEvent('conflict-detected', conflict)
    return conflict
  }

  /**
   * Resolve a conflict
   * @param conflictId Conflict ID
   * @param decision Decision/resolution text
   * @param decidedBy Who resolved it ('user' | 'auto')
   * @returns Updated conflict
   */
  resolveConflict(
    conflictId: string,
    decision: string,
    decidedBy: 'user' | 'auto'
  ): AgentConflict | null {
    const conflict = this.getConflict(conflictId)
    if (!conflict) return null

    if (conflict.status !== 'pending') {
      throw new Error(`Conflict ${conflictId} is already resolved`)
    }

    const db = databaseService.getDb()
    const now = new Date().toISOString()

    // Update context with resolution
    const updatedContext = {
      ...conflict,
      resolution: {
        decision,
        decidedBy,
        decidedAt: now
      }
    }

    db.prepare(`
      UPDATE agent_coordination
      SET status = 'resolved', context = ?, resolved_at = ?, resolved_by = ?
      WHERE id = ? AND coordination_type = 'conflict'
    `).run(JSON.stringify(updatedContext), now, decidedBy, conflictId)

    const updated = this.getConflict(conflictId)
    if (updated) {
      this.emitEvent('conflict-resolved', updated)
    }
    return updated
  }

  /**
   * Get a conflict by ID
   * @param id Conflict ID
   * @returns Conflict or null
   */
  getConflict(id: string): AgentConflict | null {
    const db = databaseService.getDb()
    const row = db.prepare(`
      SELECT * FROM agent_coordination
      WHERE id = ? AND coordination_type = 'conflict'
    `).get(id) as CoordinationRow | undefined

    return row ? this.rowToConflict(row) : null
  }

  /**
   * Get all unresolved conflicts for a project
   * @param projectId Project ID
   * @returns List of unresolved conflicts
   */
  getUnresolvedConflicts(projectId: string): AgentConflict[] {
    const db = databaseService.getDb()
    const rows = db.prepare(`
      SELECT * FROM agent_coordination
      WHERE project_id = ?
        AND coordination_type = 'conflict'
        AND status = 'pending'
      ORDER BY created_at DESC
    `).all(projectId) as CoordinationRow[]

    return rows.map(row => this.rowToConflict(row))
  }

  /**
   * Get all conflicts for an item
   * @param itemId Item ID
   * @returns List of conflicts
   */
  getConflictsForItem(itemId: string): AgentConflict[] {
    const db = databaseService.getDb()
    const rows = db.prepare(`
      SELECT * FROM agent_coordination
      WHERE item_id = ? AND coordination_type = 'conflict'
      ORDER BY created_at DESC
    `).all(itemId) as CoordinationRow[]

    return rows.map(row => this.rowToConflict(row))
  }

  // ============ Coordination State ============

  /**
   * Track agent starting work on an item
   * @param agentType Agent type
   * @param itemId Item ID
   * @param itemType Item type
   * @param projectId Project ID
   */
  trackAgentStart(
    agentType: AgentType,
    itemId: string,
    itemType: string,
    projectId: string
  ): void {
    const db = databaseService.getDb()
    const now = new Date().toISOString()
    const id = this.generateId('state')

    const context = {
      agentType,
      itemType,
      status: 'working'
    }

    db.prepare(`
      INSERT INTO agent_coordination (
        id, project_id, coordination_type, source_agent, target_agent,
        item_id, item_type, status, context, created_at
      ) VALUES (?, ?, 'parallel', ?, NULL, ?, ?, 'in_progress', ?, ?)
    `).run(id, projectId, agentType, itemId, itemType, JSON.stringify(context), now)

    this.emitEvent('agent-started', { agentType, itemId, itemType })
  }

  /**
   * Track agent finishing work on an item
   * @param agentType Agent type
   * @param itemId Item ID
   */
  trackAgentFinish(agentType: AgentType, itemId: string): void {
    const db = databaseService.getDb()
    const now = new Date().toISOString()

    db.prepare(`
      UPDATE agent_coordination
      SET status = 'completed', resolved_at = ?, resolved_by = 'auto'
      WHERE coordination_type = 'parallel'
        AND source_agent = ?
        AND item_id = ?
        AND status = 'in_progress'
    `).run(now, agentType, itemId)

    this.emitEvent('agent-finished', { agentType, itemId })
  }

  /**
   * Check if any agent is currently working on an item
   * Prevents duplicate work
   * @param itemId Item ID
   * @returns Agent type if someone is working, null otherwise
   */
  isItemBeingWorkedOn(itemId: string): AgentType | null {
    const db = databaseService.getDb()
    const row = db.prepare(`
      SELECT source_agent FROM agent_coordination
      WHERE coordination_type = 'parallel'
        AND item_id = ?
        AND status = 'in_progress'
      ORDER BY created_at DESC
      LIMIT 1
    `).get(itemId) as { source_agent: string } | undefined

    return row ? (row.source_agent as AgentType) : null
  }

  /**
   * Get all active agent work for a project
   * Shows which agents are currently working on what
   * @param projectId Project ID
   * @returns Map of agent type to items they're working on
   */
  getActiveWork(projectId: string): Map<AgentType, Array<{ itemId: string; itemType: string }>> {
    const db = databaseService.getDb()
    const rows = db.prepare(`
      SELECT source_agent, item_id, item_type, context
      FROM agent_coordination
      WHERE project_id = ?
        AND coordination_type = 'parallel'
        AND status = 'in_progress'
      ORDER BY created_at DESC
    `).all(projectId) as Array<{
      source_agent: string
      item_id: string
      item_type: string
      context: string
    }>

    const activeWork = new Map<AgentType, Array<{ itemId: string; itemType: string }>>()

    for (const row of rows) {
      const agent = row.source_agent as AgentType
      if (!activeWork.has(agent)) {
        activeWork.set(agent, [])
      }
      activeWork.get(agent)!.push({
        itemId: row.item_id,
        itemType: row.item_type
      })
    }

    return activeWork
  }

  /**
   * Check if parallel execution is safe
   * Returns false if agents would conflict (e.g., both modifying same code)
   * @param agentType Agent type
   * @param itemId Item ID
   * @returns True if safe to execute in parallel
   */
  isParallelExecutionSafe(agentType: AgentType, itemId: string): boolean {
    const currentWorker = this.isItemBeingWorkedOn(itemId)

    // No one working on it = safe
    if (!currentWorker) return true

    // Same agent type = not safe (duplicate work)
    if (currentWorker === agentType) return false

    // Define which agent combinations are safe to run in parallel
    const safeParallelPairs = new Set([
      'tester-developer',      // Tester can write tests while developer codes
      'documentation-developer', // Documentation can be written in parallel
      'product-owner-developer', // PO can refine stories while dev works
      'security-developer'       // Security can audit while dev implements
    ])

    const pair = [currentWorker, agentType].sort().join('-')
    return safeParallelPairs.has(pair)
  }

  // ============ Utility Methods ============

  /**
   * Get coordination history for an item
   * Shows all handoffs, conflicts, and parallel work
   * @param itemId Item ID
   * @returns Complete coordination history
   */
  getCoordinationHistory(itemId: string): {
    handoffs: AgentHandoff[]
    conflicts: AgentConflict[]
    parallelWork: Array<{ agent: AgentType; status: string; createdAt: string }>
  } {
    const db = databaseService.getDb()
    const rows = db.prepare(`
      SELECT * FROM agent_coordination
      WHERE item_id = ?
      ORDER BY created_at ASC
    `).all(itemId) as CoordinationRow[]

    const handoffs: AgentHandoff[] = []
    const conflicts: AgentConflict[] = []
    const parallelWork: Array<{ agent: AgentType; status: string; createdAt: string }> = []

    for (const row of rows) {
      if (row.coordination_type === 'handoff') {
        handoffs.push(this.rowToHandoff(row))
      } else if (row.coordination_type === 'conflict') {
        conflicts.push(this.rowToConflict(row))
      } else if (row.coordination_type === 'parallel') {
        parallelWork.push({
          agent: row.source_agent as AgentType,
          status: row.status,
          createdAt: row.created_at
        })
      }
    }

    return { handoffs, conflicts, parallelWork }
  }

  /**
   * Clear old coordination data
   * Removes completed/resolved entries older than specified days
   * @param projectId Project ID
   * @param daysToKeep Number of days to keep
   */
  clearOldData(projectId: string, daysToKeep = 30): number {
    const db = databaseService.getDb()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
    const cutoff = cutoffDate.toISOString()

    const result = db.prepare(`
      DELETE FROM agent_coordination
      WHERE project_id = ?
        AND status IN ('completed', 'resolved')
        AND created_at < ?
    `).run(projectId, cutoff)

    return result.changes
  }

  /**
   * Get coordination statistics for a project
   * @param projectId Project ID
   * @returns Statistics about handoffs, conflicts, etc.
   */
  getStatistics(projectId: string): {
    totalHandoffs: number
    pendingHandoffs: number
    completedHandoffs: number
    totalConflicts: number
    unresolvedConflicts: number
    averageHandoffTime: number
    activeAgents: number
  } {
    const db = databaseService.getDb()

    const stats = db.prepare(`
      SELECT
        coordination_type,
        status,
        COUNT(*) as count,
        AVG(
          CASE
            WHEN resolved_at IS NOT NULL AND created_at IS NOT NULL
            THEN (julianday(resolved_at) - julianday(created_at)) * 86400
            ELSE NULL
          END
        ) as avg_time
      FROM agent_coordination
      WHERE project_id = ?
      GROUP BY coordination_type, status
    `).all(projectId) as Array<{
      coordination_type: string
      status: string
      count: number
      avg_time: number | null
    }>

    const activeAgentsCount = db.prepare(`
      SELECT COUNT(DISTINCT source_agent) as count
      FROM agent_coordination
      WHERE project_id = ?
        AND coordination_type = 'parallel'
        AND status = 'in_progress'
    `).get(projectId) as { count: number }

    let totalHandoffs = 0
    let pendingHandoffs = 0
    let completedHandoffs = 0
    let totalConflicts = 0
    let unresolvedConflicts = 0
    let avgHandoffTime = 0

    for (const stat of stats) {
      if (stat.coordination_type === 'handoff') {
        totalHandoffs += stat.count
        if (stat.status === 'pending') pendingHandoffs += stat.count
        if (stat.status === 'completed') {
          completedHandoffs += stat.count
          if (stat.avg_time) avgHandoffTime = stat.avg_time
        }
      } else if (stat.coordination_type === 'conflict') {
        totalConflicts += stat.count
        if (stat.status === 'pending') unresolvedConflicts += stat.count
      }
    }

    return {
      totalHandoffs,
      pendingHandoffs,
      completedHandoffs,
      totalConflicts,
      unresolvedConflicts,
      averageHandoffTime: Math.round(avgHandoffTime),
      activeAgents: activeAgentsCount.count
    }
  }

  // ============ Private Helper Methods ============

  /**
   * Convert database row to AgentHandoff
   */
  private rowToHandoff(row: CoordinationRow): AgentHandoff {
    const context = row.context ? JSON.parse(row.context) : {}

    return {
      id: row.id,
      projectId: row.project_id,
      sourceAgent: row.source_agent,
      targetAgent: row.target_agent || '',
      itemId: row.item_id || '',
      itemType: (row.item_type as 'story' | 'task' | 'test' | 'code') || 'task',
      context,
      status: row.status as 'pending' | 'accepted' | 'completed',
      createdAt: row.created_at,
      acceptedAt: row.status === 'accepted' ? row.resolved_at || undefined : undefined,
      completedAt: row.status === 'completed' ? row.resolved_at || undefined : undefined
    }
  }

  /**
   * Convert database row to AgentConflict
   */
  private rowToConflict(row: CoordinationRow): AgentConflict {
    const context = row.context ? JSON.parse(row.context) : {}

    return {
      id: row.id,
      projectId: row.project_id,
      agents: context.agents || [row.source_agent, row.target_agent].filter(Boolean),
      itemId: row.item_id || '',
      itemType: row.item_type || 'task',
      conflictType: context.conflictType || 'recommendation',
      perspectives: context.perspectives || [],
      status: row.status as 'pending' | 'resolved',
      resolution: context.resolution,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at || undefined
    }
  }
}

// Singleton instance
export const agentCoordinationService = new AgentCoordinationService()

// Initialize database on import
agentCoordinationService.initDatabase()
