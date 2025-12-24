import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '../stores/appStore'
import type { Workflow, WorkflowStep, WorkflowTemplate } from '@shared/types'
import { useToast } from './Toast'

interface WorkflowPanelProps {
  projectPath: string
}

const AGENT_COLORS: Record<string, string> = {
  'product-owner': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  developer: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  tester: 'bg-green-500/20 text-green-400 border-green-500/30',
  security: 'bg-red-500/20 text-red-400 border-red-500/30',
  devops: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  documentation: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
}

const AGENT_ICONS: Record<string, string> = {
  'product-owner': 'clipboard-list',
  developer: 'code',
  tester: 'flask',
  security: 'shield-alt',
  devops: 'server',
  documentation: 'book'
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-zinc-600',
  running: 'bg-yellow-500 animate-pulse',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  skipped: 'bg-zinc-500',
  cancelled: 'bg-orange-500'
}

export function WorkflowPanel({ projectPath }: WorkflowPanelProps): JSX.Element {
  const { currentProject } = useAppStore()
  const toast = useToast()
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null)
  const [newWorkflowInput, setNewWorkflowInput] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate>('story-to-tests')
  const [isCreating, setIsCreating] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const templates = window.electronAPI.workflows.getTemplates()

  // Load workflows
  const loadWorkflows = useCallback(async () => {
    if (!currentProject) return
    setIsLoading(true)
    try {
      const projectWorkflows = await window.electronAPI.workflows.list(currentProject.id)
      setWorkflows(projectWorkflows)
    } catch (error) {
      console.error('Failed to load workflows:', error)
      toast.error('Load Failed', 'Could not load workflows')
    } finally {
      setIsLoading(false)
    }
  }, [currentProject, toast])

  useEffect(() => {
    loadWorkflows()
  }, [loadWorkflows])

  // Subscribe to workflow updates
  useEffect(() => {
    const cleanup = window.electronAPI.workflows.onStepUpdate((data) => {
      if (data.type === 'step-start' && data.step) {
        setSelectedWorkflow((prev) => {
          if (!prev) return null
          return {
            ...prev,
            steps: prev.steps.map((s) =>
              s.id === data.step!.id ? { ...s, status: 'running' } : s
            )
          }
        })
      } else if (data.type === 'step-complete' && data.step) {
        setSelectedWorkflow((prev) => {
          if (!prev) return null
          return {
            ...prev,
            steps: prev.steps.map((s) =>
              s.id === data.step!.id
                ? { ...s, status: 'completed', outputData: data.output }
                : s
            )
          }
        })
      } else if (data.type === 'step-error' && data.step) {
        setSelectedWorkflow((prev) => {
          if (!prev) return null
          return {
            ...prev,
            steps: prev.steps.map((s) =>
              s.id === data.step!.id ? { ...s, status: 'failed' } : s
            )
          }
        })
      } else if (data.type === 'workflow-complete') {
        setIsRunning(false)
        loadWorkflows()
      } else if (data.type === 'workflow-error') {
        setIsRunning(false)
        loadWorkflows()
      }
    })

    return cleanup
  }, [loadWorkflows])

  const handleCreateWorkflow = async (): Promise<void> => {
    if (!currentProject || !newWorkflowInput.trim()) return

    setIsCreating(true)
    try {
      const workflow = await window.electronAPI.workflows.create({
        projectId: currentProject.id,
        template: selectedTemplate,
        initialInput: newWorkflowInput
      })
      setWorkflows((prev) => [workflow, ...prev])
      setSelectedWorkflow(workflow)
      setNewWorkflowInput('')
    } catch (error) {
      console.error('Failed to create workflow:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleRunWorkflow = async (): Promise<void> => {
    if (!selectedWorkflow) return

    setIsRunning(true)
    try {
      await window.electronAPI.workflows.run({
        workflowId: selectedWorkflow.id,
        projectPath
      })
    } catch (error) {
      console.error('Failed to run workflow:', error)
      setIsRunning(false)
    }
  }

  const handleCancelWorkflow = async (): Promise<void> => {
    if (!selectedWorkflow) return

    try {
      await window.electronAPI.workflows.cancel(selectedWorkflow.id)
      setIsRunning(false)
    } catch (error) {
      console.error('Failed to cancel workflow:', error)
    }
  }

  const renderStepStatus = (step: WorkflowStep): JSX.Element => {
    return (
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[step.status]}`} />
        <span className="text-xs text-zinc-500 capitalize">{step.status}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-1 h-full bg-zinc-950">
      {/* Workflow List */}
      <div className="w-80 border-r border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-white mb-4">Workflows</h2>

          {/* Template Selector */}
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value as WorkflowTemplate)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white mb-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.stepCount} steps)
              </option>
            ))}
          </select>

          {/* Input */}
          <textarea
            value={newWorkflowInput}
            onChange={(e) => setNewWorkflowInput(e.target.value)}
            placeholder="Describe your user story or paste code to review..."
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white mb-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
            rows={3}
          />

          <button
            onClick={handleCreateWorkflow}
            disabled={isCreating || !newWorkflowInput.trim()}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {isCreating ? 'Creating...' : 'Create Workflow'}
          </button>
        </div>

        {/* Workflow List */}
        <div className="flex-1 overflow-y-auto">
          {workflows.length === 0 ? (
            <div className="p-4 text-center text-zinc-500 text-sm">
              No workflows yet. Create one above!
            </div>
          ) : (
            workflows.map((workflow) => (
              <button
                key={workflow.id}
                onClick={() => setSelectedWorkflow(workflow)}
                className={`w-full p-4 text-left border-b border-zinc-800 hover:bg-zinc-900 transition-colors ${
                  selectedWorkflow?.id === workflow.id ? 'bg-zinc-900' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white font-medium text-sm truncate">
                    {workflow.name}
                  </span>
                  <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[workflow.status]}`} />
                </div>
                <p className="text-xs text-zinc-500 truncate">{workflow.description}</p>
                <p className="text-xs text-zinc-600 mt-1">
                  {workflow.steps.length} steps
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Workflow Detail */}
      <div className="flex-1 flex flex-col">
        {selectedWorkflow ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">{selectedWorkflow.name}</h3>
                <p className="text-sm text-zinc-500">{selectedWorkflow.description}</p>
              </div>
              <div className="flex gap-2">
                {selectedWorkflow.status === 'pending' && (
                  <button
                    onClick={handleRunWorkflow}
                    disabled={isRunning}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <i className="fas fa-play text-xs" />
                    Run Workflow
                  </button>
                )}
                {selectedWorkflow.status === 'running' && (
                  <button
                    onClick={handleCancelWorkflow}
                    className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <i className="fas fa-stop text-xs" />
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {/* Steps */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                {selectedWorkflow.steps.map((step, index) => (
                  <div key={step.id} className="relative">
                    {/* Connector line */}
                    {index < selectedWorkflow.steps.length - 1 && (
                      <div className="absolute left-6 top-12 w-0.5 h-8 bg-zinc-700" />
                    )}

                    <div
                      className={`border rounded-lg p-4 ${AGENT_COLORS[step.agentType]} border-opacity-50`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
                            <i className={`fas fa-${AGENT_ICONS[step.agentType]} text-sm`} />
                          </div>
                          <div>
                            <span className="text-white font-medium text-sm capitalize">
                              {step.agentType.replace('-', ' ')}
                            </span>
                            <p className="text-xs text-zinc-500">Step {step.stepOrder + 1}</p>
                          </div>
                        </div>
                        {renderStepStatus(step)}
                      </div>

                      {/* Task */}
                      <div className="mt-3 p-3 bg-zinc-900/50 rounded-lg">
                        <p className="text-xs text-zinc-400 mb-1">Task:</p>
                        <p className="text-sm text-zinc-300 whitespace-pre-wrap">
                          {step.task.length > 200
                            ? step.task.slice(0, 200) + '...'
                            : step.task}
                        </p>
                      </div>

                      {/* Output */}
                      {step.outputData && (
                        <div className="mt-3 p-3 bg-zinc-900/50 rounded-lg">
                          <p className="text-xs text-zinc-400 mb-1">Output:</p>
                          <pre className="text-sm text-zinc-300 whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto">
                            {step.outputData}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <i className="fas fa-project-diagram text-4xl text-zinc-700 mb-4" />
              <p className="text-zinc-500">Select a workflow to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
