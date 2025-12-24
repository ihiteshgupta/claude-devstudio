import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { claudeService } from './services/claude.service'
import { projectService } from './services/project.service'
import { databaseService } from './services/database.service'
import { workflowService } from './services/workflow.service'
import { fileService } from './services/file.service'
import { gitService } from './services/git.service'
import { roadmapService } from './services/roadmap.service'
import { taskQueueService } from './services/task-queue.service'
import { techAdvisorService } from './services/tech-advisor.service'
import { taskDecomposerService } from './services/task-decomposer.service'
import { autonomousExecutorService } from './services/autonomous-executor.service'
import { IPC_CHANNELS } from '@shared/types'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    frame: false, // Custom titlebar
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    autoHideMenuBar: true,
    backgroundColor: '#0f0f0f',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Load the app
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Setup IPC handlers
function setupIpcHandlers(): void {
  // Claude CLI handlers
  ipcMain.handle(IPC_CHANNELS.CLAUDE_CHECK_STATUS, async () => {
    const status = await claudeService.checkStatus()
    console.log('[IPC] CLAUDE_CHECK_STATUS returning:', status)
    return status
  })

  ipcMain.handle(
    IPC_CHANNELS.CLAUDE_SEND_MESSAGE,
    async (event, { message, projectPath, agentType }) => {
      console.log('[IPC] CLAUDE_SEND_MESSAGE received:', { message: message?.substring(0, 50), projectPath, agentType })
      const sessionId = `session-${Date.now()}`

      // Create handlers that we can remove later
      const handleStream = (data: { sessionId: string; content: string }): void => {
        if (data.sessionId === sessionId) {
          event.sender.send(IPC_CHANNELS.CLAUDE_STREAM, {
            type: 'chunk',
            content: data.content
          })
        }
      }

      const handleComplete = (data: { sessionId: string; content: string }): void => {
        if (data.sessionId === sessionId) {
          event.sender.send(IPC_CHANNELS.CLAUDE_STREAM, {
            type: 'complete',
            content: data.content
          })
          // Clean up listeners
          claudeService.removeListener('stream', handleStream)
          claudeService.removeListener('complete', handleComplete)
          claudeService.removeListener('error', handleError)
        }
      }

      const handleError = (data: { sessionId: string; error: string }): void => {
        if (data.sessionId === sessionId) {
          event.sender.send(IPC_CHANNELS.CLAUDE_STREAM, {
            type: 'error',
            error: data.error
          })
          // Clean up listeners
          claudeService.removeListener('stream', handleStream)
          claudeService.removeListener('complete', handleComplete)
          claudeService.removeListener('error', handleError)
        }
      }

      // Set up streaming listeners
      claudeService.on('stream', handleStream)
      claudeService.on('complete', handleComplete)
      claudeService.on('error', handleError)

      return claudeService.sendMessage({
        sessionId,
        message,
        projectPath,
        agentType
      })
    }
  )

  ipcMain.handle(IPC_CHANNELS.CLAUDE_CANCEL, async () => {
    return claudeService.cancelCurrent()
  })

  // Project handlers
  ipcMain.handle(IPC_CHANNELS.PROJECT_LIST, async () => {
    return projectService.listProjects()
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_CREATE, async (_, project) => {
    return projectService.createProject(project)
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_CREATE_NEW, async (_, input) => {
    return projectService.createNewProject(input)
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_OPEN, async (_, projectId) => {
    return projectService.openProject(projectId)
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_DELETE, async (_, projectId) => {
    return projectService.deleteProject(projectId)
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_SELECT_FOLDER, async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
      title: 'Select Project Folder'
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // Window handlers
  ipcMain.on(IPC_CHANNELS.WINDOW_MINIMIZE, () => {
    mainWindow?.minimize()
  })

  ipcMain.on(IPC_CHANNELS.WINDOW_MAXIMIZE, () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })

  ipcMain.on(IPC_CHANNELS.WINDOW_CLOSE, () => {
    mainWindow?.close()
  })

  // App handlers
  ipcMain.handle(IPC_CHANNELS.APP_GET_VERSION, () => {
    return app.getVersion()
  })

  // Chat Session handlers
  ipcMain.handle(IPC_CHANNELS.SESSION_CREATE, async (_, params) => {
    return databaseService.createSession(params.projectId, params.agentType)
  })

  ipcMain.handle(IPC_CHANNELS.SESSION_GET, async (_, sessionId) => {
    return databaseService.getSession(sessionId)
  })

  ipcMain.handle(IPC_CHANNELS.SESSION_LIST, async (_, projectId) => {
    return databaseService.listSessions(projectId)
  })

  ipcMain.handle(IPC_CHANNELS.SESSION_DELETE, async (_, sessionId) => {
    return databaseService.deleteSession(sessionId)
  })

  ipcMain.handle(IPC_CHANNELS.SESSION_ADD_MESSAGE, async (_, { sessionId, message }) => {
    return databaseService.addMessage(sessionId, {
      ...message,
      timestamp: new Date()
    })
  })

  // User Story handlers
  ipcMain.handle(IPC_CHANNELS.STORY_CREATE, async (_, params) => {
    return databaseService.createUserStory(params)
  })

  ipcMain.handle(IPC_CHANNELS.STORY_LIST, async (_, projectId) => {
    return databaseService.listUserStories(projectId)
  })

  ipcMain.handle(IPC_CHANNELS.STORY_UPDATE, async (_, { storyId, updates }) => {
    return databaseService.updateUserStory(storyId, updates)
  })

  ipcMain.handle(IPC_CHANNELS.STORY_DELETE, async (_, storyId) => {
    return databaseService.deleteUserStory(storyId)
  })

  ipcMain.handle(
    IPC_CHANNELS.STORY_GENERATE_FROM_PROMPT,
    async (_, { projectId, projectPath, prompt }) => {
      return workflowService.generateUserStory(projectId, projectPath, prompt)
    }
  )

  // Sprint handlers
  ipcMain.handle(IPC_CHANNELS.SPRINT_CREATE, async (_, params) => {
    return databaseService.createSprint({
      ...params,
      startDate: new Date(params.startDate),
      endDate: new Date(params.endDate)
    })
  })

  ipcMain.handle(IPC_CHANNELS.SPRINT_LIST, async (_, projectId) => {
    return databaseService.listSprints(projectId)
  })

  ipcMain.handle(IPC_CHANNELS.SPRINT_GET, async (_, sprintId) => {
    return databaseService.getSprint(sprintId)
  })

  ipcMain.handle(IPC_CHANNELS.SPRINT_UPDATE, async (_, { sprintId, updates }) => {
    // Convert date strings to Date objects if present
    const processedUpdates = { ...updates }
    if (processedUpdates.startDate) {
      processedUpdates.startDate = new Date(processedUpdates.startDate)
    }
    if (processedUpdates.endDate) {
      processedUpdates.endDate = new Date(processedUpdates.endDate)
    }
    return databaseService.updateSprint(sprintId, processedUpdates)
  })

  ipcMain.handle(IPC_CHANNELS.SPRINT_DELETE, async (_, sprintId) => {
    return databaseService.deleteSprint(sprintId)
  })

  ipcMain.handle(IPC_CHANNELS.SPRINT_ADD_STORY, async (_, { sprintId, storyId }) => {
    return databaseService.addStoryToSprint(sprintId, storyId)
  })

  ipcMain.handle(IPC_CHANNELS.SPRINT_REMOVE_STORY, async (_, storyId) => {
    return databaseService.removeStoryFromSprint(storyId)
  })

  // Test Case handlers
  ipcMain.handle(IPC_CHANNELS.TEST_CASE_CREATE, async (_, params) => {
    return databaseService.createTestCase(params)
  })

  ipcMain.handle(IPC_CHANNELS.TEST_CASE_LIST, async (_, projectId) => {
    return databaseService.listTestCases(projectId)
  })

  ipcMain.handle(
    IPC_CHANNELS.TEST_CASE_GENERATE_FROM_STORY,
    async (_, { projectPath, userStory }) => {
      return workflowService.generateTestCases(projectPath, userStory)
    }
  )

  // Workflow handlers
  ipcMain.handle(IPC_CHANNELS.WORKFLOW_CREATE, async (_, { projectId, template, initialInput }) => {
    return workflowService.createFromTemplate(projectId, template, initialInput)
  })

  ipcMain.handle(IPC_CHANNELS.WORKFLOW_GET, async (_, workflowId) => {
    return databaseService.getWorkflow(workflowId)
  })

  ipcMain.handle(IPC_CHANNELS.WORKFLOW_LIST, async (_, projectId) => {
    return databaseService.listWorkflows(projectId)
  })

  ipcMain.handle(
    IPC_CHANNELS.WORKFLOW_RUN,
    async (event, { workflowId, projectPath }) => {
      // Set up event forwarding to renderer
      const sendUpdate = (type: string, data: unknown): void => {
        event.sender.send(IPC_CHANNELS.WORKFLOW_STEP_UPDATE, { type, ...data as object })
      }

      return workflowService.runWorkflow({
        workflowId,
        projectPath,
        onStepStart: (step) => sendUpdate('step-start', { step }),
        onStepComplete: (step, output) => sendUpdate('step-complete', { step, output }),
        onStepError: (step, error) => sendUpdate('step-error', { step, error }),
        onComplete: (workflow) => sendUpdate('workflow-complete', { workflow }),
        onError: (error) => sendUpdate('workflow-error', { error })
      })
    }
  )

  ipcMain.handle(IPC_CHANNELS.WORKFLOW_CANCEL, async (_, workflowId) => {
    return workflowService.cancelWorkflow(workflowId)
  })

  // File handlers
  ipcMain.handle(IPC_CHANNELS.FILES_GET_TREE, async (_, projectPath) => {
    return fileService.getFileTree(projectPath)
  })

  ipcMain.handle(IPC_CHANNELS.FILES_READ_CONTENT, async (_, filePath) => {
    return fileService.readFileContent(filePath)
  })

  ipcMain.handle(IPC_CHANNELS.FILES_GET_CONTEXT, async (_, { filePaths, rootPath }) => {
    return fileService.getFilesContext(filePaths, rootPath)
  })

  ipcMain.handle(IPC_CHANNELS.FILES_GET_SUMMARY, async (_, projectPath) => {
    return fileService.getProjectSummary(projectPath)
  })

  // Git handlers
  ipcMain.handle(IPC_CHANNELS.GIT_STATUS, async (_, projectPath) => {
    return gitService.getStatus(projectPath)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_LOG, async (_, { projectPath, limit }) => {
    return gitService.getLog(projectPath, limit)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_BRANCHES, async (_, projectPath) => {
    return gitService.getBranches(projectPath)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_CHECKOUT, async (_, { projectPath, branch }) => {
    return gitService.checkout(projectPath, branch)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_STAGE, async (_, { projectPath, files }) => {
    return gitService.stage(projectPath, files)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_UNSTAGE, async (_, { projectPath, files }) => {
    return gitService.unstage(projectPath, files)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_COMMIT, async (_, { projectPath, message }) => {
    return gitService.commit(projectPath, message)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_DIFF, async (_, { projectPath, file }) => {
    return gitService.getDiff(projectPath, file)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_PULL, async (_, projectPath) => {
    return gitService.pull(projectPath)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_PUSH, async (_, projectPath) => {
    return gitService.push(projectPath)
  })

  // Roadmap handlers
  ipcMain.handle(IPC_CHANNELS.ROADMAP_LIST, async (_, projectId) => {
    return roadmapService.listItems(projectId)
  })

  ipcMain.handle(IPC_CHANNELS.ROADMAP_GET, async (_, id) => {
    return roadmapService.getItem(id)
  })

  ipcMain.handle(IPC_CHANNELS.ROADMAP_CREATE, async (_, params) => {
    return roadmapService.createItem(params)
  })

  ipcMain.handle(IPC_CHANNELS.ROADMAP_UPDATE, async (_, { id, updates }) => {
    return roadmapService.updateItem(id, updates)
  })

  ipcMain.handle(IPC_CHANNELS.ROADMAP_DELETE, async (_, id) => {
    return roadmapService.deleteItem(id)
  })

  ipcMain.handle(IPC_CHANNELS.ROADMAP_MOVE, async (_, { id, lane }) => {
    return roadmapService.moveToLane(id, lane)
  })

  // Task Queue handlers
  ipcMain.handle(IPC_CHANNELS.TASK_QUEUE_LIST, async (_, projectId) => {
    return taskQueueService.listTasks(projectId)
  })

  ipcMain.handle(IPC_CHANNELS.TASK_QUEUE_GET, async (_, id) => {
    return taskQueueService.getTask(id)
  })

  ipcMain.handle(IPC_CHANNELS.TASK_QUEUE_ENQUEUE, async (_, params) => {
    return taskQueueService.enqueueTask(params)
  })

  ipcMain.handle(IPC_CHANNELS.TASK_QUEUE_UPDATE, async (_, { id, updates }) => {
    if (updates.autonomyLevel) {
      return taskQueueService.updateAutonomyLevel(id, updates.autonomyLevel)
    }
    return taskQueueService.updateTaskStatus(id, updates.status, updates)
  })

  ipcMain.handle(IPC_CHANNELS.TASK_QUEUE_CANCEL, async (_, id) => {
    return taskQueueService.cancelTask(id)
  })

  ipcMain.handle(IPC_CHANNELS.TASK_QUEUE_START, async (_, { projectId, projectPath }) => {
    // Forward events to renderer
    taskQueueService.on('task-event', (event) => {
      mainWindow?.webContents.send(IPC_CHANNELS.TASK_QUEUE_EVENT, event)
    })
    return taskQueueService.startQueue(projectId, { projectPath })
  })

  ipcMain.handle(IPC_CHANNELS.TASK_QUEUE_PAUSE, async () => {
    taskQueueService.pauseQueue()
  })

  ipcMain.handle(IPC_CHANNELS.TASK_QUEUE_RESUME, async () => {
    taskQueueService.resumeQueue()
  })

  ipcMain.handle(IPC_CHANNELS.TASK_QUEUE_APPROVE, async (_, { gateId, approvedBy, notes }) => {
    return taskQueueService.approveGate(gateId, approvedBy, notes)
  })

  ipcMain.handle(IPC_CHANNELS.TASK_QUEUE_REJECT, async (_, { gateId, rejectedBy, notes }) => {
    return taskQueueService.rejectGate(gateId, rejectedBy, notes)
  })

  ipcMain.handle(IPC_CHANNELS.APPROVAL_LIST, async (_, taskId) => {
    return taskQueueService.listApprovalGates(taskId)
  })

  // Tech Advisor handlers
  ipcMain.handle(IPC_CHANNELS.TECH_ADVISOR_ANALYZE, async (_, params) => {
    return techAdvisorService.analyzeRequirement(params)
  })

  ipcMain.handle(IPC_CHANNELS.TECH_ADVISOR_LIST_CHOICES, async (_, projectId) => {
    return techAdvisorService.listChoices(projectId)
  })

  ipcMain.handle(IPC_CHANNELS.TECH_ADVISOR_GET_CHOICE, async (_, id) => {
    return techAdvisorService.getChoice(id)
  })

  ipcMain.handle(IPC_CHANNELS.TECH_ADVISOR_DECIDE, async (_, { id, selectedOption, rationale }) => {
    return techAdvisorService.decide(id, selectedOption, rationale)
  })

  // Task Decomposer handlers
  ipcMain.handle(IPC_CHANNELS.DECOMPOSER_DECOMPOSE, async (_, params) => {
    return taskDecomposerService.decompose(params)
  })

  // Autonomous Executor handlers
  ipcMain.handle(IPC_CHANNELS.AUTONOMOUS_START, async (_, config) => {
    // Set up event forwarding to renderer
    autonomousExecutorService.on('autonomous-started', (data) => {
      mainWindow?.webContents.send(IPC_CHANNELS.AUTONOMOUS_EVENT, { type: 'started', ...data })
    })
    autonomousExecutorService.on('autonomous-stopped', (data) => {
      mainWindow?.webContents.send(IPC_CHANNELS.AUTONOMOUS_EVENT, { type: 'stopped', ...data })
    })
    autonomousExecutorService.on('autonomous-paused', (data) => {
      mainWindow?.webContents.send(IPC_CHANNELS.AUTONOMOUS_EVENT, { type: 'paused', ...data })
    })
    autonomousExecutorService.on('autonomous-resumed', (data) => {
      mainWindow?.webContents.send(IPC_CHANNELS.AUTONOMOUS_EVENT, { type: 'resumed', ...data })
    })
    autonomousExecutorService.on('autonomous-progress', (data) => {
      mainWindow?.webContents.send(IPC_CHANNELS.AUTONOMOUS_EVENT, { type: 'progress', ...data })
    })
    autonomousExecutorService.on('autonomous-error', (data) => {
      mainWindow?.webContents.send(IPC_CHANNELS.AUTONOMOUS_EVENT, { type: 'error', ...data })
    })
    autonomousExecutorService.on('auto-approved', (data) => {
      mainWindow?.webContents.send(IPC_CHANNELS.AUTONOMOUS_EVENT, { type: 'auto-approved', ...data })
    })
    autonomousExecutorService.on('manual-approval-required', (data) => {
      mainWindow?.webContents.send(IPC_CHANNELS.AUTONOMOUS_EVENT, { type: 'manual-approval-required', ...data })
    })
    autonomousExecutorService.on('task-stuck', (data) => {
      mainWindow?.webContents.send(IPC_CHANNELS.AUTONOMOUS_EVENT, { type: 'task-stuck', ...data })
    })
    autonomousExecutorService.on('task-retried', (data) => {
      mainWindow?.webContents.send(IPC_CHANNELS.AUTONOMOUS_EVENT, { type: 'task-retried', ...data })
    })
    autonomousExecutorService.on('autonomous-idle-timeout', (data) => {
      mainWindow?.webContents.send(IPC_CHANNELS.AUTONOMOUS_EVENT, { type: 'idle-timeout', ...data })
    })

    return autonomousExecutorService.startContinuous(config)
  })

  ipcMain.handle(IPC_CHANNELS.AUTONOMOUS_STOP, async () => {
    autonomousExecutorService.stop()
    autonomousExecutorService.removeAllListeners()
  })

  ipcMain.handle(IPC_CHANNELS.AUTONOMOUS_PAUSE, async () => {
    autonomousExecutorService.pause()
  })

  ipcMain.handle(IPC_CHANNELS.AUTONOMOUS_RESUME, async () => {
    autonomousExecutorService.resume()
  })

  ipcMain.handle(IPC_CHANNELS.AUTONOMOUS_STATUS, async () => {
    return autonomousExecutorService.getState()
  })

  ipcMain.handle(IPC_CHANNELS.AUTONOMOUS_STATS, async () => {
    return autonomousExecutorService.getStats()
  })

  ipcMain.handle(IPC_CHANNELS.AUTONOMOUS_METRICS, async (_, projectId) => {
    return taskQueueService.getMetricsSummary(projectId)
  })
}

// App lifecycle
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.claude.devstudio')

  // Watch for shortcuts in dev
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  setupIpcHandlers()
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // Cleanup Claude processes
  claudeService.cleanup()

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Handle app quit
app.on('before-quit', () => {
  claudeService.cleanup()
})
