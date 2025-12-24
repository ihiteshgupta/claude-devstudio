import { useState } from 'react'
import { useAppStore, type ViewMode } from '../stores/appStore'
import type { AgentType, Project } from '@shared/types'

const AGENTS: { type: AgentType; name: string; icon: string; description: string }[] = [
  { type: 'developer', name: 'Developer', icon: '👨‍💻', description: 'Code & architecture' },
  { type: 'product-owner', name: 'Product Owner', icon: '📋', description: 'User stories & planning' },
  { type: 'tester', name: 'Tester', icon: '🧪', description: 'Test cases & QA' },
  { type: 'security', name: 'Security', icon: '🔒', description: 'Security audit' },
  { type: 'devops', name: 'DevOps', icon: '🚀', description: 'CI/CD & infra' },
  { type: 'documentation', name: 'Docs', icon: '📚', description: 'Documentation' }
]

const VIEW_TABS: { mode: ViewMode; name: string; icon: string }[] = [
  { mode: 'dashboard', name: 'Home', icon: '📊' },
  { mode: 'chat', name: 'Chat', icon: '💬' },
  { mode: 'workflows', name: 'Flows', icon: '🔄' },
  { mode: 'stories', name: 'Stories', icon: '📝' },
  { mode: 'sprints', name: 'Sprints', icon: '📅' },
  { mode: 'git', name: 'Git', icon: '🔀' }
]

export function Sidebar(): JSX.Element {
  const {
    projects,
    currentProject,
    setCurrentProject,
    addProject,
    removeProject,
    currentAgentType,
    setCurrentAgentType,
    clearMessages,
    viewMode,
    setViewMode
  } = useAppStore()

  const [isAddingProject, setIsAddingProject] = useState(false)

  const handleSelectFolder = async (): Promise<void> => {
    setIsAddingProject(true)
    try {
      const folderPath = await window.electronAPI.projects.selectFolder()
      if (folderPath) {
        const project = await window.electronAPI.projects.create({ path: folderPath })
        addProject(project)
        setCurrentProject(project)
        clearMessages()
      }
    } catch (error) {
      console.error('Failed to add project:', error)
    } finally {
      setIsAddingProject(false)
    }
  }

  const handleSelectProject = async (project: Project): Promise<void> => {
    try {
      await window.electronAPI.projects.open(project.id)
      setCurrentProject(project)
      clearMessages()
    } catch (error) {
      console.error('Failed to open project:', error)
    }
  }

  const handleDeleteProject = async (projectId: string, e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    try {
      await window.electronAPI.projects.delete(projectId)
      removeProject(projectId)
    } catch (error) {
      console.error('Failed to delete project:', error)
    }
  }

  const handleAgentChange = (type: AgentType): void => {
    setCurrentAgentType(type)
    clearMessages()
  }

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col">
      {/* Projects Section */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Projects</h2>
          <button
            onClick={handleSelectFolder}
            disabled={isAddingProject}
            className="p-1 hover:bg-secondary/50 rounded transition-colors disabled:opacity-50 text-muted-foreground hover:text-foreground"
            title="Add project"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        <div className="space-y-1 max-h-48 overflow-y-auto">
          {projects.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No projects yet</p>
          ) : (
            projects.map((project) => (
              <div
                key={project.id}
                onClick={() => handleSelectProject(project)}
                className={`group flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
                  currentProject?.id === project.id
                    ? 'bg-primary/20 text-primary'
                    : 'hover:bg-secondary'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm">📁</span>
                  <span className="text-sm truncate">{project.name}</span>
                </div>
                <button
                  onClick={(e) => handleDeleteProject(project.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/20 rounded transition-all"
                  title="Remove project"
                >
                  <svg className="w-3 h-3 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* View Mode Tabs - Grid Layout */}
      <div className="p-3 border-b border-border">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">View</h2>
        <div className="grid grid-cols-3 gap-1">
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.mode}
              onClick={() => setViewMode(tab.mode)}
              disabled={!currentProject}
              className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                viewMode === tab.mode && currentProject
                  ? 'bg-primary/20 text-primary'
                  : 'hover:bg-secondary/50 text-muted-foreground hover:text-foreground'
              }`}
              title={tab.name}
            >
              <span className="text-base">{tab.icon}</span>
              <span className="text-[10px] font-medium">{tab.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Dashboard info - Only show in dashboard mode */}
      {viewMode === 'dashboard' && (
        <div className="flex-1 p-3 overflow-y-auto">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Overview</h2>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Project metrics, sprint progress, and statistics.</p>
          </div>
        </div>
      )}

      {/* Agents Section - Only show in chat mode */}
      {viewMode === 'chat' && (
        <div className="flex-1 p-3 overflow-y-auto">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">AI Agents</h2>
          <div className="space-y-0.5">
            {AGENTS.map((agent) => (
              <button
                key={agent.type}
                onClick={() => handleAgentChange(agent.type)}
                disabled={!currentProject}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  currentAgentType === agent.type && currentProject
                    ? 'bg-primary/20 text-primary'
                    : 'hover:bg-secondary/50'
                }`}
              >
                <span className="text-sm">{agent.icon}</span>
                <span className="text-sm font-medium truncate">{agent.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Workflow Templates - Only show in workflows mode */}
      {viewMode === 'workflows' && (
        <div className="flex-1 p-3 overflow-y-auto">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Templates</h2>
          <div className="space-y-1">
            {[
              { icon: '📋', name: 'Story → Tests', color: 'text-purple-400' },
              { icon: '🔧', name: 'Story → Code', color: 'text-blue-400' },
              { icon: '🔒', name: 'Review + Security', color: 'text-red-400' },
              { icon: '🚀', name: 'Full Pipeline', color: 'text-green-400' }
            ].map((template) => (
              <div key={template.name} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary/50 cursor-pointer">
                <span className={template.color}>{template.icon}</span>
                <span className="text-sm">{template.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stories info - Only show in stories mode */}
      {viewMode === 'stories' && (
        <div className="flex-1 p-3 overflow-y-auto">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Stories</h2>
          <p className="text-xs text-muted-foreground">Create and manage user stories.</p>
        </div>
      )}

      {/* Sprints info - Only show in sprints mode */}
      {viewMode === 'sprints' && (
        <div className="flex-1 p-3 overflow-y-auto">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Sprints</h2>
          <p className="text-xs text-muted-foreground">Kanban board for sprint management.</p>
        </div>
      )}

      {/* Git info - Only show in git mode */}
      {viewMode === 'git' && (
        <div className="flex-1 p-3 overflow-y-auto">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Git</h2>
          <p className="text-xs text-muted-foreground">Repository status and commits.</p>
        </div>
      )}

      {/* Current project path */}
      {currentProject && (
        <div className="p-2 border-t border-border">
          <div className="text-[10px] text-muted-foreground/60 truncate" title={currentProject.path}>
            {currentProject.path}
          </div>
        </div>
      )}
    </aside>
  )
}
