import { EventEmitter } from 'events'
import { databaseService } from './database.service'
import type {
  RoadmapItem,
  RoadmapItemType,
  RoadmapItemStatus,
  RoadmapLane,
  RoadmapPriority
} from '@shared/types'

interface CreateRoadmapItemInput {
  projectId: string
  parentId?: string
  title: string
  description?: string
  type?: RoadmapItemType
  status?: RoadmapItemStatus
  priority?: RoadmapPriority
  targetQuarter?: string
  lane?: RoadmapLane
  startDate?: string
  targetDate?: string
  storyPoints?: number
  owner?: string
  tags?: string[]
}

interface UpdateRoadmapItemInput {
  title?: string
  description?: string
  type?: RoadmapItemType
  status?: RoadmapItemStatus
  priority?: RoadmapPriority
  targetQuarter?: string
  lane?: RoadmapLane
  startDate?: string
  targetDate?: string
  completedDate?: string
  storyPoints?: number
  owner?: string
  tags?: string[]
}

class RoadmapService extends EventEmitter {
  /**
   * Generate unique ID for roadmap items
   */
  private generateId(): string {
    return `roadmap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get all roadmap items for a project
   */
  listItems(projectId: string, options?: { type?: RoadmapItemType; lane?: RoadmapLane }): RoadmapItem[] {
    const db = databaseService.getDb()

    let query = `
      SELECT * FROM roadmap_items
      WHERE project_id = ?
    `
    const params: (string | undefined)[] = [projectId]

    if (options?.type) {
      query += ` AND type = ?`
      params.push(options.type)
    }

    if (options?.lane) {
      query += ` AND lane = ?`
      params.push(options.lane)
    }

    query += ` ORDER BY priority DESC, created_at DESC`

    const rows = db.prepare(query).all(...params) as RoadmapItemRow[]
    return rows.map(this.rowToItem)
  }

  /**
   * Get a single roadmap item by ID
   */
  getItem(id: string): RoadmapItem | null {
    const db = databaseService.getDb()
    const row = db.prepare('SELECT * FROM roadmap_items WHERE id = ?').get(id) as RoadmapItemRow | undefined
    return row ? this.rowToItem(row) : null
  }

  /**
   * Get roadmap items with their children (hierarchical)
   */
  getItemsHierarchy(projectId: string): RoadmapItem[] {
    const allItems = this.listItems(projectId)
    const itemMap = new Map<string, RoadmapItem>()
    const rootItems: RoadmapItem[] = []

    // First pass: create map
    for (const item of allItems) {
      itemMap.set(item.id, { ...item, children: [] })
    }

    // Second pass: build hierarchy
    for (const item of allItems) {
      const mappedItem = itemMap.get(item.id)!
      if (item.parentId && itemMap.has(item.parentId)) {
        const parent = itemMap.get(item.parentId)!
        parent.children = parent.children || []
        parent.children.push(mappedItem)
      } else {
        rootItems.push(mappedItem)
      }
    }

    return rootItems
  }

  /**
   * Get items grouped by lane (for Kanban view)
   */
  getItemsByLane(projectId: string): Record<RoadmapLane, RoadmapItem[]> {
    const items = this.listItems(projectId)
    const lanes: Record<RoadmapLane, RoadmapItem[]> = {
      now: [],
      next: [],
      later: [],
      done: []
    }

    for (const item of items) {
      lanes[item.lane].push(item)
    }

    return lanes
  }

  /**
   * Get items grouped by quarter (for Timeline view)
   */
  getItemsByQuarter(projectId: string): Record<string, RoadmapItem[]> {
    const items = this.listItems(projectId)
    const quarters: Record<string, RoadmapItem[]> = {}

    for (const item of items) {
      const quarter = item.targetQuarter || 'Unscheduled'
      if (!quarters[quarter]) {
        quarters[quarter] = []
      }
      quarters[quarter].push(item)
    }

    return quarters
  }

  /**
   * Create a new roadmap item
   */
  createItem(input: CreateRoadmapItemInput): RoadmapItem {
    const db = databaseService.getDb()
    const now = new Date().toISOString()
    const id = this.generateId()

    const item: RoadmapItem = {
      id,
      projectId: input.projectId,
      parentId: input.parentId,
      title: input.title,
      description: input.description,
      type: input.type || 'feature',
      status: input.status || 'planned',
      priority: input.priority || 'medium',
      targetQuarter: input.targetQuarter,
      lane: input.lane || 'next',
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      targetDate: input.targetDate ? new Date(input.targetDate) : undefined,
      storyPoints: input.storyPoints,
      owner: input.owner,
      tags: input.tags,
      createdAt: new Date(now),
      updatedAt: new Date(now)
    }

    db.prepare(`
      INSERT INTO roadmap_items (
        id, project_id, parent_id, title, description, type, status,
        priority, target_quarter, lane, start_date, target_date,
        story_points, owner, tags, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.projectId,
      input.parentId || null,
      input.title,
      input.description || null,
      item.type,
      item.status,
      item.priority,
      input.targetQuarter || null,
      item.lane,
      input.startDate || null,
      input.targetDate || null,
      input.storyPoints || null,
      input.owner || null,
      input.tags ? JSON.stringify(input.tags) : null,
      now,
      now
    )

    this.emit('item-created', item)
    return item
  }

  /**
   * Update a roadmap item
   */
  updateItem(id: string, input: UpdateRoadmapItemInput): RoadmapItem | null {
    const existing = this.getItem(id)
    if (!existing) return null

    const db = databaseService.getDb()
    const now = new Date().toISOString()

    const updates: string[] = ['updated_at = ?']
    const params: (string | number | null)[] = [now]

    if (input.title !== undefined) {
      updates.push('title = ?')
      params.push(input.title)
    }
    if (input.description !== undefined) {
      updates.push('description = ?')
      params.push(input.description)
    }
    if (input.type !== undefined) {
      updates.push('type = ?')
      params.push(input.type)
    }
    if (input.status !== undefined) {
      updates.push('status = ?')
      params.push(input.status)
      // Auto-set completed date
      if (input.status === 'completed' && !input.completedDate) {
        updates.push('completed_date = ?')
        params.push(now)
      }
    }
    if (input.priority !== undefined) {
      updates.push('priority = ?')
      params.push(input.priority)
    }
    if (input.targetQuarter !== undefined) {
      updates.push('target_quarter = ?')
      params.push(input.targetQuarter)
    }
    if (input.lane !== undefined) {
      updates.push('lane = ?')
      params.push(input.lane)
      // Auto-complete when moved to done
      if (input.lane === 'done' && existing.status !== 'completed') {
        updates.push('status = ?')
        params.push('completed')
        updates.push('completed_date = ?')
        params.push(now)
      }
    }
    if (input.startDate !== undefined) {
      updates.push('start_date = ?')
      params.push(input.startDate)
    }
    if (input.targetDate !== undefined) {
      updates.push('target_date = ?')
      params.push(input.targetDate)
    }
    if (input.completedDate !== undefined) {
      updates.push('completed_date = ?')
      params.push(input.completedDate)
    }
    if (input.storyPoints !== undefined) {
      updates.push('story_points = ?')
      params.push(input.storyPoints)
    }
    if (input.owner !== undefined) {
      updates.push('owner = ?')
      params.push(input.owner)
    }
    if (input.tags !== undefined) {
      updates.push('tags = ?')
      params.push(JSON.stringify(input.tags))
    }

    params.push(id)
    db.prepare(`UPDATE roadmap_items SET ${updates.join(', ')} WHERE id = ?`).run(...params)

    const updated = this.getItem(id)
    if (updated) {
      this.emit('item-updated', updated)
    }
    return updated
  }

  /**
   * Move item to a different lane
   */
  moveToLane(id: string, lane: RoadmapLane): RoadmapItem | null {
    return this.updateItem(id, { lane })
  }

  /**
   * Move item to a different quarter
   */
  moveToQuarter(id: string, quarter: string): RoadmapItem | null {
    return this.updateItem(id, { targetQuarter: quarter })
  }

  /**
   * Update item parent (for hierarchy changes)
   */
  setParent(id: string, parentId: string | null): RoadmapItem | null {
    const db = databaseService.getDb()
    const now = new Date().toISOString()

    db.prepare('UPDATE roadmap_items SET parent_id = ?, updated_at = ? WHERE id = ?')
      .run(parentId, now, id)

    const updated = this.getItem(id)
    if (updated) {
      this.emit('item-updated', updated)
    }
    return updated
  }

  /**
   * Delete a roadmap item
   */
  deleteItem(id: string): boolean {
    const item = this.getItem(id)
    if (!item) return false

    const db = databaseService.getDb()

    // Delete the item (children will have parent_id set to NULL via FK)
    db.prepare('DELETE FROM roadmap_items WHERE id = ?').run(id)

    this.emit('item-deleted', id)
    return true
  }

  /**
   * Get roadmap statistics
   */
  getStats(projectId: string): {
    total: number
    byStatus: Record<RoadmapItemStatus, number>
    byLane: Record<RoadmapLane, number>
    byType: Record<RoadmapItemType, number>
    totalPoints: number
    completedPoints: number
  } {
    const items = this.listItems(projectId)

    const stats = {
      total: items.length,
      byStatus: { planned: 0, 'in-progress': 0, completed: 0, blocked: 0, cancelled: 0 } as Record<RoadmapItemStatus, number>,
      byLane: { now: 0, next: 0, later: 0, done: 0 } as Record<RoadmapLane, number>,
      byType: { epic: 0, feature: 0, milestone: 0, task: 0 } as Record<RoadmapItemType, number>,
      totalPoints: 0,
      completedPoints: 0
    }

    for (const item of items) {
      stats.byStatus[item.status]++
      stats.byLane[item.lane]++
      stats.byType[item.type]++
      if (item.storyPoints) {
        stats.totalPoints += item.storyPoints
        if (item.status === 'completed') {
          stats.completedPoints += item.storyPoints
        }
      }
    }

    return stats
  }

  /**
   * Convert database row to RoadmapItem
   */
  private rowToItem(row: RoadmapItemRow): RoadmapItem {
    return {
      id: row.id,
      projectId: row.project_id,
      parentId: row.parent_id || undefined,
      title: row.title,
      description: row.description || undefined,
      type: row.type as RoadmapItemType,
      status: row.status as RoadmapItemStatus,
      priority: row.priority as RoadmapPriority,
      targetQuarter: row.target_quarter || undefined,
      lane: row.lane as RoadmapLane,
      startDate: row.start_date ? new Date(row.start_date) : undefined,
      targetDate: row.target_date ? new Date(row.target_date) : undefined,
      completedDate: row.completed_date ? new Date(row.completed_date) : undefined,
      storyPoints: row.story_points || undefined,
      owner: row.owner || undefined,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }
  }
}

// Database row type
interface RoadmapItemRow {
  id: string
  project_id: string
  parent_id: string | null
  title: string
  description: string | null
  type: string
  status: string
  priority: string
  target_quarter: string | null
  lane: string
  start_date: string | null
  target_date: string | null
  completed_date: string | null
  story_points: number | null
  owner: string | null
  tags: string | null
  created_at: string
  updated_at: string
}

export const roadmapService = new RoadmapService()
