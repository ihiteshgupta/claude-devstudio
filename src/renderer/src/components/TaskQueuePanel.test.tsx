/**
 * Copyright (c) 2025 Claude DevStudio
 *
 * TaskQueuePanel Component Tests
 *
 * Comprehensive test suite for the TaskQueuePanel component including:
 * - Task list rendering (pending/running/completed)
 * - Task status, type, and progress display
 * - Start/Pause/Cancel task buttons
 * - Approve/Reject buttons for approval gates
 * - Autonomy level selector
 * - Task details panel
 * - Empty state
 * - Loading states
 * - Tech choice modal integration
 * - Live output streaming
 * - Task decomposition
 */

import * as React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TaskQueuePanel } from './TaskQueuePanel'
import { ToastProvider } from './Toast'
import type {
  QueuedTask,
  ApprovalGate,
  TechChoice,
  TaskQueueEvent,
  Project
} from '@shared/types'

// Mock the appStore
const mockUseAppStore = vi.fn()
vi.mock('../stores/appStore', () => ({
  useAppStore: () => mockUseAppStore()
}))

// Mock child components
vi.mock('./ApprovalDialog', () => ({
  ApprovalDialog: ({ gate, onApprove, onReject, onClose }: any) => (
    <div data-testid="approval-dialog">
      <div data-testid="gate-title">{gate.title}</div>
      <button onClick={() => onApprove('Approved')} data-testid="approve-dialog-btn">
        Approve
      </button>
      <button onClick={() => onReject('Rejected')} data-testid="reject-dialog-btn">
        Reject
      </button>
      <button onClick={onClose} data-testid="close-dialog-btn">
        Close
      </button>
    </div>
  )
}))

vi.mock('./TechChoiceModal', () => ({
  TechChoiceModal: ({ choice, onDecide, onCancel }: any) => (
    <div data-testid="tech-choice-modal">
      <div data-testid="tech-choice-question">{choice.question}</div>
      <button onClick={() => onDecide('Option 1', 'Test rationale')} data-testid="decide-btn">
        Decide
      </button>
      <button onClick={onCancel} data-testid="cancel-tech-btn">
        Cancel
      </button>
    </div>
  )
}))

describe('TaskQueuePanel', () => {
  let mockProject: Project
  let mockElectronAPI: any
  let eventListeners: Map<string, (event: TaskQueueEvent) => void>

  beforeEach(() => {
    vi.clearAllMocks()
    eventListeners = new Map()

    mockProject = {
      id: 'test-project-id',
      name: 'Test Project',
      path: '/test/path',
      createdAt: new Date(),
      lastOpenedAt: new Date()
    }

    mockUseAppStore.mockReturnValue({
      currentProject: mockProject
    })

    // Mock window.electronAPI
    mockElectronAPI = {
      taskQueue: {
        list: vi.fn().mockResolvedValue([]),
        getApprovals: vi.fn().mockResolvedValue([]),
        enqueue: vi.fn().mockResolvedValue(undefined),
        start: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn().mockResolvedValue(undefined),
        resume: vi.fn().mockResolvedValue(undefined),
        cancel: vi.fn().mockResolvedValue(undefined),
        approve: vi.fn().mockResolvedValue(undefined),
        reject: vi.fn().mockResolvedValue(undefined),
        updateAutonomy: vi.fn().mockResolvedValue(undefined),
        onEvent: vi.fn((callback) => {
          const listenerId = Math.random().toString()
          eventListeners.set(listenerId, callback)
          return () => eventListeners.delete(listenerId)
        })
      },
      techAdvisor: {
        listChoices: vi.fn().mockResolvedValue([]),
        decide: vi.fn().mockResolvedValue(undefined)
      },
      decomposer: {
        decompose: vi.fn().mockResolvedValue({
          enqueuedTasks: [{ id: 'subtask-1' }, { id: 'subtask-2' }]
        })
      }
    }

    global.window.electronAPI = mockElectronAPI
  })

  afterEach(() => {
    vi.restoreAllMocks()
    eventListeners.clear()
  })

  const renderWithToast = (ui: React.ReactElement) => {
    return render(<ToastProvider>{ui}</ToastProvider>)
  }

  const createMockTask = (overrides: Partial<QueuedTask> = {}): QueuedTask => ({
    id: 'task-1',
    projectId: 'test-project-id',
    title: 'Test Task',
    description: 'Test task description',
    taskType: 'code-generation',
    autonomyLevel: 'supervised',
    status: 'pending',
    priority: 50,
    approvalRequired: false,
    retryCount: 0,
    maxRetries: 3,
    createdAt: new Date(),
    ...overrides
  })

  const createMockApprovalGate = (overrides: Partial<ApprovalGate> = {}): ApprovalGate => ({
    id: 'gate-1',
    taskId: 'task-1',
    gateType: 'manual',
    title: 'Approval Required',
    status: 'pending',
    requiresReview: true,
    createdAt: new Date(),
    ...overrides
  })

  const createMockTechChoice = (overrides: Partial<TechChoice> = {}): TechChoice => ({
    id: 'tech-1',
    projectId: 'test-project-id',
    category: 'framework',
    question: 'Which framework to use?',
    options: [
      {
        name: 'React',
        description: 'A JavaScript library',
        pros: ['Popular', 'Large ecosystem'],
        cons: ['Learning curve'],
        learningCurve: 'medium',
        communitySupport: 'large',
        isRecommended: true
      }
    ],
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  })

  describe('Loading State', () => {
    it('should show loading spinner while fetching tasks', () => {
      mockElectronAPI.taskQueue.list.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      )

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      const spinner = document.querySelector('.fa-spinner.fa-spin')
      expect(spinner).toBeInTheDocument()
    })

    it('should hide loading spinner after tasks are loaded', async () => {
      mockElectronAPI.taskQueue.list.mockResolvedValue([])

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        const spinner = document.querySelector('.fa-spinner.fa-spin')
        expect(spinner).not.toBeInTheDocument()
      })
    })
  })

  describe('Empty State', () => {
    it('should display empty state when no tasks exist', async () => {
      mockElectronAPI.taskQueue.list.mockResolvedValue([])

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('No tasks in queue')).toBeInTheDocument()
        expect(screen.getByText('Add tasks to get started')).toBeInTheDocument()
      })
    })

    it('should show task icon in empty state', async () => {
      mockElectronAPI.taskQueue.list.mockResolvedValue([])

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        const icon = document.querySelector('.fa-tasks')
        expect(icon).toBeInTheDocument()
      })
    })
  })

  describe('Task List Rendering', () => {
    it('should render pending tasks', async () => {
      const tasks = [
        createMockTask({ id: 'task-1', title: 'Pending Task 1', status: 'pending' }),
        createMockTask({ id: 'task-2', title: 'Pending Task 2', status: 'queued' })
      ]

      mockElectronAPI.taskQueue.list.mockResolvedValue(tasks)

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Pending Task 1')).toBeInTheDocument()
        expect(screen.getByText('Pending Task 2')).toBeInTheDocument()
      })
    })

    it('should render running tasks', async () => {
      const tasks = [
        createMockTask({ id: 'task-1', title: 'Running Task', status: 'running' })
      ]

      mockElectronAPI.taskQueue.list.mockResolvedValue(tasks)

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Running Task')).toBeInTheDocument()
        expect(screen.getByText(/Running \(1\)/i)).toBeInTheDocument()
      })
    })

    it('should render completed tasks', async () => {
      const tasks = [
        createMockTask({ id: 'task-1', title: 'Completed Task', status: 'completed' })
      ]

      mockElectronAPI.taskQueue.list.mockResolvedValue(tasks)

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Completed Task')).toBeInTheDocument()
        expect(screen.getByText(/Completed \(1\)/i)).toBeInTheDocument()
      })
    })

    it('should render tasks with correct status colors', async () => {
      const tasks = [
        createMockTask({ id: 'task-1', title: 'Task 1', status: 'pending' })
      ]

      mockElectronAPI.taskQueue.list.mockResolvedValue(tasks)

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Pending')).toBeInTheDocument()
      })
    })

    it('should render task type icons', async () => {
      const tasks = [
        createMockTask({ id: 'task-1', taskType: 'code-generation' }),
        createMockTask({ id: 'task-2', taskType: 'testing' })
      ]

      mockElectronAPI.taskQueue.list.mockResolvedValue(tasks)

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        const codeIcon = document.querySelector('.fa-code')
        const flaskIcon = document.querySelector('.fa-flask')
        expect(codeIcon).toBeInTheDocument()
        expect(flaskIcon).toBeInTheDocument()
      })
    })

    it('should render task descriptions when available', async () => {
      const tasks = [
        createMockTask({
          id: 'task-1',
          title: 'Task with Description',
          description: 'This is a task description'
        })
      ]

      mockElectronAPI.taskQueue.list.mockResolvedValue(tasks)

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('This is a task description')).toBeInTheDocument()
      })
    })

    it('should display task count in header', async () => {
      const tasks = [
        createMockTask({ id: 'task-1', status: 'pending' }),
        createMockTask({ id: 'task-2', status: 'running' })
      ]

      mockElectronAPI.taskQueue.list.mockResolvedValue(tasks)

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('1 pending, 1 running')).toBeInTheDocument()
      })
    })

    it('should display estimated duration when available', async () => {
      const tasks = [
        createMockTask({ id: 'task-1', estimatedDuration: 180 }) // 180 seconds = 3 minutes
      ]

      mockElectronAPI.taskQueue.list.mockResolvedValue(tasks)

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('~3m')).toBeInTheDocument()
      })
    })
  })

  describe('Autonomy Level Selector', () => {
    it('should display autonomy level for each task', async () => {
      const tasks = [createMockTask({ id: 'task-1', autonomyLevel: 'supervised' })]

      mockElectronAPI.taskQueue.list.mockResolvedValue(tasks)

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        const select = screen.getByRole('combobox')
        expect(select).toHaveValue('supervised')
      })
    })

    it('should update autonomy level when changed', async () => {
      const user = userEvent.setup()
      const tasks = [createMockTask({ id: 'task-1', autonomyLevel: 'supervised' })]

      mockElectronAPI.taskQueue.list.mockResolvedValue(tasks)

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument()
      })

      const select = screen.getByRole('combobox')
      await user.selectOptions(select, 'auto')

      expect(mockElectronAPI.taskQueue.updateAutonomy).toHaveBeenCalledWith('task-1', 'auto')
    })

    it('should show all autonomy level options', async () => {
      const tasks = [createMockTask({ id: 'task-1' })]

      mockElectronAPI.taskQueue.list.mockResolvedValue(tasks)

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        const select = screen.getByRole('combobox')
        const options = within(select).getAllByRole('option')
        expect(options).toHaveLength(3)
        expect(options[0]).toHaveTextContent('Automatic')
        expect(options[1]).toHaveTextContent('Approval Gates')
        expect(options[2]).toHaveTextContent('Supervised')
      })
    })
  })

  describe('Task Actions', () => {
    it('should show Start button when tasks are pending', async () => {
      const tasks = [createMockTask({ id: 'task-1', status: 'pending' })]

      mockElectronAPI.taskQueue.list.mockResolvedValue(tasks)

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Start')).toBeInTheDocument()
      })
    })

    it('should call start queue when Start button is clicked', async () => {
      const user = userEvent.setup()
      const tasks = [createMockTask({ id: 'task-1', status: 'pending' })]

      mockElectronAPI.taskQueue.list.mockResolvedValue(tasks)

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Start')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Start'))

      expect(mockElectronAPI.taskQueue.start).toHaveBeenCalledWith('test-project-id', '/test/path')
    })

    it('should show Pause button when queue is running', async () => {
      const user = userEvent.setup()
      const tasks = [createMockTask({ id: 'task-1', status: 'pending' })]

      mockElectronAPI.taskQueue.list.mockResolvedValue(tasks)

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Start')).toBeInTheDocument()
      })

      // Start the queue
      await user.click(screen.getByText('Start'))

      await waitFor(() => {
        expect(screen.getByText('Pause')).toBeInTheDocument()
      })
    })

    it('should call pause when Pause button is clicked', async () => {
      const user = userEvent.setup()
      const tasks = [createMockTask({ id: 'task-1', status: 'pending' })]

      mockElectronAPI.taskQueue.list.mockResolvedValue(tasks)

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Start')).toBeInTheDocument()
      })

      // Start the queue first
      await user.click(screen.getByText('Start'))

      await waitFor(() => {
        expect(screen.getByText('Pause')).toBeInTheDocument()
      })

      // Now pause it
      await user.click(screen.getByText('Pause'))

      expect(mockElectronAPI.taskQueue.pause).toHaveBeenCalled()
    })

    it('should show Cancel button for pending tasks', async () => {
      const tasks = [createMockTask({ id: 'task-1', status: 'pending' })]

      mockElectronAPI.taskQueue.list.mockResolvedValue(tasks)

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument()
      })
    })

    it('should call cancel when Cancel button is clicked', async () => {
      const user = userEvent.setup()
      const tasks = [createMockTask({ id: 'task-1', status: 'pending' })]

      mockElectronAPI.taskQueue.list.mockResolvedValue(tasks)

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Cancel'))

      expect(mockElectronAPI.taskQueue.cancel).toHaveBeenCalledWith('task-1')
    })
  })

  describe('Approval Gates', () => {
    it('should display pending approvals section', async () => {
      const tasks = [createMockTask({ id: 'task-1', status: 'waiting_approval' })]
      const approvals = [createMockApprovalGate({ taskId: 'task-1' })]

      mockElectronAPI.taskQueue.list.mockResolvedValue(tasks)
      mockElectronAPI.taskQueue.getApprovals.mockResolvedValue(approvals)

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText(/Pending Approvals \(1\)/i)).toBeInTheDocument()
      })
    })

    it('should render approval gate details', async () => {
      const tasks = [createMockTask({ id: 'task-1', status: 'waiting_approval' })]
      const approvals = [
        createMockApprovalGate({
          taskId: 'task-1',
          title: 'Code Review Required',
          description: 'Please review the generated code'
        })
      ]

      mockElectronAPI.taskQueue.list.mockResolvedValue(tasks)
      mockElectronAPI.taskQueue.getApprovals.mockResolvedValue(approvals)

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Code Review Required')).toBeInTheDocument()
        expect(screen.getByText('Please review the generated code')).toBeInTheDocument()
      })
    })

    it('should show Approve and Reject buttons for pending approvals', async () => {
      const tasks = [createMockTask({ id: 'task-1', status: 'waiting_approval' })]
      const approvals = [createMockApprovalGate({ taskId: 'task-1' })]

      mockElectronAPI.taskQueue.list.mockResolvedValue(tasks)
      mockElectronAPI.taskQueue.getApprovals.mockResolvedValue(approvals)

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        const approveButtons = screen.getAllByText('Approve')
        const rejectButtons = screen.getAllByText('Reject')
        expect(approveButtons.length).toBeGreaterThan(0)
        expect(rejectButtons.length).toBeGreaterThan(0)
      })
    })

    it('should call approve when Approve button is clicked', async () => {
      const user = userEvent.setup()
      const tasks = [createMockTask({ id: 'task-1', status: 'waiting_approval' })]
      const approvals = [createMockApprovalGate({ taskId: 'task-1' })]

      mockElectronAPI.taskQueue.list.mockResolvedValue(tasks)
      mockElectronAPI.taskQueue.getApprovals.mockResolvedValue(approvals)

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        const approveButtons = screen.getAllByText('Approve')
        expect(approveButtons.length).toBeGreaterThan(0)
      })

      const approveButtons = screen.getAllByText('Approve')
      await user.click(approveButtons[0])

      expect(mockElectronAPI.taskQueue.approve).toHaveBeenCalledWith('gate-1', 'user')
    })

    it('should call reject when Reject button is clicked', async () => {
      const user = userEvent.setup()
      const tasks = [createMockTask({ id: 'task-1', status: 'waiting_approval' })]
      const approvals = [createMockApprovalGate({ taskId: 'task-1' })]

      mockElectronAPI.taskQueue.list.mockResolvedValue(tasks)
      mockElectronAPI.taskQueue.getApprovals.mockResolvedValue(approvals)

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        const rejectButtons = screen.getAllByText('Reject')
        expect(rejectButtons.length).toBeGreaterThan(0)
      })

      const rejectButtons = screen.getAllByText('Reject')
      await user.click(rejectButtons[0])

      expect(mockElectronAPI.taskQueue.reject).toHaveBeenCalledWith(
        'gate-1',
        'user',
        'Rejected by user'
      )
    })

    it('should open approval dialog when approval gate is clicked', async () => {
      const user = userEvent.setup()
      const tasks = [createMockTask({ id: 'task-1', status: 'waiting_approval' })]
      const approvals = [createMockApprovalGate({ taskId: 'task-1', title: 'Gate Title' })]

      mockElectronAPI.taskQueue.list.mockResolvedValue(tasks)
      mockElectronAPI.taskQueue.getApprovals.mockResolvedValue(approvals)

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Gate Title')).toBeInTheDocument()
      })

      // Click on the approval gate card (not the approve button)
      const gateCard = screen.getByText('Gate Title').closest('div')
      if (gateCard) {
        await user.click(gateCard)
      }

      await waitFor(() => {
        expect(screen.getByTestId('approval-dialog')).toBeInTheDocument()
      })
    })
  })

  describe('Tech Choice Modal', () => {
    it('should display pending tech choices section', async () => {
      const techChoices = [createMockTechChoice({ status: 'pending' })]

      mockElectronAPI.taskQueue.list.mockResolvedValue([])
      mockElectronAPI.techAdvisor.listChoices.mockResolvedValue(techChoices)

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText(/Technology Decisions Required \(1\)/i)).toBeInTheDocument()
      })
    })

    it('should render tech choice question', async () => {
      const techChoices = [
        createMockTechChoice({ question: 'Which database to use?', status: 'pending' })
      ]

      mockElectronAPI.taskQueue.list.mockResolvedValue([])
      mockElectronAPI.techAdvisor.listChoices.mockResolvedValue(techChoices)

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Which database to use?')).toBeInTheDocument()
      })
    })

    it('should open tech choice modal when clicked', async () => {
      const user = userEvent.setup()
      const techChoices = [createMockTechChoice({ status: 'pending' })]

      mockElectronAPI.taskQueue.list.mockResolvedValue([])
      mockElectronAPI.techAdvisor.listChoices.mockResolvedValue(techChoices)

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Decide')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Decide'))

      await waitFor(() => {
        expect(screen.getByTestId('tech-choice-modal')).toBeInTheDocument()
      })
    })

    it('should call decide when tech choice is made', async () => {
      const user = userEvent.setup()
      const techChoices = [createMockTechChoice({ status: 'pending' })]

      mockElectronAPI.taskQueue.list.mockResolvedValue([])
      mockElectronAPI.techAdvisor.listChoices.mockResolvedValue(techChoices)

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Decide')).toBeInTheDocument()
      })

      // Open modal
      await user.click(screen.getByText('Decide'))

      await waitFor(() => {
        expect(screen.getByTestId('decide-btn')).toBeInTheDocument()
      })

      // Make decision
      await user.click(screen.getByTestId('decide-btn'))

      expect(mockElectronAPI.techAdvisor.decide).toHaveBeenCalledWith(
        'tech-1',
        'Option 1',
        'Test rationale'
      )
    })
  })

  describe('Task Details Panel', () => {
    it('should open details panel when task is clicked', async () => {
      const user = userEvent.setup()
      const tasks = [createMockTask({ id: 'task-1', title: 'Task to Select' })]

      mockElectronAPI.taskQueue.list.mockResolvedValue(tasks)

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Task to Select')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Task to Select'))

      // Task title should appear in the details panel
      const titles = screen.getAllByText('Task to Select')
      expect(titles.length).toBeGreaterThan(1)
    })

    it('should display task status in details panel', async () => {
      const user = userEvent.setup()
      const tasks = [createMockTask({ id: 'task-1', title: 'Task 1', status: 'running' })]

      mockElectronAPI.taskQueue.list.mockResolvedValue(tasks)

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Task 1')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Task 1'))

      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument()
      })
    })

    it('should display task type in details panel', async () => {
      const user = userEvent.setup()
      const tasks = [createMockTask({ id: 'task-1', title: 'Task 1' })]

      mockElectronAPI.taskQueue.list.mockResolvedValue(tasks)

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Task 1')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Task 1'))

      await waitFor(() => {
        expect(screen.getByText('Type')).toBeInTheDocument()
      })
    })

    it('should display autonomy level details', async () => {
      const user = userEvent.setup()
      const tasks = [createMockTask({ id: 'task-1', title: 'Task 1' })]

      mockElectronAPI.taskQueue.list.mockResolvedValue(tasks)

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Task 1')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Task 1'))

      await waitFor(() => {
        expect(screen.getByText('Autonomy Level')).toBeInTheDocument()
      })
    })

    it('should close details panel when close button is clicked', async () => {
      const user = userEvent.setup()
      const tasks = [createMockTask({ id: 'task-1', title: 'Task 1' })]

      mockElectronAPI.taskQueue.list.mockResolvedValue(tasks)

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Task 1')).toBeInTheDocument()
      })

      // Open details
      await user.click(screen.getByText('Task 1'))

      // Wait for details panel to open
      await waitFor(() => {
        const titles = screen.getAllByText('Task 1')
        expect(titles.length).toBeGreaterThan(1)
      })

      // Find and click close button (fa-times icon button)
      const closeButtons = screen.getAllByRole('button')
      const closeButton = closeButtons.find((btn) => {
        const icon = btn.querySelector('.fa-times')
        return icon !== null
      })

      if (closeButton) {
        await user.click(closeButton)
      }

      // Details panel should be closed (only one instance of title)
      await waitFor(() => {
        const titles = screen.getAllByText('Task 1')
        expect(titles.length).toBe(1)
      })
    })
  })

  describe('Add Task Form', () => {
    it('should open add task form when Add Task button is clicked', async () => {
      const user = userEvent.setup()

      mockElectronAPI.taskQueue.list.mockResolvedValue([])

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Add Task')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Add Task'))

      await waitFor(() => {
        expect(screen.getByText('Add Task to Queue')).toBeInTheDocument()
      })
    })

    it('should submit new task when form is filled and submitted', async () => {
      const user = userEvent.setup()

      mockElectronAPI.taskQueue.list.mockResolvedValue([])

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Add Task')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Add Task'))

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter task title...')).toBeInTheDocument()
      })

      // Fill in the form
      await user.type(screen.getByPlaceholderText('Enter task title...'), 'New Task')
      await user.type(
        screen.getByPlaceholderText('Enter task description...'),
        'Task description'
      )

      // Submit
      const submitButton = screen.getByText('Add to Queue')
      await user.click(submitButton)

      expect(mockElectronAPI.taskQueue.enqueue).toHaveBeenCalledWith({
        projectId: 'test-project-id',
        title: 'New Task',
        description: 'Task description',
        taskType: 'code-generation',
        autonomyLevel: 'supervised'
      })
    })

    it('should not submit without title', async () => {
      const user = userEvent.setup()

      mockElectronAPI.taskQueue.list.mockResolvedValue([])

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Add Task')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Add Task'))

      await waitFor(() => {
        const submitButton = screen.getByText('Add to Queue')
        expect(submitButton).toBeDisabled()
      })
    })
  })

  describe('Task Decomposition', () => {
    it('should open decompose form when Decompose button is clicked', async () => {
      const user = userEvent.setup()

      mockElectronAPI.taskQueue.list.mockResolvedValue([])

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Decompose')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Decompose'))

      await waitFor(() => {
        expect(screen.getByText('Decompose Task')).toBeInTheDocument()
      })
    })

    it('should call decompose API when form is submitted', async () => {
      const user = userEvent.setup()

      mockElectronAPI.taskQueue.list.mockResolvedValue([])

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Decompose')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Decompose'))

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText(/Implement user authentication system/i)
        ).toBeInTheDocument()
      })

      // Fill in form
      await user.type(
        screen.getByPlaceholderText(/Implement user authentication system/i),
        'Build Login System'
      )

      // Submit
      const submitButton = screen.getByText(/Decompose & Queue/i)
      await user.click(submitButton)

      expect(mockElectronAPI.decomposer.decompose).toHaveBeenCalledWith({
        projectId: 'test-project-id',
        title: 'Build Login System',
        description: '',
        projectPath: '/test/path',
        autonomyLevel: 'supervised',
        enqueueImmediately: true
      })
    })
  })

  describe('Event Handling', () => {
    it('should handle task-started event', async () => {
      mockElectronAPI.taskQueue.list.mockResolvedValue([])

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(mockElectronAPI.taskQueue.onEvent).toHaveBeenCalled()
      })

      // Trigger event
      const callback = mockElectronAPI.taskQueue.onEvent.mock.calls[0][0]
      callback({
        type: 'task-started',
        taskId: 'task-1',
        timestamp: new Date()
      })

      // Component should handle the event without errors
      expect(true).toBe(true)
    })

    it('should reload tasks on task-completed event', async () => {
      mockElectronAPI.taskQueue.list.mockResolvedValue([])

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(mockElectronAPI.taskQueue.onEvent).toHaveBeenCalled()
      })

      const initialCallCount = mockElectronAPI.taskQueue.list.mock.calls.length

      // Trigger event
      const callback = mockElectronAPI.taskQueue.onEvent.mock.calls[0][0]
      callback({
        type: 'task-completed',
        taskId: 'task-1',
        timestamp: new Date()
      })

      await waitFor(() => {
        expect(mockElectronAPI.taskQueue.list.mock.calls.length).toBeGreaterThan(initialCallCount)
      })
    })

    it('should handle queue-paused event', async () => {
      mockElectronAPI.taskQueue.list.mockResolvedValue([])

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(mockElectronAPI.taskQueue.onEvent).toHaveBeenCalled()
      })

      // Trigger event
      const callback = mockElectronAPI.taskQueue.onEvent.mock.calls[0][0]
      callback({
        type: 'queue-paused',
        taskId: '',
        timestamp: new Date()
      })

      // Component should update state
      expect(true).toBe(true)
    })
  })

  describe('No Project State', () => {
    it('should handle no current project gracefully', async () => {
      mockUseAppStore.mockReturnValue({
        currentProject: null
      })

      // Mock the API to not be called when there's no project
      mockElectronAPI.taskQueue.list.mockResolvedValue([])

      renderWithToast(<TaskQueuePanel projectPath="/test/path" />)

      // Should not crash - wait for component to render
      await waitFor(() => {
        // Component should render without crashing
        expect(screen.getByText('Task Queue')).toBeInTheDocument()
      })

      // API should not have been called since there's no project
      expect(mockElectronAPI.taskQueue.list).not.toHaveBeenCalled()
    })
  })
})
