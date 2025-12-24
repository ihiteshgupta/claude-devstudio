import { useState } from 'react'
import { useAppStore } from '../stores/appStore'

export function WelcomeScreen(): JSX.Element {
  const { addProject, setCurrentProject, projects } = useAppStore()
  const [isLoading, setIsLoading] = useState(false)

  const handleOpenProject = async (): Promise<void> => {
    setIsLoading(true)
    try {
      const folderPath = await window.electronAPI.projects.selectFolder()
      if (folderPath) {
        const project = await window.electronAPI.projects.create({ path: folderPath })
        addProject(project)
        setCurrentProject(project)
      }
    } catch (error) {
      console.error('Failed to open project:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectRecentProject = async (projectId: string): Promise<void> => {
    try {
      const project = await window.electronAPI.projects.open(projectId)
      if (project) {
        setCurrentProject(project)
      }
    } catch (error) {
      console.error('Failed to open project:', error)
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        {/* Logo and title */}
        <div className="text-center mb-12">
          <div className="text-6xl mb-4">
            <svg className="w-16 h-16 mx-auto text-[#D97757]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.5 3.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-11 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm11 14a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-11 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold mb-2">Claude DevStudio</h1>
          <p className="text-muted-foreground">
            AI-powered Agile SDLC with Claude Code
          </p>
        </div>

        {/* Main actions */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <button
            onClick={handleOpenProject}
            disabled={isLoading}
            className="p-6 bg-card border border-border rounded-xl hover:border-primary/50 hover:bg-card/80 transition-all group text-left"
          >
            <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">📁</div>
            <h3 className="font-semibold mb-1">Open Project</h3>
            <p className="text-sm text-muted-foreground">
              Select a folder to start working with AI agents
            </p>
          </button>

          <div className="p-6 bg-card border border-border rounded-xl opacity-60 cursor-not-allowed">
            <div className="text-3xl mb-3">✨</div>
            <h3 className="font-semibold mb-1">New Project</h3>
            <p className="text-sm text-muted-foreground">
              Create a new project with AI scaffolding (Coming soon)
            </p>
          </div>
        </div>

        {/* Recent projects */}
        {projects.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-3">Recent Projects</h2>
            <div className="space-y-2">
              {projects.slice(0, 5).map((project) => (
                <button
                  key={project.id}
                  onClick={() => handleSelectRecentProject(project.id)}
                  className="w-full flex items-center gap-3 p-3 bg-card border border-border rounded-lg hover:border-primary/50 hover:bg-card/80 transition-all text-left"
                >
                  <span className="text-xl">📁</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{project.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{project.path}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatRelativeTime(project.lastOpenedAt)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Features preview */}
        <div className="mt-12 pt-8 border-t border-border">
          <h2 className="text-sm font-semibold text-muted-foreground mb-4 text-center">
            AI Agents at Your Service
          </h2>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
            {[
              { icon: '👨‍💻', name: 'Developer' },
              { icon: '📋', name: 'Product Owner' },
              { icon: '🧪', name: 'Tester' },
              { icon: '🔒', name: 'Security' },
              { icon: '🚀', name: 'DevOps' },
              { icon: '📚', name: 'Docs' }
            ].map((agent) => (
              <div key={agent.name} className="text-center">
                <div className="text-2xl mb-1">{agent.icon}</div>
                <div className="text-xs text-muted-foreground">{agent.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - new Date(date).getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return new Date(date).toLocaleDateString()
}
