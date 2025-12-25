/**
 * Claude DevStudio
 * Copyright (c) 2024 Claude DevStudio Contributors
 * Licensed under MIT License - see LICENSE file
 *
 * In-memory SQLite mock for database service testing
 */

import Database from 'better-sqlite3'
import { vi } from 'vitest'

/**
 * Creates an in-memory SQLite database for testing
 * This is a real database, just in memory for isolation
 */
export function createTestDatabase(): Database.Database {
  const db = new Database(':memory:')

  // Enable foreign keys
  db.pragma('foreign_keys = ON')

  // Initialize schema (mirrors production schema)
  initializeSchema(db)

  return db
}

/**
 * Initialize the database schema for testing
 */
function initializeSchema(db: Database.Database): void {
  // Chat sessions table
  db.exec(`
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
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      agent_type TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    )
  `)

  // User stories table
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_stories (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      acceptance_criteria TEXT,
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'backlog',
      story_points INTEGER,
      sprint_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  // Test cases table
  db.exec(`
    CREATE TABLE IF NOT EXISTS test_cases (
      id TEXT PRIMARY KEY,
      story_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      steps TEXT,
      expected_result TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL,
      FOREIGN KEY (story_id) REFERENCES user_stories(id) ON DELETE CASCADE
    )
  `)

  // Sprints table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sprints (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      goal TEXT,
      start_date TEXT,
      end_date TEXT,
      status TEXT DEFAULT 'planning',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  // Roadmap items table
  db.exec(`
    CREATE TABLE IF NOT EXISTS roadmap_items (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      lane TEXT DEFAULT 'now',
      quarter TEXT,
      priority INTEGER DEFAULT 0,
      status TEXT DEFAULT 'planned',
      dependencies TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  // Task queue table
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_queue (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      task_type TEXT NOT NULL,
      priority INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      agent_type TEXT,
      input_data TEXT,
      output_data TEXT,
      error TEXT,
      autonomy_level TEXT DEFAULT 'supervised',
      approval_gates TEXT,
      parent_task_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT,
      FOREIGN KEY (parent_task_id) REFERENCES task_queue(id) ON DELETE SET NULL
    )
  `)

  // Tech choices table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tech_choices (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      category TEXT NOT NULL,
      options TEXT NOT NULL,
      selected_option TEXT,
      rationale TEXT,
      decided_by TEXT,
      created_at TEXT NOT NULL,
      decided_at TEXT,
      FOREIGN KEY (task_id) REFERENCES task_queue(id) ON DELETE CASCADE
    )
  `)

  // Workflows table
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      template TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  // Workflow steps table
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflow_steps (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      step_number INTEGER NOT NULL,
      agent_type TEXT NOT NULL,
      prompt TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      output TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
    )
  `)

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_project ON chat_sessions(project_id);
    CREATE INDEX IF NOT EXISTS idx_stories_project ON user_stories(project_id);
    CREATE INDEX IF NOT EXISTS idx_stories_sprint ON user_stories(sprint_id);
    CREATE INDEX IF NOT EXISTS idx_test_cases_story ON test_cases(story_id);
    CREATE INDEX IF NOT EXISTS idx_task_queue_project ON task_queue(project_id);
    CREATE INDEX IF NOT EXISTS idx_task_queue_status ON task_queue(status);
    CREATE INDEX IF NOT EXISTS idx_roadmap_project ON roadmap_items(project_id);
  `)
}

/**
 * Seed database with test data
 */
export function seedTestData(db: Database.Database): TestDataIds {
  const projectId = 'test-project-1'
  const sessionId = 'test-session-1'
  const storyId = 'test-story-1'
  const sprintId = 'test-sprint-1'
  const taskId = 'test-task-1'
  const now = new Date().toISOString()

  // Insert test session
  db.prepare(`
    INSERT INTO chat_sessions (id, project_id, agent_type, title, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(sessionId, projectId, 'developer', 'Test Session', now, now)

  // Insert test messages
  db.prepare(`
    INSERT INTO messages (id, session_id, role, content, agent_type, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('msg-1', sessionId, 'user', 'Hello', null, now)

  db.prepare(`
    INSERT INTO messages (id, session_id, role, content, agent_type, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('msg-2', sessionId, 'assistant', 'Hi! How can I help?', 'developer', now)

  // Insert test sprint
  db.prepare(`
    INSERT INTO sprints (id, project_id, name, goal, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(sprintId, projectId, 'Sprint 1', 'Complete MVP', 'active', now, now)

  // Insert test story
  db.prepare(`
    INSERT INTO user_stories (id, project_id, title, description, priority, status, story_points, sprint_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(storyId, projectId, 'Test Story', 'As a user, I want to test', 'high', 'in-progress', 5, sprintId, now, now)

  // Insert test task
  db.prepare(`
    INSERT INTO task_queue (id, project_id, title, description, task_type, priority, status, agent_type, autonomy_level, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(taskId, projectId, 'Test Task', 'A test task', 'code', 1, 'pending', 'developer', 'supervised', now, now)

  return {
    projectId,
    sessionId,
    storyId,
    sprintId,
    taskId
  }
}

export interface TestDataIds {
  projectId: string
  sessionId: string
  storyId: string
  sprintId: string
  taskId: string
}

/**
 * Create a mock database service for when you need to mock the service itself
 */
export function createMockDatabaseService() {
  return {
    // Session methods
    createSession: vi.fn(),
    getSessions: vi.fn(() => []),
    getSession: vi.fn(),
    deleteSession: vi.fn(),

    // Message methods
    addMessage: vi.fn(),
    getMessages: vi.fn(() => []),
    updateMessage: vi.fn(),
    deleteMessage: vi.fn(),

    // Story methods
    createStory: vi.fn(),
    getStories: vi.fn(() => []),
    updateStory: vi.fn(),
    deleteStory: vi.fn(),

    // Sprint methods
    createSprint: vi.fn(),
    getSprints: vi.fn(() => []),
    updateSprint: vi.fn(),
    deleteSprint: vi.fn(),

    // Task queue methods
    enqueueTask: vi.fn(),
    getTaskQueue: vi.fn(() => []),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    getNextPendingTask: vi.fn(),

    // Roadmap methods
    createRoadmapItem: vi.fn(),
    getRoadmapItems: vi.fn(() => []),
    updateRoadmapItem: vi.fn(),
    deleteRoadmapItem: vi.fn(),

    // Workflow methods
    createWorkflow: vi.fn(),
    getWorkflows: vi.fn(() => []),
    updateWorkflow: vi.fn(),

    // Close
    close: vi.fn()
  }
}

/**
 * Helper to clear all data from test database
 */
export function clearTestDatabase(db: Database.Database): void {
  const tables = [
    'workflow_steps',
    'workflows',
    'tech_choices',
    'task_queue',
    'roadmap_items',
    'test_cases',
    'user_stories',
    'sprints',
    'messages',
    'chat_sessions'
  ]

  for (const table of tables) {
    db.exec(`DELETE FROM ${table}`)
  }
}
