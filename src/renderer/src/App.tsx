import { useEffect } from 'react'
import { useAppStore } from './stores/appStore'
import { Titlebar } from './components/Titlebar'
import { Sidebar } from './components/Sidebar'
import { ChatPanel } from './components/ChatPanel'
import { WorkflowPanel } from './components/WorkflowPanel'
import { StoriesPanel } from './components/StoriesPanel'
import { SprintPanel } from './components/SprintPanel'
import { WelcomeScreen } from './components/WelcomeScreen'
import { StatusBar } from './components/StatusBar'

function App(): JSX.Element {
  const { claudeStatus, setClaudeStatus, currentProject, setProjects, isSidebarOpen, viewMode } =
    useAppStore()

  // Check Claude CLI status on mount
  useEffect(() => {
    const checkStatus = async (): Promise<void> => {
      try {
        const status = await window.electronAPI.claude.checkStatus()
        setClaudeStatus(status)
      } catch (error) {
        console.error('Failed to check Claude status:', error)
      }
    }
    checkStatus()
  }, [setClaudeStatus])

  // Load projects on mount
  useEffect(() => {
    const loadProjects = async (): Promise<void> => {
      try {
        const projects = await window.electronAPI.projects.list()
        setProjects(projects)
      } catch (error) {
        console.error('Failed to load projects:', error)
      }
    }
    loadProjects()
  }, [setProjects])

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
          ) : viewMode === 'chat' ? (
            <ChatPanel />
          ) : viewMode === 'workflows' ? (
            <WorkflowPanel projectPath={currentProject.path} />
          ) : viewMode === 'stories' ? (
            <StoriesPanel projectPath={currentProject.path} />
          ) : viewMode === 'sprints' ? (
            <SprintPanel projectPath={currentProject.path} />
          ) : (
            <ChatPanel />
          )}
        </main>
      </div>

      <StatusBar />
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
          Sakha DevStudio requires Claude Code CLI to be installed. Please install it to continue.
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

export default App
