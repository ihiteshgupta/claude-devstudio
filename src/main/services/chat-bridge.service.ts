/**
 * Chat Bridge Service
 *
 * Connects chat interactions to the database by executing
 * parsed actions (creating stories, tasks, roadmap items, etc.)
 */

import { EventEmitter } from 'events'
import { databaseService } from './database.service'
import { actionParserService, ExtractedAction, ActionType } from './action-parser.service'
import { taskQueueService } from './task-queue.service'
import { v4 as uuidv4 } from 'uuid'
import type { AutonomyLevel } from '@shared/types'

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
  // New fields for queue integration:
  queued?: boolean
  queuedTaskId?: string
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

class ChatBridgeService extends EventEmitter {
  /**
   * Parse response and return proposed actions
   */
  parseActions(
    responseText: string,
    context?: { agentType?: string; projectId?: string }
  ): ExtractedAction[] {
    return actionParserService.parseResponse(responseText, context)
  }

  /**
   * Check for duplicates before creating an item
   */
  async checkDuplicates(
    projectId: string,
    type: ActionType,
    title: string
  ): Promise<DuplicateCheckResult> {
    const db = databaseService.getDb()
    const normalizedTitle = title.toLowerCase().trim()
    const matches: DuplicateCheckResult['matches'] = []

    try {
      switch (type) {
        case 'create-story': {
          const stories = db
            .prepare('SELECT id, title FROM user_stories WHERE project_id = ?')
            .all(projectId) as Array<{ id: string; title: string }>

          for (const story of stories) {
            const similarity = this.calculateSimilarity(normalizedTitle, story.title.toLowerCase())
            if (similarity > 0.6) {
              matches.push({
                id: story.id,
                title: story.title,
                type: 'story',
                similarity,
              })
            }
          }
          break
        }

        case 'create-task': {
          const tasks = db
            .prepare('SELECT id, title FROM task_queue WHERE project_id = ?')
            .all(projectId) as Array<{ id: string; title: string }>

          for (const task of tasks) {
            const similarity = this.calculateSimilarity(normalizedTitle, task.title.toLowerCase())
            if (similarity > 0.6) {
              matches.push({
                id: task.id,
                title: task.title,
                type: 'task',
                similarity,
              })
            }
          }
          break
        }

        case 'create-roadmap-item': {
          const items = db
            .prepare('SELECT id, title FROM roadmap_items WHERE project_id = ?')
            .all(projectId) as Array<{ id: string; title: string }>

          for (const item of items) {
            const similarity = this.calculateSimilarity(normalizedTitle, item.title.toLowerCase())
            if (similarity > 0.6) {
              matches.push({
                id: item.id,
                title: item.title,
                type: 'roadmap',
                similarity,
              })
            }
          }
          break
        }

        case 'create-test': {
          const tests = db
            .prepare('SELECT id, title FROM test_cases WHERE story_id IN (SELECT id FROM user_stories WHERE project_id = ?)')
            .all(projectId) as Array<{ id: string; title: string }>

          for (const test of tests) {
            const similarity = this.calculateSimilarity(normalizedTitle, test.title.toLowerCase())
            if (similarity > 0.6) {
              matches.push({
                id: test.id,
                title: test.title,
                type: 'test',
                similarity,
              })
            }
          }
          break
        }
      }
    } catch (error) {
      console.error('Error checking duplicates:', error)
    }

    // Sort by similarity descending
    matches.sort((a, b) => b.similarity - a.similarity)

    return {
      hasDuplicate: matches.length > 0,
      matches: matches.slice(0, 5), // Return top 5 matches
    }
  }

  /**
   * Calculate similarity between two strings (Jaccard similarity on words)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.split(/\s+/).filter(w => w.length > 2))
    const words2 = new Set(str2.split(/\s+/).filter(w => w.length > 2))

    if (words1.size === 0 || words2.size === 0) return 0

    const intersection = new Set([...words1].filter(w => words2.has(w)))
    const union = new Set([...words1, ...words2])

    return intersection.size / union.size
  }

  /**
   * Execute an action - create the item in the database
   */
  async executeAction(
    action: ExtractedAction,
    projectId: string,
    options?: {
      skipDuplicateCheck?: boolean
      forceCreate?: boolean
      autoQueue?: boolean
      autonomyLevel?: AutonomyLevel
      priority?: number
    }
  ): Promise<ExecutionResult> {
    // Check for duplicates first
    if (!options?.skipDuplicateCheck) {
      const duplicateCheck = await this.checkDuplicates(projectId, action.type, action.title)
      if (duplicateCheck.hasDuplicate && !options?.forceCreate) {
        return {
          actionId: action.id,
          success: false,
          error: 'Duplicate item found',
          duplicateFound: duplicateCheck.matches[0],
        }
      }
    }

    try {
      let result: ExecutionResult

      switch (action.type) {
        case 'create-story':
          result = this.createStory(action, projectId)
          break

        case 'create-task':
          result = this.createTask(action, projectId)
          break

        case 'create-roadmap-item':
          result = this.createRoadmapItem(action, projectId)
          break

        case 'create-test':
          result = this.createTest(action, projectId)
          break

        default:
          result = {
            actionId: action.id,
            success: false,
            error: `Action type ${action.type} not yet implemented`,
          }
      }

      // Auto-queue if requested and creation was successful
      if (options?.autoQueue && result.success && result.createdItemId && result.createdItemType === 'task') {
        try {
          const task = taskQueueService.getTask(result.createdItemId)
          if (task) {
            // Update autonomy level if specified
            if (options.autonomyLevel) {
              taskQueueService.updateAutonomyLevel(result.createdItemId, options.autonomyLevel)
            }
            // Update priority if specified
            if (options.priority !== undefined) {
              taskQueueService.reorderTask(result.createdItemId, options.priority)
            }
            // Mark as queued
            taskQueueService.updateTaskStatus(result.createdItemId, 'queued')

            result.queued = true
            result.queuedTaskId = result.createdItemId

            this.emit('task-queued', {
              taskId: result.createdItemId,
              actionId: action.id,
              projectId
            })
          }
        } catch (queueError) {
          console.error('Failed to queue task:', queueError)
          // Don't fail the entire operation if queueing fails
        }
      }

      return result
    } catch (error) {
      return {
        actionId: action.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Create a user story
   */
  private createStory(action: ExtractedAction, projectId: string): ExecutionResult {
    const db = databaseService.getDb()
    const now = new Date().toISOString()
    const id = uuidv4()

    const metadata = action.metadata as {
      priority?: string
      acceptanceCriteria?: string[]
      storyType?: string
    }

    db.prepare(`
      INSERT INTO user_stories (
        id, project_id, title, description, status, priority,
        story_type, acceptance_criteria, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      projectId,
      action.title,
      action.description || '',
      'backlog',
      metadata.priority || 'medium',
      metadata.storyType || 'feature',
      JSON.stringify(metadata.acceptanceCriteria || []),
      now,
      now
    )

    this.emit('item-created', {
      type: 'story',
      id,
      title: action.title,
      projectId,
    })

    return {
      actionId: action.id,
      success: true,
      createdItemId: id,
      createdItemType: 'story',
    }
  }

  /**
   * Create a task in the queue
   */
  private createTask(action: ExtractedAction, projectId: string): ExecutionResult {
    const db = databaseService.getDb()
    const now = new Date().toISOString()
    const id = `task_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

    const metadata = action.metadata as {
      taskType?: string
      agentType?: string
      autonomyLevel?: string
      priority?: number
      parentStoryId?: string
    }

    db.prepare(`
      INSERT INTO task_queue (
        id, project_id, title, description, task_type, agent_type,
        autonomy_level, status, priority, input_data, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      projectId,
      action.title,
      action.description || '',
      metadata.taskType || 'code-generation',
      metadata.agentType || 'developer',
      metadata.autonomyLevel || 'approval_gates',
      'pending',
      metadata.priority || 50,
      JSON.stringify({ sourceAction: action.id }),
      now,
      now
    )

    this.emit('item-created', {
      type: 'task',
      id,
      title: action.title,
      projectId,
    })

    return {
      actionId: action.id,
      success: true,
      createdItemId: id,
      createdItemType: 'task',
    }
  }

  /**
   * Create a roadmap item
   */
  private createRoadmapItem(action: ExtractedAction, projectId: string): ExecutionResult {
    const db = databaseService.getDb()
    const now = new Date().toISOString()
    const id = uuidv4()

    const metadata = action.metadata as {
      itemType?: string
      lane?: string
      priority?: string
    }

    db.prepare(`
      INSERT INTO roadmap_items (
        id, project_id, title, description, item_type, lane,
        priority, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      projectId,
      action.title,
      action.description || '',
      metadata.itemType || 'feature',
      metadata.lane || 'next',
      metadata.priority || 'medium',
      'planned',
      now,
      now
    )

    this.emit('item-created', {
      type: 'roadmap',
      id,
      title: action.title,
      projectId,
    })

    return {
      actionId: action.id,
      success: true,
      createdItemId: id,
      createdItemType: 'roadmap',
    }
  }

  /**
   * Create a test case
   */
  private createTest(action: ExtractedAction, projectId: string): ExecutionResult {
    const db = databaseService.getDb()
    const now = new Date().toISOString()
    const id = uuidv4()

    const metadata = action.metadata as {
      testType?: string
      targetFile?: string
    }

    // Find a story to attach to (or create orphan test)
    const story = db
      .prepare('SELECT id FROM user_stories WHERE project_id = ? LIMIT 1')
      .get(projectId) as { id: string } | undefined

    if (!story) {
      return {
        actionId: action.id,
        success: false,
        error: 'No user story found to attach test to',
      }
    }

    db.prepare(`
      INSERT INTO test_cases (
        id, story_id, title, description, test_type, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      story.id,
      action.title,
      action.description || '',
      metadata.testType || 'unit',
      'pending',
      now,
      now
    )

    this.emit('item-created', {
      type: 'test',
      id,
      title: action.title,
      projectId,
    })

    return {
      actionId: action.id,
      success: true,
      createdItemId: id,
      createdItemType: 'test',
    }
  }

  /**
   * Execute multiple actions with results
   */
  async executeActions(
    actions: ExtractedAction[],
    projectId: string
  ): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = []

    for (const action of actions) {
      const result = await this.executeAction(action, projectId)
      results.push(result)

      // Emit progress event
      this.emit('action-executed', {
        action,
        result,
        progress: results.length / actions.length,
      })
    }

    return results
  }

  /**
   * Update action status
   */
  updateActionStatus(actionId: string, status: ExtractedAction['status']): void {
    // This would be stored in action_history table
    this.emit('action-status-changed', { actionId, status })
  }

  /**
   * Get suggested actions for a response with duplicate checking
   */
  async getSuggestedActions(
    responseText: string,
    projectId: string,
    context?: { agentType?: string }
  ): Promise<Array<ExtractedAction & { duplicateCheck?: DuplicateCheckResult }>> {
    const actions = this.parseActions(responseText, { ...context, projectId })

    // Check duplicates for each action
    const actionsWithDuplicates = await Promise.all(
      actions.map(async (action) => {
        const duplicateCheck = await this.checkDuplicates(projectId, action.type, action.title)
        return {
          ...action,
          duplicateCheck: duplicateCheck.hasDuplicate ? duplicateCheck : undefined,
        }
      })
    )

    return actionsWithDuplicates
  }

  /**
   * Queue a task for autonomous execution
   */
  async queueForExecution(
    action: ExtractedAction,
    projectId: string,
    options?: {
      autonomyLevel?: AutonomyLevel
      startImmediately?: boolean
      priority?: number
    }
  ): Promise<{ taskId: string; queued: boolean }> {
    // Execute the action first to create the item
    const result = await this.executeAction(action, projectId, {
      autoQueue: true,
      autonomyLevel: options?.autonomyLevel,
      priority: options?.priority
    })

    if (!result.success || !result.queuedTaskId) {
      return {
        taskId: result.createdItemId || '',
        queued: false
      }
    }

    // If startImmediately is requested, update status to queued (already done in executeAction)
    // The actual execution would be triggered by the queue service externally

    return {
      taskId: result.queuedTaskId,
      queued: true
    }
  }

  /**
   * Batch queue multiple actions for autonomous execution
   */
  async queueAllApproved(
    actions: ExtractedAction[],
    projectId: string,
    options?: {
      autonomyLevel?: AutonomyLevel
      priority?: number
    }
  ): Promise<Array<{ actionId: string; taskId?: string; queued: boolean; error?: string }>> {
    const results: Array<{ actionId: string; taskId?: string; queued: boolean; error?: string }> = []

    for (const action of actions) {
      try {
        // Only queue approved or proposed actions
        if (action.status === 'approved' || action.status === 'proposed') {
          const queueResult = await this.queueForExecution(action, projectId, options)
          results.push({
            actionId: action.id,
            taskId: queueResult.taskId,
            queued: queueResult.queued
          })
        } else {
          results.push({
            actionId: action.id,
            queued: false,
            error: `Action status is ${action.status}, not approved`
          })
        }
      } catch (error) {
        results.push({
          actionId: action.id,
          queued: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    const queuedCount = results.filter(r => r.queued).length
    this.emit('batch-queued', { count: queuedCount, projectId })

    return results
  }
}

export const chatBridgeService = new ChatBridgeService()
