// Shared types between main and renderer processes

export interface Project {
  id: string
  name: string
  path: string
  description?: string
  createdAt: Date
  lastOpenedAt: Date
}

export interface ClaudeStatus {
  installed: boolean
  authenticated: boolean
  version: string | null
}

export interface AgentMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  agentType?: AgentType
  isStreaming?: boolean
}

export type AgentType =
  | 'developer'
  | 'product-owner'
  | 'tester'
  | 'security'
  | 'devops'
  | 'documentation'

export interface AgentConfig {
  type: AgentType
  name: string
  description: string
  systemPrompt: string
  icon: string
}

export interface ChatSession {
  id: string
  projectId: string
  agentType: AgentType
  messages: AgentMessage[]
  createdAt: Date
  updatedAt: Date
}

// User Stories
export interface UserStory {
  id: string
  projectId: string
  sprintId?: string
  title: string
  description?: string
  acceptanceCriteria?: string
  storyPoints?: number
  status: 'backlog' | 'todo' | 'in-progress' | 'review' | 'done'
  priority: 'low' | 'medium' | 'high' | 'critical'
  createdAt: Date
  updatedAt: Date
}

// Sprints
export type SprintStatus = 'planned' | 'active' | 'completed' | 'cancelled'

export interface Sprint {
  id: string
  projectId: string
  name: string
  description?: string
  startDate: Date
  endDate: Date
  status: SprintStatus
  goal?: string
  createdAt: Date
  updatedAt: Date
}

// Test Cases
export interface TestCase {
  id: string
  projectId: string
  userStoryId?: string
  title: string
  description?: string
  preconditions?: string
  steps?: string
  expectedResult?: string
  status: 'draft' | 'ready' | 'passed' | 'failed' | 'blocked'
  createdAt: Date
  updatedAt: Date
}

// Workflows (Multi-Agent Pipelines)
export interface Workflow {
  id: string
  projectId: string
  name: string
  description?: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
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
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  stepOrder: number
  createdAt: Date
  completedAt?: Date
}

// Workflow Templates
export type WorkflowTemplate =
  | 'story-to-tests'
  | 'story-to-implementation'
  | 'code-review-security'
  | 'full-feature-pipeline'

// File System
export interface FileNode {
  name: string
  path: string
  relativePath: string
  type: 'file' | 'directory'
  children?: FileNode[]
  extension?: string
  size?: number
}

// IPC Channel names - type-safe channel definitions
export const IPC_CHANNELS = {
  // Claude CLI
  CLAUDE_CHECK_STATUS: 'claude:check-status',
  CLAUDE_SEND_MESSAGE: 'claude:send-message',
  CLAUDE_CANCEL: 'claude:cancel',
  CLAUDE_STREAM: 'claude:stream',

  // Projects
  PROJECT_LIST: 'project:list',
  PROJECT_CREATE: 'project:create',
  PROJECT_OPEN: 'project:open',
  PROJECT_DELETE: 'project:delete',
  PROJECT_SELECT_FOLDER: 'project:select-folder',

  // Chat Sessions
  SESSION_CREATE: 'session:create',
  SESSION_GET: 'session:get',
  SESSION_LIST: 'session:list',
  SESSION_DELETE: 'session:delete',
  SESSION_ADD_MESSAGE: 'session:add-message',

  // User Stories
  STORY_CREATE: 'story:create',
  STORY_LIST: 'story:list',
  STORY_UPDATE: 'story:update',
  STORY_DELETE: 'story:delete',
  STORY_GENERATE_FROM_PROMPT: 'story:generate-from-prompt',

  // Sprints
  SPRINT_CREATE: 'sprint:create',
  SPRINT_LIST: 'sprint:list',
  SPRINT_GET: 'sprint:get',
  SPRINT_UPDATE: 'sprint:update',
  SPRINT_DELETE: 'sprint:delete',
  SPRINT_ADD_STORY: 'sprint:add-story',
  SPRINT_REMOVE_STORY: 'sprint:remove-story',

  // Test Cases
  TEST_CASE_CREATE: 'test-case:create',
  TEST_CASE_LIST: 'test-case:list',
  TEST_CASE_GENERATE_FROM_STORY: 'test-case:generate-from-story',

  // Workflows
  WORKFLOW_CREATE: 'workflow:create',
  WORKFLOW_GET: 'workflow:get',
  WORKFLOW_LIST: 'workflow:list',
  WORKFLOW_RUN: 'workflow:run',
  WORKFLOW_CANCEL: 'workflow:cancel',
  WORKFLOW_STEP_UPDATE: 'workflow:step-update',

  // Window
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',

  // App
  APP_GET_VERSION: 'app:get-version',

  // Files
  FILES_GET_TREE: 'files:get-tree',
  FILES_READ_CONTENT: 'files:read-content',
  FILES_GET_CONTEXT: 'files:get-context',
  FILES_GET_SUMMARY: 'files:get-summary',
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
