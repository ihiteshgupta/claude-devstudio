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
  type GitBranch
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
  }
}

// Type for the exposed API
export type ElectronAPI = typeof api

// Expose to renderer
contextBridge.exposeInMainWorld('electronAPI', api)
