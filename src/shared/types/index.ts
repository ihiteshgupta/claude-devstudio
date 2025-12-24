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

// Claude Code Todo Item (from TodoWrite tool)
export interface ClaudeTodo {
  id?: string
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  activeForm: string
}

// Alias for component compatibility
export type TodoItem = ClaudeTodo

// Parsed Claude response structure
export interface ParsedClaudeResponse {
  thinking: string | null
  todos: TodoItem[]
  subAgentActions: SubAgentAction[]
  content: string
  toolCalls: ToolCall[]
}

// Sub-agent action tracking
export interface SubAgentAction {
  id: string
  type: 'Explore' | 'Plan' | 'Task'
  description: string
  status: 'running' | 'completed' | 'failed'
  result?: string
}

// Parsed response structure
export interface ParsedResponse {
  thinking: string | null
  todos: ClaudeTodo[]
  subAgentActions: SubAgentAction[]
  content: string
  toolCalls: ToolCall[]
}

// Tool call tracking
export interface ToolCall {
  id: string
  name: string
  parameters: Record<string, unknown>
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: string
}

export interface AgentMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  agentType?: AgentType
  isStreaming?: boolean
  // Claude Code integration fields
  thinking?: string
  todos?: ClaudeTodo[]
  subAgentActions?: SubAgentAction[]
  toolCalls?: ToolCall[]
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

// Agent persona definitions with system prompts
export const AGENT_PERSONAS: Record<AgentType, AgentConfig> = {
  developer: {
    type: 'developer',
    name: 'Developer',
    description: 'Code generation, reviews, and debugging',
    icon: '💻',
    systemPrompt: `You are a Developer AI Agent in Claude DevStudio. Your responsibilities:
- Generate clean, maintainable code following project conventions
- Perform thorough code reviews
- Suggest refactoring improvements
- Create technical specifications
- Help debug issues

Always follow the project's existing code style and patterns.
Prefer small, focused changes over large rewrites.
Be concise but thorough in your explanations.`
  },
  'product-owner': {
    type: 'product-owner',
    name: 'Product Owner',
    description: 'User stories and backlog management',
    icon: '📋',
    systemPrompt: `You are a Product Owner AI Agent in Claude DevStudio. Your responsibilities:
- Create clear, well-structured user stories
- Generate detailed acceptance criteria
- Prioritize backlog items based on business value
- Assist with sprint planning and capacity estimation

Output user stories in this format:
**As a** [user type]
**I want** [feature]
**So that** [benefit]

**Acceptance Criteria:**
1. Given [context], when [action], then [outcome]`
  },
  tester: {
    type: 'tester',
    name: 'Tester',
    description: 'Test cases and quality assurance',
    icon: '🧪',
    systemPrompt: `You are a Test Agent in Claude DevStudio. Your responsibilities:
- Generate comprehensive test cases from requirements
- Create automated tests (unit, integration, e2e)
- Analyze test coverage and identify gaps
- Create detailed bug reports

Output test cases in this format:
**Test Case:** [ID]
**Title:** [descriptive title]
**Preconditions:** [setup required]
**Steps:** [numbered steps]
**Expected Result:** [outcome]`
  },
  security: {
    type: 'security',
    name: 'Security',
    description: 'Security audits and vulnerability detection',
    icon: '🔒',
    systemPrompt: `You are a Security Agent in Claude DevStudio. Your responsibilities:
- Identify security vulnerabilities in code
- Check for OWASP Top 10 issues
- Audit dependencies for known CVEs
- Suggest security best practices

Prioritize findings by severity: Critical > High > Medium > Low`
  },
  devops: {
    type: 'devops',
    name: 'DevOps',
    description: 'CI/CD and infrastructure automation',
    icon: '🚀',
    systemPrompt: `You are a DevOps Agent in Claude DevStudio. Your responsibilities:
- Create and optimize CI/CD pipelines
- Generate infrastructure as code (Terraform, Bicep)
- Manage deployment configurations
- Set up monitoring and alerting

Follow infrastructure best practices and principle of least privilege.`
  },
  documentation: {
    type: 'documentation',
    name: 'Documentation',
    description: 'API docs and technical writing',
    icon: '📚',
    systemPrompt: `You are a Documentation Agent in Claude DevStudio. Your responsibilities:
- Generate API documentation
- Create and update README files
- Write code comments and docstrings
- Maintain changelog entries

Documentation should be clear, concise, and developer-friendly.`
  }
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

// Git
export type GitFileStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked'

export interface GitFileChange {
  path: string
  status: GitFileStatus
}

export interface GitStatus {
  isRepo: boolean
  current: string | null
  tracking: string | null
  ahead: number
  behind: number
  staged: GitFileChange[]
  unstaged: GitFileChange[]
  untracked: string[]
}

export interface GitCommit {
  hash: string
  hashShort: string
  date: string
  message: string
  authorName: string
  authorEmail: string
  body?: string
}

export interface GitBranch {
  name: string
  current: boolean
  tracking?: string
  commit: string
}

// ============================================
// Roadmap & Autonomous Task System Types
// ============================================

// Roadmap Item Types
export type RoadmapItemType = 'epic' | 'feature' | 'milestone' | 'task'
export type RoadmapItemStatus = 'planned' | 'in-progress' | 'completed' | 'blocked' | 'cancelled'
export type RoadmapLane = 'now' | 'next' | 'later' | 'done'
export type RoadmapPriority = 'low' | 'medium' | 'high' | 'critical'

export interface RoadmapItem {
  id: string
  projectId: string
  parentId?: string
  title: string
  description?: string
  type: RoadmapItemType
  status: RoadmapItemStatus
  priority: RoadmapPriority
  targetQuarter?: string // e.g., "Q1-2025"
  lane: RoadmapLane
  startDate?: Date
  targetDate?: Date
  completedDate?: Date
  storyPoints?: number
  owner?: string
  tags?: string[]
  children?: RoadmapItem[] // For hierarchical display
  createdAt: Date
  updatedAt: Date
}

// Task Queue Types
export type TaskType =
  | 'code-generation'
  | 'code-review'
  | 'testing'
  | 'documentation'
  | 'security-audit'
  | 'deployment'
  | 'refactoring'
  | 'bug-fix'
  | 'tech-decision'
  | 'decomposition'

export type AutonomyLevel = 'auto' | 'approval_gates' | 'supervised'
export type TaskStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'waiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'skipped'

export interface TaskInputData {
  prompt?: string
  context?: string
  files?: string[]
  dependencies?: string[]
  parentOutput?: string
  techChoiceId?: string
  [key: string]: unknown
}

export interface TaskOutputData {
  result?: string
  files?: { path: string; content: string }[]
  summary?: string
  metrics?: Record<string, number>
  nextSteps?: string[]
  [key: string]: unknown
}

export interface QueuedTask {
  id: string
  projectId: string
  roadmapItemId?: string
  parentTaskId?: string
  title: string
  description?: string
  taskType: TaskType
  autonomyLevel: AutonomyLevel
  status: TaskStatus
  agentType?: AgentType
  priority: number // 0-100, higher = more urgent
  inputData?: TaskInputData
  outputData?: TaskOutputData
  errorMessage?: string
  approvalRequired: boolean
  approvalCheckpoint?: string
  approvedBy?: string
  approvedAt?: Date
  estimatedDuration?: number // in seconds
  actualDuration?: number
  retryCount: number
  maxRetries: number
  subtasks?: QueuedTask[] // For hierarchical display
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
}

// Tech Advisor Types
export type TechCategory =
  | 'framework'
  | 'database'
  | 'authentication'
  | 'hosting'
  | 'testing'
  | 'ci-cd'
  | 'monitoring'
  | 'caching'
  | 'messaging'
  | 'other'

export interface TechOption {
  name: string
  description: string
  pros: string[]
  cons: string[]
  learningCurve: 'low' | 'medium' | 'high'
  communitySupport: 'small' | 'medium' | 'large'
  isRecommended: boolean
  estimatedSetupTime?: string
  links?: { label: string; url: string }[]
}

export type TechChoiceStatus = 'pending' | 'decided' | 'cancelled'

export interface TechChoice {
  id: string
  projectId: string
  taskId?: string
  category: TechCategory
  question: string
  context?: string
  options: TechOption[]
  selectedOption?: string
  decisionRationale?: string
  status: TechChoiceStatus
  decidedBy?: string
  decidedAt?: Date
  createdAt: Date
  updatedAt: Date
}

// Task Dependencies
export type DependencyType = 'blocks' | 'required_by' | 'related'

export interface TaskDependency {
  id: string
  taskId: string
  dependsOnTaskId: string
  dependencyType: DependencyType
  createdAt: Date
}

// Approval Gates
export type GateType = 'manual' | 'quality' | 'security' | 'tech_decision' | 'review'
export type GateStatus = 'pending' | 'approved' | 'rejected' | 'skipped'

export interface ApprovalGate {
  id: string
  taskId: string
  gateType: GateType
  title: string
  description?: string
  status: GateStatus
  requiresReview: boolean
  reviewData?: string
  approvedBy?: string
  approvalNotes?: string
  createdAt: Date
  resolvedAt?: Date
}

// Roadmap View Types
export type RoadmapViewMode = 'kanban' | 'timeline'

export interface RoadmapViewState {
  mode: RoadmapViewMode
  selectedLane?: RoadmapLane
  selectedQuarter?: string
  expandedItems: string[]
  filterTypes?: RoadmapItemType[]
  filterStatus?: RoadmapItemStatus[]
}

// Task Queue Events (for real-time updates)
export interface TaskQueueEvent {
  type:
    | 'task-queued'
    | 'task-started'
    | 'task-progress'
    | 'task-approval-required'
    | 'task-completed'
    | 'task-failed'
    | 'task-cancelled'
    | 'queue-paused'
    | 'queue-resumed'
  taskId: string
  data?: unknown
  timestamp: Date
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
  PROJECT_CREATE_NEW: 'project:create-new',
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

  // Git
  GIT_STATUS: 'git:status',
  GIT_LOG: 'git:log',
  GIT_BRANCHES: 'git:branches',
  GIT_CHECKOUT: 'git:checkout',
  GIT_STAGE: 'git:stage',
  GIT_UNSTAGE: 'git:unstage',
  GIT_COMMIT: 'git:commit',
  GIT_DIFF: 'git:diff',
  GIT_PULL: 'git:pull',
  GIT_PUSH: 'git:push',

  // Roadmap
  ROADMAP_LIST: 'roadmap:list',
  ROADMAP_GET: 'roadmap:get',
  ROADMAP_CREATE: 'roadmap:create',
  ROADMAP_UPDATE: 'roadmap:update',
  ROADMAP_DELETE: 'roadmap:delete',
  ROADMAP_MOVE: 'roadmap:move',
  ROADMAP_REORDER: 'roadmap:reorder',

  // Task Queue
  TASK_QUEUE_LIST: 'task-queue:list',
  TASK_QUEUE_GET: 'task-queue:get',
  TASK_QUEUE_ENQUEUE: 'task-queue:enqueue',
  TASK_QUEUE_UPDATE: 'task-queue:update',
  TASK_QUEUE_CANCEL: 'task-queue:cancel',
  TASK_QUEUE_REORDER: 'task-queue:reorder',
  TASK_QUEUE_START: 'task-queue:start',
  TASK_QUEUE_PAUSE: 'task-queue:pause',
  TASK_QUEUE_RESUME: 'task-queue:resume',
  TASK_QUEUE_APPROVE: 'task-queue:approve',
  TASK_QUEUE_REJECT: 'task-queue:reject',
  TASK_QUEUE_EVENT: 'task-queue:event',

  // Tech Advisor
  TECH_ADVISOR_ANALYZE: 'tech-advisor:analyze',
  TECH_ADVISOR_LIST_CHOICES: 'tech-advisor:list-choices',
  TECH_ADVISOR_GET_CHOICE: 'tech-advisor:get-choice',
  TECH_ADVISOR_DECIDE: 'tech-advisor:decide',
  TECH_ADVISOR_CANCEL: 'tech-advisor:cancel',

  // Task Decomposer
  DECOMPOSER_DECOMPOSE: 'decomposer:decompose',
  DECOMPOSER_SUGGEST_AGENTS: 'decomposer:suggest-agents',
  DECOMPOSER_ESTIMATE: 'decomposer:estimate',

  // Approval Gates
  APPROVAL_LIST: 'approval:list',
  APPROVAL_GET: 'approval:get',
  APPROVAL_APPROVE: 'approval:approve',
  APPROVAL_REJECT: 'approval:reject',

  // Autonomous Executor
  AUTONOMOUS_START: 'autonomous:start',
  AUTONOMOUS_STOP: 'autonomous:stop',
  AUTONOMOUS_PAUSE: 'autonomous:pause',
  AUTONOMOUS_RESUME: 'autonomous:resume',
  AUTONOMOUS_STATUS: 'autonomous:status',
  AUTONOMOUS_STATS: 'autonomous:stats',
  AUTONOMOUS_EVENT: 'autonomous:event',
  AUTONOMOUS_METRICS: 'autonomous:metrics',
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
