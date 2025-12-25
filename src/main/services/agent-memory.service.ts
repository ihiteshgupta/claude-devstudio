/**
 * Agent Memory Service
 *
 * Manages agent session memory to remember previous interactions.
 * Tracks decisions, created items, rejections, and story discussions
 * to provide context for future agent interactions.
 */

import { EventEmitter } from 'events'
import { databaseService } from './database.service'
import { randomUUID } from 'crypto'

export interface AgentMemory {
  projectId: string
  sessionId: string
  agentType: string
  recentStories: string[]
  recentDecisions: Decision[]
  createdItems: CreatedItem[]
  rejectedSuggestions: string[]
}

export interface Decision {
  id: string
  type: 'approved' | 'rejected' | 'modified' | 'deferred'
  itemType: 'story' | 'task' | 'test' | 'roadmap'
  itemTitle: string
  reason?: string
  timestamp: string
}

export interface CreatedItem {
  id: string
  type: 'story' | 'task' | 'test' | 'roadmap'
  title: string
  createdAt: string
}

interface MemoryRecord {
  id: string
  session_id: string
  project_id: string
  agent_type: string
  memory_type: 'decision' | 'created_item' | 'rejection' | 'story_discussion'
  content: string
  created_at: string
  expires_at: string | null
}

class AgentMemoryService extends EventEmitter {
  private sessions: Map<string, AgentMemory> = new Map()

  constructor() {
    super()
    this.initTable()
  }

  /**
   * Initialize the agent_memory table in the database
   */
  private initTable(): void {
    const db = databaseService.getDb()

    // Create agent_memory table
    db.exec(`
      CREATE TABLE IF NOT EXISTS agent_memory (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        agent_type TEXT NOT NULL,
        memory_type TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT
      )
    `)

    // Create indexes for better query performance
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_agent_memory_session ON agent_memory(session_id);
      CREATE INDEX IF NOT EXISTS idx_agent_memory_project ON agent_memory(project_id);
      CREATE INDEX IF NOT EXISTS idx_agent_memory_type ON agent_memory(memory_type);
      CREATE INDEX IF NOT EXISTS idx_agent_memory_created ON agent_memory(created_at);
    `)
  }

  /**
   * Start a new agent session
   */
  startSession(projectId: string, agentType: string): string {
    const sessionId = `agent_session_${Date.now()}_${randomUUID().substring(0, 8)}`

    const memory: AgentMemory = {
      projectId,
      sessionId,
      agentType,
      recentStories: [],
      recentDecisions: [],
      createdItems: [],
      rejectedSuggestions: []
    }

    this.sessions.set(sessionId, memory)

    this.emit('session-started', { sessionId, projectId, agentType })

    return sessionId
  }

  /**
   * End an agent session and persist to database
   */
  endSession(sessionId: string): void {
    const memory = this.sessions.get(sessionId)
    if (!memory) {
      console.warn(`Session ${sessionId} not found`)
      return
    }

    // Persist any in-memory data that hasn't been saved
    this.persistSession(sessionId)

    // Remove from active sessions
    this.sessions.delete(sessionId)

    this.emit('session-ended', { sessionId })
  }

  /**
   * Get current session memory
   */
  getSession(sessionId: string): AgentMemory | null {
    // Check in-memory first
    const inMemory = this.sessions.get(sessionId)
    if (inMemory) {
      return inMemory
    }

    // Load from database
    return this.loadSessionFromDb(sessionId)
  }

  /**
   * Get all sessions for a project
   */
  getProjectMemory(projectId: string): AgentMemory[] {
    const db = databaseService.getDb()

    // Get distinct session IDs for this project
    const sessionIds = db
      .prepare(
        `SELECT DISTINCT session_id, agent_type
         FROM agent_memory
         WHERE project_id = ?
         ORDER BY created_at DESC`
      )
      .all(projectId) as Array<{ session_id: string; agent_type: string }>

    return sessionIds
      .map(({ session_id }) => this.loadSessionFromDb(session_id))
      .filter((session): session is AgentMemory => session !== null)
  }

  /**
   * Record a decision made during the session
   */
  recordDecision(
    sessionId: string,
    decision: Omit<Decision, 'id' | 'timestamp'>
  ): void {
    const memory = this.getOrCreateSession(sessionId)
    if (!memory) {
      console.error(`Cannot record decision: session ${sessionId} not found`)
      return
    }

    const fullDecision: Decision = {
      id: randomUUID(),
      ...decision,
      timestamp: new Date().toISOString()
    }

    // Add to in-memory session
    memory.recentDecisions.push(fullDecision)

    // Persist to database
    this.saveMemoryRecord(
      sessionId,
      memory.projectId,
      memory.agentType,
      'decision',
      JSON.stringify(fullDecision)
    )

    this.emit('decision-recorded', { sessionId, decision: fullDecision })
  }

  /**
   * Record a created item
   */
  recordCreatedItem(
    sessionId: string,
    item: Omit<CreatedItem, 'createdAt'>
  ): void {
    const memory = this.getOrCreateSession(sessionId)
    if (!memory) {
      console.error(`Cannot record created item: session ${sessionId} not found`)
      return
    }

    const fullItem: CreatedItem = {
      ...item,
      createdAt: new Date().toISOString()
    }

    // Add to in-memory session
    memory.createdItems.push(fullItem)

    // Persist to database
    this.saveMemoryRecord(
      sessionId,
      memory.projectId,
      memory.agentType,
      'created_item',
      JSON.stringify(fullItem)
    )

    this.emit('item-created', { sessionId, item: fullItem })
  }

  /**
   * Record a rejected suggestion
   */
  recordRejection(sessionId: string, suggestion: string): void {
    const memory = this.getOrCreateSession(sessionId)
    if (!memory) {
      console.error(`Cannot record rejection: session ${sessionId} not found`)
      return
    }

    // Add to in-memory session
    memory.rejectedSuggestions.push(suggestion)

    // Persist to database
    this.saveMemoryRecord(
      sessionId,
      memory.projectId,
      memory.agentType,
      'rejection',
      suggestion
    )

    this.emit('rejection-recorded', { sessionId, suggestion })
  }

  /**
   * Record a story discussion
   */
  recordStoryDiscussion(sessionId: string, storyId: string): void {
    const memory = this.getOrCreateSession(sessionId)
    if (!memory) {
      console.error(`Cannot record story discussion: session ${sessionId} not found`)
      return
    }

    // Only add if not already in recent stories
    if (!memory.recentStories.includes(storyId)) {
      memory.recentStories.push(storyId)

      // Keep only the last 10 stories
      if (memory.recentStories.length > 10) {
        memory.recentStories.shift()
      }

      // Persist to database
      this.saveMemoryRecord(
        sessionId,
        memory.projectId,
        memory.agentType,
        'story_discussion',
        storyId
      )

      this.emit('story-discussed', { sessionId, storyId })
    }
  }

  /**
   * Get recent decisions for a project
   */
  getRecentDecisions(projectId: string, limit: number = 20): Decision[] {
    const db = databaseService.getDb()

    const records = db
      .prepare(
        `SELECT content, created_at
         FROM agent_memory
         WHERE project_id = ? AND memory_type = 'decision'
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .all(projectId, limit) as Array<{ content: string; created_at: string }>

    return records.map((record) => {
      try {
        return JSON.parse(record.content) as Decision
      } catch (error) {
        console.error('Error parsing decision:', error)
        return null
      }
    }).filter((decision): decision is Decision => decision !== null)
  }

  /**
   * Get recently created items for a project
   */
  getRecentlyCreatedItems(projectId: string, limit: number = 20): CreatedItem[] {
    const db = databaseService.getDb()

    const records = db
      .prepare(
        `SELECT content, created_at
         FROM agent_memory
         WHERE project_id = ? AND memory_type = 'created_item'
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .all(projectId, limit) as Array<{ content: string; created_at: string }>

    return records.map((record) => {
      try {
        return JSON.parse(record.content) as CreatedItem
      } catch (error) {
        console.error('Error parsing created item:', error)
        return null
      }
    }).filter((item): item is CreatedItem => item !== null)
  }

  /**
   * Clear all memory for a session
   */
  clearSessionMemory(sessionId: string): void {
    const db = databaseService.getDb()

    databaseService.withWriteLock(() => {
      db.prepare('DELETE FROM agent_memory WHERE session_id = ?').run(sessionId)
    })

    // Remove from in-memory sessions
    this.sessions.delete(sessionId)

    this.emit('session-cleared', { sessionId })
  }

  /**
   * Clear all memory for a project
   */
  clearProjectMemory(projectId: string): void {
    const db = databaseService.getDb()

    databaseService.withWriteLock(() => {
      db.prepare('DELETE FROM agent_memory WHERE project_id = ?').run(projectId)
    })

    // Remove from in-memory sessions
    for (const [sessionId, memory] of this.sessions.entries()) {
      if (memory.projectId === projectId) {
        this.sessions.delete(sessionId)
      }
    }

    this.emit('project-memory-cleared', { projectId })
  }

  /**
   * Helper: Get or create a session
   */
  private getOrCreateSession(sessionId: string): AgentMemory | null {
    let memory = this.sessions.get(sessionId)
    if (!memory) {
      // Try loading from database
      memory = this.loadSessionFromDb(sessionId)
      if (memory) {
        this.sessions.set(sessionId, memory)
      }
    }
    return memory
  }

  /**
   * Helper: Save a memory record to the database
   */
  private saveMemoryRecord(
    sessionId: string,
    projectId: string,
    agentType: string,
    memoryType: MemoryRecord['memory_type'],
    content: string,
    expiresAt?: string
  ): void {
    const db = databaseService.getDb()
    const id = randomUUID()
    const createdAt = new Date().toISOString()

    databaseService.withWriteLockRetry(() => {
      db.prepare(
        `INSERT INTO agent_memory (id, session_id, project_id, agent_type, memory_type, content, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(id, sessionId, projectId, agentType, memoryType, content, createdAt, expiresAt || null)
    })
  }

  /**
   * Helper: Load session from database
   */
  private loadSessionFromDb(sessionId: string): AgentMemory | null {
    const db = databaseService.getDb()

    const records = db
      .prepare('SELECT * FROM agent_memory WHERE session_id = ? ORDER BY created_at ASC')
      .all(sessionId) as MemoryRecord[]

    if (records.length === 0) {
      return null
    }

    const firstRecord = records[0]
    const memory: AgentMemory = {
      sessionId,
      projectId: firstRecord.project_id,
      agentType: firstRecord.agent_type,
      recentStories: [],
      recentDecisions: [],
      createdItems: [],
      rejectedSuggestions: []
    }

    // Reconstruct memory from records
    for (const record of records) {
      try {
        switch (record.memory_type) {
          case 'decision':
            memory.recentDecisions.push(JSON.parse(record.content) as Decision)
            break
          case 'created_item':
            memory.createdItems.push(JSON.parse(record.content) as CreatedItem)
            break
          case 'rejection':
            memory.rejectedSuggestions.push(record.content)
            break
          case 'story_discussion':
            if (!memory.recentStories.includes(record.content)) {
              memory.recentStories.push(record.content)
            }
            break
        }
      } catch (error) {
        console.error(`Error parsing memory record ${record.id}:`, error)
      }
    }

    return memory
  }

  /**
   * Helper: Persist current session state to database
   */
  private persistSession(sessionId: string): void {
    const memory = this.sessions.get(sessionId)
    if (!memory) {
      return
    }

    // All data should already be persisted via individual record methods
    // This is just a safety check to ensure consistency
    this.emit('session-persisted', { sessionId })
  }

  /**
   * Clean up expired memory records
   */
  cleanupExpiredMemory(): number {
    const db = databaseService.getDb()
    const now = new Date().toISOString()

    const result = databaseService.withWriteLock(() => {
      return db.prepare(
        'DELETE FROM agent_memory WHERE expires_at IS NOT NULL AND expires_at < ?'
      ).run(now)
    })

    const deletedCount = result.changes

    if (deletedCount > 0) {
      this.emit('memory-cleaned', { deletedCount })
    }

    return deletedCount
  }

  /**
   * Get memory statistics for a project
   */
  getProjectStats(projectId: string): {
    totalSessions: number
    totalDecisions: number
    totalCreatedItems: number
    totalRejections: number
    totalStoryDiscussions: number
  } {
    const db = databaseService.getDb()

    const sessionCount = db
      .prepare('SELECT COUNT(DISTINCT session_id) as count FROM agent_memory WHERE project_id = ?')
      .get(projectId) as { count: number }

    const typeCounts = db
      .prepare(
        `SELECT memory_type, COUNT(*) as count
         FROM agent_memory
         WHERE project_id = ?
         GROUP BY memory_type`
      )
      .all(projectId) as Array<{ memory_type: string; count: number }>

    const stats = {
      totalSessions: sessionCount.count,
      totalDecisions: 0,
      totalCreatedItems: 0,
      totalRejections: 0,
      totalStoryDiscussions: 0
    }

    for (const { memory_type, count } of typeCounts) {
      switch (memory_type) {
        case 'decision':
          stats.totalDecisions = count
          break
        case 'created_item':
          stats.totalCreatedItems = count
          break
        case 'rejection':
          stats.totalRejections = count
          break
        case 'story_discussion':
          stats.totalStoryDiscussions = count
          break
      }
    }

    return stats
  }
}

export const agentMemoryService = new AgentMemoryService()
