import { useState } from 'react'
import { useAppStore } from '../stores/appStore'
import OnboardingWizard from './OnboardingWizard'
import { Project } from '@shared/types'
import {
  FolderOpen,
  Sparkles,
  HelpCircle,
  Code,
  ClipboardList,
  TestTube,
  Shield,
  Rocket,
  BookOpen,
  Folder,
  Cpu
} from 'lucide-react'

export function WelcomeScreen(): JSX.Element {
  const { addProject, setCurrentProject, projects, setShowTutorial } = useAppStore()
  const [isLoading, setIsLoading] = useState(false)
  const [showNewProjectModal, setShowNewProjectModal] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [onboardingProject, setOnboardingProject] = useState<Project | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)

  const handleOpenProject = async (): Promise<void> => {
    setIsLoading(true)
    try {
      const folderPath = await window.electronAPI.projects.selectFolder()
      if (folderPath) {
        const project = await window.electronAPI.projects.create({ path: folderPath })
        addProject(project)
        // Show onboarding wizard for new projects
        setOnboardingProject(project)
        setShowOnboarding(true)
      }
    } catch (error) {
      console.error('Failed to open project:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleNewProject = async (): Promise<void> => {
    if (!newProjectName.trim()) return

    setIsLoading(true)
    try {
      const parentPath = await window.electronAPI.projects.selectFolder()
      if (parentPath) {
        const projectPath = await window.electronAPI.projects.createNew({
          name: newProjectName.trim(),
          parentPath
        })
        if (projectPath) {
          const project = await window.electronAPI.projects.create({ path: projectPath })
          addProject(project)
          // Show onboarding wizard for new projects
          setOnboardingProject(project)
          setShowOnboarding(true)
        }
      }
    } catch (error) {
      console.error('Failed to create project:', error)
    } finally {
      setIsLoading(false)
      setShowNewProjectModal(false)
      setNewProjectName('')
    }
  }

  const handleOnboardingComplete = (): void => {
    if (onboardingProject) {
      setCurrentProject(onboardingProject)
    }
    setShowOnboarding(false)
    setOnboardingProject(null)
  }

  const handleOnboardingCancel = (): void => {
    // Still set the project, just skip onboarding
    if (onboardingProject) {
      setCurrentProject(onboardingProject)
    }
    setShowOnboarding(false)
    setOnboardingProject(null)
  }

  const handleSelectRecentProject = async (projectId: string): Promise<void> => {
    try {
      const project = await window.electronAPI.projects.open(projectId)
      if (project) {
        // Check if project has any onboarding plan
        try {
          const pendingPlan = await window.electronAPI.onboarding.getPlan(projectId)
          if (pendingPlan && pendingPlan.status === 'pending_approval') {
            // Show onboarding wizard to complete the pending plan
            setOnboardingProject(project)
            setShowOnboarding(true)
            return
          }
        } catch {
          // No plan exists, just open the project
        }
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
          <div className="mb-4 flex justify-center">
            <div className="p-4 bg-gradient-to-br from-violet-500/20 to-orange-500/20 rounded-2xl">
              <Cpu className="w-16 h-16 text-[#D97757]" />
            </div>
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
            <div className="mb-3 group-hover:scale-110 transition-transform">
              <FolderOpen className="w-8 h-8 text-violet-500" />
            </div>
            <h3 className="font-semibold mb-1">Open Project</h3>
            <p className="text-sm text-muted-foreground">
              Select a folder to start working with AI agents
            </p>
          </button>

          <button
            onClick={() => setShowNewProjectModal(true)}
            disabled={isLoading}
            className="p-6 bg-card border border-border rounded-xl hover:border-primary/50 hover:bg-card/80 transition-all group text-left"
          >
            <div className="mb-3 group-hover:scale-110 transition-transform">
              <Sparkles className="w-8 h-8 text-amber-500" />
            </div>
            <h3 className="font-semibold mb-1">New Project</h3>
            <p className="text-sm text-muted-foreground">
              Create a new project folder
            </p>
          </button>
        </div>

        {/* Help button */}
        <div className="text-center mb-8">
          <button
            onClick={() => setShowTutorial(true)}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
            New here? View the Getting Started Guide
            <kbd className="ml-1 bg-secondary px-1.5 py-0.5 rounded text-xs">?</kbd>
          </button>
        </div>

        {/* New Project Modal */}
        {showNewProjectModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md mx-4">
              <h2 className="text-lg font-semibold mb-4">Create New Project</h2>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Project name"
                autoFocus
                className="w-full px-3 py-2 bg-secondary border border-border rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-primary"
                onKeyDown={(e) => e.key === 'Enter' && handleNewProject()}
              />
              <p className="text-xs text-muted-foreground mb-4">
                You'll select a parent folder where the project will be created.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowNewProjectModal(false)
                    setNewProjectName('')
                  }}
                  className="px-4 py-2 text-sm hover:bg-secondary rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleNewProject}
                  disabled={!newProjectName.trim() || isLoading}
                  className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isLoading ? 'Creating...' : 'Select Folder & Create'}
                </button>
              </div>
            </div>
          </div>
        )}

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
                  <Folder className="w-5 h-5 text-violet-400" />
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
              { icon: Code, name: 'Developer', color: 'text-blue-400' },
              { icon: ClipboardList, name: 'Product Owner', color: 'text-green-400' },
              { icon: TestTube, name: 'Tester', color: 'text-purple-400' },
              { icon: Shield, name: 'Security', color: 'text-red-400' },
              { icon: Rocket, name: 'DevOps', color: 'text-orange-400' },
              { icon: BookOpen, name: 'Docs', color: 'text-cyan-400' }
            ].map((agent) => (
              <div key={agent.name} className="text-center">
                <div className="flex justify-center mb-1">
                  <agent.icon className={`w-6 h-6 ${agent.color}`} />
                </div>
                <div className="text-xs text-muted-foreground">{agent.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Onboarding Wizard */}
      {showOnboarding && onboardingProject && (
        <OnboardingWizard
          projectId={onboardingProject.id}
          projectName={onboardingProject.name}
          projectPath={onboardingProject.path}
          onComplete={handleOnboardingComplete}
          onCancel={handleOnboardingCancel}
        />
      )}
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
