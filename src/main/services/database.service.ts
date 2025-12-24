import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import type { AgentMessage, AgentType, ChatSession } from '@shared/types'

class DatabaseService {
  private db: Database.Database

  constructor() {
    const dataPath = join(app.getPath('userData'), 'sakha-data')
    if (!existsSync(dataPath)) {
      mkdirSync(dataPath, { recursive: true })
    }

    const dbPath = join(dataPath, 'sakha.db')
    this.db = new Database(dbPath)
    this.initTables()
  }

  private initTables(): void {
    // Chat sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        agent_type TEXT NOT NULL,
        title TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)

    // Messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        agent_type TEXT,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
      )
    `)

    // Workflows table (for multi-agent pipelines)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)

    // Workflow steps table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_steps (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        agent_type TEXT NOT NULL,
        task TEXT NOT NULL,
        input_data TEXT,
        output_data TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        step_order INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        completed_at TEXT,
        FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
      )
    `)

    // User stories table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_stories (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        acceptance_criteria TEXT,
        story_points INTEGER,
        status TEXT NOT NULL DEFAULT 'backlog',
        priority TEXT DEFAULT 'medium',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)

    // Test cases table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS test_cases (
        id TEXT PRIMARY KEY,
        user_story_id TEXT,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        preconditions TEXT,
        steps TEXT,
        expected_result TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_story_id) REFERENCES user_stories(id) ON DELETE SET NULL
      )
    `)

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_project ON chat_sessions(project_id);
      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_workflows_project ON workflows(project_id);
      CREATE INDEX IF NOT EXISTS idx_stories_project ON user_stories(project_id);
      CREATE INDEX IF NOT EXISTS idx_testcases_story ON test_cases(user_story_id);
    `)
  }

  // ============ Chat Sessions ============

  createSession(projectId: string, agentType: AgentType, title?: string): ChatSession {
    const id = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const now = new Date().toISOString()

    this.db
      .prepare(
        `INSERT INTO chat_sessions (id, project_id, agent_type, title, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, projectId, agentType, title || `${agentType} session`, now, now)

    return {
      id,
      projectId,
      agentType,
      messages: [],
      createdAt: new Date(now),
      updatedAt: new Date(now)
    }
  }

  getSession(sessionId: string): ChatSession | null {
    const session = this.db
      .prepare('SELECT * FROM chat_sessions WHERE id = ?')
      .get(sessionId) as {
      id: string
      project_id: string
      agent_type: AgentType
      title: string
      created_at: string
      updated_at: string
    } | undefined

    if (!session) return null

    const messages = this.getSessionMessages(sessionId)

    return {
      id: session.id,
      projectId: session.project_id,
      agentType: session.agent_type,
      messages,
      createdAt: new Date(session.created_at),
      updatedAt: new Date(session.updated_at)
    }
  }

  listSessions(projectId: string, agentType?: AgentType): ChatSession[] {
    let query = 'SELECT * FROM chat_sessions WHERE project_id = ?'
    const params: (string | AgentType)[] = [projectId]

    if (agentType) {
      query += ' AND agent_type = ?'
      params.push(agentType)
    }

    query += ' ORDER BY updated_at DESC'

    const sessions = this.db.prepare(query).all(...params) as Array<{
      id: string
      project_id: string
      agent_type: AgentType
      title: string
      created_at: string
      updated_at: string
    }>

    return sessions.map((s) => ({
      id: s.id,
      projectId: s.project_id,
      agentType: s.agent_type,
      messages: [], // Don't load messages for list view
      createdAt: new Date(s.created_at),
      updatedAt: new Date(s.updated_at)
    }))
  }

  deleteSession(sessionId: string): boolean {
    const result = this.db.prepare('DELETE FROM chat_sessions WHERE id = ?').run(sessionId)
    return result.changes > 0
  }

  // ============ Messages ============

  addMessage(sessionId: string, message: Omit<AgentMessage, 'id'>): AgentMessage {
    const id = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    this.db
      .prepare(
        `INSERT INTO messages (id, session_id, role, content, agent_type, timestamp)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        sessionId,
        message.role,
        message.content,
        message.agentType || null,
        message.timestamp.toISOString()
      )

    // Update session updated_at
    this.db
      .prepare('UPDATE chat_sessions SET updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), sessionId)

    return {
      id,
      ...message
    }
  }

  getSessionMessages(sessionId: string): AgentMessage[] {
    const messages = this.db
      .prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC')
      .all(sessionId) as Array<{
      id: string
      role: 'user' | 'assistant'
      content: string
      agent_type: AgentType | null
      timestamp: string
    }>

    return messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      agentType: m.agent_type || undefined,
      timestamp: new Date(m.timestamp)
    }))
  }

  updateMessage(messageId: string, content: string): void {
    this.db.prepare('UPDATE messages SET content = ? WHERE id = ?').run(content, messageId)
  }

  // ============ User Stories ============

  createUserStory(data: {
    projectId: string
    title: string
    description?: string
    acceptanceCriteria?: string
    storyPoints?: number
    priority?: string
  }): UserStory {
    const id = `story_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const now = new Date().toISOString()

    this.db
      .prepare(
        `INSERT INTO user_stories (id, project_id, title, description, acceptance_criteria, story_points, priority, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'backlog', ?, ?)`
      )
      .run(
        id,
        data.projectId,
        data.title,
        data.description || null,
        data.acceptanceCriteria || null,
        data.storyPoints || null,
        data.priority || 'medium',
        now,
        now
      )

    return {
      id,
      projectId: data.projectId,
      title: data.title,
      description: data.description,
      acceptanceCriteria: data.acceptanceCriteria,
      storyPoints: data.storyPoints,
      priority: data.priority || 'medium',
      status: 'backlog',
      createdAt: new Date(now),
      updatedAt: new Date(now)
    }
  }

  listUserStories(projectId: string): UserStory[] {
    const stories = this.db
      .prepare('SELECT * FROM user_stories WHERE project_id = ? ORDER BY created_at DESC')
      .all(projectId) as Array<{
      id: string
      project_id: string
      title: string
      description: string | null
      acceptance_criteria: string | null
      story_points: number | null
      status: string
      priority: string
      created_at: string
      updated_at: string
    }>

    return stories.map((s) => ({
      id: s.id,
      projectId: s.project_id,
      title: s.title,
      description: s.description || undefined,
      acceptanceCriteria: s.acceptance_criteria || undefined,
      storyPoints: s.story_points || undefined,
      status: s.status,
      priority: s.priority,
      createdAt: new Date(s.created_at),
      updatedAt: new Date(s.updated_at)
    }))
  }

  updateUserStory(id: string, updates: Partial<UserStory>): void {
    const fields: string[] = []
    const values: (string | number | null)[] = []

    if (updates.title !== undefined) {
      fields.push('title = ?')
      values.push(updates.title)
    }
    if (updates.description !== undefined) {
      fields.push('description = ?')
      values.push(updates.description || null)
    }
    if (updates.acceptanceCriteria !== undefined) {
      fields.push('acceptance_criteria = ?')
      values.push(updates.acceptanceCriteria || null)
    }
    if (updates.storyPoints !== undefined) {
      fields.push('story_points = ?')
      values.push(updates.storyPoints || null)
    }
    if (updates.status !== undefined) {
      fields.push('status = ?')
      values.push(updates.status)
    }
    if (updates.priority !== undefined) {
      fields.push('priority = ?')
      values.push(updates.priority)
    }

    if (fields.length > 0) {
      fields.push('updated_at = ?')
      values.push(new Date().toISOString())
      values.push(id)

      this.db.prepare(`UPDATE user_stories SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    }
  }

  deleteUserStory(id: string): boolean {
    const result = this.db.prepare('DELETE FROM user_stories WHERE id = ?').run(id)
    return result.changes > 0
  }

  // ============ Test Cases ============

  createTestCase(data: {
    projectId: string
    userStoryId?: string
    title: string
    description?: string
    preconditions?: string
    steps?: string
    expectedResult?: string
  }): TestCase {
    const id = `test_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const now = new Date().toISOString()

    this.db
      .prepare(
        `INSERT INTO test_cases (id, project_id, user_story_id, title, description, preconditions, steps, expected_result, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`
      )
      .run(
        id,
        data.projectId,
        data.userStoryId || null,
        data.title,
        data.description || null,
        data.preconditions || null,
        data.steps || null,
        data.expectedResult || null,
        now,
        now
      )

    return {
      id,
      projectId: data.projectId,
      userStoryId: data.userStoryId,
      title: data.title,
      description: data.description,
      preconditions: data.preconditions,
      steps: data.steps,
      expectedResult: data.expectedResult,
      status: 'draft',
      createdAt: new Date(now),
      updatedAt: new Date(now)
    }
  }

  listTestCases(projectId: string, userStoryId?: string): TestCase[] {
    let query = 'SELECT * FROM test_cases WHERE project_id = ?'
    const params: string[] = [projectId]

    if (userStoryId) {
      query += ' AND user_story_id = ?'
      params.push(userStoryId)
    }

    query += ' ORDER BY created_at DESC'

    const testCases = this.db.prepare(query).all(...params) as Array<{
      id: string
      project_id: string
      user_story_id: string | null
      title: string
      description: string | null
      preconditions: string | null
      steps: string | null
      expected_result: string | null
      status: string
      created_at: string
      updated_at: string
    }>

    return testCases.map((tc) => ({
      id: tc.id,
      projectId: tc.project_id,
      userStoryId: tc.user_story_id || undefined,
      title: tc.title,
      description: tc.description || undefined,
      preconditions: tc.preconditions || undefined,
      steps: tc.steps || undefined,
      expectedResult: tc.expected_result || undefined,
      status: tc.status,
      createdAt: new Date(tc.created_at),
      updatedAt: new Date(tc.updated_at)
    }))
  }

  // ============ Workflows ============

  createWorkflow(data: {
    projectId: string
    name: string
    description?: string
    steps: Array<{
      agentType: AgentType
      task: string
      inputData?: string
    }>
  }): Workflow {
    const id = `workflow_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const now = new Date().toISOString()

    // Create workflow
    this.db
      .prepare(
        `INSERT INTO workflows (id, project_id, name, description, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'pending', ?, ?)`
      )
      .run(id, data.projectId, data.name, data.description || null, now, now)

    // Create steps
    const insertStep = this.db.prepare(
      `INSERT INTO workflow_steps (id, workflow_id, agent_type, task, input_data, status, step_order, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`
    )

    const steps: WorkflowStep[] = data.steps.map((step, index) => {
      const stepId = `step_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 9)}`
      insertStep.run(stepId, id, step.agentType, step.task, step.inputData || null, index, now)

      return {
        id: stepId,
        workflowId: id,
        agentType: step.agentType,
        task: step.task,
        inputData: step.inputData,
        status: 'pending',
        stepOrder: index,
        createdAt: new Date(now)
      }
    })

    return {
      id,
      projectId: data.projectId,
      name: data.name,
      description: data.description,
      status: 'pending',
      steps,
      createdAt: new Date(now),
      updatedAt: new Date(now)
    }
  }

  getWorkflow(workflowId: string): Workflow | null {
    const workflow = this.db.prepare('SELECT * FROM workflows WHERE id = ?').get(workflowId) as
      | {
          id: string
          project_id: string
          name: string
          description: string | null
          status: string
          created_at: string
          updated_at: string
        }
      | undefined

    if (!workflow) return null

    const steps = this.db
      .prepare('SELECT * FROM workflow_steps WHERE workflow_id = ? ORDER BY step_order ASC')
      .all(workflowId) as Array<{
      id: string
      workflow_id: string
      agent_type: AgentType
      task: string
      input_data: string | null
      output_data: string | null
      status: string
      step_order: number
      created_at: string
      completed_at: string | null
    }>

    return {
      id: workflow.id,
      projectId: workflow.project_id,
      name: workflow.name,
      description: workflow.description || undefined,
      status: workflow.status,
      steps: steps.map((s) => ({
        id: s.id,
        workflowId: s.workflow_id,
        agentType: s.agent_type,
        task: s.task,
        inputData: s.input_data || undefined,
        outputData: s.output_data || undefined,
        status: s.status,
        stepOrder: s.step_order,
        createdAt: new Date(s.created_at),
        completedAt: s.completed_at ? new Date(s.completed_at) : undefined
      })),
      createdAt: new Date(workflow.created_at),
      updatedAt: new Date(workflow.updated_at)
    }
  }

  updateWorkflowStep(stepId: string, updates: { status?: string; outputData?: string }): void {
    const fields: string[] = []
    const values: (string | null)[] = []

    if (updates.status !== undefined) {
      fields.push('status = ?')
      values.push(updates.status)
      if (updates.status === 'completed') {
        fields.push('completed_at = ?')
        values.push(new Date().toISOString())
      }
    }
    if (updates.outputData !== undefined) {
      fields.push('output_data = ?')
      values.push(updates.outputData)
    }

    if (fields.length > 0) {
      values.push(stepId)
      this.db.prepare(`UPDATE workflow_steps SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    }
  }

  updateWorkflowStatus(workflowId: string, status: string): void {
    this.db
      .prepare('UPDATE workflows SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, new Date().toISOString(), workflowId)
  }

  listWorkflows(projectId: string): Workflow[] {
    const workflows = this.db
      .prepare('SELECT * FROM workflows WHERE project_id = ? ORDER BY created_at DESC')
      .all(projectId) as Array<{
      id: string
      project_id: string
      name: string
      description: string | null
      status: string
      created_at: string
      updated_at: string
    }>

    return workflows.map((w) => ({
      id: w.id,
      projectId: w.project_id,
      name: w.name,
      description: w.description || undefined,
      status: w.status,
      steps: [], // Don't load steps for list view
      createdAt: new Date(w.created_at),
      updatedAt: new Date(w.updated_at)
    }))
  }

  close(): void {
    this.db.close()
  }
}

// Type definitions
export interface UserStory {
  id: string
  projectId: string
  title: string
  description?: string
  acceptanceCriteria?: string
  storyPoints?: number
  status: string
  priority: string
  createdAt: Date
  updatedAt: Date
}

export interface TestCase {
  id: string
  projectId: string
  userStoryId?: string
  title: string
  description?: string
  preconditions?: string
  steps?: string
  expectedResult?: string
  status: string
  createdAt: Date
  updatedAt: Date
}

export interface Workflow {
  id: string
  projectId: string
  name: string
  description?: string
  status: string
  steps: WorkflowStep[]
  createdAt: Date
  updatedAt: Date
}

export interface WorkflowStep {
  id: string
  workflowId: string
  agentType: AgentType
  task: string
  inputData?: string
  outputData?: string
  status: string
  stepOrder: number
  createdAt: Date
  completedAt?: Date
}

export const databaseService = new DatabaseService()
