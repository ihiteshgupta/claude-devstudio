import { EventEmitter } from 'events'
import { databaseService } from './database.service'
import { taskDecomposerService } from './task-decomposer.service'
import { taskQueueService } from './task-queue.service'
import type { Sprint, SprintStatus, RoadmapItem, AutonomyLevel, UserStory } from '@shared/types'

export interface SprintConfig {
  projectId: string
  projectPath: string
  capacity: number // story points
  durationDays: number
  defaultAutonomyLevel: AutonomyLevel
  autoDecompose: boolean
  autoEnqueue: boolean
}

export interface SprintPlan {
  sprint: Sprint
  selectedItems: RoadmapItem[]
  totalPoints: number
  decomposedTasks: number
  enqueuedTasks: number
}

export interface SprintProgress {
  sprintId: string
  totalStories: number
  completedStories: number
  inProgressStories: number
  blockedStories: number
  totalPoints: number
  completedPoints: number
  percentComplete: number
  estimatedCompletion: Date | null
  velocity: number // points per day
}

class SprintPlannerService extends EventEmitter {
  /**
   * Auto-generate next sprint from roadmap items
   */
  async generateNextSprint(config: SprintConfig): Promise<SprintPlan> {
    const db = databaseService.getDb()

    this.emit('sprint-planning-started', { projectId: config.projectId })

    // Get high-priority roadmap items from 'now' lane
    const availableItems = db.prepare(`
      SELECT * FROM roadmap_items
      WHERE project_id = ?
        AND lane = 'now'
        AND status IN ('planned', 'in_progress')
        AND (sprint_id IS NULL OR sprint_id = '')
      ORDER BY priority DESC, story_points ASC
    `).all(config.projectId) as RoadmapItem[]

    // Select items that fit within capacity
    const selectedItems: RoadmapItem[] = []
    let totalPoints = 0

    for (const item of availableItems) {
      const points = item.storyPoints || 0
      if (totalPoints + points <= config.capacity) {
        selectedItems.push(item)
        totalPoints += points
      }
    }

    if (selectedItems.length === 0) {
      throw new Error('No roadmap items available for sprint planning')
    }

    // Create sprint
    const sprintId = `sprint_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    const startDate = new Date()
    const endDate = new Date(startDate.getTime() + config.durationDays * 24 * 60 * 60 * 1000)
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO sprints (id, project_id, name, description, start_date, end_date, status, goal, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sprintId,
      config.projectId,
      `Sprint ${new Date().toLocaleDateString()}`,
      `Auto-generated sprint with ${selectedItems.length} items (${totalPoints} points)`,
      startDate.toISOString(),
      endDate.toISOString(),
      'active' as SprintStatus,
      `Complete ${selectedItems.length} roadmap items`,
      now,
      now
    )

    // Link roadmap items to sprint
    for (const item of selectedItems) {
      db.prepare(`UPDATE roadmap_items SET sprint_id = ? WHERE id = ?`).run(sprintId, item.id)
    }

    // Convert roadmap items to user stories
    const stories: UserStory[] = []
    for (const item of selectedItems) {
      const storyId = `story_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

      db.prepare(`
        INSERT INTO user_stories (id, project_id, sprint_id, title, description, acceptance_criteria, story_points, status, priority, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        storyId,
        config.projectId,
        sprintId,
        item.title,
        item.description || '',
        '', // Will be generated
        item.storyPoints || 0,
        'todo',
        item.priority || 'medium',
        now,
        now
      )

      stories.push({
        id: storyId,
        projectId: config.projectId,
        title: item.title,
        description: item.description,
        storyPoints: item.storyPoints || 0,
        status: 'todo',
        priority: item.priority as any || 'medium',
        createdAt: new Date(now),
        updatedAt: new Date(now)
      })
    }

    // Decompose stories into tasks if enabled
    let decomposedTasks = 0
    let enqueuedTasks = 0

    if (config.autoDecompose) {
      for (const story of stories) {
        try {
          const result = await taskDecomposerService.decompose({
            projectId: config.projectId,
            title: story.title,
            description: story.description || '',
            context: `Sprint: ${sprintId}\nStory Points: ${story.storyPoints}`,
            projectPath: config.projectPath,
            autonomyLevel: config.defaultAutonomyLevel,
            enqueueImmediately: config.autoEnqueue
          })

          decomposedTasks += result.subtasks.length
          enqueuedTasks += result.enqueuedTasks.length

          this.emit('story-decomposed', {
            storyId: story.id,
            subtaskCount: result.subtasks.length
          })
        } catch (error) {
          this.emit('decomposition-error', {
            storyId: story.id,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }
    }

    const sprint: Sprint = {
      id: sprintId,
      projectId: config.projectId,
      name: `Sprint ${new Date().toLocaleDateString()}`,
      description: `Auto-generated sprint with ${selectedItems.length} items`,
      startDate,
      endDate,
      status: 'active',
      goal: `Complete ${selectedItems.length} roadmap items`,
      createdAt: new Date(now),
      updatedAt: new Date(now)
    }

    const plan: SprintPlan = {
      sprint,
      selectedItems,
      totalPoints,
      decomposedTasks,
      enqueuedTasks
    }

    this.emit('sprint-created', plan)
    return plan
  }

  /**
   * Get current active sprint
   */
  getActiveSprint(projectId: string): Sprint | null {
    const db = databaseService.getDb()

    const row = db.prepare(`
      SELECT * FROM sprints
      WHERE project_id = ? AND status = 'active'
      ORDER BY start_date DESC
      LIMIT 1
    `).get(projectId) as any

    if (!row) return null

    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      description: row.description,
      startDate: new Date(row.start_date),
      endDate: new Date(row.end_date),
      status: row.status,
      goal: row.goal,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }
  }

  /**
   * Get sprint progress
   */
  getSprintProgress(sprintId: string): SprintProgress {
    const db = databaseService.getDb()

    const stories = db.prepare(`
      SELECT status, story_points FROM user_stories WHERE sprint_id = ?
    `).all(sprintId) as any[]

    const totalStories = stories.length
    const completedStories = stories.filter(s => s.status === 'done').length
    const inProgressStories = stories.filter(s => s.status === 'in_progress').length
    const blockedStories = stories.filter(s => s.status === 'blocked').length

    const totalPoints = stories.reduce((sum, s) => sum + (s.story_points || 0), 0)
    const completedPoints = stories
      .filter(s => s.status === 'done')
      .reduce((sum, s) => sum + (s.story_points || 0), 0)

    const sprint = db.prepare(`SELECT * FROM sprints WHERE id = ?`).get(sprintId) as any
    const startDate = new Date(sprint?.start_date || Date.now())
    const daysElapsed = Math.max(1, (Date.now() - startDate.getTime()) / (24 * 60 * 60 * 1000))
    const velocity = completedPoints / daysElapsed

    const remainingPoints = totalPoints - completedPoints
    const daysToComplete = velocity > 0 ? remainingPoints / velocity : null
    const estimatedCompletion = daysToComplete
      ? new Date(Date.now() + daysToComplete * 24 * 60 * 60 * 1000)
      : null

    return {
      sprintId,
      totalStories,
      completedStories,
      inProgressStories,
      blockedStories,
      totalPoints,
      completedPoints,
      percentComplete: totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0,
      estimatedCompletion,
      velocity: Math.round(velocity * 10) / 10
    }
  }

  /**
   * Check and complete sprint if all stories done
   */
  async checkSprintCompletion(projectId: string): Promise<boolean> {
    const sprint = this.getActiveSprint(projectId)
    if (!sprint) return false

    const progress = this.getSprintProgress(sprint.id)

    if (progress.completedStories === progress.totalStories && progress.totalStories > 0) {
      const db = databaseService.getDb()
      const now = new Date().toISOString()

      db.prepare(`
        UPDATE sprints SET status = 'completed', updated_at = ? WHERE id = ?
      `).run(now, sprint.id)

      // Update roadmap items to 'done' lane
      db.prepare(`
        UPDATE roadmap_items SET lane = 'done', status = 'done' WHERE sprint_id = ?
      `).run(sprint.id)

      this.emit('sprint-completed', { sprintId: sprint.id, progress })
      return true
    }

    return false
  }

  /**
   * Monitor active sprint and trigger next if complete
   */
  async monitorAndContinue(config: SprintConfig): Promise<SprintPlan | null> {
    const completed = await this.checkSprintCompletion(config.projectId)

    if (completed) {
      // Small delay before starting next sprint
      await new Promise(resolve => setTimeout(resolve, 1000))

      try {
        return await this.generateNextSprint(config)
      } catch (error) {
        this.emit('sprint-generation-error', {
          error: error instanceof Error ? error.message : String(error)
        })
        return null
      }
    }

    return null
  }

  /**
   * Get sprint stories
   */
  getSprintStories(sprintId: string): UserStory[] {
    const db = databaseService.getDb()

    const rows = db.prepare(`
      SELECT * FROM user_stories WHERE sprint_id = ? ORDER BY priority DESC
    `).all(sprintId) as any[]

    return rows.map(row => ({
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      description: row.description,
      acceptanceCriteria: row.acceptance_criteria,
      storyPoints: row.story_points,
      status: row.status,
      priority: row.priority,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }))
  }

  /**
   * Update story status based on task completion
   */
  async syncStoryStatusFromTasks(projectId: string): Promise<number> {
    const db = databaseService.getDb()
    let updatedCount = 0

    // Get all stories with linked tasks
    const stories = db.prepare(`
      SELECT DISTINCT us.id, us.status as story_status
      FROM user_stories us
      INNER JOIN task_queue tq ON tq.input_data LIKE '%' || us.id || '%'
      WHERE us.project_id = ?
    `).all(projectId) as any[]

    for (const story of stories) {
      // Get all tasks for this story
      const tasks = db.prepare(`
        SELECT status FROM task_queue WHERE input_data LIKE '%' || ? || '%'
      `).all(story.id) as any[]

      if (tasks.length === 0) continue

      const allCompleted = tasks.every(t => t.status === 'completed')
      const anyFailed = tasks.some(t => t.status === 'failed')
      const anyRunning = tasks.some(t => t.status === 'running')
      const anyPending = tasks.some(t => ['pending', 'queued'].includes(t.status))

      let newStatus = story.story_status
      if (allCompleted) {
        newStatus = 'done'
      } else if (anyFailed) {
        newStatus = 'blocked'
      } else if (anyRunning) {
        newStatus = 'in_progress'
      } else if (anyPending) {
        newStatus = 'todo'
      }

      if (newStatus !== story.story_status) {
        db.prepare(`UPDATE user_stories SET status = ?, updated_at = ? WHERE id = ?`)
          .run(newStatus, new Date().toISOString(), story.id)
        updatedCount++
      }
    }

    return updatedCount
  }
}

export const sprintPlannerService = new SprintPlannerService()
