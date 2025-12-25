import { EventEmitter } from 'events'
import { databaseService } from './database.service'
import { roadmapService } from './roadmap.service'
import { claudeService } from './claude.service'
import type { AgentType, UserStory } from '@shared/types'

// ============================================
// Sprint Automation Types
// ============================================

export interface SprintSuggestion {
  id: string
  projectId: string
  suggestedStories: Array<{
    storyId: string
    title: string
    priority: string
    estimatedEffort: number
    reason: string
  }>
  totalCapacity: number
  usedCapacity: number
  sprintGoal: string
  warnings: string[]
  createdAt: string
}

export interface ChatWorkflow {
  id: string
  projectId: string
  userIntent: string
  steps: Array<{
    agentType: AgentType
    action: string
    status: 'pending' | 'in_progress' | 'completed' | 'skipped'
    output?: unknown
  }>
  currentStep: number
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
}

interface SprintAutomationRow {
  id: string
  project_id: string
  sprint_id: string | null
  automation_type: string
  status: string
  suggestion_data: string | null
  workflow_steps: string | null
  created_at: string
  completed_at: string | null
}

class SprintAutomationService extends EventEmitter {
  private activeWorkflows: Map<string, ChatWorkflow> = new Map()

  constructor() {
    super()
    this.initTables()
  }

  /**
   * Initialize database tables
   */
  private initTables(): void {
    const db = databaseService.getDb()

    db.exec(`
      CREATE TABLE IF NOT EXISTS sprint_automation (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        sprint_id TEXT,
        automation_type TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        suggestion_data TEXT,
        workflow_steps TEXT,
        created_at TEXT NOT NULL,
        completed_at TEXT
      )
    `)

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sprint_automation_project ON sprint_automation(project_id);
      CREATE INDEX IF NOT EXISTS idx_sprint_automation_status ON sprint_automation(status);
    `)
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `sprint_auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Generate sprint suggestion based on roadmap and backlog
   */
  async generateSprintSuggestion(projectId: string, capacity?: number): Promise<SprintSuggestion> {
    const db = databaseService.getDb()
    const now = new Date().toISOString()
    const id = this.generateId()

    // Get roadmap items in "Now" lane
    const nowItems = roadmapService.listItems(projectId, { lane: 'now' })

    // Get backlog stories
    const backlogStories = databaseService.listUserStories(projectId)
      .filter(story => !story.sprintId && story.status === 'backlog')
      .sort((a, b) => {
        // Sort by priority
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
        return priorityOrder[b.priority] - priorityOrder[a.priority]
      })

    // Calculate default capacity (based on past sprints if available)
    const defaultCapacity = capacity || await this.estimateSprintCapacity(projectId)

    // Select stories for sprint
    const suggestedStories: SprintSuggestion['suggestedStories'] = []
    let usedCapacity = 0
    const warnings: string[] = []

    // Prioritize roadmap items in "Now" lane
    for (const item of nowItems.slice(0, 3)) {
      const effort = item.storyPoints || 5
      if (usedCapacity + effort <= defaultCapacity) {
        suggestedStories.push({
          storyId: item.id,
          title: item.title,
          priority: item.priority,
          estimatedEffort: effort,
          reason: `High-priority roadmap item in "Now" lane`
        })
        usedCapacity += effort
      } else {
        warnings.push(`Roadmap item "${item.title}" exceeds capacity`)
      }
    }

    // Add backlog stories
    for (const story of backlogStories) {
      if (usedCapacity >= defaultCapacity) break

      const effort = story.storyPoints || 3
      if (usedCapacity + effort <= defaultCapacity) {
        suggestedStories.push({
          storyId: story.id,
          title: story.title,
          priority: story.priority,
          estimatedEffort: effort,
          reason: `${story.priority} priority backlog item`
        })
        usedCapacity += effort
      }
    }

    // Generate sprint goal
    const sprintGoal = this.generateSprintGoal(suggestedStories)

    const suggestion: SprintSuggestion = {
      id,
      projectId,
      suggestedStories,
      totalCapacity: defaultCapacity,
      usedCapacity,
      sprintGoal,
      warnings,
      createdAt: now
    }

    // Save to database
    db.prepare(`
      INSERT INTO sprint_automation (
        id, project_id, automation_type, status, suggestion_data, created_at
      ) VALUES (?, ?, 'suggestion', 'pending', ?, ?)
    `).run(id, projectId, JSON.stringify(suggestion), now)

    this.emit('suggestion-generated', suggestion)
    return suggestion
  }

  /**
   * Estimate sprint capacity based on historical data
   */
  private async estimateSprintCapacity(projectId: string): Promise<number> {
    const db = databaseService.getDb()

    // Get completed sprints with their story points
    const sprints = db.prepare(`
      SELECT s.id,
             SUM(us.story_points) as total_points
      FROM sprints s
      LEFT JOIN user_stories us ON us.sprint_id = s.id
      WHERE s.project_id = ? AND s.status = 'completed'
      GROUP BY s.id
      ORDER BY s.end_date DESC
      LIMIT 3
    `).all(projectId) as Array<{ id: string; total_points: number | null }>

    if (sprints.length === 0) {
      return 20 // Default capacity
    }

    // Calculate average capacity
    const avgCapacity = sprints.reduce((sum, s) => sum + (s.total_points || 0), 0) / sprints.length
    return Math.round(avgCapacity) || 20
  }

  /**
   * Generate sprint goal from suggested stories
   */
  private generateSprintGoal(stories: SprintSuggestion['suggestedStories']): string {
    if (stories.length === 0) {
      return 'Complete planned development work'
    }

    // Group by priority
    const highPriority = stories.filter(s => s.priority === 'high' || s.priority === 'critical')

    if (highPriority.length > 0) {
      const titles = highPriority.slice(0, 2).map(s => s.title.toLowerCase())
      return `Deliver ${titles.join(' and ')}`
    }

    return `Complete ${stories.length} user stories`
  }

  /**
   * Apply sprint suggestion to create actual sprint
   */
  async applySprintSuggestion(suggestionId: string): Promise<string> {
    const db = databaseService.getDb()

    const row = db.prepare('SELECT * FROM sprint_automation WHERE id = ?')
      .get(suggestionId) as SprintAutomationRow | undefined

    if (!row || !row.suggestion_data) {
      throw new Error('Sprint suggestion not found')
    }

    const suggestion: SprintSuggestion = JSON.parse(row.suggestion_data)

    // Create sprint
    const startDate = new Date()
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + 14) // 2-week sprint

    const sprint = databaseService.createSprint({
      projectId: suggestion.projectId,
      name: `Sprint ${new Date().toISOString().slice(0, 10)}`,
      description: `Auto-generated sprint`,
      startDate,
      endDate,
      goal: suggestion.sprintGoal
    })

    // Add stories to sprint
    for (const story of suggestion.suggestedStories) {
      databaseService.addStoryToSprint(sprint.id, story.storyId)
    }

    // Update suggestion status
    db.prepare(`
      UPDATE sprint_automation
      SET status = 'completed', sprint_id = ?, completed_at = ?
      WHERE id = ?
    `).run(sprint.id, new Date().toISOString(), suggestionId)

    this.emit('suggestion-applied', { suggestionId, sprintId: sprint.id })
    return sprint.id
  }

  /**
   * Get all suggestions for a project
   */
  getSuggestions(projectId: string): SprintSuggestion[] {
    const db = databaseService.getDb()

    const rows = db.prepare(`
      SELECT * FROM sprint_automation
      WHERE project_id = ? AND automation_type = 'suggestion'
      ORDER BY created_at DESC
    `).all(projectId) as SprintAutomationRow[]

    return rows
      .filter(row => row.suggestion_data)
      .map(row => JSON.parse(row.suggestion_data!))
  }

  /**
   * Start a multi-agent workflow from chat intent
   */
  async startChatWorkflow(projectId: string, userIntent: string): Promise<ChatWorkflow> {
    const id = this.generateId()

    // Parse intent and determine workflow steps
    const steps = await this.parseIntentToSteps(userIntent)

    const workflow: ChatWorkflow = {
      id,
      projectId,
      userIntent,
      steps,
      currentStep: 0,
      status: 'pending'
    }

    // Save to database
    const db = databaseService.getDb()
    db.prepare(`
      INSERT INTO sprint_automation (
        id, project_id, automation_type, status, workflow_steps, created_at
      ) VALUES (?, ?, 'workflow', 'pending', ?, ?)
    `).run(id, projectId, JSON.stringify(workflow), new Date().toISOString())

    this.activeWorkflows.set(id, workflow)
    this.emit('workflow-started', workflow)

    return workflow
  }

  /**
   * Parse user intent into workflow steps
   */
  private async parseIntentToSteps(intent: string): Promise<ChatWorkflow['steps']> {
    const lowerIntent = intent.toLowerCase()

    // Detect workflow type based on keywords
    if (lowerIntent.includes('implement') && lowerIntent.includes('end-to-end')) {
      // Full feature pipeline
      return [
        { agentType: 'product-owner', action: 'Refine requirements', status: 'pending' },
        { agentType: 'developer', action: 'Create technical specification', status: 'pending' },
        { agentType: 'tester', action: 'Generate test cases', status: 'pending' },
        { agentType: 'developer', action: 'Implement feature', status: 'pending' },
        { agentType: 'security', action: 'Security review', status: 'pending' },
        { agentType: 'documentation', action: 'Update documentation', status: 'pending' }
      ]
    } else if (lowerIntent.includes('test')) {
      // Testing workflow
      return [
        { agentType: 'tester', action: 'Analyze requirements', status: 'pending' },
        { agentType: 'tester', action: 'Generate test cases', status: 'pending' }
      ]
    } else if (lowerIntent.includes('security') || lowerIntent.includes('audit')) {
      // Security workflow
      return [
        { agentType: 'security', action: 'Security audit', status: 'pending' },
        { agentType: 'developer', action: 'Fix vulnerabilities', status: 'pending' }
      ]
    } else if (lowerIntent.includes('document')) {
      // Documentation workflow
      return [
        { agentType: 'documentation', action: 'Generate documentation', status: 'pending' }
      ]
    } else {
      // Default: PO → Developer workflow
      return [
        { agentType: 'product-owner', action: 'Analyze requirements', status: 'pending' },
        { agentType: 'developer', action: 'Implement solution', status: 'pending' }
      ]
    }
  }

  /**
   * Advance workflow to next step
   */
  async advanceWorkflow(workflowId: string, stepOutput: unknown): Promise<ChatWorkflow> {
    const workflow = this.activeWorkflows.get(workflowId)
    if (!workflow) {
      throw new Error('Workflow not found')
    }

    // Mark current step as completed
    if (workflow.currentStep < workflow.steps.length) {
      workflow.steps[workflow.currentStep].status = 'completed'
      workflow.steps[workflow.currentStep].output = stepOutput
    }

    // Move to next step
    workflow.currentStep++

    // Check if workflow is complete
    if (workflow.currentStep >= workflow.steps.length) {
      workflow.status = 'completed'
      this.activeWorkflows.delete(workflowId)
      this.emit('workflow-completed', workflow)
    } else {
      workflow.steps[workflow.currentStep].status = 'in_progress'
      workflow.status = 'in_progress'
      this.emit('workflow-step-started', {
        workflowId,
        step: workflow.steps[workflow.currentStep]
      })
    }

    // Update database
    const db = databaseService.getDb()
    db.prepare(`
      UPDATE sprint_automation
      SET workflow_steps = ?, status = ?, completed_at = ?
      WHERE id = ?
    `).run(
      JSON.stringify(workflow),
      workflow.status,
      workflow.status === 'completed' ? new Date().toISOString() : null,
      workflowId
    )

    return workflow
  }

  /**
   * Cancel running workflow
   */
  cancelWorkflow(workflowId: string): boolean {
    const workflow = this.activeWorkflows.get(workflowId)
    if (!workflow) {
      return false
    }

    workflow.status = 'cancelled'

    // Mark remaining steps as skipped
    for (let i = workflow.currentStep; i < workflow.steps.length; i++) {
      if (workflow.steps[i].status === 'pending' || workflow.steps[i].status === 'in_progress') {
        workflow.steps[i].status = 'skipped'
      }
    }

    this.activeWorkflows.delete(workflowId)

    // Update database
    const db = databaseService.getDb()
    db.prepare(`
      UPDATE sprint_automation
      SET workflow_steps = ?, status = 'cancelled', completed_at = ?
      WHERE id = ?
    `).run(
      JSON.stringify(workflow),
      new Date().toISOString(),
      workflowId
    )

    this.emit('workflow-cancelled', workflowId)
    return true
  }

  /**
   * Get active workflows for a project
   */
  getActiveWorkflows(projectId: string): ChatWorkflow[] {
    const db = databaseService.getDb()

    const rows = db.prepare(`
      SELECT * FROM sprint_automation
      WHERE project_id = ?
        AND automation_type = 'workflow'
        AND status IN ('pending', 'in_progress')
      ORDER BY created_at DESC
    `).all(projectId) as SprintAutomationRow[]

    return rows
      .filter(row => row.workflow_steps)
      .map(row => JSON.parse(row.workflow_steps!))
  }

  /**
   * Get workflow by ID
   */
  getWorkflow(workflowId: string): ChatWorkflow | null {
    // Check in-memory first
    const activeWorkflow = this.activeWorkflows.get(workflowId)
    if (activeWorkflow) {
      return activeWorkflow
    }

    // Check database
    const db = databaseService.getDb()
    const row = db.prepare('SELECT * FROM sprint_automation WHERE id = ?')
      .get(workflowId) as SprintAutomationRow | undefined

    if (!row || !row.workflow_steps) {
      return null
    }

    return JSON.parse(row.workflow_steps)
  }
}

export const sprintAutomationService = new SprintAutomationService()
