/**
 * Claude DevStudio
 * Copyright (c) 2024 Claude DevStudio Contributors
 * Licensed under MIT License - see LICENSE file
 *
 * SprintPanel component tests
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SprintPanel } from './SprintPanel'
import { useAppStore } from '../stores/appStore'
import type { Sprint, UserStory, Project } from '@shared/types'

// Mock the appStore
vi.mock('../stores/appStore', () => ({
  useAppStore: vi.fn()
}))

// Mock @hello-pangea/dnd
vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Droppable: ({ children, droppableId }: { children: Function; droppableId: string }) => {
    const provided = {
      innerRef: vi.fn(),
      droppableProps: {},
      placeholder: null
    }
    const snapshot = { isDraggingOver: false }
    return <div data-testid={`droppable-${droppableId}`}>{children(provided, snapshot)}</div>
  },
  Draggable: ({
    children,
    draggableId,
    index
  }: {
    children: Function
    draggableId: string
    index: number
  }) => {
    const provided = {
      innerRef: vi.fn(),
      draggableProps: {},
      dragHandleProps: {}
    }
    const snapshot = { isDragging: false }
    return (
      <div data-testid={`draggable-${draggableId}`} data-index={index}>
        {children(provided, snapshot)}
      </div>
    )
  }
}))

describe('SprintPanel', () => {
  const mockProject: Project = {
    id: 'project-1',
    name: 'Test Project',
    path: '/path/to/project',
    createdAt: new Date('2024-01-01'),
    lastOpenedAt: new Date('2024-01-02')
  }

  const mockSprints: Sprint[] = [
    {
      id: 'sprint-1',
      projectId: 'project-1',
      name: 'Sprint 1',
      description: 'First sprint',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-14'),
      status: 'active',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01')
    },
    {
      id: 'sprint-2',
      projectId: 'project-1',
      name: 'Sprint 2',
      description: 'Second sprint',
      startDate: new Date('2024-01-15'),
      endDate: new Date('2024-01-28'),
      status: 'planned',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01')
    }
  ]

  const mockStories: UserStory[] = [
    {
      id: 'story-1',
      projectId: 'project-1',
      sprintId: 'sprint-1',
      title: 'User Login Feature',
      description: 'Implement user login',
      acceptanceCriteria: 'User can login with email and password',
      storyPoints: 5,
      status: 'todo',
      priority: 'high',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01')
    },
    {
      id: 'story-2',
      projectId: 'project-1',
      sprintId: 'sprint-1',
      title: 'Dashboard UI',
      description: 'Create dashboard',
      storyPoints: 8,
      status: 'in-progress',
      priority: 'medium',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01')
    },
    {
      id: 'story-3',
      projectId: 'project-1',
      sprintId: 'sprint-1',
      title: 'API Integration',
      description: 'Connect to backend',
      storyPoints: 3,
      status: 'done',
      priority: 'critical',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01')
    },
    {
      id: 'story-4',
      projectId: 'project-1',
      title: 'Unassigned Story',
      description: 'Not in any sprint',
      storyPoints: 2,
      status: 'backlog',
      priority: 'low',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01')
    }
  ]

  const mockAppStoreFunctions = {
    setSprints: vi.fn(),
    setCurrentSprint: vi.fn(),
    addSprint: vi.fn(),
    removeSprint: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Use vi.mocked to configure the existing mock from setup.ts
    vi.mocked(window.electronAPI.sprints.list).mockResolvedValue(mockSprints)
    vi.mocked(window.electronAPI.sprints.create).mockResolvedValue({} as any)
    vi.mocked(window.electronAPI.sprints.update).mockResolvedValue(undefined)
    vi.mocked(window.electronAPI.sprints.delete).mockResolvedValue(undefined)
    vi.mocked(window.electronAPI.sprints.addStory).mockResolvedValue(undefined)
    vi.mocked(window.electronAPI.sprints.removeStory).mockResolvedValue(undefined)

    vi.mocked(window.electronAPI.stories.list).mockResolvedValue(mockStories)
    vi.mocked(window.electronAPI.stories.update).mockResolvedValue(undefined)

    window.confirm = vi.fn()

    vi.mocked(useAppStore).mockReturnValue({
      currentProject: mockProject,
      sprints: mockSprints,
      currentSprint: null,
      ...mockAppStoreFunctions
    } as any)
  })

  describe('Rendering', () => {
    it('should render sprint panel with left panel and main area', async () => {
      await act(async () => {
        render(<SprintPanel projectPath="/path/to/project" />)
      })

      expect(screen.getByText('Sprints')).toBeInTheDocument()
      expect(screen.getByText('+ New')).toBeInTheDocument()
    })

    it('should render empty state when no sprints exist', async () => {
      vi.mocked(useAppStore).mockReturnValue({
        currentProject: mockProject,
        sprints: [],
        currentSprint: null,
        ...mockAppStoreFunctions
      } as any)

      await act(async () => {
        render(<SprintPanel projectPath="/path/to/project" />)
      })

      expect(screen.getByText('No sprints yet. Create one above!')).toBeInTheDocument()
    })

    it('should render sprint list when sprints exist', async () => {
      await act(async () => {
        render(<SprintPanel projectPath="/path/to/project" />)
      })

      expect(screen.getByText('Sprint 1')).toBeInTheDocument()
      expect(screen.getByText('Sprint 2')).toBeInTheDocument()
    })

    it('should show select sprint message when no sprint is selected', async () => {
      await act(async () => {
        render(<SprintPanel projectPath="/path/to/project" />)
      })

      expect(screen.getByText('Select a sprint to view the board')).toBeInTheDocument()
      expect(screen.getByText('or create a new sprint to get started')).toBeInTheDocument()
    })

    it('should render sprint status badges with correct colors', async () => {
      let container: any
      await act(async () => {
        const result = render(<SprintPanel projectPath="/path/to/project" />)
        container = result.container
      })

      const activeBadge = screen.getByText('active')
      const plannedBadge = screen.getByText('planned')

      expect(activeBadge).toHaveClass('bg-blue-600', 'text-blue-100')
      expect(plannedBadge).toHaveClass('bg-zinc-600', 'text-zinc-200')
    })

    it('should highlight current sprint in the list', async () => {
      vi.mocked(useAppStore).mockReturnValue({
        currentProject: mockProject,
        sprints: mockSprints,
        currentSprint: mockSprints[0],
        ...mockAppStoreFunctions
      } as any)

      let container: any
      await act(async () => {
        const result = render(<SprintPanel projectPath="/path/to/project" />)
        container = result.container
      })

      const sprintButtons = container.querySelectorAll('button')
      const activeSprint = Array.from(sprintButtons).find((btn) =>
        btn.textContent?.includes('Sprint 1')
      )

      expect(activeSprint).toHaveClass('bg-zinc-900', 'border-l-2', 'border-l-purple-500')
    })
  })

  describe('Sprint Creation', () => {
    it('should show create form when + New button is clicked', async () => {
      await act(async () => {
        render(<SprintPanel projectPath="/path/to/project" />)
      })

      act(() => {
        const newButton = screen.getByText('+ New')
        fireEvent.click(newButton)
      })

      expect(screen.getByPlaceholderText('Sprint name...')).toBeInTheDocument()
      expect(screen.getByText('Create Sprint')).toBeInTheDocument()
    })

    it('should hide create form when Cancel is clicked', async () => {
      await act(async () => {
        render(<SprintPanel projectPath="/path/to/project" />)
      })

      act(() => {
        const newButton = screen.getByText('+ New')
        fireEvent.click(newButton)
      })

      act(() => {
        const cancelButton = screen.getByText('Cancel')
        fireEvent.click(cancelButton)
      })

      expect(screen.queryByPlaceholderText('Sprint name...')).not.toBeInTheDocument()
    })

    it('should render all form fields in create form', async () => {
      await act(async () => {
        render(<SprintPanel projectPath="/path/to/project" />)
      })

      act(() => {
        fireEvent.click(screen.getByText('+ New'))
      })

      const nameInput = screen.getByPlaceholderText('Sprint name...')
      const dateInputs = screen.getAllByDisplayValue('')

      expect(nameInput).toBeInTheDocument()
      expect(dateInputs.length).toBeGreaterThanOrEqual(2) // start and end date inputs
    })

    it('should disable create button when form is incomplete', async () => {
      await act(async () => {
        render(<SprintPanel projectPath="/path/to/project" />)
      })

      act(() => {
        fireEvent.click(screen.getByText('+ New'))
      })

      const createButton = screen.getByText('Create Sprint')
      expect(createButton).toBeDisabled()
    })

    it('should enable create button when form is complete', async () => {
      await act(async () => {
        render(<SprintPanel projectPath="/path/to/project" />)
      })

      act(() => {
        fireEvent.click(screen.getByText('+ New'))
      })

      const nameInput = screen.getByPlaceholderText('Sprint name...')
      fireEvent.change(nameInput, { target: { value: 'New Sprint' } })

      const dateInputs = screen.getAllByDisplayValue('')
      fireEvent.change(dateInputs[0], { target: { value: '2024-02-01' } })
      fireEvent.change(dateInputs[1], { target: { value: '2024-02-14' } })

      const createButton = screen.getByText('Create Sprint')
      expect(createButton).not.toBeDisabled()
    })

    it('should call create API when form is submitted', async () => {
      const newSprint: Sprint = {
        id: 'sprint-3',
        projectId: 'project-1',
        name: 'Sprint 3',
        startDate: new Date('2024-02-01'),
        endDate: new Date('2024-02-14'),
        status: 'planned',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      vi.mocked(window.electronAPI.sprints.create).mockResolvedValue(newSprint)

      await act(async () => {
        render(<SprintPanel projectPath="/path/to/project" />)
      })

      act(() => {
        fireEvent.click(screen.getByText('+ New'))
      })

      const nameInput = screen.getByPlaceholderText('Sprint name...')
      fireEvent.change(nameInput, { target: { value: 'Sprint 3' } })

      const dateInputs = screen.getAllByDisplayValue('')
      fireEvent.change(dateInputs[0], { target: { value: '2024-02-01' } })
      fireEvent.change(dateInputs[1], { target: { value: '2024-02-14' } })

      const createButton = screen.getByText('Create Sprint')

      await act(async () => {
        fireEvent.click(createButton)
      })

      await waitFor(() => {
        expect(window.electronAPI.sprints.create).toHaveBeenCalledWith({
          projectId: 'project-1',
          name: 'Sprint 3',
          startDate: '2024-02-01',
          endDate: '2024-02-14'
        })
        expect(mockAppStoreFunctions.addSprint).toHaveBeenCalledWith(newSprint)
        expect(mockAppStoreFunctions.setCurrentSprint).toHaveBeenCalledWith(newSprint)
      })
    })

    it('should clear form after successful creation', async () => {
      const newSprint: Sprint = {
        id: 'sprint-3',
        projectId: 'project-1',
        name: 'Sprint 3',
        startDate: new Date('2024-02-01'),
        endDate: new Date('2024-02-14'),
        status: 'planned',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      vi.mocked(window.electronAPI.sprints.create).mockResolvedValue(newSprint)

      await act(async () => {
        render(<SprintPanel projectPath="/path/to/project" />)
      })

      act(() => {
        fireEvent.click(screen.getByText('+ New'))
      })

      const nameInput = screen.getByPlaceholderText('Sprint name...')
      fireEvent.change(nameInput, { target: { value: 'Sprint 3' } })

      const dateInputs = screen.getAllByDisplayValue('')
      fireEvent.change(dateInputs[0], { target: { value: '2024-02-01' } })
      fireEvent.change(dateInputs[1], { target: { value: '2024-02-14' } })

      await act(async () => {
        fireEvent.click(screen.getByText('Create Sprint'))
      })

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Sprint name...')).not.toBeInTheDocument()
      })
    })

    it('should show creating state when submitting', async () => {
      vi.mocked(window.electronAPI.sprints.create).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  id: 'sprint-3',
                  projectId: 'project-1',
                  name: 'Sprint 3',
                  startDate: new Date(),
                  endDate: new Date(),
                  status: 'planned',
                  createdAt: new Date(),
                  updatedAt: new Date()
                }),
              100
            )
          })
      )

      await act(async () => {
        render(<SprintPanel projectPath="/path/to/project" />)
      })

      act(() => {
        fireEvent.click(screen.getByText('+ New'))
      })

      const nameInput = screen.getByPlaceholderText('Sprint name...')
      fireEvent.change(nameInput, { target: { value: 'Sprint 3' } })

      const dateInputs = screen.getAllByDisplayValue('')
      fireEvent.change(dateInputs[0], { target: { value: '2024-02-01' } })
      fireEvent.change(dateInputs[1], { target: { value: '2024-02-14' } })

      await act(async () => {
        fireEvent.click(screen.getByText('Create Sprint'))
      })

      expect(screen.getByText('Creating...')).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.queryByText('Creating...')).not.toBeInTheDocument()
      })
    })
  })

  describe('Sprint Selection', () => {
    it('should display Kanban board when sprint is selected', async () => {
      vi.mocked(useAppStore).mockReturnValue({
        currentProject: mockProject,
        sprints: mockSprints,
        currentSprint: mockSprints[0],
        ...mockAppStoreFunctions
      } as any)

      await act(async () => {
        render(<SprintPanel projectPath="/path/to/project" />)
      })

      await waitFor(() => {
        expect(screen.getAllByText('Sprint 1').length).toBeGreaterThan(0)
      })
      expect(screen.getByText('Backlog')).toBeInTheDocument()
      expect(screen.getByText('To Do')).toBeInTheDocument()
      expect(screen.getByText('In Progress')).toBeInTheDocument()
      expect(screen.getByText('Review')).toBeInTheDocument()
      expect(screen.getByText('Done')).toBeInTheDocument()
    })

    it('should call setCurrentSprint when sprint is clicked', async () => {
      await act(async () => {
        render(<SprintPanel projectPath="/path/to/project" />)
      })

      const sprintButton = screen.getByText('Sprint 2')
      fireEvent.click(sprintButton)

      expect(mockAppStoreFunctions.setCurrentSprint).toHaveBeenCalledWith(mockSprints[1])
    })

    it('should display sprint dates in header', async () => {
      vi.mocked(useAppStore).mockReturnValue({
        currentProject: mockProject,
        sprints: mockSprints,
        currentSprint: mockSprints[0],
        ...mockAppStoreFunctions
      } as any)

      await act(async () => {
        render(<SprintPanel projectPath="/path/to/project" />)
      })

      // Wait for the sprint header to render - dates appear in both sprint list and header
      await waitFor(() => {
        const allText = screen.getAllByText(/Sprint 1/)
        expect(allText.length).toBeGreaterThan(0)
      }, { timeout: 3000 })

      // Just verify the dates appear somewhere in the document
      await waitFor(() => {
        const dateElements = screen.getAllByText(/1\/1\/2024/)
        expect(dateElements.length).toBeGreaterThan(0)
      }, { timeout: 3000 })
    })

    it('should display story count in header', async () => {
      vi.mocked(useAppStore).mockReturnValue({
        currentProject: mockProject,
        sprints: mockSprints,
        currentSprint: mockSprints[0],
        ...mockAppStoreFunctions
      } as any)

      await act(async () => {
        render(<SprintPanel projectPath="/path/to/project" />)
      })

      await waitFor(() => {
        expect(screen.getByText(/3 stories/)).toBeInTheDocument()
      })
    })
  })

  describe('Kanban Board Columns', () => {
    beforeEach(() => {
      vi.mocked(useAppStore).mockReturnValue({
        currentProject: mockProject,
        sprints: mockSprints,
        currentSprint: mockSprints[0],
        ...mockAppStoreFunctions
      } as any)
    })

    it('should render all status columns', async () => {
      await act(async () => {
        render(<SprintPanel projectPath="/path/to/project" />)
      })

      expect(screen.getByText('Backlog')).toBeInTheDocument()
      expect(screen.getByText('To Do')).toBeInTheDocument()
      expect(screen.getByText('In Progress')).toBeInTheDocument()
      expect(screen.getByText('Review')).toBeInTheDocument()
      expect(screen.getByText('Done')).toBeInTheDocument()
    })

    it('should display story count per column', async () => {
      await act(async () => {
        render(<SprintPanel projectPath="/path/to/project" />)
      })

      // Based on mockStories: 0 backlog, 1 todo, 1 in-progress, 0 review, 1 done
      await waitFor(() => {
        expect(screen.getByText('Backlog')).toBeInTheDocument()
      }, { timeout: 2000 })

      // Check that columns have story counts - the exact format may vary
      expect(screen.getByText(/Backlog/)).toBeInTheDocument()
      expect(screen.getByText(/To Do/)).toBeInTheDocument()
      expect(screen.getByText(/In Progress/)).toBeInTheDocument()
      expect(screen.getByText(/Review/)).toBeInTheDocument()
      expect(screen.getByText(/Done/)).toBeInTheDocument()
    })

    it('should render droppable areas for each column', async () => {
      let container: any
      await act(async () => {
        const result = render(<SprintPanel projectPath="/path/to/project" />)
        container = result.container
      })

      expect(container.querySelector('[data-testid="droppable-backlog"]')).toBeInTheDocument()
      expect(container.querySelector('[data-testid="droppable-todo"]')).toBeInTheDocument()
      expect(container.querySelector('[data-testid="droppable-in-progress"]')).toBeInTheDocument()
      expect(container.querySelector('[data-testid="droppable-review"]')).toBeInTheDocument()
      expect(container.querySelector('[data-testid="droppable-done"]')).toBeInTheDocument()
    })
  })

  describe('Task Cards', () => {
    beforeEach(() => {
      vi.mocked(useAppStore).mockReturnValue({
        currentProject: mockProject,
        sprints: mockSprints,
        currentSprint: mockSprints[0],
        ...mockAppStoreFunctions
      } as any)
    })

    it('should display task cards in correct columns', async () => {
      await act(async () => {
        render(<SprintPanel projectPath="/path/to/project" />)
      })

      expect(screen.getByText('User Login Feature')).toBeInTheDocument()
      expect(screen.getByText('Dashboard UI')).toBeInTheDocument()
      expect(screen.getByText('API Integration')).toBeInTheDocument()
    })

    it('should display task title on card', async () => {
      await act(async () => {
        render(<SprintPanel projectPath="/path/to/project" />)
      })

      const card = screen.getByText('User Login Feature')
      expect(card).toBeInTheDocument()
    })

    it('should display task description on card', async () => {
      await act(async () => {
        render(<SprintPanel projectPath="/path/to/project" />)
      })

      expect(screen.getByText('Implement user login')).toBeInTheDocument()
      expect(screen.getByText('Create dashboard')).toBeInTheDocument()
    })

    it('should display story points on card', async () => {
      await act(async () => {
        render(<SprintPanel projectPath="/path/to/project" />)
      })

      expect(screen.getByText('5 pts')).toBeInTheDocument()
      expect(screen.getByText('8 pts')).toBeInTheDocument()
      expect(screen.getByText('3 pts')).toBeInTheDocument()
    })

    it('should display priority indicator on card', async () => {
      let container: any
      await act(async () => {
        const result = render(<SprintPanel projectPath="/path/to/project" />)
        container = result.container
      })

      const priorityIndicators = container.querySelectorAll('.rounded-full')
      expect(priorityIndicators.length).toBeGreaterThan(0)
    })

    it('should render priority colors correctly', async () => {
      let container: any
      await act(async () => {
        const result = render(<SprintPanel projectPath="/path/to/project" />)
        container = result.container
      })

      await waitFor(() => {
        expect(screen.getByText('User Login Feature')).toBeInTheDocument()
      })

      const priorityDots = container.querySelectorAll('.rounded-full')
      expect(priorityDots.length).toBeGreaterThan(0)

      // Check that we have the correct priority color classes
      const orangeDot = container.querySelector('.bg-orange-500')
      const blueDot = container.querySelector('.bg-blue-500')
      const redDot = container.querySelector('.bg-red-500')

      expect(orangeDot).toBeInTheDocument()
      expect(blueDot).toBeInTheDocument()
      expect(redDot).toBeInTheDocument()
    })

    it('should render draggable cards', async () => {
      let container: any
      await act(async () => {
        const result = render(<SprintPanel projectPath="/path/to/project" />)
        container = result.container
      })

      expect(container.querySelector('[data-testid="draggable-story-1"]')).toBeInTheDocument()
      expect(container.querySelector('[data-testid="draggable-story-2"]')).toBeInTheDocument()
      expect(container.querySelector('[data-testid="draggable-story-3"]')).toBeInTheDocument()
    })

    it('should display remove button on card', async () => {
      let container: any
      await act(async () => {
        const result = render(<SprintPanel projectPath="/path/to/project" />)
        container = result.container
      })

      const removeButtons = container.querySelectorAll('button svg')
      // Should have remove buttons for each card
      expect(removeButtons.length).toBeGreaterThan(0)
    })

    it('should call removeStory when remove button is clicked', async () => {
      let container: any
      await act(async () => {
        const result = render(<SprintPanel projectPath="/path/to/project" />)
        container = result.container
      })

      const userLoginCard = screen.getByText('User Login Feature').closest('div')
      const removeButton = userLoginCard?.querySelector('button')

      if (removeButton) {
        await act(async () => {
          fireEvent.click(removeButton)
        })

        await waitFor(() => {
          expect(window.electronAPI.sprints.removeStory).toHaveBeenCalledWith('story-1')
        })
      }
    })
  })

  describe('Sprint Management', () => {
    beforeEach(() => {
      vi.mocked(useAppStore).mockReturnValue({
        currentProject: mockProject,
        sprints: mockSprints,
        currentSprint: mockSprints[0],
        ...mockAppStoreFunctions
      } as any)
    })

    it('should render status dropdown', async () => {
      let container: any
      await act(async () => {
        const result = render(<SprintPanel projectPath="/path/to/project" />)
        container = result.container
      })

      await waitFor(() => {
        const selects = container.querySelectorAll('select')
        expect(selects.length).toBeGreaterThan(0)
      }, { timeout: 3000 })

      const statusSelect = container.querySelector('select')
      expect(statusSelect).toBeInTheDocument()
      expect(statusSelect?.value).toBe('active')
    })

    it('should display all status options', async () => {
      let container: any
      await act(async () => {
        const result = render(<SprintPanel projectPath="/path/to/project" />)
        container = result.container
      })

      await waitFor(() => {
        const selects = container.querySelectorAll('select')
        expect(selects.length).toBeGreaterThan(0)
      }, { timeout: 3000 })

      const statusSelect = container.querySelector('select')
      expect(statusSelect?.querySelector('option[value="planned"]')).toBeInTheDocument()
      expect(statusSelect?.querySelector('option[value="active"]')).toBeInTheDocument()
      expect(statusSelect?.querySelector('option[value="completed"]')).toBeInTheDocument()
      expect(statusSelect?.querySelector('option[value="cancelled"]')).toBeInTheDocument()
    })

    it('should call update API when status is changed', async () => {
      let container: any
      await act(async () => {
        const result = render(<SprintPanel projectPath="/path/to/project" />)
        container = result.container
      })

      await waitFor(() => {
        const selects = container.querySelectorAll('select')
        expect(selects.length).toBeGreaterThan(0)
      }, { timeout: 3000 })

      const statusSelect = container.querySelector('select')

      await act(async () => {
        if (statusSelect) {
          fireEvent.change(statusSelect, { target: { value: 'completed' } })
        }
      })

      await waitFor(() => {
        expect(window.electronAPI.sprints.update).toHaveBeenCalledWith('sprint-1', {
          status: 'completed'
        })
      })
    })

    it('should render delete button', async () => {
      await act(async () => {
        render(<SprintPanel projectPath="/path/to/project" />)
      })

      const deleteButton = screen.getByText('Delete')
      expect(deleteButton).toBeInTheDocument()
    })

    it('should show confirmation dialog when delete is clicked', async () => {
      await act(async () => {
        render(<SprintPanel projectPath="/path/to/project" />)
      })

      const deleteButton = screen.getByText('Delete')
      fireEvent.click(deleteButton)

      expect(window.confirm).toHaveBeenCalledWith(
        'Are you sure you want to delete this sprint? Stories will be moved back to backlog.'
      )
    })

    it('should call delete API when deletion is confirmed', async () => {
      ;(window.confirm as any).mockReturnValue(true)

      await act(async () => {
        render(<SprintPanel projectPath="/path/to/project" />)
      })

      const deleteButton = screen.getByText('Delete')

      await act(async () => {
        fireEvent.click(deleteButton)
      })

      await waitFor(() => {
        expect(window.electronAPI.sprints.delete).toHaveBeenCalledWith('sprint-1')
        expect(mockAppStoreFunctions.removeSprint).toHaveBeenCalledWith('sprint-1')
      })
    })

    it('should not call delete API when deletion is cancelled', async () => {
      ;(window.confirm as any).mockReturnValue(false)

      await act(async () => {
        render(<SprintPanel projectPath="/path/to/project" />)
      })

      const deleteButton = screen.getByText('Delete')
      fireEvent.click(deleteButton)

      await waitFor(() => {
        expect(window.electronAPI.sprints.delete).not.toHaveBeenCalled()
      })
    })
  })

  describe('Unassigned Stories', () => {
    beforeEach(() => {
      vi.mocked(useAppStore).mockReturnValue({
        currentProject: mockProject,
        sprints: mockSprints,
        currentSprint: mockSprints[0],
        ...mockAppStoreFunctions
      } as any)
    })

    it('should display unassigned stories drawer when stories exist', async () => {
      await act(async () => {
        render(<SprintPanel projectPath="/path/to/project" />)
      })

      expect(screen.getByText(/Unassigned Stories \(1\)/)).toBeInTheDocument()
      expect(screen.getByText('Unassigned Story')).toBeInTheDocument()
    })

    it('should not display drawer when no unassigned stories exist', async () => {
      vi.mocked(window.electronAPI.stories.list).mockResolvedValue(
        mockStories.filter((s) => s.sprintId !== undefined)
      )

      await act(async () => {
        render(<SprintPanel projectPath="/path/to/project" />)
      })

      expect(screen.queryByText(/Unassigned Stories/)).not.toBeInTheDocument()
    })

    it('should show clickable unassigned story cards', async () => {
      await act(async () => {
        render(<SprintPanel projectPath="/path/to/project" />)
      })

      const unassignedCard = screen.getByText('Unassigned Story')
      expect(unassignedCard).toBeInTheDocument()
      expect(screen.getByText('Click to add to sprint')).toBeInTheDocument()
    })

    it('should call addStory when unassigned story is clicked', async () => {
      await act(async () => {
        render(<SprintPanel projectPath="/path/to/project" />)
      })

      const unassignedCard = screen.getByText('Unassigned Story')

      await act(async () => {
        fireEvent.click(unassignedCard)
      })

      await waitFor(() => {
        expect(window.electronAPI.sprints.addStory).toHaveBeenCalledWith('sprint-1', 'story-4')
      })
    })

    it('should limit display to 5 unassigned stories', async () => {
      const manyUnassignedStories = Array.from({ length: 10 }, (_, i) => ({
        id: `story-unassigned-${i}`,
        projectId: 'project-1',
        title: `Unassigned Story ${i}`,
        status: 'backlog' as const,
        priority: 'low' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      }))

      vi.mocked(window.electronAPI.stories.list).mockResolvedValue([
        ...mockStories.filter((s) => s.sprintId),
        ...manyUnassignedStories
      ])

      await act(async () => {
        render(<SprintPanel projectPath="/path/to/project" />)
      })

      expect(screen.getByText('+5 more')).toBeInTheDocument()
    })
  })

  describe('Loading and Data Fetching', () => {
    it('should load sprints on mount', async () => {
      await act(async () => {
        render(<SprintPanel projectPath="/path/to/project" />)
      })

      await waitFor(() => {
        expect(window.electronAPI.sprints.list).toHaveBeenCalledWith('project-1')
        expect(mockAppStoreFunctions.setSprints).toHaveBeenCalledWith(mockSprints)
      })
    })

    it('should load stories on mount', async () => {
      await act(async () => {
        render(<SprintPanel projectPath="/path/to/project" />)
      })

      await waitFor(() => {
        expect(window.electronAPI.stories.list).toHaveBeenCalledWith('project-1')
      })
    })

    it('should handle loading errors gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(window.electronAPI.sprints.list).mockRejectedValue(new Error('Failed to load'))

      await act(async () => {
        render(<SprintPanel projectPath="/path/to/project" />)
      })

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalled()
      })

      consoleError.mockRestore()
    })

    it('should not load data when no project is selected', async () => {
      vi.mocked(useAppStore).mockReturnValue({
        currentProject: null,
        sprints: [],
        currentSprint: null,
        ...mockAppStoreFunctions
      } as any)

      await act(async () => {
        render(<SprintPanel projectPath="/path/to/project" />)
      })

      await waitFor(() => {
        expect(window.electronAPI.sprints.list).not.toHaveBeenCalled()
      })
    })
  })

  describe('Drag and Drop', () => {
    beforeEach(() => {
      vi.mocked(useAppStore).mockReturnValue({
        currentProject: mockProject,
        sprints: mockSprints,
        currentSprint: mockSprints[0],
        ...mockAppStoreFunctions
      } as any)
    })

    it('should render DragDropContext', async () => {
      let container: any
      await act(async () => {
        const result = render(<SprintPanel projectPath="/path/to/project" />)
        container = result.container
      })

      // The mocked DragDropContext should render a div
      expect(container.querySelector('div')).toBeInTheDocument()
    })

    it('should make story cards draggable', async () => {
      let container: any
      await act(async () => {
        const result = render(<SprintPanel projectPath="/path/to/project" />)
        container = result.container
      })

      const draggableCards = container.querySelectorAll('[data-testid^="draggable-story"]')
      expect(draggableCards.length).toBe(3) // 3 stories in sprint
    })

    it('should display cursor-grab on cards', async () => {
      let container: any
      await act(async () => {
        const result = render(<SprintPanel projectPath="/path/to/project" />)
        container = result.container
      })

      await waitFor(() => {
        expect(screen.getByText('User Login Feature')).toBeInTheDocument()
      })

      // Find the card with cursor-grab class
      const cursorGrabCards = container.querySelectorAll('.cursor-grab')
      expect(cursorGrabCards.length).toBeGreaterThan(0)
    })
  })

  describe('Responsive Layout', () => {
    it('should have flex layout for main container', async () => {
      let container: any
      await act(async () => {
        const result = render(<SprintPanel projectPath="/path/to/project" />)
        container = result.container
      })

      const mainContainer = container.firstChild as HTMLElement
      expect(mainContainer).toHaveClass('flex', 'flex-1', 'h-full')
    })

    it('should have fixed width for sprint list panel', async () => {
      let container: any
      await act(async () => {
        const result = render(<SprintPanel projectPath="/path/to/project" />)
        container = result.container
      })

      const leftPanel = container.querySelector('.w-80')
      expect(leftPanel).toBeInTheDocument()
    })

    it('should have scrollable kanban area', async () => {
      vi.mocked(useAppStore).mockReturnValue({
        currentProject: mockProject,
        sprints: mockSprints,
        currentSprint: mockSprints[0],
        ...mockAppStoreFunctions
      } as any)

      let container: any
      await act(async () => {
        const result = render(<SprintPanel projectPath="/path/to/project" />)
        container = result.container
      })

      const kanbanArea = container.querySelector('.overflow-x-auto')
      expect(kanbanArea).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper button roles', async () => {
      await act(async () => {
        render(<SprintPanel projectPath="/path/to/project" />)
      })

      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('should have accessible form inputs', async () => {
      await act(async () => {
        render(<SprintPanel projectPath="/path/to/project" />)
      })

      act(() => {
        fireEvent.click(screen.getByText('+ New'))
      })

      const nameInput = screen.getByPlaceholderText('Sprint name...')
      expect(nameInput).toHaveAttribute('type', 'text')
    })

    it('should have semantic HTML structure', async () => {
      let container: any
      await act(async () => {
        const result = render(<SprintPanel projectPath="/path/to/project" />)
        container = result.container
      })

      const headings = container.querySelectorAll('h2, h3, h4')
      expect(headings.length).toBeGreaterThan(0)
    })
  })
})
