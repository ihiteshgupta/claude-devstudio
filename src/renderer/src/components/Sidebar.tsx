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
  { mode: 'chat', name: 'Chat', icon: '💬' },
  { mode: 'workflows', name: 'Workflows', icon: '🔄' },
  { mode: 'stories', name: 'Stories', icon: '📝' },
  { mode: 'sprints', name: 'Sprints', icon: '📅' }
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
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Projects</h2>
          <button
            onClick={handleSelectFolder}
            disabled={isAddingProject}
            className="p-1 hover:bg-secondary rounded transition-colors disabled:opacity-50"
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

      {/* View Mode Tabs */}
      <div className="p-4 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground mb-3">View</h2>
        <div className="flex gap-1 bg-secondary/50 p-1 rounded-lg">
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.mode}
              onClick={() => setViewMode(tab.mode)}
              disabled={!currentProject}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                viewMode === tab.mode && currentProject
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-secondary'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Agents Section - Only show in chat mode */}
      {viewMode === 'chat' && (
        <div className="flex-1 p-4 overflow-y-auto">
          <h2 className="text-sm font-semibold text-foreground mb-3">AI Agents</h2>
          <div className="space-y-1">
            {AGENTS.map((agent) => (
              <button
                key={agent.type}
                onClick={() => handleAgentChange(agent.type)}
                disabled={!currentProject}
                className={`w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  currentAgentType === agent.type && currentProject
                    ? 'bg-primary/20 text-primary'
                    : 'hover:bg-secondary'
                }`}
              >
                <span className="text-lg">{agent.icon}</span>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{agent.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{agent.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Workflow Templates - Only show in workflows mode */}
      {viewMode === 'workflows' && (
        <div className="flex-1 p-4 overflow-y-auto">
          <h2 className="text-sm font-semibold text-foreground mb-3">Workflow Templates</h2>
          <div className="space-y-2">
            <div className="p-3 bg-secondary/30 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-purple-400">📋</span>
                <span className="text-sm font-medium">Story to Tests</span>
              </div>
              <p className="text-xs text-muted-foreground">Generate test cases from user stories</p>
            </div>
            <div className="p-3 bg-secondary/30 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-blue-400">🔧</span>
                <span className="text-sm font-medium">Story to Code</span>
              </div>
              <p className="text-xs text-muted-foreground">Tech spec and implementation</p>
            </div>
            <div className="p-3 bg-secondary/30 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-red-400">🔒</span>
                <span className="text-sm font-medium">Review + Security</span>
              </div>
              <p className="text-xs text-muted-foreground">Code review and security audit</p>
            </div>
            <div className="p-3 bg-secondary/30 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-green-400">🚀</span>
                <span className="text-sm font-medium">Full Pipeline</span>
              </div>
              <p className="text-xs text-muted-foreground">Complete feature development</p>
            </div>
          </div>
        </div>
      )}

      {/* Stories info - Only show in stories mode */}
      {viewMode === 'stories' && (
        <div className="flex-1 p-4 overflow-y-auto">
          <h2 className="text-sm font-semibold text-foreground mb-3">User Stories</h2>
          <div className="text-xs text-muted-foreground">
            Create and manage user stories for your project. Generate test cases automatically.
          </div>
        </div>
      )}

      {/* Sprints info - Only show in sprints mode */}
      {viewMode === 'sprints' && (
        <div className="flex-1 p-4 overflow-y-auto">
          <h2 className="text-sm font-semibold text-foreground mb-3">Sprint Board</h2>
          <div className="text-xs text-muted-foreground space-y-2">
            <p>Manage sprints and track story progress with the Kanban board.</p>
            <p className="text-purple-400">Drag and drop stories between columns to update their status.</p>
          </div>
        </div>
      )}

      {/* Current project path */}
      {currentProject && (
        <div className="p-4 border-t border-border">
          <div className="text-xs text-muted-foreground truncate" title={currentProject.path}>
            {currentProject.path}
          </div>
        </div>
      )}
    </aside>
  )
}
