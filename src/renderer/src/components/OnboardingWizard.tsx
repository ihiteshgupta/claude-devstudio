import React, { useState, useEffect, useCallback } from 'react'
import {
  FolderOpen,
  Sparkles,
  CheckCircle,
  Loader2,
  ChevronRight,
  MessageSquare,
  Code,
  TestTube,
  Shield,
  FileText,
  GitBranch,
  Package,
  AlertCircle,
  Check,
  X,
  RefreshCw,
} from 'lucide-react'

// Types
interface ProjectAnalysis {
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
}

interface SuggestedRoadmapItem {
  type: 'epic' | 'feature' | 'milestone'
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  lane: 'now' | 'next' | 'later'
  estimatedEffort: number
  tags: string[]
  accepted: boolean
}

interface SuggestedTask {
  type: string
  title: string
  description: string
  agentType: string
  autonomyLevel: 'auto' | 'approval_gates' | 'supervised'
  priority: number
  accepted: boolean
}

interface OnboardingPlan {
  id: string
  projectId: string
  analysis: ProjectAnalysis
  suggestedRoadmap: SuggestedRoadmapItem[]
  suggestedTasks: SuggestedTask[]
  status: string
  userFeedback?: string
}

interface OnboardingWizardProps {
  projectId: string
  projectName: string
  projectPath: string
  onComplete: () => void
  onCancel: () => void
}

type WizardStep = 'analyzing' | 'review-analysis' | 'generating-plan' | 'review-plan' | 'applying' | 'complete'

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  projectId,
  projectName,
  projectPath,
  onComplete,
  onCancel,
}) => {
  const [step, setStep] = useState<WizardStep>('analyzing')
  const [analysis, setAnalysis] = useState<ProjectAnalysis | null>(null)
  const [plan, setPlan] = useState<OnboardingPlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [selectedRoadmapItems, setSelectedRoadmapItems] = useState<Set<string>>(new Set())
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())
  const [applyResult, setApplyResult] = useState<{ roadmapItemsCreated: number; tasksCreated: number } | null>(null)
  const [lastSuccessStep, setLastSuccessStep] = useState<WizardStep>('analyzing')

  // Handle retry without page reload
  const handleRetry = useCallback(() => {
    setError(null)
    // Go back to the last successful step
    setStep(lastSuccessStep)
  }, [lastSuccessStep])

  // Analyze project on mount
  useEffect(() => {
    const analyzeProject = async (): Promise<void> => {
      try {
        const result = await window.electronAPI.onboarding.analyze(projectPath)
        setAnalysis(result)
        setLastSuccessStep('review-analysis')
        setStep('review-analysis')
      } catch (err) {
        setError(`Analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }

    analyzeProject()
  }, [projectPath])

  // Generate plan after analysis is reviewed
  const handleGeneratePlan = useCallback(async () => {
    if (!analysis) return

    setStep('generating-plan')
    try {
      const result = await window.electronAPI.onboarding.init({
        projectPath,
        projectName,
        projectId,
      })

      const planData = result as OnboardingPlan
      setPlan(planData)

      // Select all items by default
      const roadmapTitles = new Set(planData.suggestedRoadmap.map(r => r.title))
      const taskTitles = new Set(planData.suggestedTasks.map(t => t.title))
      setSelectedRoadmapItems(roadmapTitles)
      setSelectedTasks(taskTitles)

      setLastSuccessStep('review-plan')
      setStep('review-plan')
    } catch (err) {
      setError(`Plan generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }, [analysis, projectPath, projectName, projectId])

  // Submit feedback and regenerate
  const handleSubmitFeedback = useCallback(async () => {
    if (!plan || !feedback.trim()) return

    setStep('generating-plan')
    try {
      const result = await window.electronAPI.onboarding.updatePlan(
        plan.id,
        feedback,
        Array.from(selectedRoadmapItems),
        Array.from(selectedTasks)
      )

      const updatedPlan = result as OnboardingPlan
      setPlan(updatedPlan)
      setFeedback('')

      // Update selections
      const roadmapTitles = new Set(updatedPlan.suggestedRoadmap.filter(r => r.accepted).map(r => r.title))
      const taskTitles = new Set(updatedPlan.suggestedTasks.filter(t => t.accepted).map(t => t.title))
      setSelectedRoadmapItems(roadmapTitles)
      setSelectedTasks(taskTitles)

      setLastSuccessStep('review-plan')
      setStep('review-plan')
    } catch (err) {
      setError(`Feedback update failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
      // Don't setStep here - let error handler show error, retry will go to lastSuccessStep
    }
  }, [plan, feedback, selectedRoadmapItems, selectedTasks])

  // Apply the plan
  const handleApplyPlan = useCallback(async () => {
    if (!plan) return

    setStep('applying')
    try {
      // Update plan with current selections
      await window.electronAPI.onboarding.updatePlan(
        plan.id,
        '',
        Array.from(selectedRoadmapItems),
        Array.from(selectedTasks)
      )

      const result = await window.electronAPI.onboarding.applyPlan(plan.id)
      setApplyResult(result)
      setLastSuccessStep('complete')
      setStep('complete')
    } catch (err) {
      setError(`Failed to apply plan: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }, [plan, selectedRoadmapItems, selectedTasks])

  // Toggle roadmap item selection
  const toggleRoadmapItem = (title: string): void => {
    setSelectedRoadmapItems(prev => {
      const next = new Set(prev)
      if (next.has(title)) {
        next.delete(title)
      } else {
        next.add(title)
      }
      return next
    })
  }

  // Toggle task selection
  const toggleTask = (title: string): void => {
    setSelectedTasks(prev => {
      const next = new Set(prev)
      if (next.has(title)) {
        next.delete(title)
      } else {
        next.add(title)
      }
      return next
    })
  }

  // Agent icon helper
  const getAgentIcon = (agent: string): JSX.Element => {
    const icons: Record<string, JSX.Element> = {
      developer: <Code className="w-4 h-4" />,
      tester: <TestTube className="w-4 h-4" />,
      security: <Shield className="w-4 h-4" />,
      documentation: <FileText className="w-4 h-4" />,
      devops: <GitBranch className="w-4 h-4" />,
    }
    return icons[agent] || <Code className="w-4 h-4" />
  }

  // Lane color helper
  const getLaneColor = (lane: string): string => {
    const colors: Record<string, string> = {
      now: 'bg-red-500/20 text-red-400 border-red-500/30',
      next: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      later: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    }
    return colors[lane] || 'bg-zinc-500/20 text-zinc-400'
  }

  // Priority badge helper
  const getPriorityColor = (priority: string): string => {
    const colors: Record<string, string> = {
      high: 'bg-red-500/20 text-red-400',
      medium: 'bg-yellow-500/20 text-yellow-400',
      low: 'bg-green-500/20 text-green-400',
    }
    return colors[priority] || 'bg-zinc-500/20 text-zinc-400'
  }

  // Autonomy badge helper
  const getAutonomyColor = (level: string): string => {
    const colors: Record<string, string> = {
      auto: 'bg-green-500/20 text-green-400',
      approval_gates: 'bg-yellow-500/20 text-yellow-400',
      supervised: 'bg-red-500/20 text-red-400',
    }
    return colors[level] || 'bg-zinc-500/20 text-zinc-400'
  }

  // Render step content
  const renderContent = (): JSX.Element => {
    switch (step) {
      case 'analyzing':
        return (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin">
              <Loader2 className="w-12 h-12 text-violet-500" />
            </div>
            <h3 className="mt-4 text-lg font-medium text-zinc-100">Analyzing Project</h3>
            <p className="mt-2 text-sm text-zinc-400">
              Scanning {projectName} to understand its structure...
            </p>
          </div>
        )

      case 'review-analysis':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <CheckCircle className="w-10 h-10 mx-auto text-green-500" />
              <h3 className="mt-3 text-lg font-medium text-zinc-100">Analysis Complete</h3>
              <p className="mt-1 text-sm text-zinc-400">
                We've analyzed your project. Review the findings below.
              </p>
            </div>

            {analysis && (
              <div className="grid grid-cols-2 gap-4">
                {/* Project Info */}
                <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
                  <h4 className="text-sm font-medium text-zinc-300 mb-3">Project Info</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Type:</span>
                      <span className="text-zinc-200 capitalize">{analysis.projectType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Language:</span>
                      <span className="text-zinc-200 capitalize">{analysis.language}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Frameworks:</span>
                      <span className="text-zinc-200">
                        {analysis.frameworks.length > 0 ? analysis.frameworks.join(', ') : 'None detected'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Structure */}
                <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
                  <h4 className="text-sm font-medium text-zinc-300 mb-3">Structure</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Source Dirs:</span>
                      <span className="text-zinc-200">{analysis.structure.srcDirs.join(', ') || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Config Files:</span>
                      <span className="text-zinc-200">{analysis.structure.configFiles.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Entry Points:</span>
                      <span className="text-zinc-200">{analysis.structure.entryPoints.join(', ') || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Capabilities */}
                <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
                  <h4 className="text-sm font-medium text-zinc-300 mb-3">Capabilities</h4>
                  <div className="flex flex-wrap gap-2">
                    <span className={`px-2 py-1 rounded text-xs ${analysis.hasTests ? 'bg-green-500/20 text-green-400' : 'bg-zinc-700 text-zinc-500'}`}>
                      {analysis.hasTests ? '✓' : '✗'} Tests
                    </span>
                    <span className={`px-2 py-1 rounded text-xs ${analysis.hasCICD ? 'bg-green-500/20 text-green-400' : 'bg-zinc-700 text-zinc-500'}`}>
                      {analysis.hasCICD ? '✓' : '✗'} CI/CD
                    </span>
                    <span className={`px-2 py-1 rounded text-xs ${analysis.hasDocker ? 'bg-green-500/20 text-green-400' : 'bg-zinc-700 text-zinc-500'}`}>
                      {analysis.hasDocker ? '✓' : '✗'} Docker
                    </span>
                  </div>
                </div>

                {/* Suggested Agents */}
                <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
                  <h4 className="text-sm font-medium text-zinc-300 mb-3">Recommended Agents</h4>
                  <div className="flex flex-wrap gap-2">
                    {analysis.suggestedAgents.map(agent => (
                      <span key={agent} className="flex items-center gap-1.5 px-2 py-1 bg-violet-500/20 text-violet-400 rounded text-xs capitalize">
                        {getAgentIcon(agent)}
                        {agent}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGeneratePlan}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Generate Plan
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
          </div>
        )

      case 'generating-plan':
        return (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin">
              <Sparkles className="w-12 h-12 text-violet-500" />
            </div>
            <h3 className="mt-4 text-lg font-medium text-zinc-100">Generating Plan</h3>
            <p className="mt-2 text-sm text-zinc-400">
              AI is creating a customized roadmap for your project...
            </p>
          </div>
        )

      case 'review-plan':
        return (
          <div className="space-y-6 max-h-[60vh] overflow-y-auto">
            <div className="text-center">
              <Sparkles className="w-10 h-10 mx-auto text-violet-500" />
              <h3 className="mt-3 text-lg font-medium text-zinc-100">Review Your Plan</h3>
              <p className="mt-1 text-sm text-zinc-400">
                Select items to include. Provide feedback to refine the plan.
              </p>
            </div>

            {plan && (
              <>
                {/* Roadmap Items */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <FolderOpen className="w-4 h-4" />
                    Roadmap Items ({selectedRoadmapItems.size} selected)
                  </h4>
                  <div className="space-y-2">
                    {plan.suggestedRoadmap.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => toggleRoadmapItem(item.title)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          selectedRoadmapItems.has(item.title)
                            ? 'bg-violet-500/10 border-violet-500/30'
                            : 'bg-zinc-800/50 border-zinc-700 opacity-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-5 h-5 rounded border flex items-center justify-center mt-0.5 ${
                            selectedRoadmapItems.has(item.title)
                              ? 'bg-violet-600 border-violet-600'
                              : 'border-zinc-600'
                          }`}>
                            {selectedRoadmapItems.has(item.title) && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-zinc-200">{item.title}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${getLaneColor(item.lane)}`}>
                                {item.lane}
                              </span>
                              <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${getPriorityColor(item.priority)}`}>
                                {item.priority}
                              </span>
                            </div>
                            <p className="text-sm text-zinc-400 mt-1">{item.description}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs text-zinc-500">~{item.estimatedEffort}h</span>
                              <span className="text-xs text-zinc-500 capitalize">{item.type}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tasks */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Initial Tasks ({selectedTasks.size} selected)
                  </h4>
                  <div className="space-y-2">
                    {plan.suggestedTasks.map((task, idx) => (
                      <div
                        key={idx}
                        onClick={() => toggleTask(task.title)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          selectedTasks.has(task.title)
                            ? 'bg-violet-500/10 border-violet-500/30'
                            : 'bg-zinc-800/50 border-zinc-700 opacity-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-5 h-5 rounded border flex items-center justify-center mt-0.5 ${
                            selectedTasks.has(task.title)
                              ? 'bg-violet-600 border-violet-600'
                              : 'border-zinc-600'
                          }`}>
                            {selectedTasks.has(task.title) && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-zinc-200">{task.title}</span>
                              <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300 capitalize">
                                {getAgentIcon(task.agentType)}
                                {task.agentType}
                              </span>
                              <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${getAutonomyColor(task.autonomyLevel)}`}>
                                {task.autonomyLevel.replace('_', ' ')}
                              </span>
                            </div>
                            <p className="text-sm text-zinc-400 mt-1">{task.description}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Feedback Input */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Feedback (optional)
                  </h4>
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Suggest changes... e.g., 'Add more security tasks' or 'Focus on testing first'"
                    className="w-full h-20 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 resize-none focus:outline-none focus:border-violet-500"
                  />
                </div>
              </>
            )}

            <div className="flex justify-between gap-3 pt-2 border-t border-zinc-700">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <div className="flex gap-3">
                {feedback.trim() && (
                  <button
                    onClick={handleSubmitFeedback}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refine Plan
                  </button>
                )}
                <button
                  onClick={handleApplyPlan}
                  disabled={selectedRoadmapItems.size === 0 && selectedTasks.size === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Apply Plan
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )

      case 'applying':
        return (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin">
              <Loader2 className="w-12 h-12 text-violet-500" />
            </div>
            <h3 className="mt-4 text-lg font-medium text-zinc-100">Applying Plan</h3>
            <p className="mt-2 text-sm text-zinc-400">
              Creating roadmap items and tasks...
            </p>
          </div>
        )

      case 'complete':
        return (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-bounce">
              <CheckCircle className="w-16 h-16 text-green-500" />
            </div>
            <h3 className="mt-4 text-lg font-medium text-zinc-100">Setup Complete!</h3>
            <p className="mt-2 text-sm text-zinc-400 text-center">
              Your project is ready to go.
            </p>
            {applyResult && (
              <div className="mt-4 flex gap-4 text-sm">
                <div className="px-4 py-2 bg-violet-500/10 rounded-lg">
                  <span className="text-violet-400">{applyResult.roadmapItemsCreated}</span>
                  <span className="text-zinc-400 ml-1">roadmap items</span>
                </div>
                <div className="px-4 py-2 bg-violet-500/10 rounded-lg">
                  <span className="text-violet-400">{applyResult.tasksCreated}</span>
                  <span className="text-zinc-400 ml-1">tasks queued</span>
                </div>
              </div>
            )}
            <button
              onClick={onComplete}
              className="mt-6 flex items-center gap-2 px-6 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Get Started
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )

      default:
        return <div>Unknown step</div>
    }
  }

  // Error display
  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-md p-6 bg-zinc-900 rounded-xl border border-zinc-700 shadow-xl animate-in fade-in zoom-in duration-200">
          <div className="flex flex-col items-center text-center">
            <AlertCircle className="w-12 h-12 text-red-500" />
            <h3 className="mt-4 text-lg font-medium text-zinc-100">Error</h3>
            <p className="mt-2 text-sm text-zinc-400">{error}</p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleRetry}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl p-6 bg-zinc-900 rounded-xl border border-zinc-700 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-500/20 rounded-lg">
              <FolderOpen className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">Project Setup</h2>
              <p className="text-sm text-zinc-400">{projectName}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {(['analyzing', 'review-analysis', 'generating-plan', 'review-plan', 'applying', 'complete'] as WizardStep[]).map((s, idx) => (
            <React.Fragment key={s}>
              <div
                className={`w-2 h-2 rounded-full transition-colors ${
                  s === step
                    ? 'bg-violet-500'
                    : ['analyzing', 'review-analysis', 'generating-plan', 'review-plan', 'applying', 'complete'].indexOf(s) <
                      ['analyzing', 'review-analysis', 'generating-plan', 'review-plan', 'applying', 'complete'].indexOf(step)
                    ? 'bg-green-500'
                    : 'bg-zinc-700'
                }`}
              />
              {idx < 5 && <div className="w-8 h-0.5 bg-zinc-700" />}
            </React.Fragment>
          ))}
        </div>

        {/* Content */}
        <div className="transition-all duration-200">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}

export default OnboardingWizard
