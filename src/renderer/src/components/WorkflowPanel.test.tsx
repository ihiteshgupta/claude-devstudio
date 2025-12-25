/**
 * Copyright (c) 2025 Claude DevStudio
 *
 * WorkflowPanel Component Tests
 *
 * Comprehensive test suite for WorkflowPanel including:
 * - Workflow templates list rendering
 * - Create new workflow functionality
 * - Workflow steps/stages display
 * - Running workflow progress tracking
 * - Step status indicators
 * - Cancel workflow button
 * - Workflow output display
 * - Empty state when no workflows
 * - Real-time step updates via IPC
 * - Template selection
 */

import * as React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WorkflowPanel } from './WorkflowPanel'
import { useAppStore } from '../stores/appStore'
import type { Workflow, WorkflowStep, WorkflowTemplate } from '@shared/types'

// Mock dependencies
vi.mock('../stores/appStore')
vi.mock('./Toast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn()
  })
}))

// Mock window.electronAPI
const mockElectronAPI = {
  workflows: {
    getTemplates: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    run: vi.fn(),
    cancel: vi.fn(),
    onStepUpdate: vi.fn()
  }
}

// Setup window.electronAPI mock
beforeEach(() => {
  Object.defineProperty(window, 'electronAPI', {
    value: mockElectronAPI,
    writable: true,
    configurable: true
  })
})

// Mock workflow data
const mockProject = {
  id: 'project-1',
  name: 'Test Project',
  path: '/path/to/project',
  createdAt: new Date(),
  lastOpenedAt: new Date()
}

const mockWorkflowTemplates = [
  {
    id: 'story-to-tests' as WorkflowTemplate,
    name: 'Story to Tests',
    description: 'Generate test cases from user story',
    stepCount: 2
  },
  {
    id: 'story-to-implementation' as WorkflowTemplate,
    name: 'Story to Implementation',
    description: 'Implement user story',
    stepCount: 3
  },
  {
    id: 'code-review-security' as WorkflowTemplate,
    name: 'Code Review + Security',
    description: 'Review code and check security',
    stepCount: 2
  },
  {
    id: 'full-feature-pipeline' as WorkflowTemplate,
    name: 'Full Feature Pipeline',
    description: 'Complete feature development pipeline',
    stepCount: 5
  }
]

const createMockWorkflowStep = (overrides?: Partial<WorkflowStep>): WorkflowStep => ({
  id: 'step-1',
  workflowId: 'workflow-1',
  agentType: 'developer',
  task: 'Implement the feature',
  status: 'pending',
  stepOrder: 0,
  createdAt: new Date(),
  ...overrides
})

const createMockWorkflow = (overrides?: Partial<Workflow>): Workflow => ({
  id: 'workflow-1',
  projectId: 'project-1',
  name: 'Test Workflow',
  description: 'Test workflow description',
  status: 'pending',
  steps: [createMockWorkflowStep()],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
})

describe('WorkflowPanel', () => {
  const defaultProps = {
    projectPath: '/path/to/project'
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mocks
    mockElectronAPI.workflows.getTemplates.mockReturnValue(mockWorkflowTemplates)
    mockElectronAPI.workflows.list.mockResolvedValue([])
    mockElectronAPI.workflows.onStepUpdate.mockReturnValue(vi.fn())

    // Mock useAppStore
    vi.mocked(useAppStore).mockReturnValue({
      currentProject: mockProject
    } as ReturnType<typeof useAppStore>)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Initial Rendering', () => {
    it('should render workflow panel with header', () => {
      render(<WorkflowPanel {...defaultProps} />)

      expect(screen.getByText('Workflows')).toBeInTheDocument()
    })

    it('should load and display workflow templates', () => {
      render(<WorkflowPanel {...defaultProps} />)

      expect(mockElectronAPI.workflows.getTemplates).toHaveBeenCalled()

      const select = screen.getByRole('combobox')
      expect(select).toBeInTheDocument()

      // Check if all templates are in the select
      mockWorkflowTemplates.forEach((template) => {
        const option = within(select).getByRole('option', {
          name: `${template.name} (${template.stepCount} steps)`
        })
        expect(option).toBeInTheDocument()
      })
    })

    it('should load workflows for current project', async () => {
      const mockWorkflows = [createMockWorkflow()]
      mockElectronAPI.workflows.list.mockResolvedValue(mockWorkflows)

      render(<WorkflowPanel {...defaultProps} />)

      await waitFor(() => {
        expect(mockElectronAPI.workflows.list).toHaveBeenCalledWith('project-1')
      })
    })

    it('should not load workflows when no current project', () => {
      vi.mocked(useAppStore).mockReturnValue({
        currentProject: null
      } as ReturnType<typeof useAppStore>)

      render(<WorkflowPanel {...defaultProps} />)

      expect(mockElectronAPI.workflows.list).not.toHaveBeenCalled()
    })
  })

  describe('Empty State', () => {
    it('should show empty state when no workflows exist', async () => {
      mockElectronAPI.workflows.list.mockResolvedValue([])

      render(<WorkflowPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('No workflows yet. Create one above!')).toBeInTheDocument()
      })
    })

    it('should show placeholder message when no workflow is selected', () => {
      render(<WorkflowPanel {...defaultProps} />)

      expect(screen.getByText('Select a workflow to view details')).toBeInTheDocument()
    })
  })

  describe('Workflow Creation', () => {
    it('should render create workflow form', () => {
      render(<WorkflowPanel {...defaultProps} />)

      expect(screen.getByRole('combobox')).toBeInTheDocument()
      expect(
        screen.getByPlaceholderText('Describe your user story or paste code to review...')
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /create workflow/i })).toBeInTheDocument()
    })

    it('should disable create button when input is empty', () => {
      render(<WorkflowPanel {...defaultProps} />)

      const createButton = screen.getByRole('button', { name: /create workflow/i })
      expect(createButton).toBeDisabled()
    })

    it('should enable create button when input has text', async () => {
      const user = userEvent.setup()
      render(<WorkflowPanel {...defaultProps} />)

      const textarea = screen.getByPlaceholderText(
        'Describe your user story or paste code to review...'
      )
      await user.type(textarea, 'Create a login feature')

      const createButton = screen.getByRole('button', { name: /create workflow/i })
      expect(createButton).toBeEnabled()
    })

    it('should create workflow when form is submitted', async () => {
      const user = userEvent.setup()
      const mockWorkflow = createMockWorkflow()
      mockElectronAPI.workflows.create.mockResolvedValue(mockWorkflow)

      render(<WorkflowPanel {...defaultProps} />)

      const textarea = screen.getByPlaceholderText(
        'Describe your user story or paste code to review...'
      )
      await user.type(textarea, 'Create a login feature')

      const createButton = screen.getByRole('button', { name: /create workflow/i })
      await user.click(createButton)

      await waitFor(() => {
        expect(mockElectronAPI.workflows.create).toHaveBeenCalledWith({
          projectId: 'project-1',
          template: 'story-to-tests',
          initialInput: 'Create a login feature'
        })
      })
    })

    it('should show creating state while workflow is being created', async () => {
      const user = userEvent.setup()
      let resolveCreate: (value: Workflow) => void
      mockElectronAPI.workflows.create.mockReturnValue(
        new Promise((resolve) => {
          resolveCreate = resolve
        })
      )

      render(<WorkflowPanel {...defaultProps} />)

      const textarea = screen.getByPlaceholderText(
        'Describe your user story or paste code to review...'
      )
      await user.type(textarea, 'Create a login feature')

      const createButton = screen.getByRole('button', { name: /create workflow/i })
      await user.click(createButton)

      expect(screen.getByText('Creating...')).toBeInTheDocument()
      expect(createButton).toBeDisabled()

      resolveCreate!(createMockWorkflow())

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create workflow/i })).toBeInTheDocument()
      })
    })

    it('should clear input after successful creation', async () => {
      const user = userEvent.setup()
      const mockWorkflow = createMockWorkflow()
      mockElectronAPI.workflows.create.mockResolvedValue(mockWorkflow)

      render(<WorkflowPanel {...defaultProps} />)

      const textarea = screen.getByPlaceholderText(
        'Describe your user story or paste code to review...'
      ) as HTMLTextAreaElement
      await user.type(textarea, 'Create a login feature')

      const createButton = screen.getByRole('button', { name: /create workflow/i })
      await user.click(createButton)

      await waitFor(() => {
        expect(textarea.value).toBe('')
      })
    })

    it('should select workflow after creation', async () => {
      const user = userEvent.setup()
      const mockWorkflow = createMockWorkflow()
      mockElectronAPI.workflows.create.mockResolvedValue(mockWorkflow)

      render(<WorkflowPanel {...defaultProps} />)

      const textarea = screen.getByPlaceholderText(
        'Describe your user story or paste code to review...'
      )
      await user.type(textarea, 'Create a login feature')

      const createButton = screen.getByRole('button', { name: /create workflow/i })
      await user.click(createButton)

      await waitFor(() => {
        expect(screen.getByText('Test Workflow')).toBeInTheDocument()
        expect(screen.getByText('Test workflow description')).toBeInTheDocument()
      })
    })

    it('should change template selection', async () => {
      const user = userEvent.setup()
      render(<WorkflowPanel {...defaultProps} />)

      const select = screen.getByRole('combobox')
      await user.selectOptions(select, 'code-review-security')

      expect(select).toHaveValue('code-review-security')
    })
  })

  describe('Workflow List', () => {
    it('should display workflow list', async () => {
      const mockWorkflows = [
        createMockWorkflow({ id: 'workflow-1', name: 'Workflow 1' }),
        createMockWorkflow({ id: 'workflow-2', name: 'Workflow 2' })
      ]
      mockElectronAPI.workflows.list.mockResolvedValue(mockWorkflows)

      render(<WorkflowPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Workflow 1')).toBeInTheDocument()
        expect(screen.getByText('Workflow 2')).toBeInTheDocument()
      })
    })

    it('should display workflow status indicator', async () => {
      const mockWorkflows = [createMockWorkflow({ status: 'running' })]
      mockElectronAPI.workflows.list.mockResolvedValue(mockWorkflows)

      render(<WorkflowPanel {...defaultProps} />)

      await waitFor(() => {
        const workflowButton = screen.getByText('Test Workflow').closest('button')
        const statusDot = workflowButton?.querySelector('.bg-yellow-500')
        expect(statusDot).toBeInTheDocument()
      })
    })

    it('should display workflow step count', async () => {
      const mockWorkflows = [
        createMockWorkflow({
          steps: [
            createMockWorkflowStep({ id: 'step-1' }),
            createMockWorkflowStep({ id: 'step-2' }),
            createMockWorkflowStep({ id: 'step-3' })
          ]
        })
      ]
      mockElectronAPI.workflows.list.mockResolvedValue(mockWorkflows)

      render(<WorkflowPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('3 steps')).toBeInTheDocument()
      })
    })

    it('should select workflow when clicked', async () => {
      const user = userEvent.setup()
      const mockWorkflows = [createMockWorkflow()]
      mockElectronAPI.workflows.list.mockResolvedValue(mockWorkflows)

      render(<WorkflowPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test Workflow')).toBeInTheDocument()
      })

      const workflowButton = screen.getByText('Test Workflow').closest('button')!
      await user.click(workflowButton)

      // Check if detail view is shown
      expect(screen.getAllByText('Test Workflow')).toHaveLength(2) // One in list, one in detail
    })

    it('should highlight selected workflow', async () => {
      const user = userEvent.setup()
      const mockWorkflows = [createMockWorkflow()]
      mockElectronAPI.workflows.list.mockResolvedValue(mockWorkflows)

      render(<WorkflowPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test Workflow')).toBeInTheDocument()
      })

      const workflowButton = screen.getByText('Test Workflow').closest('button')!
      await user.click(workflowButton)

      expect(workflowButton).toHaveClass('bg-zinc-900')
    })
  })

  describe('Workflow Detail View', () => {
    it('should display workflow details', async () => {
      const user = userEvent.setup()
      const mockWorkflows = [createMockWorkflow()]
      mockElectronAPI.workflows.list.mockResolvedValue(mockWorkflows)

      render(<WorkflowPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test Workflow')).toBeInTheDocument()
      })

      const workflowButton = screen.getByText('Test Workflow').closest('button')!
      await user.click(workflowButton)

      // Should have description in both list and detail view
      expect(screen.getAllByText('Test workflow description')).toHaveLength(2)
    })

    it('should show run button for pending workflow', async () => {
      const user = userEvent.setup()
      const mockWorkflows = [createMockWorkflow({ status: 'pending' })]
      mockElectronAPI.workflows.list.mockResolvedValue(mockWorkflows)

      render(<WorkflowPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test Workflow')).toBeInTheDocument()
      })

      const workflowButton = screen.getByText('Test Workflow').closest('button')!
      await user.click(workflowButton)

      expect(screen.getByRole('button', { name: /run workflow/i })).toBeInTheDocument()
    })

    it('should show cancel button for running workflow', async () => {
      const user = userEvent.setup()
      const mockWorkflows = [createMockWorkflow({ status: 'running' })]
      mockElectronAPI.workflows.list.mockResolvedValue(mockWorkflows)

      render(<WorkflowPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test Workflow')).toBeInTheDocument()
      })

      const workflowButton = screen.getByText('Test Workflow').closest('button')!
      await user.click(workflowButton)

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    it('should not show action buttons for completed workflow', async () => {
      const user = userEvent.setup()
      const mockWorkflows = [createMockWorkflow({ status: 'completed' })]
      mockElectronAPI.workflows.list.mockResolvedValue(mockWorkflows)

      render(<WorkflowPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test Workflow')).toBeInTheDocument()
      })

      const workflowButton = screen.getByText('Test Workflow').closest('button')!
      await user.click(workflowButton)

      expect(screen.queryByRole('button', { name: /run workflow/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument()
    })
  })

  describe('Workflow Steps Display', () => {
    it('should display all workflow steps', async () => {
      const user = userEvent.setup()
      const mockWorkflows = [
        createMockWorkflow({
          steps: [
            createMockWorkflowStep({
              id: 'step-1',
              agentType: 'product-owner',
              task: 'Create user story',
              stepOrder: 0
            }),
            createMockWorkflowStep({
              id: 'step-2',
              agentType: 'developer',
              task: 'Implement feature',
              stepOrder: 1
            }),
            createMockWorkflowStep({
              id: 'step-3',
              agentType: 'tester',
              task: 'Write tests',
              stepOrder: 2
            })
          ]
        })
      ]
      mockElectronAPI.workflows.list.mockResolvedValue(mockWorkflows)

      render(<WorkflowPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test Workflow')).toBeInTheDocument()
      })

      const workflowButton = screen.getByText('Test Workflow').closest('button')!
      await user.click(workflowButton)

      // Agent types are displayed with replaced hyphens and capitalized via CSS
      expect(screen.getByText(/product owner/i)).toBeInTheDocument()
      expect(screen.getByText(/developer/i)).toBeInTheDocument()
      expect(screen.getByText(/tester/i)).toBeInTheDocument()
      expect(screen.getByText('Step 1')).toBeInTheDocument()
      expect(screen.getByText('Step 2')).toBeInTheDocument()
      expect(screen.getByText('Step 3')).toBeInTheDocument()
    })

    it('should display step status indicators', async () => {
      const user = userEvent.setup()
      const mockWorkflows = [
        createMockWorkflow({
          steps: [
            createMockWorkflowStep({ id: 'step-1', status: 'completed', stepOrder: 0 }),
            createMockWorkflowStep({ id: 'step-2', status: 'running', stepOrder: 1 }),
            createMockWorkflowStep({ id: 'step-3', status: 'pending', stepOrder: 2 })
          ]
        })
      ]
      mockElectronAPI.workflows.list.mockResolvedValue(mockWorkflows)

      render(<WorkflowPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test Workflow')).toBeInTheDocument()
      })

      const workflowButton = screen.getByText('Test Workflow').closest('button')!
      await user.click(workflowButton)

      expect(screen.getByText('completed')).toBeInTheDocument()
      expect(screen.getByText('running')).toBeInTheDocument()
      expect(screen.getByText('pending')).toBeInTheDocument()
    })

    it('should display step task with truncation for long tasks', async () => {
      const user = userEvent.setup()
      const longTask = 'A'.repeat(250)
      const mockWorkflows = [
        createMockWorkflow({
          steps: [createMockWorkflowStep({ task: longTask })]
        })
      ]
      mockElectronAPI.workflows.list.mockResolvedValue(mockWorkflows)

      render(<WorkflowPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test Workflow')).toBeInTheDocument()
      })

      const workflowButton = screen.getByText('Test Workflow').closest('button')!
      await user.click(workflowButton)

      const taskText = screen.getByText((content) => content.includes('A'.repeat(200)))
      expect(taskText.textContent).toContain('...')
      expect(taskText.textContent?.length).toBeLessThan(longTask.length)
    })

    it('should display step output when available', async () => {
      const user = userEvent.setup()
      const mockWorkflows = [
        createMockWorkflow({
          steps: [
            createMockWorkflowStep({
              status: 'completed',
              outputData: 'Task completed successfully'
            })
          ]
        })
      ]
      mockElectronAPI.workflows.list.mockResolvedValue(mockWorkflows)

      render(<WorkflowPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test Workflow')).toBeInTheDocument()
      })

      const workflowButton = screen.getByText('Test Workflow').closest('button')!
      await user.click(workflowButton)

      expect(screen.getByText('Output:')).toBeInTheDocument()
      expect(screen.getByText('Task completed successfully')).toBeInTheDocument()
    })

    it('should show connector lines between steps', async () => {
      const user = userEvent.setup()
      const mockWorkflows = [
        createMockWorkflow({
          steps: [
            createMockWorkflowStep({ id: 'step-1', stepOrder: 0 }),
            createMockWorkflowStep({ id: 'step-2', stepOrder: 1 })
          ]
        })
      ]
      mockElectronAPI.workflows.list.mockResolvedValue(mockWorkflows)

      render(<WorkflowPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test Workflow')).toBeInTheDocument()
      })

      const workflowButton = screen.getByText('Test Workflow').closest('button')!
      await user.click(workflowButton)

      const connectorLines = document.querySelectorAll('.bg-zinc-700')
      expect(connectorLines.length).toBeGreaterThan(0)
    })
  })

  describe('Running Workflow', () => {
    it('should run workflow when run button is clicked', async () => {
      const user = userEvent.setup()
      const mockWorkflows = [createMockWorkflow({ status: 'pending' })]
      mockElectronAPI.workflows.list.mockResolvedValue(mockWorkflows)
      mockElectronAPI.workflows.run.mockResolvedValue(undefined)

      render(<WorkflowPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test Workflow')).toBeInTheDocument()
      })

      const workflowButton = screen.getByText('Test Workflow').closest('button')!
      await user.click(workflowButton)

      const runButton = screen.getByRole('button', { name: /run workflow/i })
      await user.click(runButton)

      expect(mockElectronAPI.workflows.run).toHaveBeenCalledWith({
        workflowId: 'workflow-1',
        projectPath: '/path/to/project'
      })
    })

    it('should disable run button while workflow is running', async () => {
      const user = userEvent.setup()
      const mockWorkflows = [createMockWorkflow({ status: 'pending' })]
      mockElectronAPI.workflows.list.mockResolvedValue(mockWorkflows)

      let resolveRun: () => void
      mockElectronAPI.workflows.run.mockReturnValue(
        new Promise((resolve) => {
          resolveRun = resolve
        })
      )

      render(<WorkflowPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test Workflow')).toBeInTheDocument()
      })

      const workflowButton = screen.getByText('Test Workflow').closest('button')!
      await user.click(workflowButton)

      const runButton = screen.getByRole('button', { name: /run workflow/i })
      await user.click(runButton)

      expect(runButton).toBeDisabled()

      resolveRun!()

      await waitFor(() => {
        expect(runButton).toBeDisabled() // Still disabled because workflow is running
      })
    })
  })

  describe('Cancel Workflow', () => {
    it('should cancel workflow when cancel button is clicked', async () => {
      const user = userEvent.setup()
      const mockWorkflows = [createMockWorkflow({ status: 'running' })]
      mockElectronAPI.workflows.list.mockResolvedValue(mockWorkflows)
      mockElectronAPI.workflows.cancel.mockResolvedValue(undefined)

      render(<WorkflowPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test Workflow')).toBeInTheDocument()
      })

      const workflowButton = screen.getByText('Test Workflow').closest('button')!
      await user.click(workflowButton)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      expect(mockElectronAPI.workflows.cancel).toHaveBeenCalledWith('workflow-1')
    })
  })

  describe('Real-time Step Updates', () => {
    it('should subscribe to workflow step updates', () => {
      render(<WorkflowPanel {...defaultProps} />)

      expect(mockElectronAPI.workflows.onStepUpdate).toHaveBeenCalled()
    })

    it('should update step status when step starts', async () => {
      const user = userEvent.setup()
      let stepUpdateCallback: (data: any) => void

      mockElectronAPI.workflows.onStepUpdate.mockImplementation((callback) => {
        stepUpdateCallback = callback
        return vi.fn()
      })

      const mockWorkflows = [
        createMockWorkflow({
          steps: [createMockWorkflowStep({ id: 'step-1', status: 'pending' })]
        })
      ]
      mockElectronAPI.workflows.list.mockResolvedValue(mockWorkflows)

      render(<WorkflowPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test Workflow')).toBeInTheDocument()
      })

      const workflowButton = screen.getByText('Test Workflow').closest('button')!
      await user.click(workflowButton)

      expect(screen.getByText('pending')).toBeInTheDocument()

      // Simulate step start update
      stepUpdateCallback!({
        type: 'step-start',
        step: { id: 'step-1', status: 'running' }
      })

      await waitFor(() => {
        expect(screen.getByText('running')).toBeInTheDocument()
      })
    })

    it('should update step status and output when step completes', async () => {
      const user = userEvent.setup()
      let stepUpdateCallback: (data: any) => void

      mockElectronAPI.workflows.onStepUpdate.mockImplementation((callback) => {
        stepUpdateCallback = callback
        return vi.fn()
      })

      const mockWorkflows = [
        createMockWorkflow({
          steps: [createMockWorkflowStep({ id: 'step-1', status: 'running' })]
        })
      ]
      mockElectronAPI.workflows.list.mockResolvedValue(mockWorkflows)

      render(<WorkflowPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test Workflow')).toBeInTheDocument()
      })

      const workflowButton = screen.getByText('Test Workflow').closest('button')!
      await user.click(workflowButton)

      // Simulate step complete update
      stepUpdateCallback!({
        type: 'step-complete',
        step: { id: 'step-1', status: 'completed' },
        output: 'Step output data'
      })

      await waitFor(() => {
        expect(screen.getByText('completed')).toBeInTheDocument()
        expect(screen.getByText('Step output data')).toBeInTheDocument()
      })
    })

    it('should update step status when step fails', async () => {
      const user = userEvent.setup()
      let stepUpdateCallback: (data: any) => void

      mockElectronAPI.workflows.onStepUpdate.mockImplementation((callback) => {
        stepUpdateCallback = callback
        return vi.fn()
      })

      const mockWorkflows = [
        createMockWorkflow({
          steps: [createMockWorkflowStep({ id: 'step-1', status: 'running' })]
        })
      ]
      mockElectronAPI.workflows.list.mockResolvedValue(mockWorkflows)

      render(<WorkflowPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test Workflow')).toBeInTheDocument()
      })

      const workflowButton = screen.getByText('Test Workflow').closest('button')!
      await user.click(workflowButton)

      // Simulate step error update
      stepUpdateCallback!({
        type: 'step-error',
        step: { id: 'step-1', status: 'failed' }
      })

      await waitFor(() => {
        expect(screen.getByText('failed')).toBeInTheDocument()
      })
    })

    it('should reload workflows when workflow completes', async () => {
      let stepUpdateCallback: (data: any) => void

      mockElectronAPI.workflows.onStepUpdate.mockImplementation((callback) => {
        stepUpdateCallback = callback
        return vi.fn()
      })

      render(<WorkflowPanel {...defaultProps} />)

      await waitFor(() => {
        expect(mockElectronAPI.workflows.list).toHaveBeenCalled()
      })

      // Get the current call count after initial load
      const initialCallCount = mockElectronAPI.workflows.list.mock.calls.length

      // Simulate workflow complete update
      stepUpdateCallback!({
        type: 'workflow-complete'
      })

      await waitFor(() => {
        expect(mockElectronAPI.workflows.list).toHaveBeenCalledTimes(initialCallCount + 1)
      })
    })

    it('should cleanup subscription on unmount', () => {
      const cleanupFn = vi.fn()
      mockElectronAPI.workflows.onStepUpdate.mockReturnValue(cleanupFn)

      const { unmount } = render(<WorkflowPanel {...defaultProps} />)

      expect(cleanupFn).not.toHaveBeenCalled()

      unmount()

      expect(cleanupFn).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should handle workflow list loading error', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockElectronAPI.workflows.list.mockRejectedValue(new Error('Failed to load'))

      render(<WorkflowPanel {...defaultProps} />)

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to load workflows:',
          expect.any(Error)
        )
      })

      consoleErrorSpy.mockRestore()
    })

    it('should handle workflow creation error', async () => {
      const user = userEvent.setup()
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockElectronAPI.workflows.create.mockRejectedValue(new Error('Creation failed'))

      render(<WorkflowPanel {...defaultProps} />)

      const textarea = screen.getByPlaceholderText(
        'Describe your user story or paste code to review...'
      )
      await user.type(textarea, 'Create a login feature')

      const createButton = screen.getByRole('button', { name: /create workflow/i })
      await user.click(createButton)

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to create workflow:',
          expect.any(Error)
        )
      })

      consoleErrorSpy.mockRestore()
    })

    it('should handle workflow run error', async () => {
      const user = userEvent.setup()
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const mockWorkflows = [createMockWorkflow({ status: 'pending' })]
      mockElectronAPI.workflows.list.mockResolvedValue(mockWorkflows)
      mockElectronAPI.workflows.run.mockRejectedValue(new Error('Run failed'))

      render(<WorkflowPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test Workflow')).toBeInTheDocument()
      })

      const workflowButton = screen.getByText('Test Workflow').closest('button')!
      await user.click(workflowButton)

      const runButton = screen.getByRole('button', { name: /run workflow/i })
      await user.click(runButton)

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to run workflow:', expect.any(Error))
      })

      consoleErrorSpy.mockRestore()
    })

    it('should handle workflow cancel error', async () => {
      const user = userEvent.setup()
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const mockWorkflows = [createMockWorkflow({ status: 'running' })]
      mockElectronAPI.workflows.list.mockResolvedValue(mockWorkflows)
      mockElectronAPI.workflows.cancel.mockRejectedValue(new Error('Cancel failed'))

      render(<WorkflowPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test Workflow')).toBeInTheDocument()
      })

      const workflowButton = screen.getByText('Test Workflow').closest('button')!
      await user.click(workflowButton)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to cancel workflow:',
          expect.any(Error)
        )
      })

      consoleErrorSpy.mockRestore()
    })
  })

  describe('Agent Type Display', () => {
    it('should display correct agent icons', async () => {
      const user = userEvent.setup()
      const mockWorkflows = [
        createMockWorkflow({
          steps: [
            createMockWorkflowStep({ agentType: 'developer' }),
            createMockWorkflowStep({ agentType: 'tester', stepOrder: 1, id: 'step-2' }),
            createMockWorkflowStep({ agentType: 'security', stepOrder: 2, id: 'step-3' })
          ]
        })
      ]
      mockElectronAPI.workflows.list.mockResolvedValue(mockWorkflows)

      render(<WorkflowPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test Workflow')).toBeInTheDocument()
      })

      const workflowButton = screen.getByText('Test Workflow').closest('button')!
      await user.click(workflowButton)

      const developerIcon = document.querySelector('.fa-code')
      const testerIcon = document.querySelector('.fa-flask')
      const securityIcon = document.querySelector('.fa-shield-alt')

      expect(developerIcon).toBeInTheDocument()
      expect(testerIcon).toBeInTheDocument()
      expect(securityIcon).toBeInTheDocument()
    })

    it('should apply correct agent type colors', async () => {
      const user = userEvent.setup()
      const mockWorkflows = [createMockWorkflow({ steps: [createMockWorkflowStep()] })]
      mockElectronAPI.workflows.list.mockResolvedValue(mockWorkflows)

      render(<WorkflowPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test Workflow')).toBeInTheDocument()
      })

      const workflowButton = screen.getByText('Test Workflow').closest('button')!
      await user.click(workflowButton)

      // Agent type is displayed as lowercase "developer" with capitalize CSS class
      // Find the step container which has the border classes
      const developerText = screen.getByText(/developer/i)
      const stepContainer = developerText.closest('.border')
      expect(stepContainer).toHaveClass('border-blue-500/30')
    })
  })
})
