import { databaseService } from './database.service'

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
   */
  async getContextSummary(projectId: string): Promise<string> {
    const context = await this.getProjectContext(projectId)
    return this.formatContextForPrompt(context)
  }
}

export const contextInjectionService = new ContextInjectionService()
