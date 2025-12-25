import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import {
  IPC_CHANNELS,
  type ClaudeStatus,
  type Project,
  type AgentType,
  type ChatSession,
  type AgentMessage,
  type UserStory,
  type Sprint,
  type SprintStatus,
  type TestCase,
  type Workflow,
  type WorkflowStep,
  type WorkflowTemplate,
  type FileNode,
  type GitStatus,
  type GitCommit,
  type GitBranch,
  type RoadmapItem,
  type RoadmapItemType,
  type RoadmapItemStatus,
  type RoadmapLane,
  type RoadmapPriority,
  type QueuedTask,
  type TaskType,
  type AutonomyLevel,
  type TaskStatus,
  type ApprovalGate,
  type TaskQueueEvent,
  type TechChoice,
  type TechCategory,
  type MemorySession,
  type MemoryDecision,
  type MemoryCreatedItem,
  type MemoryRejection
} from '@shared/types'

// Stream callback type
type StreamCallback = (data: { type: 'chunk' | 'complete' | 'error'; content?: string; error?: string }) => void

// Exposed API
const api = {
  // Claude CLI
  claude: {
    checkStatus: (): Promise<ClaudeStatus> => {
      return ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_CHECK_STATUS)
    },
    sendMessage: (params: {
      message: string
      projectPath: string
      agentType: AgentType
    }): Promise<{ sessionId: string }> => {
      return ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_SEND_MESSAGE, params)
    },
    cancel: (): Promise<boolean> => {
      return ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_CANCEL)
    },
    onStream: (callback: StreamCallback): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: Parameters<StreamCallback>[0]): void => {
        callback(data)
      }
      ipcRenderer.on(IPC_CHANNELS.CLAUDE_STREAM, handler)
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.CLAUDE_STREAM, handler)
      }
    }
  },

  // Projects
  projects: {
    list: (): Promise<Project[]> => {
      return ipcRenderer.invoke(IPC_CHANNELS.PROJECT_LIST)
    },
    create: (project: { name?: string; path: string; description?: string }): Promise<Project> => {
      return ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CREATE, project)
    },
    createNew: (input: { name: string; parentPath: string }): Promise<string> => {
      return ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CREATE_NEW, input)
    },
    open: (projectId: string): Promise<Project | null> => {
      return ipcRenderer.invoke(IPC_CHANNELS.PROJECT_OPEN, projectId)
    },
    delete: (projectId: string): Promise<boolean> => {
      return ipcRenderer.invoke(IPC_CHANNELS.PROJECT_DELETE, projectId)
    },
    selectFolder: (): Promise<string | null> => {
      return ipcRenderer.invoke(IPC_CHANNELS.PROJECT_SELECT_FOLDER)
    }
  },

  // Window controls
  window: {
    minimize: (): void => {
      ipcRenderer.send(IPC_CHANNELS.WINDOW_MINIMIZE)
    },
    maximize: (): void => {
      ipcRenderer.send(IPC_CHANNELS.WINDOW_MAXIMIZE)
    },
    close: (): void => {
      ipcRenderer.send(IPC_CHANNELS.WINDOW_CLOSE)
    }
  },

  // App info
  app: {
    getVersion: (): Promise<string> => {
      return ipcRenderer.invoke(IPC_CHANNELS.APP_GET_VERSION)
    }
  },

  // Chat Sessions
  sessions: {
    create: (params: { projectId: string; agentType: AgentType }): Promise<ChatSession> => {
      return ipcRenderer.invoke(IPC_CHANNELS.SESSION_CREATE, params)
    },
    get: (sessionId: string): Promise<ChatSession | null> => {
      return ipcRenderer.invoke(IPC_CHANNELS.SESSION_GET, sessionId)
    },
    list: (projectId: string): Promise<ChatSession[]> => {
      return ipcRenderer.invoke(IPC_CHANNELS.SESSION_LIST, projectId)
    },
    delete: (sessionId: string): Promise<boolean> => {
      return ipcRenderer.invoke(IPC_CHANNELS.SESSION_DELETE, sessionId)
    },
    addMessage: (sessionId: string, message: Omit<AgentMessage, 'id' | 'timestamp'>): Promise<AgentMessage> => {
      return ipcRenderer.invoke(IPC_CHANNELS.SESSION_ADD_MESSAGE, { sessionId, message })
    }
  },

  // User Stories
  stories: {
    create: (params: {
      projectId: string
      title: string
      description?: string
      acceptanceCriteria?: string
      storyPoints?: number
      priority?: 'low' | 'medium' | 'high' | 'critical'
    }): Promise<UserStory> => {
      return ipcRenderer.invoke(IPC_CHANNELS.STORY_CREATE, params)
    },
    list: (projectId: string): Promise<UserStory[]> => {
      return ipcRenderer.invoke(IPC_CHANNELS.STORY_LIST, projectId)
    },
    update: (storyId: string, updates: Partial<UserStory>): Promise<UserStory | null> => {
      return ipcRenderer.invoke(IPC_CHANNELS.STORY_UPDATE, { storyId, updates })
    },
    delete: (storyId: string): Promise<boolean> => {
      return ipcRenderer.invoke(IPC_CHANNELS.STORY_DELETE, storyId)
    },
    generateFromPrompt: (params: {
      projectId: string
      projectPath: string
      prompt: string
    }): Promise<{ title: string; description: string; acceptanceCriteria: string }> => {
      return ipcRenderer.invoke(IPC_CHANNELS.STORY_GENERATE_FROM_PROMPT, params)
    }
  },

  // Sprints
  sprints: {
    create: (params: {
      projectId: string
      name: string
      description?: string
      startDate: string | Date
      endDate: string | Date
      goal?: string
    }): Promise<Sprint> => {
      return ipcRenderer.invoke(IPC_CHANNELS.SPRINT_CREATE, {
        ...params,
        startDate: typeof params.startDate === 'string' ? params.startDate : params.startDate.toISOString(),
        endDate: typeof params.endDate === 'string' ? params.endDate : params.endDate.toISOString()
      })
    },
    list: (projectId: string): Promise<Sprint[]> => {
      return ipcRenderer.invoke(IPC_CHANNELS.SPRINT_LIST, projectId)
    },
    get: (sprintId: string): Promise<Sprint | null> => {
      return ipcRenderer.invoke(IPC_CHANNELS.SPRINT_GET, sprintId)
    },
    update: (sprintId: string, updates: Partial<Omit<Sprint, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>>): Promise<Sprint | null> => {
      return ipcRenderer.invoke(IPC_CHANNELS.SPRINT_UPDATE, { sprintId, updates })
    },
    delete: (sprintId: string): Promise<boolean> => {
      return ipcRenderer.invoke(IPC_CHANNELS.SPRINT_DELETE, sprintId)
    },
    addStory: (sprintId: string, storyId: string): Promise<boolean> => {
      return ipcRenderer.invoke(IPC_CHANNELS.SPRINT_ADD_STORY, { sprintId, storyId })
    },
    removeStory: (storyId: string): Promise<boolean> => {
      return ipcRenderer.invoke(IPC_CHANNELS.SPRINT_REMOVE_STORY, storyId)
    }
  },

  // Test Cases
  testCases: {
    create: (params: {
      projectId: string
      userStoryId?: string
      title: string
      description?: string
      preconditions?: string
      steps?: string
      expectedResult?: string
    }): Promise<TestCase> => {
      return ipcRenderer.invoke(IPC_CHANNELS.TEST_CASE_CREATE, params)
    },
    list: (projectId: string): Promise<TestCase[]> => {
      return ipcRenderer.invoke(IPC_CHANNELS.TEST_CASE_LIST, projectId)
    },
    generateFromStory: (params: {
      projectPath: string
      userStory: { title: string; description: string; acceptanceCriteria: string }
    }): Promise<Array<{
      title: string
      description: string
      preconditions: string
      steps: string
      expectedResult: string
    }>> => {
      return ipcRenderer.invoke(IPC_CHANNELS.TEST_CASE_GENERATE_FROM_STORY, params)
    }
  },

  // Files
  files: {
    getTree: (projectPath: string): Promise<FileNode[]> => {
      return ipcRenderer.invoke(IPC_CHANNELS.FILES_GET_TREE, projectPath)
    },
    readContent: (filePath: string): Promise<string> => {
      return ipcRenderer.invoke(IPC_CHANNELS.FILES_READ_CONTENT, filePath)
    },
    getContext: (filePaths: string[], rootPath: string): Promise<string> => {
      return ipcRenderer.invoke(IPC_CHANNELS.FILES_GET_CONTEXT, { filePaths, rootPath })
    },
    getSummary: (projectPath: string): Promise<string> => {
      return ipcRenderer.invoke(IPC_CHANNELS.FILES_GET_SUMMARY, projectPath)
    }
  },

  // Workflows
  workflows: {
    create: (params: {
      projectId: string
      template: WorkflowTemplate
      initialInput: string
    }): Promise<Workflow> => {
      return ipcRenderer.invoke(IPC_CHANNELS.WORKFLOW_CREATE, params)
    },
    get: (workflowId: string): Promise<Workflow | null> => {
      return ipcRenderer.invoke(IPC_CHANNELS.WORKFLOW_GET, workflowId)
    },
    list: (projectId: string): Promise<Workflow[]> => {
      return ipcRenderer.invoke(IPC_CHANNELS.WORKFLOW_LIST, projectId)
    },
    run: (params: { workflowId: string; projectPath: string }): Promise<void> => {
      return ipcRenderer.invoke(IPC_CHANNELS.WORKFLOW_RUN, params)
    },
    cancel: (workflowId: string): Promise<boolean> => {
      return ipcRenderer.invoke(IPC_CHANNELS.WORKFLOW_CANCEL, workflowId)
    },
    onStepUpdate: (callback: (data: {
      type: 'step-start' | 'step-complete' | 'step-error' | 'workflow-complete' | 'workflow-error'
      step?: WorkflowStep
      output?: string
      error?: string
      workflow?: Workflow
    }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: Parameters<typeof callback>[0]): void => {
        callback(data)
      }
      ipcRenderer.on(IPC_CHANNELS.WORKFLOW_STEP_UPDATE, handler)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.WORKFLOW_STEP_UPDATE, handler)
      }
    },
    getTemplates: (): Array<{
      id: WorkflowTemplate
      name: string
      description: string
      stepCount: number
    }> => {
      // Return templates client-side (they're static)
      return [
        { id: 'story-to-tests', name: 'User Story → Test Cases', description: 'Generate test cases from a user story', stepCount: 2 },
        { id: 'story-to-implementation', name: 'User Story → Implementation', description: 'Generate technical spec and code from a user story', stepCount: 3 },
        { id: 'code-review-security', name: 'Code Review + Security Audit', description: 'Review code for quality and security issues', stepCount: 2 },
        { id: 'full-feature-pipeline', name: 'Full Feature Pipeline', description: 'Complete workflow from story to deployed feature', stepCount: 6 }
      ]
    }
  },

  // Git
  git: {
    status: (projectPath: string): Promise<GitStatus> => {
      return ipcRenderer.invoke(IPC_CHANNELS.GIT_STATUS, projectPath)
    },
    log: (projectPath: string, limit?: number): Promise<GitCommit[]> => {
      return ipcRenderer.invoke(IPC_CHANNELS.GIT_LOG, { projectPath, limit })
    },
    branches: (projectPath: string): Promise<GitBranch[]> => {
      return ipcRenderer.invoke(IPC_CHANNELS.GIT_BRANCHES, projectPath)
    },
    checkout: (projectPath: string, branch: string): Promise<boolean> => {
      return ipcRenderer.invoke(IPC_CHANNELS.GIT_CHECKOUT, { projectPath, branch })
    },
    stage: (projectPath: string, files: string[]): Promise<boolean> => {
      return ipcRenderer.invoke(IPC_CHANNELS.GIT_STAGE, { projectPath, files })
    },
    unstage: (projectPath: string, files: string[]): Promise<boolean> => {
      return ipcRenderer.invoke(IPC_CHANNELS.GIT_UNSTAGE, { projectPath, files })
    },
    commit: (projectPath: string, message: string): Promise<boolean> => {
      return ipcRenderer.invoke(IPC_CHANNELS.GIT_COMMIT, { projectPath, message })
    },
    diff: (projectPath: string, file?: string): Promise<string> => {
      return ipcRenderer.invoke(IPC_CHANNELS.GIT_DIFF, { projectPath, file })
    },
    pull: (projectPath: string): Promise<{ success: boolean; summary: string }> => {
      return ipcRenderer.invoke(IPC_CHANNELS.GIT_PULL, projectPath)
    },
    push: (projectPath: string): Promise<{ success: boolean; summary: string }> => {
      return ipcRenderer.invoke(IPC_CHANNELS.GIT_PUSH, projectPath)
    }
  },

  // Roadmap
  roadmap: {
    list: (projectId: string): Promise<RoadmapItem[]> => {
      return ipcRenderer.invoke(IPC_CHANNELS.ROADMAP_LIST, projectId)
    },
    get: (id: string): Promise<RoadmapItem | null> => {
      return ipcRenderer.invoke(IPC_CHANNELS.ROADMAP_GET, id)
    },
    create: (params: {
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
    }): Promise<RoadmapItem> => {
      return ipcRenderer.invoke(IPC_CHANNELS.ROADMAP_CREATE, params)
    },
    update: (id: string, updates: Partial<RoadmapItem>): Promise<RoadmapItem | null> => {
      return ipcRenderer.invoke(IPC_CHANNELS.ROADMAP_UPDATE, { id, updates })
    },
    delete: (id: string): Promise<boolean> => {
      return ipcRenderer.invoke(IPC_CHANNELS.ROADMAP_DELETE, id)
    },
    move: (id: string, lane: RoadmapLane): Promise<RoadmapItem | null> => {
      return ipcRenderer.invoke(IPC_CHANNELS.ROADMAP_MOVE, { id, lane })
    }
  },

  // Task Queue
  taskQueue: {
    list: (projectId: string): Promise<QueuedTask[]> => {
      return ipcRenderer.invoke(IPC_CHANNELS.TASK_QUEUE_LIST, projectId)
    },
    get: (id: string): Promise<QueuedTask | null> => {
      return ipcRenderer.invoke(IPC_CHANNELS.TASK_QUEUE_GET, id)
    },
    enqueue: (params: {
      projectId: string
      roadmapItemId?: string
      parentTaskId?: string
      title: string
      description?: string
      taskType: TaskType
      autonomyLevel?: AutonomyLevel
      agentType?: AgentType
      priority?: number
    }): Promise<QueuedTask> => {
      return ipcRenderer.invoke(IPC_CHANNELS.TASK_QUEUE_ENQUEUE, params)
    },
    update: (id: string, updates: Partial<QueuedTask>): Promise<QueuedTask | null> => {
      return ipcRenderer.invoke(IPC_CHANNELS.TASK_QUEUE_UPDATE, { id, updates })
    },
    cancel: (id: string): Promise<boolean> => {
      return ipcRenderer.invoke(IPC_CHANNELS.TASK_QUEUE_CANCEL, id)
    },
    start: (projectId: string, projectPath: string): Promise<void> => {
      return ipcRenderer.invoke(IPC_CHANNELS.TASK_QUEUE_START, { projectId, projectPath })
    },
    pause: (): Promise<void> => {
      return ipcRenderer.invoke(IPC_CHANNELS.TASK_QUEUE_PAUSE)
    },
    resume: (): Promise<void> => {
      return ipcRenderer.invoke(IPC_CHANNELS.TASK_QUEUE_RESUME)
    },
    approve: (gateId: string, approvedBy: string, notes?: string): Promise<ApprovalGate | null> => {
      return ipcRenderer.invoke(IPC_CHANNELS.TASK_QUEUE_APPROVE, { gateId, approvedBy, notes })
    },
    reject: (gateId: string, rejectedBy: string, notes?: string): Promise<ApprovalGate | null> => {
      return ipcRenderer.invoke(IPC_CHANNELS.TASK_QUEUE_REJECT, { gateId, rejectedBy, notes })
    },
    updateAutonomy: (id: string, level: AutonomyLevel): Promise<QueuedTask | null> => {
      return ipcRenderer.invoke(IPC_CHANNELS.TASK_QUEUE_UPDATE, { id, updates: { autonomyLevel: level } })
    },
    getApprovals: (taskId: string): Promise<ApprovalGate[]> => {
      return ipcRenderer.invoke(IPC_CHANNELS.APPROVAL_LIST, taskId)
    },
    onEvent: (callback: (event: TaskQueueEvent) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: TaskQueueEvent): void => {
        callback(data)
      }
      ipcRenderer.on(IPC_CHANNELS.TASK_QUEUE_EVENT, handler)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.TASK_QUEUE_EVENT, handler)
      }
    }
  },

  // Tech Advisor
  techAdvisor: {
    analyze: (params: {
      projectId: string
      taskId?: string
      category: TechCategory
      question: string
      context?: string
      projectPath: string
    }): Promise<TechChoice> => {
      return ipcRenderer.invoke(IPC_CHANNELS.TECH_ADVISOR_ANALYZE, params)
    },
    listChoices: (projectId: string): Promise<TechChoice[]> => {
      return ipcRenderer.invoke(IPC_CHANNELS.TECH_ADVISOR_LIST_CHOICES, projectId)
    },
    getChoice: (id: string): Promise<TechChoice | null> => {
      return ipcRenderer.invoke(IPC_CHANNELS.TECH_ADVISOR_GET_CHOICE, id)
    },
    decide: (id: string, selectedOption: string, rationale?: string): Promise<TechChoice | null> => {
      return ipcRenderer.invoke(IPC_CHANNELS.TECH_ADVISOR_DECIDE, { id, selectedOption, rationale })
    }
  },

  // Task Decomposer
  decomposer: {
    decompose: (params: {
      projectId: string
      title: string
      description: string
      context?: string
      projectPath: string
      autonomyLevel?: AutonomyLevel
      enqueueImmediately?: boolean
    }): Promise<{
      parentTask: QueuedTask | null
      subtasks: Array<{
        title: string
        description: string
        taskType: TaskType
        agentType: AgentType
        estimatedDuration: number
        dependencies: number[]
        priority: number
      }>
      enqueuedTasks: QueuedTask[]
    }> => {
      return ipcRenderer.invoke(IPC_CHANNELS.DECOMPOSER_DECOMPOSE, params)
    }
  },

  // Autonomous Executor
  autonomous: {
    start: (config: {
      projectId: string
      projectPath: string
      defaultAutonomyLevel?: AutonomyLevel
      checkIntervalMs?: number
      autoApproveThreshold?: number
      maxIdleMinutes?: number
      enableAutoApproval?: boolean
    }): Promise<void> => {
      return ipcRenderer.invoke(IPC_CHANNELS.AUTONOMOUS_START, config)
    },
    stop: (): Promise<void> => {
      return ipcRenderer.invoke(IPC_CHANNELS.AUTONOMOUS_STOP)
    },
    pause: (): Promise<void> => {
      return ipcRenderer.invoke(IPC_CHANNELS.AUTONOMOUS_PAUSE)
    },
    resume: (): Promise<void> => {
      return ipcRenderer.invoke(IPC_CHANNELS.AUTONOMOUS_RESUME)
    },
    getStatus: (): Promise<{
      isRunning: boolean
      isPaused: boolean
      currentTaskId: string | null
      startTime: Date | null
      lastActivityTime: Date | null
      projectId: string | null
    }> => {
      return ipcRenderer.invoke(IPC_CHANNELS.AUTONOMOUS_STATUS)
    },
    getStats: (): Promise<{
      tasksCompleted: number
      tasksFailed: number
      tasksAutoApproved: number
      totalExecutionTime: number
      averageTaskTime: number
      errorRate: number
    }> => {
      return ipcRenderer.invoke(IPC_CHANNELS.AUTONOMOUS_STATS)
    },
    getMetrics: (projectId: string): Promise<{
      totalTasks: number
      successRate: number
      avgDuration: number
      avgRetries: number
      byTaskType: Record<string, { count: number; successRate: number; avgDuration: number }>
    }> => {
      return ipcRenderer.invoke(IPC_CHANNELS.AUTONOMOUS_METRICS, projectId)
    },
    onEvent: (callback: (event: {
      type: 'autonomous-started' | 'autonomous-stopped' | 'autonomous-paused' |
            'autonomous-resumed' | 'task-started' | 'task-completed' | 'task-failed' |
            'auto-approved' | 'approval-required' | 'stuck-task-detected' | 'idle-timeout' | 'error'
      data?: unknown
      taskId?: string
      error?: string
    }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: Parameters<typeof callback>[0]): void => {
        callback(data)
      }
      ipcRenderer.on(IPC_CHANNELS.AUTONOMOUS_EVENT, handler)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.AUTONOMOUS_EVENT, handler)
      }
    }
  },

  // Test Execution
  testing: {
    run: (params: {
      projectPath: string
      projectId: string
      options?: {
        taskId?: string
        testPattern?: string
        framework?: 'jest' | 'vitest' | 'playwright' | 'auto'
        timeout?: number
        coverage?: boolean
      }
    }): Promise<unknown> => {
      return ipcRenderer.invoke(IPC_CHANNELS.TEST_RUN, params)
    },
    cancel: (): Promise<boolean> => {
      return ipcRenderer.invoke(IPC_CHANNELS.TEST_CANCEL)
    },
    isRunning: (): Promise<boolean> => {
      return ipcRenderer.invoke(IPC_CHANNELS.TEST_STATUS)
    },
    getBaselines: (projectId: string): Promise<unknown[]> => {
      return ipcRenderer.invoke(IPC_CHANNELS.TEST_BASELINES, projectId)
    },
    getExecutions: (projectId: string, limit?: number): Promise<unknown[]> => {
      return ipcRenderer.invoke(IPC_CHANNELS.TEST_EXECUTIONS, { projectId, limit })
    },
    getFlakyTests: (projectId: string, threshold?: number): Promise<unknown[]> => {
      return ipcRenderer.invoke(IPC_CHANNELS.TEST_FLAKY, { projectId, threshold })
    },
    analyzeFailure: (projectId: string, testKey: string): Promise<unknown> => {
      return ipcRenderer.invoke(IPC_CHANNELS.TEST_ANALYZE, { projectId, testKey })
    },
    onEvent: (callback: (event: { type: string; data: unknown }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: Parameters<typeof callback>[0]): void => {
        callback(data)
      }
      ipcRenderer.on(IPC_CHANNELS.TEST_EVENT, handler)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.TEST_EVENT, handler)
      }
    }
  },

  // Git Automation
  gitAuto: {
    createBranch: (projectPath: string, branchName: string, baseBranch?: string): Promise<{ success: boolean; message: string }> => {
      return ipcRenderer.invoke(IPC_CHANNELS.GIT_CREATE_BRANCH, { projectPath, branchName, baseBranch })
    },
    createFeature: (projectPath: string, featureName: string, baseBranch?: string): Promise<{ success: boolean; branchName: string; message: string }> => {
      return ipcRenderer.invoke(IPC_CHANNELS.GIT_CREATE_FEATURE, { projectPath, featureName, baseBranch })
    },
    createRelease: (projectPath: string, version: string, baseBranch?: string): Promise<{ success: boolean; branchName: string; message: string }> => {
      return ipcRenderer.invoke(IPC_CHANNELS.GIT_CREATE_RELEASE, { projectPath, version, baseBranch })
    },
    deleteBranch: (projectPath: string, branchName: string, deleteRemote?: boolean): Promise<{ success: boolean; message: string }> => {
      return ipcRenderer.invoke(IPC_CHANNELS.GIT_DELETE_BRANCH, { projectPath, branchName, deleteRemote })
    },
    merge: (projectPath: string, sourceBranch: string, targetBranch?: string, options?: { noFastForward?: boolean; squash?: boolean; message?: string }): Promise<{ success: boolean; mergedCommit?: string; conflicts?: string[]; message: string }> => {
      return ipcRenderer.invoke(IPC_CHANNELS.GIT_MERGE, { projectPath, sourceBranch, targetBranch, options })
    },
    createTag: (projectPath: string, tagName: string, options?: { message?: string; annotated?: boolean; commit?: string }): Promise<{ success: boolean; message: string }> => {
      return ipcRenderer.invoke(IPC_CHANNELS.GIT_CREATE_TAG, { projectPath, tagName, options })
    },
    listTags: (projectPath: string): Promise<Array<{ name: string; commit: string; message?: string; createdAt?: string }>> => {
      return ipcRenderer.invoke(IPC_CHANNELS.GIT_LIST_TAGS, projectPath)
    },
    pushTags: (projectPath: string, tagName?: string): Promise<{ success: boolean; message: string }> => {
      return ipcRenderer.invoke(IPC_CHANNELS.GIT_PUSH_TAGS, { projectPath, tagName })
    },
    commitAgent: (projectPath: string, message: string, options?: { taskId?: string; agentType?: string; files?: string[] }): Promise<{ success: boolean; commitHash?: string; message: string }> => {
      return ipcRenderer.invoke(IPC_CHANNELS.GIT_COMMIT_AGENT, { projectPath, message, options })
    },
    preparePR: (projectPath: string, sourceBranch: string, targetBranch?: string): Promise<{ title: string; body: string; sourceBranch: string; targetBranch: string; files: string[]; commits: number } | null> => {
      return ipcRenderer.invoke(IPC_CHANNELS.GIT_PREPARE_PR, { projectPath, sourceBranch, targetBranch })
    },
    rebase: (projectPath: string, ontoBranch: string): Promise<{ success: boolean; message: string }> => {
      return ipcRenderer.invoke(IPC_CHANNELS.GIT_REBASE, { projectPath, ontoBranch })
    },
    fetch: (projectPath: string, options?: { remote?: string; prune?: boolean; tags?: boolean }): Promise<{ success: boolean; message: string }> => {
      return ipcRenderer.invoke(IPC_CHANNELS.GIT_FETCH, { projectPath, options })
    }
  },

  // Build & Deployment
  build: {
    run: (params: {
      projectPath: string
      projectId: string
      options?: { taskId?: string; config?: { command?: string; args?: string[]; env?: Record<string, string>; outputDir?: string } }
    }): Promise<unknown> => {
      return ipcRenderer.invoke(IPC_CHANNELS.BUILD_RUN, params)
    },
    cancel: (): Promise<boolean> => {
      return ipcRenderer.invoke(IPC_CHANNELS.BUILD_CANCEL)
    },
    isRunning: (): Promise<boolean> => {
      return ipcRenderer.invoke(IPC_CHANNELS.BUILD_STATUS)
    },
    list: (projectId: string, limit?: number): Promise<unknown[]> => {
      return ipcRenderer.invoke(IPC_CHANNELS.BUILD_LIST, { projectId, limit })
    },
    onEvent: (callback: (event: { type: string; data: unknown }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: Parameters<typeof callback>[0]): void => {
        callback(data)
      }
      ipcRenderer.on(IPC_CHANNELS.BUILD_EVENT, handler)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.BUILD_EVENT, handler)
      }
    }
  },

  deploy: {
    run: (params: {
      projectPath: string
      projectId: string
      config: {
        environment: 'development' | 'staging' | 'production'
        buildId?: string
        artifactPath?: string
        preDeployHooks?: string[]
        postDeployHooks?: string[]
        healthCheckUrl?: string
        healthCheckTimeout?: number
        rollbackOnFailure?: boolean
      }
    }): Promise<unknown> => {
      return ipcRenderer.invoke(IPC_CHANNELS.DEPLOY_RUN, params)
    },
    rollback: (projectPath: string, projectId: string, environment: 'development' | 'staging' | 'production'): Promise<unknown> => {
      return ipcRenderer.invoke(IPC_CHANNELS.DEPLOY_ROLLBACK, { projectPath, projectId, environment })
    },
    isRunning: (): Promise<boolean> => {
      return ipcRenderer.invoke(IPC_CHANNELS.DEPLOY_STATUS)
    },
    list: (projectId: string, environment?: 'development' | 'staging' | 'production', limit?: number): Promise<unknown[]> => {
      return ipcRenderer.invoke(IPC_CHANNELS.DEPLOY_LIST, { projectId, environment, limit })
    },
    getCurrent: (projectId: string, environment: 'development' | 'staging' | 'production'): Promise<unknown> => {
      return ipcRenderer.invoke(IPC_CHANNELS.DEPLOY_CURRENT, { projectId, environment })
    },
    onEvent: (callback: (event: { type: string; data: unknown }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: Parameters<typeof callback>[0]): void => {
        callback(data)
      }
      ipcRenderer.on(IPC_CHANNELS.DEPLOY_EVENT, handler)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.DEPLOY_EVENT, handler)
      }
    }
  },

  // Sprint Planner
  sprintPlanner: {
    generate: (config: {
      projectId: string
      projectPath: string
      capacity: number
      durationDays: number
      defaultAutonomyLevel?: AutonomyLevel
      autoDecompose?: boolean
      autoEnqueue?: boolean
    }): Promise<unknown> => {
      return ipcRenderer.invoke(IPC_CHANNELS.SPRINT_PLANNER_GENERATE, config)
    },
    getActive: (projectId: string): Promise<Sprint | null> => {
      return ipcRenderer.invoke(IPC_CHANNELS.SPRINT_PLANNER_ACTIVE, projectId)
    },
    getProgress: (sprintId: string): Promise<{
      sprintId: string
      totalStories: number
      completedStories: number
      inProgressStories: number
      blockedStories: number
      totalPoints: number
      completedPoints: number
      percentComplete: number
      estimatedCompletion: Date | null
      velocity: number
    }> => {
      return ipcRenderer.invoke(IPC_CHANNELS.SPRINT_PLANNER_PROGRESS, sprintId)
    },
    getStories: (sprintId: string): Promise<UserStory[]> => {
      return ipcRenderer.invoke(IPC_CHANNELS.SPRINT_PLANNER_STORIES, sprintId)
    },
    checkCompletion: (projectId: string): Promise<boolean> => {
      return ipcRenderer.invoke(IPC_CHANNELS.SPRINT_PLANNER_CHECK_COMPLETION, projectId)
    },
    monitor: (config: {
      projectId: string
      projectPath: string
      capacity: number
      durationDays: number
      defaultAutonomyLevel?: AutonomyLevel
      autoDecompose?: boolean
      autoEnqueue?: boolean
    }): Promise<unknown> => {
      return ipcRenderer.invoke(IPC_CHANNELS.SPRINT_PLANNER_MONITOR, config)
    },
    syncStatus: (projectId: string): Promise<number> => {
      return ipcRenderer.invoke(IPC_CHANNELS.SPRINT_PLANNER_SYNC_STATUS, projectId)
    },
    onEvent: (callback: (event: { type: string; data: unknown }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: Parameters<typeof callback>[0]): void => {
        callback(data)
      }
      ipcRenderer.on(IPC_CHANNELS.SPRINT_PLANNER_EVENT, handler)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.SPRINT_PLANNER_EVENT, handler)
      }
    }
  },

  // Bug Reports
  bugs: {
    create: (input: {
      projectId: string
      title: string
      description: string
      severity: 'critical' | 'high' | 'medium' | 'low'
      source: 'test_failure' | 'security_scan' | 'manual' | 'ai_detected'
      sourceId?: string
      filePath?: string
      lineNumber?: number
      errorMessage?: string
      stackTrace?: string
      stepsToReproduce?: string
      expectedBehavior?: string
      actualBehavior?: string
      labels?: string[]
    }): Promise<unknown> => {
      return ipcRenderer.invoke(IPC_CHANNELS.BUG_CREATE, input)
    },
    get: (id: string): Promise<unknown> => {
      return ipcRenderer.invoke(IPC_CHANNELS.BUG_GET, id)
    },
    list: (projectId: string, options?: {
      status?: ('open' | 'in_progress' | 'resolved' | 'closed' | 'wont_fix')[]
      severity?: ('critical' | 'high' | 'medium' | 'low')[]
      source?: ('test_failure' | 'security_scan' | 'manual' | 'ai_detected')[]
      limit?: number
      offset?: number
    }): Promise<unknown[]> => {
      return ipcRenderer.invoke(IPC_CHANNELS.BUG_LIST, { projectId, options })
    },
    updateStatus: (id: string, status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'wont_fix'): Promise<unknown> => {
      return ipcRenderer.invoke(IPC_CHANNELS.BUG_UPDATE_STATUS, { id, status })
    },
    updateSeverity: (id: string, severity: 'critical' | 'high' | 'medium' | 'low'): Promise<unknown> => {
      return ipcRenderer.invoke(IPC_CHANNELS.BUG_UPDATE_SEVERITY, { id, severity })
    },
    addLabel: (id: string, label: string): Promise<unknown> => {
      return ipcRenderer.invoke(IPC_CHANNELS.BUG_ADD_LABEL, { id, label })
    },
    removeLabel: (id: string, label: string): Promise<unknown> => {
      return ipcRenderer.invoke(IPC_CHANNELS.BUG_REMOVE_LABEL, { id, label })
    },
    delete: (id: string): Promise<boolean> => {
      return ipcRenderer.invoke(IPC_CHANNELS.BUG_DELETE, id)
    },
    getStats: (projectId: string): Promise<{
      total: number
      open: number
      inProgress: number
      resolved: number
      closed: number
      bySeverity: Record<string, number>
      bySource: Record<string, number>
      avgResolutionTimeHours: number
      openedLast7Days: number
      resolvedLast7Days: number
    }> => {
      return ipcRenderer.invoke(IPC_CHANNELS.BUG_STATS, projectId)
    },
    createFromTest: (projectId: string, execution: unknown, projectPath: string): Promise<unknown> => {
      return ipcRenderer.invoke(IPC_CHANNELS.BUG_FROM_TEST, { projectId, execution, projectPath })
    },
    createFromTestRun: (projectId: string, failures: unknown[], projectPath: string): Promise<unknown[]> => {
      return ipcRenderer.invoke(IPC_CHANNELS.BUG_FROM_TEST_RUN, { projectId, failures, projectPath })
    },
    autoResolve: (projectId: string, passedTestNames: string[]): Promise<number> => {
      return ipcRenderer.invoke(IPC_CHANNELS.BUG_AUTO_RESOLVE, { projectId, passedTestNames })
    },
    onEvent: (callback: (event: { type: string; data: unknown }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: Parameters<typeof callback>[0]): void => {
        callback(data)
      }
      ipcRenderer.on(IPC_CHANNELS.BUG_EVENT, handler)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.BUG_EVENT, handler)
      }
    }
  },

  // Validation
  validation: {
    run: (config: {
      projectId: string
      projectPath: string
      taskId?: string
      checks?: Array<{
        type: 'typecheck' | 'lint' | 'build' | 'test' | 'format' | 'security' | 'custom'
        name: string
        command: string
        required: boolean
        timeout?: number
      }>
      stopOnFirstFailure?: boolean
      timeout?: number
    }): Promise<unknown> => {
      return ipcRenderer.invoke(IPC_CHANNELS.VALIDATION_RUN, config)
    },
    runWithProfile: (projectId: string, projectPath: string, profileId: string, taskId?: string): Promise<unknown> => {
      return ipcRenderer.invoke(IPC_CHANNELS.VALIDATION_RUN_PROFILE, { projectId, projectPath, profileId, taskId })
    },
    cancel: (runId: string): Promise<boolean> => {
      return ipcRenderer.invoke(IPC_CHANNELS.VALIDATION_CANCEL, runId)
    },
    getProfiles: (): Promise<Array<{
      id: string
      name: string
      description: string
      checks: Array<{ type: string; name: string; command: string; required: boolean }>
    }>> => {
      return ipcRenderer.invoke(IPC_CHANNELS.VALIDATION_PROFILES)
    },
    detectChecks: (projectPath: string): Promise<Array<{
      type: string
      name: string
      command: string
      required: boolean
    }>> => {
      return ipcRenderer.invoke(IPC_CHANNELS.VALIDATION_DETECT_CHECKS, projectPath)
    },
    getRecent: (projectId: string, limit?: number): Promise<unknown[]> => {
      return ipcRenderer.invoke(IPC_CHANNELS.VALIDATION_RECENT, { projectId, limit })
    },
    get: (runId: string): Promise<unknown> => {
      return ipcRenderer.invoke(IPC_CHANNELS.VALIDATION_GET, runId)
    },
    getTaskRuns: (taskId: string): Promise<unknown[]> => {
      return ipcRenderer.invoke(IPC_CHANNELS.VALIDATION_TASK_RUNS, taskId)
    },
    quick: (projectPath: string, projectId: string): Promise<{ passed: boolean; summary: string }> => {
      return ipcRenderer.invoke(IPC_CHANNELS.VALIDATION_QUICK, { projectPath, projectId })
    },
    onEvent: (callback: (event: { type: string; data: unknown }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: Parameters<typeof callback>[0]): void => {
        callback(data)
      }
      ipcRenderer.on(IPC_CHANNELS.VALIDATION_EVENT, handler)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.VALIDATION_EVENT, handler)
      }
    }
  },

  // Security Scanner
  security: {
    scan: (config: {
      projectId: string
      projectPath: string
      types?: ('dependency' | 'code' | 'secrets' | 'license' | 'sast')[]
      createBugs?: boolean
      minSeverityForBug?: 'critical' | 'high' | 'moderate' | 'low' | 'info'
    }): Promise<unknown> => {
      return ipcRenderer.invoke(IPC_CHANNELS.SECURITY_SCAN, config)
    },
    cancel: (scanId: string): Promise<boolean> => {
      return ipcRenderer.invoke(IPC_CHANNELS.SECURITY_CANCEL, scanId)
    },
    getFindings: (projectId: string, options?: {
      status?: ('open' | 'acknowledged' | 'fixed' | 'false_positive')[]
      severity?: ('critical' | 'high' | 'moderate' | 'low' | 'info')[]
      type?: ('dependency' | 'code' | 'secrets' | 'license' | 'sast')[]
      limit?: number
    }): Promise<unknown[]> => {
      return ipcRenderer.invoke(IPC_CHANNELS.SECURITY_FINDINGS, { projectId, options })
    },
    getFinding: (id: string): Promise<unknown> => {
      return ipcRenderer.invoke(IPC_CHANNELS.SECURITY_FINDING_GET, id)
    },
    updateFindingStatus: (id: string, status: 'open' | 'acknowledged' | 'fixed' | 'false_positive'): Promise<unknown> => {
      return ipcRenderer.invoke(IPC_CHANNELS.SECURITY_FINDING_UPDATE, { id, status })
    },
    getScans: (projectId: string, limit?: number): Promise<unknown[]> => {
      return ipcRenderer.invoke(IPC_CHANNELS.SECURITY_SCANS, { projectId, limit })
    },
    getSummary: (projectId: string): Promise<{
      openFindings: Record<string, number>
      lastScanDate: Date | null
      totalScans: number
      fixedLast30Days: number
    }> => {
      return ipcRenderer.invoke(IPC_CHANNELS.SECURITY_SUMMARY, projectId)
    },
    onEvent: (callback: (event: { type: string; data: unknown }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: Parameters<typeof callback>[0]): void => {
        callback(data)
      }
      ipcRenderer.on(IPC_CHANNELS.SECURITY_EVENT, handler)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.SECURITY_EVENT, handler)
      }
    }
  },

  // Onboarding API
  onboarding: {
    init: (config: {
      projectPath: string
      projectName: string
      projectId: string
    }): Promise<unknown> => {
      return ipcRenderer.invoke(IPC_CHANNELS.ONBOARDING_INIT, config)
    },
    analyze: (projectPath: string): Promise<{
      projectType: string
      language: string
      frameworks: string[]
      hasTests: boolean
      hasCICD: boolean
      hasDocker: boolean
      structure: {
        srcDirs: string[]
        testDirs: string[]
        configFiles: string[]
        entryPoints: string[]
        totalFiles: number
        totalLines: number
      }
      dependencies: string[]
      suggestedAgents: string[]
    }> => {
      return ipcRenderer.invoke(IPC_CHANNELS.ONBOARDING_ANALYZE, projectPath)
    },
    generatePlan: (config: {
      projectPath: string
      projectName: string
      projectId: string
    }, analysis: unknown): Promise<unknown> => {
      return ipcRenderer.invoke(IPC_CHANNELS.ONBOARDING_GENERATE_PLAN, { config, analysis })
    },
    getPlan: (projectId: string): Promise<unknown> => {
      return ipcRenderer.invoke(IPC_CHANNELS.ONBOARDING_GET_PLAN, projectId)
    },
    updatePlan: (planId: string, feedback: string, acceptedRoadmapItems: string[], acceptedTasks: string[]): Promise<unknown> => {
      return ipcRenderer.invoke(IPC_CHANNELS.ONBOARDING_UPDATE_PLAN, {
        planId,
        feedback,
        acceptedRoadmapItems,
        acceptedTasks
      })
    },
    applyPlan: (planId: string): Promise<{ roadmapItemsCreated: number; tasksCreated: number }> => {
      return ipcRenderer.invoke(IPC_CHANNELS.ONBOARDING_APPLY_PLAN, planId)
    },
    onEvent: (callback: (event: { type: string; data: unknown }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: Parameters<typeof callback>[0]): void => {
        callback(data)
      }
      ipcRenderer.on(IPC_CHANNELS.ONBOARDING_EVENT, handler)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.ONBOARDING_EVENT, handler)
      }
    }
  },

  // Action Bridge (Chat-to-Database Autonomy)
  actions: {
    parse: (responseText: string, context?: { agentType?: string; projectId?: string }): Promise<Array<{
      id: string
      type: string
      title: string
      description?: string
      metadata: Record<string, unknown>
      confidence: number
      sourceText: string
      status: string
    }>> => {
      return ipcRenderer.invoke(IPC_CHANNELS.ACTIONS_PARSE, { responseText, context })
    },
    checkDuplicates: (projectId: string, type: string, title: string): Promise<{
      hasDuplicate: boolean
      matches: Array<{
        id: string
        title: string
        type: string
        similarity: number
      }>
    }> => {
      return ipcRenderer.invoke(IPC_CHANNELS.ACTIONS_CHECK_DUPLICATES, { projectId, type, title })
    },
    execute: (action: {
      id: string
      type: string
      title: string
      description?: string
      metadata: Record<string, unknown>
    }, projectId: string, options?: {
      skipDuplicateCheck?: boolean
      forceCreate?: boolean
      autoQueue?: boolean
      autonomyLevel?: AutonomyLevel
      priority?: number
    }): Promise<{
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
      queued?: boolean
      queuedTaskId?: string
    }> => {
      return ipcRenderer.invoke(IPC_CHANNELS.ACTIONS_EXECUTE, { action, projectId, options })
    },
    executeAll: (actions: Array<{
      id: string
      type: string
      title: string
      description?: string
      metadata: Record<string, unknown>
    }>, projectId: string): Promise<Array<{
      actionId: string
      success: boolean
      createdItemId?: string
      createdItemType?: string
      error?: string
    }>> => {
      return ipcRenderer.invoke(IPC_CHANNELS.ACTIONS_EXECUTE_ALL, { actions, projectId })
    },
    getSuggestions: (responseText: string, projectId: string, context?: { agentType?: string }): Promise<Array<{
      id: string
      type: string
      title: string
      description?: string
      metadata: Record<string, unknown>
      confidence: number
      sourceText: string
      status: string
      duplicateCheck?: {
        hasDuplicate: boolean
        matches: Array<{
          id: string
          title: string
          type: string
          similarity: number
        }>
      }
    }>> => {
      return ipcRenderer.invoke(IPC_CHANNELS.ACTIONS_GET_SUGGESTIONS, { responseText, projectId, context })
    },
    queue: (action: {
      id: string
      type: string
      title: string
      description?: string
      metadata: Record<string, unknown>
    }, projectId: string, options?: {
      autonomyLevel?: AutonomyLevel
      startImmediately?: boolean
      priority?: number
    }): Promise<{
      taskId: string
      queued: boolean
    }> => {
      return ipcRenderer.invoke(IPC_CHANNELS.ACTIONS_QUEUE, { action, projectId, options })
    },
    queueAll: (actions: Array<{
      id: string
      type: string
      title: string
      description?: string
      metadata: Record<string, unknown>
      status: string
    }>, projectId: string, options?: {
      autonomyLevel?: AutonomyLevel
      priority?: number
    }): Promise<Array<{
      actionId: string
      taskId?: string
      queued: boolean
      error?: string
    }>> => {
      return ipcRenderer.invoke(IPC_CHANNELS.ACTIONS_QUEUE_ALL, { actions, projectId, options })
    }
  },

  // Agent Memory
  memory: {
    startSession: (projectId: string, agentType: AgentType): Promise<string> =>
      ipcRenderer.invoke(IPC_CHANNELS.MEMORY_START_SESSION, { projectId, agentType }),
    endSession: (sessionId: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.MEMORY_END_SESSION, { sessionId }),
    getSession: (sessionId: string): Promise<MemorySession | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.MEMORY_GET_SESSION, { sessionId }),
    recordDecision: (sessionId: string, decision: {
      type: 'approved' | 'rejected' | 'modified' | 'deferred'
      itemType: string
      itemTitle: string
      reason?: string
    }): Promise<MemoryDecision> =>
      ipcRenderer.invoke(IPC_CHANNELS.MEMORY_RECORD_DECISION, { sessionId, decision }),
    recordCreated: (sessionId: string, item: {
      id: string
      type: string
      title: string
    }): Promise<MemoryCreatedItem> =>
      ipcRenderer.invoke(IPC_CHANNELS.MEMORY_RECORD_CREATED, { sessionId, item }),
    recordRejection: (sessionId: string, itemTitle: string, reason?: string): Promise<MemoryRejection> =>
      ipcRenderer.invoke(IPC_CHANNELS.MEMORY_RECORD_REJECTION, { sessionId, itemTitle, reason }),
    getRecentDecisions: (projectId: string, limit?: number): Promise<MemoryDecision[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.MEMORY_GET_RECENT_DECISIONS, { projectId, limit }),
    getRecentCreated: (projectId: string, limit?: number): Promise<MemoryCreatedItem[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.MEMORY_GET_RECENT_CREATED, { projectId, limit }),
    clearSession: (sessionId: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.MEMORY_CLEAR_SESSION, { sessionId }),
  },

  // Learning & Evolution
  learning: {
    getPatterns: (projectId: string, type?: string): Promise<unknown[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.LEARNING_GET_PATTERNS, { projectId, type }),
    getTopPatterns: (projectId: string, limit?: number): Promise<unknown[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.LEARNING_GET_TOP_PATTERNS, { projectId, limit }),
    shouldAutoApprove: (projectId: string, itemType: string, title: string): Promise<{ shouldApprove: boolean; confidence: number; reason: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.LEARNING_SHOULD_AUTO_APPROVE, { projectId, itemType, title }),
    getSuggestedFormat: (projectId: string, itemType: string): Promise<{ template?: string; examples: string[] }> =>
      ipcRenderer.invoke(IPC_CHANNELS.LEARNING_GET_SUGGESTED_FORMAT, { projectId, itemType }),
    recordApproval: (projectId: string, itemType: string, title: string, metadata?: Record<string, unknown>): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.LEARNING_RECORD_APPROVAL, { projectId, itemType, title, metadata }),
    recordRejection: (projectId: string, itemType: string, title: string, reason?: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.LEARNING_RECORD_REJECTION, { projectId, itemType, title, reason }),
    recordEdit: (projectId: string, itemType: string, original: string, corrected: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.LEARNING_RECORD_EDIT, { projectId, itemType, original, corrected }),
  },

  // Style Analysis
  style: {
    analyzeProject: (projectId: string): Promise<unknown> =>
      ipcRenderer.invoke(IPC_CHANNELS.STYLE_ANALYZE_PROJECT, { projectId }),
    suggestTitle: (projectId: string, itemType: string, keywords: string[]): Promise<string> =>
      ipcRenderer.invoke(IPC_CHANNELS.STYLE_SUGGEST_TITLE, { projectId, itemType, keywords }),
    getCached: (projectId: string): Promise<unknown> =>
      ipcRenderer.invoke(IPC_CHANNELS.STYLE_GET_CACHED, { projectId }),
  },

  // Feedback Tracking
  feedback: {
    record: (entry: { projectId: string; itemId: string; itemType: string; feedbackType: string; feedbackData?: unknown; source: 'auto' | 'user' }): Promise<string> =>
      ipcRenderer.invoke(IPC_CHANNELS.FEEDBACK_RECORD, entry),
    getItem: (itemId: string): Promise<unknown[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.FEEDBACK_GET_ITEM, { itemId }),
    getSummary: (projectId: string): Promise<{ total: number; byType: Record<string, number>; bySource: Record<string, number>; last7Days: number }> =>
      ipcRenderer.invoke(IPC_CHANNELS.FEEDBACK_GET_SUMMARY, { projectId }),
    getRecent: (projectId: string, limit?: number): Promise<unknown[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.FEEDBACK_GET_RECENT, { projectId, limit }),
  }
}

// Type for the exposed API
export type ElectronAPI = typeof api

// Expose to renderer
contextBridge.exposeInMainWorld('electronAPI', api)
