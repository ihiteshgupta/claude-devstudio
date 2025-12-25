/**
 * Copyright (c) 2025 Claude DevStudio
 * Tests for RoadmapPanel component
 */

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { RoadmapPanel } from './RoadmapPanel'
import type { RoadmapItem, Project } from '@shared/types'

// Mock dependencies
vi.mock('../stores/appStore', () => ({
  useAppStore: vi.fn()
}))

vi.mock('./Toast', () => ({
  useToast: vi.fn()
}))

vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children, onDragEnd }: any) => {
    // Store onDragEnd for testing
    ;(global as any).__onDragEnd = onDragEnd
    return <div data-testid="drag-drop-context">{children}</div>
  },
  Droppable: ({ children, droppableId }: any) => {
    return children(
      {
        innerRef: vi.fn(),
        droppableProps: { 'data-droppable-id': droppableId }
      },
      { isDraggingOver: false }
    )
  },
  Draggable: ({ children, draggableId, index }: any) => {
    return children(
      {
        innerRef: vi.fn(),
        draggableProps: { 'data-draggable-id': draggableId },
        dragHandleProps: {}
      },
      { isDragging: false }
    )
  }
}))

// Import mocked modules
import { useAppStore } from '../stores/appStore'
import { useToast } from './Toast'

describe('RoadmapPanel', () => {
  const mockProject: Project = {
    id: 'project-1',
    name: 'Test Project',
    path: '/test/path',
    createdAt: new Date('2025-01-01'),
    lastOpenedAt: new Date('2025-01-15')
  }

  const mockRoadmapItems: RoadmapItem[] = [
    {
      id: 'item-1',
      projectId: 'project-1',
      title: 'Epic Feature',
      description: 'A large epic feature',
      type: 'epic',
      status: 'planned',
      priority: 'high',
      lane: 'now',
      targetQuarter: 'Q1-2025',
      storyPoints: 13,
      tags: ['frontend', 'backend'],
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-15')
    },
    {
      id: 'item-2',
      projectId: 'project-1',
      title: 'User Authentication',
      description: 'Implement user auth',
      type: 'feature',
      status: 'in-progress',
      priority: 'critical',
      lane: 'next',
      targetQuarter: 'Q1-2025',
      storyPoints: 8,
      createdAt: new Date('2025-01-02'),
      updatedAt: new Date('2025-01-16')
    },
    {
      id: 'item-3',
      projectId: 'project-1',
      title: 'Release v1.0',
      type: 'milestone',
      status: 'planned',
      priority: 'medium',
      lane: 'later',
      targetQuarter: 'Q2-2025',
      createdAt: new Date('2025-01-03'),
      updatedAt: new Date('2025-01-17')
    },
    {
      id: 'item-4',
      projectId: 'project-1',
      title: 'Fix Login Bug',
      type: 'task',
      status: 'completed',
      priority: 'low',
      lane: 'done',
      createdAt: new Date('2025-01-04'),
      updatedAt: new Date('2025-01-18')
    },
    {
      id: 'item-5',
      projectId: 'project-1',
      parentId: 'item-1',
      title: 'Child Task',
      type: 'task',
      status: 'planned',
      priority: 'medium',
      lane: 'now',
      createdAt: new Date('2025-01-05'),
      updatedAt: new Date('2025-01-19')
    }
  ]

  const mockToast = {
    toasts: [],
    addToast: vi.fn(),
    removeToast: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock console methods to suppress expected error messages in tests
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // Setup mocks
    ;(useAppStore as unknown as Mock).mockReturnValue({
      currentProject: mockProject
    })
    ;(useToast as Mock).mockReturnValue(mockToast)

    // Default successful API response
    window.electronAPI.roadmap.list.mockResolvedValue(mockRoadmapItems)
    window.electronAPI.roadmap.create.mockResolvedValue({ id: 'new-item' })
    window.electronAPI.roadmap.update.mockResolvedValue({})
    window.electronAPI.roadmap.delete.mockResolvedValue({})

    // Reset global drag handler
    ;(global as any).__onDragEnd = undefined
  })

  describe('Rendering', () => {
    it('should render the roadmap panel with header', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Roadmap')).toBeInTheDocument()
      })
    })

    it('should display item count in header', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('5 items')).toBeInTheDocument()
      })
    })

    it('should show loading state initially', () => {
      window.electronAPI.roadmap.list.mockReturnValue(new Promise(() => {}))
      render(<RoadmapPanel projectPath="/test/path" />)

      const spinner = document.querySelector('.fa-spinner')
      expect(spinner).toBeInTheDocument()
    })

    it('should load roadmap items on mount', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(window.electronAPI.roadmap.list).toHaveBeenCalledWith('project-1')
      })
    })

    it('should not load items if no current project', () => {
      ;(useAppStore as unknown as Mock).mockReturnValue({
        currentProject: null
      })

      render(<RoadmapPanel projectPath="/test/path" />)

      expect(window.electronAPI.roadmap.list).not.toHaveBeenCalled()
    })
  })

  describe('Kanban View', () => {
    it('should render all four lanes (Now, Next, Later, Done)', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Now')).toBeInTheDocument()
        expect(screen.getByText('Next')).toBeInTheDocument()
        expect(screen.getByText('Later')).toBeInTheDocument()
        expect(screen.getByText('Done')).toBeInTheDocument()
      })
    })

    it('should display correct item count for each lane', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        const nowLane = screen.getByText('Now').closest('div')
        const nextLane = screen.getByText('Next').closest('div')
        const laterLane = screen.getByText('Later').closest('div')
        const doneLane = screen.getByText('Done').closest('div')

        expect(within(nowLane!).getByText('1')).toBeInTheDocument() // Only parent items
        expect(within(nextLane!).getByText('1')).toBeInTheDocument()
        expect(within(laterLane!).getByText('1')).toBeInTheDocument()
        expect(within(doneLane!).getByText('1')).toBeInTheDocument()
      })
    })

    it('should render items in correct lanes', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Epic Feature')).toBeInTheDocument()
        expect(screen.getByText('User Authentication')).toBeInTheDocument()
        expect(screen.getByText('Release v1.0')).toBeInTheDocument()
        expect(screen.getByText('Fix Login Bug')).toBeInTheDocument()
      })
    })

    it('should not render child items in main lanes', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        const childTask = screen.queryByText('Child Task')
        if (childTask) {
          // Child should only be visible when parent is expanded
          expect(childTask.closest('.border-l')).toBeInTheDocument()
        }
      })
    })

    it('should show empty state for empty lanes', async () => {
      window.electronAPI.roadmap.list.mockResolvedValue([])
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        const emptyMessages = screen.getAllByText('Drop items here')
        expect(emptyMessages).toHaveLength(4) // One for each lane
      })
    })
  })

  describe('Item Cards', () => {
    it('should display item title', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Epic Feature')).toBeInTheDocument()
      })
    })

    it('should display item description', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('A large epic feature')).toBeInTheDocument()
      })
    })

    it('should display item type icon', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        const epicItem = screen.getByText('Epic Feature').closest('div')
        expect(epicItem?.querySelector('.fa-layer-group')).toBeInTheDocument()
      })
    })

    it('should display status label', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Epic Feature')).toBeInTheDocument()
      })

      // Use getAllByText for status labels that appear multiple times
      const plannedLabels = screen.getAllByText('Planned')
      expect(plannedLabels.length).toBeGreaterThan(0)

      expect(screen.getByText('In Progress')).toBeInTheDocument()
      expect(screen.getByText('Completed')).toBeInTheDocument()
    })

    it('should display target quarter', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getAllByText('Q1-2025')).toHaveLength(2)
        expect(screen.getByText('Q2-2025')).toBeInTheDocument()
      })
    })

    it('should display story points', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('13 pts')).toBeInTheDocument()
        expect(screen.getByText('8 pts')).toBeInTheDocument()
      })
    })

    it('should display priority indicator', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        const priorities = document.querySelectorAll('.rounded-full')
        expect(priorities.length).toBeGreaterThan(0)
      })
    })

    it('should apply type-specific colors', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        const epicCard = screen.getByText('Epic Feature').closest('[class*="text-purple-400"]')
        expect(epicCard).toBeInTheDocument()
      })
    })
  })

  describe('Item Selection and Detail Panel', () => {
    it('should show detail panel when item is clicked', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        const item = screen.getByText('Epic Feature')
        fireEvent.click(item)
      })

      await waitFor(() => {
        // Check for detail panel elements
        expect(screen.getByText('Type')).toBeInTheDocument()
        expect(screen.getByText('Status')).toBeInTheDocument()
        expect(screen.getByText('Priority')).toBeInTheDocument()
      })
    })

    it('should display full item details in detail panel', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('Epic Feature'))
      })

      await waitFor(() => {
        expect(screen.getByText('Target Quarter')).toBeInTheDocument()
        expect(screen.getByText('Story Points')).toBeInTheDocument()
        expect(screen.getByText('Tags')).toBeInTheDocument()
        expect(screen.getByText('frontend')).toBeInTheDocument()
        expect(screen.getByText('backend')).toBeInTheDocument()
      })
    })

    it('should close detail panel when close button is clicked', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('Epic Feature'))
      })

      const closeButtons = screen.getAllByRole('button')
      const closeButton = closeButtons.find(btn => btn.querySelector('.fa-times'))
      fireEvent.click(closeButton!)

      await waitFor(() => {
        expect(screen.queryByText('Target Quarter')).not.toBeInTheDocument()
      })
    })

    it('should show delete button in detail panel', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('Epic Feature'))
      })

      await waitFor(() => {
        expect(screen.getByText('Delete Item')).toBeInTheDocument()
      })
    })
  })

  describe('Child Items and Expansion', () => {
    it('should show expand button for items with children', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Epic Feature')).toBeInTheDocument()
      })

      const chevron = document.querySelector('.fa-chevron-right')
      expect(chevron).toBeInTheDocument()
    })

    it('should toggle child items when expand button is clicked', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Epic Feature')).toBeInTheDocument()
      })

      const expandButton = document.querySelector('.fa-chevron-right')?.closest('button')
      expect(expandButton).toBeInTheDocument()
      fireEvent.click(expandButton!)

      await waitFor(() => {
        expect(screen.getByText('Child Task')).toBeInTheDocument()
      })
    })

    it('should change chevron direction when expanded', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Epic Feature')).toBeInTheDocument()
      })

      const expandButton = document.querySelector('.fa-chevron-right')?.closest('button')
      fireEvent.click(expandButton!)

      await waitFor(() => {
        const chevronDown = document.querySelector('.fa-chevron-down')
        expect(chevronDown).toBeInTheDocument()
      })
    })

    it('should allow selecting child items', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Epic Feature')).toBeInTheDocument()
      })

      const expandButton = document.querySelector('.fa-chevron-right')?.closest('button')
      fireEvent.click(expandButton!)

      await waitFor(() => {
        expect(screen.getByText('Child Task')).toBeInTheDocument()
      })

      const childItem = screen.getByText('Child Task')
      fireEvent.click(childItem)

      await waitFor(() => {
        expect(screen.getByText('Type')).toBeInTheDocument()
      })
    })
  })

  describe('Create Item', () => {
    it('should show create form when Add Item button is clicked', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        const addButton = screen.getByText('Add Item')
        fireEvent.click(addButton)
      })

      await waitFor(() => {
        expect(screen.getByText('Add Roadmap Item')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('Enter title...')).toBeInTheDocument()
      })
    })

    it('should close create form when Cancel is clicked', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('Add Item'))
      })

      await waitFor(() => {
        const cancelButton = screen.getByText('Cancel')
        fireEvent.click(cancelButton)
      })

      await waitFor(() => {
        expect(screen.queryByText('Add Roadmap Item')).not.toBeInTheDocument()
      })
    })

    it('should disable Create button when title is empty', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('Add Item'))
      })

      await waitFor(() => {
        const createButton = screen.getAllByText('Create')[0]
        expect(createButton).toBeDisabled()
      })
    })

    it('should enable Create button when title is entered', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('Add Item'))
      })

      const titleInput = screen.getByPlaceholderText('Enter title...')
      fireEvent.change(titleInput, { target: { value: 'New Feature' } })

      await waitFor(() => {
        const createButton = screen.getAllByText('Create')[0]
        expect(createButton).not.toBeDisabled()
      })
    })

    it('should create item with all form fields', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('Add Item'))
      })

      const titleInput = screen.getByPlaceholderText('Enter title...')
      const descriptionInput = screen.getByPlaceholderText('Enter description...')
      const quarterInput = screen.getByPlaceholderText('e.g., Q1-2025')

      fireEvent.change(titleInput, { target: { value: 'New Feature' } })
      fireEvent.change(descriptionInput, { target: { value: 'Description here' } })
      fireEvent.change(quarterInput, { target: { value: 'Q2-2025' } })

      const createButton = screen.getAllByText('Create')[0]
      fireEvent.click(createButton)

      await waitFor(() => {
        expect(window.electronAPI.roadmap.create).toHaveBeenCalledWith({
          projectId: 'project-1',
          title: 'New Feature',
          description: 'Description here',
          type: 'feature',
          priority: 'medium',
          lane: 'next',
          targetQuarter: 'Q2-2025'
        })
      })
    })

    it('should show success toast after creating item', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('Add Item'))
      })

      const titleInput = screen.getByPlaceholderText('Enter title...')
      fireEvent.change(titleInput, { target: { value: 'New Feature' } })

      const createButton = screen.getAllByText('Create')[0]
      fireEvent.click(createButton)

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('Created', 'Roadmap item created')
      })
    })

    it('should reload items after successful creation', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(window.electronAPI.roadmap.list).toHaveBeenCalledTimes(1)
      })

      await waitFor(() => {
        fireEvent.click(screen.getByText('Add Item'))
      })

      const titleInput = screen.getByPlaceholderText('Enter title...')
      fireEvent.change(titleInput, { target: { value: 'New Feature' } })

      const createButton = screen.getAllByText('Create')[0]
      fireEvent.click(createButton)

      await waitFor(() => {
        expect(window.electronAPI.roadmap.list).toHaveBeenCalledTimes(2)
      })
    })

    it('should show error toast when creation fails', async () => {
      window.electronAPI.roadmap.create.mockRejectedValue(new Error('Failed'))
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('Add Item'))
      })

      const titleInput = screen.getByPlaceholderText('Enter title...')
      fireEvent.change(titleInput, { target: { value: 'New Feature' } })

      const createButton = screen.getAllByText('Create')[0]
      fireEvent.click(createButton)

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Create Failed', 'Could not create item')
      })
    })

    it('should reset form after successful creation', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('Add Item'))
      })

      const titleInput = screen.getByPlaceholderText('Enter title...') as HTMLInputElement
      fireEvent.change(titleInput, { target: { value: 'New Feature' } })

      const createButton = screen.getAllByText('Create')[0]
      fireEvent.click(createButton)

      await waitFor(() => {
        expect(screen.queryByText('Add Roadmap Item')).not.toBeInTheDocument()
      })
    })
  })

  describe('Delete Item', () => {
    it('should show delete button in detail panel', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('Epic Feature'))
      })

      await waitFor(() => {
        expect(screen.getByText('Delete Item')).toBeInTheDocument()
      })
    })

    it('should show confirmation dialog when delete is clicked', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('Epic Feature'))
      })

      const deleteButton = screen.getByText('Delete Item')
      fireEvent.click(deleteButton)

      expect(confirmSpy).toHaveBeenCalledWith('Delete this item?')
      confirmSpy.mockRestore()
    })

    it('should not delete if user cancels confirmation', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('Epic Feature'))
      })

      const deleteButton = screen.getByText('Delete Item')
      fireEvent.click(deleteButton)

      expect(window.electronAPI.roadmap.delete).not.toHaveBeenCalled()
      confirmSpy.mockRestore()
    })

    it('should delete item if user confirms', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('Epic Feature'))
      })

      const deleteButton = screen.getByText('Delete Item')
      fireEvent.click(deleteButton)

      await waitFor(() => {
        expect(window.electronAPI.roadmap.delete).toHaveBeenCalledWith('item-1')
      })
      confirmSpy.mockRestore()
    })

    it('should show success toast after deletion', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('Epic Feature'))
      })

      const deleteButton = screen.getByText('Delete Item')
      fireEvent.click(deleteButton)

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('Deleted', 'Item deleted')
      })
      confirmSpy.mockRestore()
    })

    it('should remove item from UI after deletion', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Epic Feature')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Epic Feature'))

      await waitFor(() => {
        const deleteButton = screen.getByText('Delete Item')
        fireEvent.click(deleteButton)
      })

      await waitFor(() => {
        expect(screen.queryByText('Epic Feature')).not.toBeInTheDocument()
      })
      confirmSpy.mockRestore()
    })

    it('should close detail panel after deleting selected item', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('Epic Feature'))
      })

      await waitFor(() => {
        expect(screen.getByText('Target Quarter')).toBeInTheDocument()
      })

      const deleteButton = screen.getByText('Delete Item')
      fireEvent.click(deleteButton)

      await waitFor(() => {
        expect(screen.queryByText('Target Quarter')).not.toBeInTheDocument()
      })
      confirmSpy.mockRestore()
    })

    it('should show error toast when deletion fails', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
      window.electronAPI.roadmap.delete.mockRejectedValue(new Error('Failed'))
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('Epic Feature'))
      })

      const deleteButton = screen.getByText('Delete Item')
      fireEvent.click(deleteButton)

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Delete Failed', 'Could not delete item')
      })
      confirmSpy.mockRestore()
    })
  })

  describe('Status Update', () => {
    it('should show status dropdown in detail panel', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('Epic Feature'))
      })

      await waitFor(() => {
        const statusDropdown = screen.getByRole('combobox')
        expect(statusDropdown).toBeInTheDocument()
      })
    })

    it('should update item status when dropdown changes', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('Epic Feature'))
      })

      const statusDropdown = screen.getByRole('combobox')
      fireEvent.change(statusDropdown, { target: { value: 'in-progress' } })

      await waitFor(() => {
        expect(window.electronAPI.roadmap.update).toHaveBeenCalledWith('item-1', {
          status: 'in-progress'
        })
      })
    })

    it('should update UI optimistically after status change', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Epic Feature')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Epic Feature'))

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument()
      })

      const statusDropdown = screen.getByRole('combobox')
      fireEvent.change(statusDropdown, { target: { value: 'completed' } })

      await waitFor(() => {
        expect(statusDropdown).toHaveValue('completed')
      })
    })

    it('should show error toast when status update fails', async () => {
      window.electronAPI.roadmap.update.mockRejectedValue(new Error('Failed'))
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('Epic Feature'))
      })

      const statusDropdown = screen.getByRole('combobox')
      fireEvent.change(statusDropdown, { target: { value: 'completed' } })

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Update Failed', 'Could not update status')
      })
    })
  })

  describe('Drag and Drop', () => {
    it('should render DragDropContext', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByTestId('drag-drop-context')).toBeInTheDocument()
      })
    })

    it('should move item to new lane on drag end', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Epic Feature')).toBeInTheDocument()
      })

      // Simulate drag and drop
      const dragEndHandler = (global as any).__onDragEnd
      await dragEndHandler({
        draggableId: 'item-1',
        destination: { droppableId: 'next', index: 0 }
      })

      await waitFor(() => {
        expect(window.electronAPI.roadmap.update).toHaveBeenCalledWith('item-1', {
          lane: 'next'
        })
      })
    })

    it('should show success toast after moving item', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Epic Feature')).toBeInTheDocument()
      })

      const dragEndHandler = (global as any).__onDragEnd
      await dragEndHandler({
        draggableId: 'item-1',
        destination: { droppableId: 'done', index: 0 }
      })

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('Moved', 'Item moved to Done')
      })
    })

    it('should not move item if no destination', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Epic Feature')).toBeInTheDocument()
      })

      const dragEndHandler = (global as any).__onDragEnd
      await dragEndHandler({
        draggableId: 'item-1',
        destination: null
      })

      expect(window.electronAPI.roadmap.update).not.toHaveBeenCalled()
    })

    it('should revert on move failure', async () => {
      window.electronAPI.roadmap.update.mockRejectedValue(new Error('Failed'))
      window.electronAPI.roadmap.list.mockResolvedValue(mockRoadmapItems)

      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('Epic Feature')).toBeInTheDocument()
      })

      const initialListCalls = window.electronAPI.roadmap.list.mock.calls.length

      const dragEndHandler = (global as any).__onDragEnd
      await dragEndHandler({
        draggableId: 'item-1',
        destination: { droppableId: 'done', index: 0 }
      })

      await waitFor(() => {
        expect(window.electronAPI.roadmap.list).toHaveBeenCalledTimes(initialListCalls + 1)
        expect(mockToast.error).toHaveBeenCalledWith('Move Failed', 'Could not move item')
      })
    })
  })

  describe('Timeline View', () => {
    it('should toggle to timeline view when Timeline button is clicked', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        const timelineButton = screen.getByText('Timeline')
        fireEvent.click(timelineButton)
      })

      await waitFor(() => {
        const timelineButton = screen.getByText('Timeline')
        expect(timelineButton).toHaveClass('bg-zinc-700')
      })
    })

    it('should display quarters in timeline view', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('Timeline'))
      })

      await waitFor(() => {
        expect(screen.getByText('Q1-2025')).toBeInTheDocument()
        expect(screen.getByText('Q2-2025')).toBeInTheDocument()
        expect(screen.getByText('Unscheduled')).toBeInTheDocument()
      })
    })

    it('should display item count for each quarter', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('Timeline'))
      })

      await waitFor(() => {
        expect(screen.getByText('2 items')).toBeInTheDocument() // Q1-2025
        const oneItemLabels = screen.getAllByText('1 items')
        expect(oneItemLabels.length).toBeGreaterThanOrEqual(2) // Q2-2025 and Unscheduled
      })
    })

    it('should display items in grid layout', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('Timeline'))
      })

      await waitFor(() => {
        const grids = document.querySelectorAll('.grid')
        expect(grids.length).toBeGreaterThan(0)
      })
    })

    it('should allow clicking items in timeline view', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('Timeline'))
      })

      await waitFor(() => {
        const items = screen.getAllByText('Epic Feature')
        fireEvent.click(items[0])
      })

      await waitFor(() => {
        expect(screen.getByText('Type')).toBeInTheDocument()
      })
    })

    it('should toggle back to kanban view', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('Timeline'))
      })

      await waitFor(() => {
        fireEvent.click(screen.getByText('Kanban'))
      })

      await waitFor(() => {
        const kanbanButton = screen.getByText('Kanban')
        expect(kanbanButton).toHaveClass('bg-zinc-700')
      })
    })
  })

  describe('Error Handling', () => {
    it('should show error toast when loading items fails', async () => {
      window.electronAPI.roadmap.list.mockRejectedValue(new Error('Load failed'))
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Load Failed', 'Could not load roadmap items')
      })
    })

    it('should handle empty items array', async () => {
      window.electronAPI.roadmap.list.mockResolvedValue([])
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        expect(screen.getByText('0 items')).toBeInTheDocument()
      })
    })
  })

  describe('Form Fields', () => {
    it('should have all type options in create form', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('Add Item'))
      })

      await waitFor(() => {
        const typeSelects = screen.getAllByRole('combobox')
        const typeSelect = typeSelects.find(select =>
          (select as HTMLSelectElement).querySelector('option[value="epic"]')
        )

        expect(typeSelect?.querySelector('option[value="epic"]')).toBeInTheDocument()
        expect(typeSelect?.querySelector('option[value="feature"]')).toBeInTheDocument()
        expect(typeSelect?.querySelector('option[value="milestone"]')).toBeInTheDocument()
        expect(typeSelect?.querySelector('option[value="task"]')).toBeInTheDocument()
      })
    })

    it('should have all priority options in create form', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('Add Item'))
      })

      await waitFor(() => {
        const prioritySelects = screen.getAllByRole('combobox')
        const prioritySelect = prioritySelects.find(select =>
          (select as HTMLSelectElement).querySelector('option[value="low"]')
        )

        expect(prioritySelect?.querySelector('option[value="low"]')).toBeInTheDocument()
        expect(prioritySelect?.querySelector('option[value="medium"]')).toBeInTheDocument()
        expect(prioritySelect?.querySelector('option[value="high"]')).toBeInTheDocument()
        expect(prioritySelect?.querySelector('option[value="critical"]')).toBeInTheDocument()
      })
    })

    it('should have all lane options in create form', async () => {
      render(<RoadmapPanel projectPath="/test/path" />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('Add Item'))
      })

      await waitFor(() => {
        const laneSelects = screen.getAllByRole('combobox')
        const laneSelect = laneSelects.find(select =>
          (select as HTMLSelectElement).querySelector('option[value="now"]')
        )

        expect(laneSelect?.querySelector('option[value="now"]')).toBeInTheDocument()
        expect(laneSelect?.querySelector('option[value="next"]')).toBeInTheDocument()
        expect(laneSelect?.querySelector('option[value="later"]')).toBeInTheDocument()
        expect(laneSelect?.querySelector('option[value="done"]')).toBeInTheDocument()
      })
    })
  })
})
