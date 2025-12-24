import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { claudeService } from './services/claude.service'
import { projectService } from './services/project.service'
import { databaseService } from './services/database.service'
import { workflowService } from './services/workflow.service'
import { fileService } from './services/file.service'
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
    return databaseService.getWorkflowsByProject(projectId)
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
}

// App lifecycle
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.sakha.devstudio')

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
