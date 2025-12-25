import { databaseService } from './database.service'

// Optional import for agent memory service (may not be available yet)
let agentMemoryService: any = null
try {
  // Dynamic import to handle cases where the service doesn't exist yet
  const memoryModule = require('./agent-memory.service')
  agentMemoryService = memoryModule.agentMemoryService
} catch {
  // Service not available yet, continue without it
}

export interface ContextOptions {
  includeStories?: boolean
  includeTasks?: boolean
  includeRoadmap?: boolean
  includeSprint?: boolean
  includeMemory?: boolean
  verbosity?: 'minimal' | 'standard' | 'detailed'
  maxWords?: number
}

export interface ProjectContext {
  stories: {
    total: number
    recent: Array<{ id: string; title: string; status: string; priority: string }>
    inProgress: Array<{ id: string; title: string }>
  }
  tasks: {
    total: number
    pending: Array<{ id: string; title: string; taskType: string }>
    inProgress: Array<{ id: string; title: string }>
  }
  roadmap: {
    now: Array<{ id: string; title: string; itemType: string }>
    next: Array<{ id: string; title: string; itemType: string }>
  }
  sprint?: {
    name: string
    goal?: string
    items: Array<{ id: string; title: string; type: string }>
  }
  recentActivity: Array<{
    type: 'story' | 'task' | 'test'
    action: 'created' | 'updated' | 'completed'
    title: string
    timestamp: string
  }>
}

class ContextInjectionService {
  private db = databaseService.getDb()

  /**
   * Get agent memory context - recent decisions, approvals, and rejections
   */
  getMemoryContext(projectId: string): string {
    if (!agentMemoryService) {
      return '' // Service not available yet
    }

    try {
      const sections: string[] = []
      sections.push('## Agent Memory\n')

      // Get recent decisions from agent memory service
      const recentDecisions = agentMemoryService.getRecentDecisions?.(projectId, 10) || []
      if (recentDecisions.length > 0) {
        sections.push('### Recent Decisions')
        for (const decision of recentDecisions) {
          sections.push(`- ${decision.decision} (${decision.timestamp})`)
        }
        sections.push('')
      }

      // Get recently approved items
      const approvedItems = agentMemoryService.getRecentApprovals?.(projectId, 5) || []
      if (approvedItems.length > 0) {
        sections.push('### Recently Approved')
        for (const item of approvedItems) {
          sections.push(`- ${item.type}: ${item.title}`)
        }
        sections.push('')
      }

      // Get recently rejected items (to avoid repeating rejected suggestions)
      const rejectedItems = agentMemoryService.getRecentRejections?.(projectId, 5) || []
      if (rejectedItems.length > 0) {
        sections.push('### Recently Rejected (DO NOT suggest these again)')
        for (const item of rejectedItems) {
          sections.push(`- ${item.type}: ${item.title} - Reason: ${item.reason}`)
        }
        sections.push('')
      }

      return sections.join('\n')
    } catch (error) {
      // If memory service fails, return empty string
      return ''
    }
  }

  /**
   * Get detailed sprint context with progress tracking
   */
  getSprintContext(projectId: string, verbosity: 'minimal' | 'standard' | 'detailed' = 'standard'): string {
    const activeSprint = this.db
      .prepare("SELECT * FROM sprints WHERE project_id = ? AND status = 'active' LIMIT 1")
      .get(projectId) as {
      id: string
      name: string
      goal: string | null
      start_date: string
      end_date: string
      description: string | null
    } | undefined

    if (!activeSprint) {
      return ''
    }

    const sections: string[] = []
    sections.push(`## Current Sprint: ${activeSprint.name}\n`)

    if (activeSprint.goal) {
      sections.push(`**Goal:** ${activeSprint.goal}\n`)
    }

    // Calculate sprint duration and progress
    const startDate = new Date(activeSprint.start_date)
    const endDate = new Date(activeSprint.end_date)
    const now = new Date()
    const totalDuration = endDate.getTime() - startDate.getTime()
    const elapsed = now.getTime() - startDate.getTime()
    const progressPercent = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)))

    sections.push(`**Duration:** ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`)
    sections.push(`**Progress:** ${progressPercent}% complete\n`)

    if (activeSprint.description && verbosity !== 'minimal') {
      sections.push(`**Description:** ${activeSprint.description}\n`)
    }

    // Get sprint items by status
    const todoItems = this.db
      .prepare(
        "SELECT id, title, priority FROM user_stories WHERE sprint_id = ? AND status = 'todo' ORDER BY priority DESC"
      )
      .all(activeSprint.id) as Array<{ id: string; title: string; priority: string }>

    const inProgressItems = this.db
      .prepare(
        "SELECT id, title, priority FROM user_stories WHERE sprint_id = ? AND status = 'in-progress' ORDER BY priority DESC"
      )
      .all(activeSprint.id) as Array<{ id: string; title: string; priority: string }>

    const doneItems = this.db
      .prepare(
        "SELECT id, title FROM user_stories WHERE sprint_id = ? AND status = 'done'"
      )
      .all(activeSprint.id) as Array<{ id: string; title: string }>

    const blockedItems = this.db
      .prepare(
        "SELECT id, title, priority FROM user_stories WHERE sprint_id = ? AND status = 'blocked' ORDER BY priority DESC"
      )
      .all(activeSprint.id) as Array<{ id: string; title: string; priority: string }>

    const totalItems = todoItems.length + inProgressItems.length + doneItems.length + blockedItems.length
    const completionPercent = totalItems > 0 ? Math.round((doneItems.length / totalItems) * 100) : 0

    sections.push(`**Item Completion:** ${doneItems.length}/${totalItems} (${completionPercent}%)\n`)

    // Show items by status
    if (verbosity === 'detailed') {
      if (blockedItems.length > 0) {
        sections.push('### Blocked Items (Needs Attention!)')
        for (const item of blockedItems) {
          sections.push(`- [${item.priority}] ${item.title}`)
        }
        sections.push('')
      }

      if (inProgressItems.length > 0) {
        sections.push('### In Progress')
        for (const item of inProgressItems) {
          sections.push(`- [${item.priority}] ${item.title}`)
        }
        sections.push('')
      }

      if (todoItems.length > 0) {
        sections.push('### To Do')
        for (const item of todoItems.slice(0, 5)) {
          sections.push(`- [${item.priority}] ${item.title}`)
        }
        if (todoItems.length > 5) {
          sections.push(`... and ${todoItems.length - 5} more`)
        }
        sections.push('')
      }

      if (doneItems.length > 0) {
        sections.push('### Completed')
        sections.push(`${doneItems.length} items completed`)
        sections.push('')
      }
    } else if (verbosity === 'standard') {
      // Standard verbosity - just show counts and blocked items
      if (blockedItems.length > 0) {
        sections.push('### Blocked Items')
        for (const item of blockedItems) {
          sections.push(`- ${item.title}`)
        }
        sections.push('')
      }

      sections.push(`**Status Summary:** ${doneItems.length} done, ${inProgressItems.length} in progress, ${todoItems.length} to do`)
      if (blockedItems.length > 0) {
        sections.push(`⚠️ ${blockedItems.length} blocked`)
      }
      sections.push('')
    } else {
      // Minimal - just the basics
      sections.push(`${doneItems.length}/${totalItems} complete`)
      if (blockedItems.length > 0) {
        sections.push(`⚠️ ${blockedItems.length} blocked items`)
      }
      sections.push('')
    }

    return sections.join('\n')
  }

  /**
   * Get roadmap context with dependencies and deadlines
   */
  getRoadmapContext(projectId: string, verbosity: 'minimal' | 'standard' | 'detailed' = 'standard'): string {
    const sections: string[] = []
    sections.push('## Roadmap\n')

    // Get items by lane
    const nowItems = this.db
      .prepare(
        `SELECT id, title, type, status, priority, target_date, owner
         FROM roadmap_items
         WHERE project_id = ? AND lane = 'now'
         ORDER BY priority DESC, target_date ASC`
      )
      .all(projectId) as Array<{
      id: string
      title: string
      type: string
      status: string
      priority: string
      target_date: string | null
      owner: string | null
    }>

    const nextItems = this.db
      .prepare(
        `SELECT id, title, type, status, priority, target_date, owner
         FROM roadmap_items
         WHERE project_id = ? AND lane = 'next'
         ORDER BY priority DESC, target_date ASC`
      )
      .all(projectId) as Array<{
      id: string
      title: string
      type: string
      status: string
      priority: string
      target_date: string | null
      owner: string | null
    }>

    const laterItems = this.db
      .prepare(
        `SELECT id, title, type, status, priority, target_date
         FROM roadmap_items
         WHERE project_id = ? AND lane = 'later'
         ORDER BY priority DESC, target_date ASC`
      )
      .all(projectId) as Array<{
      id: string
      title: string
      type: string
      status: string
      priority: string
      target_date: string | null
    }>

    // Helper function to get dependencies for an item
    const getDependencies = (itemId: string): Array<{ title: string; status: string }> => {
      // Using task_queue relationships if roadmap_item_id is linked
      const deps = this.db
        .prepare(
          `SELECT DISTINCT ri.title, ri.status
           FROM task_dependencies td
           JOIN task_queue tq ON td.task_id = tq.id
           JOIN task_queue dep_tq ON td.depends_on_task_id = dep_tq.id
           JOIN roadmap_items ri ON dep_tq.roadmap_item_id = ri.id
           WHERE tq.roadmap_item_id = ?`
        )
        .all(itemId) as Array<{ title: string; status: string }>
      return deps
    }

    // Check for upcoming deadlines (within 30 days)
    const upcomingDeadlines: Array<{ title: string; target_date: string; lane: string }> = []
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

    for (const item of [...nowItems, ...nextItems, ...laterItems]) {
      if (item.target_date) {
        const targetDate = new Date(item.target_date)
        if (targetDate <= thirtyDaysFromNow && targetDate >= new Date()) {
          upcomingDeadlines.push({
            title: item.title,
            target_date: item.target_date,
            lane: nowItems.includes(item as any) ? 'now' : nextItems.includes(item as any) ? 'next' : 'later'
          })
        }
      }
    }

    // Show upcoming deadlines first
    if (upcomingDeadlines.length > 0 && verbosity !== 'minimal') {
      sections.push('### Upcoming Deadlines (Next 30 Days)')
      for (const deadline of upcomingDeadlines) {
        const date = new Date(deadline.target_date)
        const daysUntil = Math.ceil((date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        sections.push(`- ${deadline.title} - ${date.toLocaleDateString()} (${daysUntil} days)`)
      }
      sections.push('')
    }

    // Now lane
    if (nowItems.length > 0) {
      sections.push('### Now (Current Focus)')
      const limit = verbosity === 'minimal' ? 3 : verbosity === 'standard' ? 5 : nowItems.length
      for (const item of nowItems.slice(0, limit)) {
        let line = `- ${item.title} [${item.type}, ${item.status}]`

        if (verbosity === 'detailed') {
          if (item.owner) line += ` - Owner: ${item.owner}`
          if (item.target_date) {
            const date = new Date(item.target_date)
            line += ` - Target: ${date.toLocaleDateString()}`
          }

          // Show dependencies
          const deps = getDependencies(item.id)
          if (deps.length > 0) {
            sections.push(line)
            sections.push(`  Dependencies: ${deps.map(d => `${d.title} (${d.status})`).join(', ')}`)
            continue
          }
        }

        sections.push(line)
      }
      if (nowItems.length > limit) {
        sections.push(`  ... and ${nowItems.length - limit} more`)
      }
      sections.push('')
    }

    // Next lane
    if (nextItems.length > 0) {
      sections.push('### Next (Up Coming)')
      const limit = verbosity === 'minimal' ? 2 : verbosity === 'standard' ? 3 : nextItems.length
      for (const item of nextItems.slice(0, limit)) {
        let line = `- ${item.title} [${item.type}, ${item.status}]`

        if (verbosity === 'detailed') {
          if (item.owner) line += ` - Owner: ${item.owner}`
          if (item.target_date) {
            const date = new Date(item.target_date)
            line += ` - Target: ${date.toLocaleDateString()}`
          }

          const deps = getDependencies(item.id)
          if (deps.length > 0) {
            sections.push(line)
            sections.push(`  Dependencies: ${deps.map(d => `${d.title} (${d.status})`).join(', ')}`)
            continue
          }
        }

        sections.push(line)
      }
      if (nextItems.length > limit) {
        sections.push(`  ... and ${nextItems.length - limit} more`)
      }
      sections.push('')
    }

    // Later lane (only in detailed mode)
    if (laterItems.length > 0 && verbosity === 'detailed') {
      sections.push('### Later (Future)')
      for (const item of laterItems.slice(0, 3)) {
        sections.push(`- ${item.title} [${item.type}]`)
      }
      if (laterItems.length > 3) {
        sections.push(`  ... and ${laterItems.length - 3} more`)
      }
      sections.push('')
    } else if (laterItems.length > 0) {
      sections.push(`### Later: ${laterItems.length} items planned\n`)
    }

    return sections.join('\n')
  }

  /**
   * Gather comprehensive project context from the database
   */
  async getProjectContext(projectId: string): Promise<ProjectContext> {
    // Get user stories
    const allStories = this.db
      .prepare(
        'SELECT id, title, status, priority, updated_at FROM user_stories WHERE project_id = ? ORDER BY updated_at DESC LIMIT 10'
      )
      .all(projectId) as Array<{
      id: string
      title: string
      status: string
      priority: string
      updated_at: string
    }>

    const inProgressStories = this.db
      .prepare(
        "SELECT id, title FROM user_stories WHERE project_id = ? AND status = 'in-progress' LIMIT 5"
      )
      .all(projectId) as Array<{ id: string; title: string }>

    const storyCount = (
      this.db
        .prepare('SELECT COUNT(*) as count FROM user_stories WHERE project_id = ?')
        .get(projectId) as { count: number }
    ).count

    // Get tasks from task queue
    const pendingTasks = this.db
      .prepare(
        "SELECT id, title, task_type FROM task_queue WHERE project_id = ? AND status IN ('pending', 'queued') ORDER BY priority DESC LIMIT 5"
      )
      .all(projectId) as Array<{ id: string; title: string; task_type: string }>

    const inProgressTasks = this.db
      .prepare(
        "SELECT id, title FROM task_queue WHERE project_id = ? AND status = 'running' LIMIT 5"
      )
      .all(projectId) as Array<{ id: string; title: string }>

    const taskCount = (
      this.db
        .prepare('SELECT COUNT(*) as count FROM task_queue WHERE project_id = ?')
        .get(projectId) as { count: number }
    ).count

    // Get roadmap items
    const nowItems = this.db
      .prepare(
        "SELECT id, title, type FROM roadmap_items WHERE project_id = ? AND lane = 'now' ORDER BY priority DESC LIMIT 5"
      )
      .all(projectId) as Array<{ id: string; title: string; type: string }>

    const nextItems = this.db
      .prepare(
        "SELECT id, title, type FROM roadmap_items WHERE project_id = ? AND lane = 'next' ORDER BY priority DESC LIMIT 5"
      )
      .all(projectId) as Array<{ id: string; title: string; type: string }>

    // Get active sprint
    const activeSprint = this.db
      .prepare("SELECT id, name, goal FROM sprints WHERE project_id = ? AND status = 'active' LIMIT 1")
      .get(projectId) as { id: string; name: string; goal: string | null } | undefined

    let sprintContext: ProjectContext['sprint'] | undefined

    if (activeSprint) {
      const sprintStories = this.db
        .prepare(
          "SELECT id, title, 'story' as type FROM user_stories WHERE sprint_id = ? ORDER BY priority DESC LIMIT 10"
        )
        .all(activeSprint.id) as Array<{ id: string; title: string; type: string }>

      sprintContext = {
        name: activeSprint.name,
        goal: activeSprint.goal || undefined,
        items: sprintStories
      }
    }

    // Get recent activity (approximate from updated_at timestamps)
    const recentStories = this.db
      .prepare(
        'SELECT id, title, status, created_at, updated_at FROM user_stories WHERE project_id = ? ORDER BY updated_at DESC LIMIT 5'
      )
      .all(projectId) as Array<{
      id: string
      title: string
      status: string
      created_at: string
      updated_at: string
    }>

    const recentTests = this.db
      .prepare(
        'SELECT id, title, status, created_at, updated_at FROM test_cases WHERE project_id = ? ORDER BY updated_at DESC LIMIT 3'
      )
      .all(projectId) as Array<{
      id: string
      title: string
      status: string
      created_at: string
      updated_at: string
    }>

    const recentTasksActivity = this.db
      .prepare(
        'SELECT id, title, status, created_at, completed_at FROM task_queue WHERE project_id = ? ORDER BY COALESCE(completed_at, created_at) DESC LIMIT 3'
      )
      .all(projectId) as Array<{
      id: string
      title: string
      status: string
      created_at: string
      completed_at: string | null
    }>

    // Combine recent activity
    const recentActivity: ProjectContext['recentActivity'] = []

    // Add stories to activity
    for (const story of recentStories) {
      const isNew = story.created_at === story.updated_at
      recentActivity.push({
        type: 'story',
        action: story.status === 'done' ? 'completed' : isNew ? 'created' : 'updated',
        title: story.title,
        timestamp: story.updated_at
      })
    }

    // Add tests to activity
    for (const test of recentTests) {
      const isNew = test.created_at === test.updated_at
      recentActivity.push({
        type: 'test',
        action: test.status === 'passed' ? 'completed' : isNew ? 'created' : 'updated',
        title: test.title,
        timestamp: test.updated_at
      })
    }

    // Add tasks to activity
    for (const task of recentTasksActivity) {
      recentActivity.push({
        type: 'task',
        action: task.status === 'completed' ? 'completed' : 'created',
        title: task.title,
        timestamp: task.completed_at || task.created_at
      })
    }

    // Sort by timestamp and limit
    recentActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    recentActivity.splice(10)

    return {
      stories: {
        total: storyCount,
        recent: allStories.map((s) => ({
          id: s.id,
          title: s.title,
          status: s.status,
          priority: s.priority
        })),
        inProgress: inProgressStories
      },
      tasks: {
        total: taskCount,
        pending: pendingTasks.map((t) => ({
          id: t.id,
          title: t.title,
          taskType: t.task_type
        })),
        inProgress: inProgressTasks
      },
      roadmap: {
        now: nowItems.map((i) => ({ id: i.id, title: i.title, itemType: i.type })),
        next: nextItems.map((i) => ({ id: i.id, title: i.title, itemType: i.type }))
      },
      sprint: sprintContext,
      recentActivity
    }
  }

  /**
   * Format context as a readable string for agent prompts
   */
  formatContextForPrompt(context: ProjectContext): string {
    const sections: string[] = []

    sections.push('## Current Project Context\n')

    // User Stories Section
    if (context.stories.total > 0) {
      sections.push(`### User Stories (${context.stories.total} total)\n`)

      if (context.stories.inProgress.length > 0) {
        sections.push('In Progress:')
        for (const story of context.stories.inProgress) {
          sections.push(`- ${story.title}`)
        }
        sections.push('')
      }

      if (context.stories.recent.length > 0) {
        sections.push('Recent:')
        for (const story of context.stories.recent.slice(0, 5)) {
          sections.push(`- ${story.title} (${story.status}, ${story.priority})`)
        }
        sections.push('')
      }
    }

    // Tasks Section
    if (context.tasks.total > 0) {
      sections.push(`### Tasks (${context.tasks.total} total)\n`)

      if (context.tasks.pending.length > 0) {
        sections.push(`${context.tasks.pending.length} pending:`)
        for (const task of context.tasks.pending.slice(0, 3)) {
          sections.push(`- ${task.title} (${task.taskType})`)
        }
        sections.push('')
      }

      if (context.tasks.inProgress.length > 0) {
        sections.push('In Progress:')
        for (const task of context.tasks.inProgress) {
          sections.push(`- ${task.title}`)
        }
        sections.push('')
      }
    }

    // Roadmap Section
    if (context.roadmap.now.length > 0 || context.roadmap.next.length > 0) {
      sections.push('### Roadmap\n')

      if (context.roadmap.now.length > 0) {
        sections.push('Now:')
        for (const item of context.roadmap.now) {
          sections.push(`- ${item.title} (${item.itemType})`)
        }
        sections.push('')
      }

      if (context.roadmap.next.length > 0) {
        sections.push('Next:')
        for (const item of context.roadmap.next.slice(0, 3)) {
          sections.push(`- ${item.title} (${item.itemType})`)
        }
        sections.push('')
      }
    }

    // Sprint Section
    if (context.sprint) {
      sections.push(`### Current Sprint: ${context.sprint.name}\n`)
      if (context.sprint.goal) {
        sections.push(`Goal: ${context.sprint.goal}\n`)
      }
      if (context.sprint.items.length > 0) {
        sections.push('Sprint Items:')
        for (const item of context.sprint.items.slice(0, 5)) {
          sections.push(`- ${item.title}`)
        }
        sections.push('')
      }
    }

    // Recent Activity Section
    if (context.recentActivity.length > 0) {
      sections.push('### Recent Activity\n')
      for (const activity of context.recentActivity.slice(0, 5)) {
        const emoji =
          activity.type === 'story' ? '📖' : activity.type === 'task' ? '⚙️' : '🧪'
        const actionVerb = activity.action === 'created' ? 'Created' : activity.action === 'updated' ? 'Updated' : 'Completed'
        sections.push(`${emoji} ${actionVerb}: ${activity.title}`)
      }
      sections.push('')
    }

    // Limit overall length to ~500 words
    let result = sections.join('\n')
    const words = result.split(/\s+/).length

    if (words > 500) {
      // Truncate recent activity first
      const withoutActivity = sections.filter((s) => !s.includes('Recent Activity')).join('\n')
      if (withoutActivity.split(/\s+/).length <= 500) {
        result = withoutActivity
      } else {
        // Further truncate by limiting each section
        result = result.split(/\s+/).slice(0, 500).join(' ') + '\n\n...'
      }
    }

    return result.trim()
  }

  /**
   * Get a formatted context summary for a project
   * @deprecated Use getFullContext instead for more control over what context to include
   */
  async getContextSummary(projectId: string): Promise<string> {
    const context = await this.getProjectContext(projectId)
    return this.formatContextForPrompt(context)
  }

  /**
   * Get full context with configurable options
   *
   * This method provides a comprehensive, well-formatted markdown context that helps agents
   * understand the project state, recent history, and what to focus on.
   *
   * @param projectId - The project ID to get context for
   * @param options - Configuration options for what context to include and how verbose to be
   * @returns Formatted markdown string with project context
   *
   * @example
   * // Get detailed context with everything
   * const detailedContext = await contextInjectionService.getFullContext(projectId, {
   *   verbosity: 'detailed',
   *   maxWords: 2000
   * })
   *
   * @example
   * // Get minimal context focused on sprint and roadmap only
   * const sprintContext = await contextInjectionService.getFullContext(projectId, {
   *   includeStories: false,
   *   includeTasks: false,
   *   includeMemory: true,
   *   includeSprint: true,
   *   includeRoadmap: true,
   *   verbosity: 'minimal'
   * })
   *
   * @example
   * // Get standard context (default - good for most agents)
   * const standardContext = await contextInjectionService.getFullContext(projectId)
   */
  async getFullContext(projectId: string, options?: ContextOptions): Promise<string> {
    const opts: Required<ContextOptions> = {
      includeStories: options?.includeStories ?? true,
      includeTasks: options?.includeTasks ?? true,
      includeRoadmap: options?.includeRoadmap ?? true,
      includeSprint: options?.includeSprint ?? true,
      includeMemory: options?.includeMemory ?? true,
      verbosity: options?.verbosity ?? 'standard',
      maxWords: options?.maxWords ?? 1000
    }

    const sections: string[] = []

    // Add memory context first (so agent remembers what was rejected)
    if (opts.includeMemory) {
      const memoryContext = this.getMemoryContext(projectId)
      if (memoryContext) {
        sections.push(memoryContext)
        sections.push('---\n')
      }
    }

    // Add sprint context (current focus)
    if (opts.includeSprint) {
      const sprintContext = this.getSprintContext(projectId, opts.verbosity)
      if (sprintContext) {
        sections.push(sprintContext)
        sections.push('---\n')
      }
    }

    // Add roadmap context (strategic view)
    if (opts.includeRoadmap) {
      const roadmapContext = this.getRoadmapContext(projectId, opts.verbosity)
      if (roadmapContext) {
        sections.push(roadmapContext)
        sections.push('---\n')
      }
    }

    // Add stories and tasks context (if needed)
    if (opts.includeStories || opts.includeTasks) {
      const projectContext = await this.getProjectContext(projectId)

      // Stories section
      if (opts.includeStories && projectContext.stories.total > 0) {
        sections.push('## User Stories\n')

        if (opts.verbosity === 'detailed') {
          sections.push(`**Total:** ${projectContext.stories.total}\n`)

          if (projectContext.stories.inProgress.length > 0) {
            sections.push('### In Progress')
            for (const story of projectContext.stories.inProgress) {
              sections.push(`- ${story.title}`)
            }
            sections.push('')
          }

          if (projectContext.stories.recent.length > 0) {
            sections.push('### Recent Stories')
            for (const story of projectContext.stories.recent.slice(0, 5)) {
              sections.push(`- ${story.title} [${story.status}, ${story.priority}]`)
            }
            sections.push('')
          }
        } else if (opts.verbosity === 'standard') {
          sections.push(`${projectContext.stories.total} total stories`)
          if (projectContext.stories.inProgress.length > 0) {
            sections.push(`${projectContext.stories.inProgress.length} in progress:`)
            for (const story of projectContext.stories.inProgress.slice(0, 3)) {
              sections.push(`- ${story.title}`)
            }
          }
          sections.push('')
        } else {
          // Minimal
          sections.push(`${projectContext.stories.total} stories (${projectContext.stories.inProgress.length} in progress)\n`)
        }

        sections.push('---\n')
      }

      // Tasks section
      if (opts.includeTasks && projectContext.tasks.total > 0) {
        sections.push('## Tasks\n')

        if (opts.verbosity === 'detailed') {
          sections.push(`**Total:** ${projectContext.tasks.total}\n`)

          if (projectContext.tasks.inProgress.length > 0) {
            sections.push('### In Progress')
            for (const task of projectContext.tasks.inProgress) {
              sections.push(`- ${task.title}`)
            }
            sections.push('')
          }

          if (projectContext.tasks.pending.length > 0) {
            sections.push('### Pending')
            for (const task of projectContext.tasks.pending.slice(0, 5)) {
              sections.push(`- ${task.title} [${task.taskType}]`)
            }
            sections.push('')
          }
        } else if (opts.verbosity === 'standard') {
          sections.push(`${projectContext.tasks.total} total tasks`)
          if (projectContext.tasks.pending.length > 0) {
            sections.push(`${projectContext.tasks.pending.length} pending, ${projectContext.tasks.inProgress.length} in progress`)
          }
          sections.push('')
        } else {
          // Minimal
          sections.push(`${projectContext.tasks.total} tasks (${projectContext.tasks.pending.length} pending)\n`)
        }

        sections.push('---\n')
      }

      // Recent activity (only in detailed mode)
      if (opts.verbosity === 'detailed' && projectContext.recentActivity.length > 0) {
        sections.push('## Recent Activity\n')
        for (const activity of projectContext.recentActivity.slice(0, 5)) {
          const actionVerb = activity.action === 'created' ? 'Created' : activity.action === 'updated' ? 'Updated' : 'Completed'
          sections.push(`- ${actionVerb} ${activity.type}: ${activity.title}`)
        }
        sections.push('')
      }
    }

    // Combine all sections
    let result = sections.join('\n').trim()

    // Apply word limit if specified
    const words = result.split(/\s+/)
    if (words.length > opts.maxWords) {
      // Truncate to maxWords
      result = words.slice(0, opts.maxWords).join(' ') + '\n\n...(truncated due to length)'
    }

    return result
  }
}

export const contextInjectionService = new ContextInjectionService()
