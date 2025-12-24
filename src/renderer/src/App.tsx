import { useEffect } from 'react'
import { useAppStore } from './stores/appStore'
import { Titlebar } from './components/Titlebar'
import { Sidebar } from './components/Sidebar'
import { ChatPanel } from './components/ChatPanel'
import { WorkflowPanel } from './components/WorkflowPanel'
import { StoriesPanel } from './components/StoriesPanel'
import { SprintPanel } from './components/SprintPanel'
import { GitPanel } from './components/GitPanel'
import { DashboardPanel } from './components/DashboardPanel'
import { RoadmapPanel } from './components/RoadmapPanel'
import { TaskQueuePanel } from './components/TaskQueuePanel'
import { WelcomeScreen } from './components/WelcomeScreen'
import { TutorialModal } from './components/TutorialModal'
import { StatusBar } from './components/StatusBar'
import { ToastProvider, useToast } from './components/Toast'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

function AppContent(): JSX.Element {
  const { claudeStatus, setClaudeStatus, currentProject, setProjects, isSidebarOpen, viewMode, showTutorial, setShowTutorial } =
    useAppStore()
  const toast = useToast()

  // Enable keyboard shortcuts
  useKeyboardShortcuts()

  // Check Claude CLI status on mount
  useEffect(() => {
    const checkStatus = async (): Promise<void> => {
      try {
        const status = await window.electronAPI.claude.checkStatus()
        setClaudeStatus(status)
      } catch (error) {
        console.error('Failed to check Claude status:', error)
        toast.error('Claude Status Check Failed', 'Could not connect to Claude CLI')
      }
    }
    checkStatus()
  }, [setClaudeStatus, toast])

  // Load projects on mount
  useEffect(() => {
    const loadProjects = async (): Promise<void> => {
      try {
        const projects = await window.electronAPI.projects.list()
        setProjects(projects)
      } catch (error) {
        console.error('Failed to load projects:', error)
        toast.error('Failed to Load Projects', 'Could not load your projects')
      }
    }
    loadProjects()
  }, [setProjects, toast])

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <Titlebar />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {isSidebarOpen && <Sidebar />}

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {!claudeStatus?.installed ? (
            <ClaudeNotInstalled />
          ) : !claudeStatus?.authenticated ? (
            <ClaudeNotAuthenticated />
          ) : !currentProject ? (
            <WelcomeScreen />
          ) : viewMode === 'dashboard' ? (
            <DashboardPanel projectPath={currentProject.path} />
          ) : viewMode === 'chat' ? (
            <ChatPanel />
          ) : viewMode === 'workflows' ? (
            <WorkflowPanel projectPath={currentProject.path} />
          ) : viewMode === 'stories' ? (
            <StoriesPanel projectPath={currentProject.path} />
          ) : viewMode === 'sprints' ? (
            <SprintPanel projectPath={currentProject.path} />
          ) : viewMode === 'git' ? (
            <GitPanel projectPath={currentProject.path} />
          ) : viewMode === 'roadmap' ? (
            <RoadmapPanel projectPath={currentProject.path} />
          ) : viewMode === 'task-queue' ? (
            <TaskQueuePanel projectPath={currentProject.path} />
          ) : (
            <ChatPanel />
          )}
        </main>
      </div>

      <StatusBar />

      {/* Tutorial Modal */}
      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}
    </div>
  )
}

function ClaudeNotInstalled(): JSX.Element {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-6">🔧</div>
        <h2 className="text-2xl font-semibold mb-4">Claude Code Not Found</h2>
        <p className="text-muted-foreground mb-6">
          Claude DevStudio requires Claude Code CLI to be installed. Please install it to continue.
        </p>
        <a
          href="https://claude.ai/code"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
        >
          Install Claude Code
        </a>
      </div>
    </div>
  )
}

function ClaudeNotAuthenticated(): JSX.Element {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-6">🔐</div>
        <h2 className="text-2xl font-semibold mb-4">Authentication Required</h2>
        <p className="text-muted-foreground mb-6">
          Please authenticate with Claude Code CLI. Open your terminal and run:
        </p>
        <code className="block bg-secondary px-4 py-3 rounded-lg text-sm mb-6">claude</code>
        <p className="text-sm text-muted-foreground">
          Follow the prompts to sign in with your Claude account.
        </p>
      </div>
    </div>
  )
}

// Main App wrapper with providers
function App(): JSX.Element {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  )
}

export default App
