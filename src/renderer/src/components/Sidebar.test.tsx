/**
 * Claude DevStudio
 * Copyright (c) 2024 Claude DevStudio Contributors
 * Licensed under MIT License - see LICENSE file
 *
 * Sidebar component tests
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Sidebar } from './Sidebar'
import { useAppStore } from '../stores/appStore'
import type { Project, AgentType } from '@shared/types'
import type { ViewMode } from '../stores/appStore'

// Mock useAppStore
vi.mock('../stores/appStore', () => ({
  useAppStore: vi.fn()
}))

describe('Sidebar', () => {
  const mockSetCurrentProject = vi.fn()
  const mockAddProject = vi.fn()
  const mockRemoveProject = vi.fn()
  const mockSetCurrentAgentType = vi.fn()
  const mockClearMessages = vi.fn()
  const mockSetViewMode = vi.fn()

  const mockProject1: Project = {
    id: 'project-1',
    name: 'Test Project 1',
    path: '/path/to/project1',
    createdAt: new Date('2024-01-01'),
    lastOpenedAt: new Date('2024-01-02')
  }

  const mockProject2: Project = {
    id: 'project-2',
    name: 'Test Project 2',
    path: '/path/to/project2',
    createdAt: new Date('2024-01-03'),
    lastOpenedAt: new Date('2024-01-04')
  }

  const defaultStoreState = {
    projects: [],
    currentProject: null,
    setCurrentProject: mockSetCurrentProject,
    addProject: mockAddProject,
    removeProject: mockRemoveProject,
    currentAgentType: 'developer' as AgentType,
    setCurrentAgentType: mockSetCurrentAgentType,
    clearMessages: mockClearMessages,
    viewMode: 'dashboard' as ViewMode,
    setViewMode: mockSetViewMode
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(defaultStoreState)
  })

  describe('Projects section', () => {
    it('renders Projects section header', () => {
      render(<Sidebar />)
      expect(screen.getByText('Projects')).toBeInTheDocument()
    })

    it('shows "No projects yet" when projects list is empty', () => {
      render(<Sidebar />)
      expect(screen.getByText('No projects yet')).toBeInTheDocument()
    })

    it('renders project list when projects exist', () => {
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        projects: [mockProject1, mockProject2]
      })

      render(<Sidebar />)
      expect(screen.getByText('Test Project 1')).toBeInTheDocument()
      expect(screen.getByText('Test Project 2')).toBeInTheDocument()
    })

    it('highlights current project', () => {
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        projects: [mockProject1, mockProject2],
        currentProject: mockProject1
      })

      render(<Sidebar />)
      // Find the parent div that contains both the project name and delete button
      const projectElement = screen.getByText('Test Project 1').closest('div[class*="cursor-pointer"]')
      expect(projectElement).toHaveClass('bg-primary/20', 'text-primary')
    })

    it('calls setCurrentProject when clicking a project', async () => {
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        projects: [mockProject1, mockProject2]
      })

      window.electronAPI.projects.open = vi.fn().mockResolvedValue(undefined)

      render(<Sidebar />)
      await userEvent.click(screen.getByText('Test Project 1'))

      await waitFor(() => {
        expect(window.electronAPI.projects.open).toHaveBeenCalledWith('project-1')
        expect(mockSetCurrentProject).toHaveBeenCalledWith(mockProject1)
        expect(mockClearMessages).toHaveBeenCalled()
      })
    })

    it('renders add project button', () => {
      render(<Sidebar />)
      const addButton = screen.getByTitle('Add project')
      expect(addButton).toBeInTheDocument()
    })

    it('opens folder dialog when clicking add project button', async () => {
      window.electronAPI.projects.selectFolder = vi.fn().mockResolvedValue('/new/project')
      window.electronAPI.projects.create = vi.fn().mockResolvedValue({
        id: 'new-project',
        name: 'New Project',
        path: '/new/project',
        createdAt: new Date(),
        lastOpenedAt: new Date()
      })

      render(<Sidebar />)
      const addButton = screen.getByTitle('Add project')
      await userEvent.click(addButton)

      await waitFor(() => {
        expect(window.electronAPI.projects.selectFolder).toHaveBeenCalled()
        expect(window.electronAPI.projects.create).toHaveBeenCalledWith({ path: '/new/project' })
      })
    })

    it('does not add project if folder selection is cancelled', async () => {
      window.electronAPI.projects.selectFolder = vi.fn().mockResolvedValue(null)

      render(<Sidebar />)
      const addButton = screen.getByTitle('Add project')
      await userEvent.click(addButton)

      await waitFor(() => {
        expect(window.electronAPI.projects.selectFolder).toHaveBeenCalled()
        expect(window.electronAPI.projects.create).not.toHaveBeenCalled()
        expect(mockAddProject).not.toHaveBeenCalled()
      })
    })

    it('calls removeProject when clicking delete button', async () => {
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        projects: [mockProject1]
      })

      window.electronAPI.projects.delete = vi.fn().mockResolvedValue(undefined)

      render(<Sidebar />)
      const deleteButton = screen.getByTitle('Remove project')
      await userEvent.click(deleteButton)

      await waitFor(() => {
        expect(window.electronAPI.projects.delete).toHaveBeenCalledWith('project-1')
        expect(mockRemoveProject).toHaveBeenCalledWith('project-1')
      })
    })

    it('stops event propagation when clicking delete button', async () => {
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        projects: [mockProject1]
      })

      window.electronAPI.projects.delete = vi.fn().mockResolvedValue(undefined)

      render(<Sidebar />)
      const deleteButton = screen.getByTitle('Remove project')
      await userEvent.click(deleteButton)

      // Verify setCurrentProject is not called when clicking delete
      expect(mockSetCurrentProject).not.toHaveBeenCalled()
    })

    it('handles error when opening project fails', async () => {
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        projects: [mockProject1]
      })

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      window.electronAPI.projects.open = vi.fn().mockRejectedValue(new Error('Failed to open'))

      render(<Sidebar />)
      await userEvent.click(screen.getByText('Test Project 1'))

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Failed to open project:', expect.any(Error))
      })

      consoleError.mockRestore()
    })
  })

  describe('View Mode tabs', () => {
    it('renders all 8 view mode tabs', () => {
      render(<Sidebar />)
      expect(screen.getByText('Home')).toBeInTheDocument()
      expect(screen.getByText('Chat')).toBeInTheDocument()
      expect(screen.getByText('Roadmap')).toBeInTheDocument()
      expect(screen.getByText('Tasks')).toBeInTheDocument()
      expect(screen.getByText('Flows')).toBeInTheDocument()
      expect(screen.getByText('Stories')).toBeInTheDocument()
      expect(screen.getByText('Sprints')).toBeInTheDocument()
      expect(screen.getByText('Git')).toBeInTheDocument()
    })

    it('highlights current view mode tab', () => {
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        viewMode: 'chat' as ViewMode,
        currentProject: mockProject1
      })

      render(<Sidebar />)
      const chatTab = screen.getByText('Chat').closest('button')
      expect(chatTab).toHaveClass('bg-primary/20', 'text-primary')
    })

    it('calls setViewMode when clicking a view tab', async () => {
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        currentProject: mockProject1
      })

      render(<Sidebar />)
      await userEvent.click(screen.getByText('Chat'))

      expect(mockSetViewMode).toHaveBeenCalledWith('chat')
    })

    it('disables view tabs when no project is selected', () => {
      render(<Sidebar />)
      const chatTab = screen.getByText('Chat').closest('button')
      expect(chatTab).toBeDisabled()
    })

    it('enables view tabs when project is selected', () => {
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        currentProject: mockProject1
      })

      render(<Sidebar />)
      const chatTab = screen.getByText('Chat').closest('button')
      expect(chatTab).not.toBeDisabled()
    })
  })

  describe('AI Agents section', () => {
    it('shows AI Agents list when viewMode is chat', () => {
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        viewMode: 'chat' as ViewMode,
        currentProject: mockProject1
      })

      render(<Sidebar />)
      expect(screen.getByText('AI Agents')).toBeInTheDocument()
      expect(screen.getByText('Developer')).toBeInTheDocument()
      expect(screen.getByText('Product Owner')).toBeInTheDocument()
      expect(screen.getByText('Tester')).toBeInTheDocument()
      expect(screen.getByText('Security')).toBeInTheDocument()
      expect(screen.getByText('DevOps')).toBeInTheDocument()
      expect(screen.getByText('Docs')).toBeInTheDocument()
    })

    it('does not show AI Agents when viewMode is not chat', () => {
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        viewMode: 'dashboard' as ViewMode,
        currentProject: mockProject1
      })

      render(<Sidebar />)
      expect(screen.queryByText('AI Agents')).not.toBeInTheDocument()
    })

    it('highlights current agent', () => {
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        viewMode: 'chat' as ViewMode,
        currentProject: mockProject1,
        currentAgentType: 'tester' as AgentType
      })

      render(<Sidebar />)
      const testerButton = screen.getByText('Tester').closest('button')
      expect(testerButton).toHaveClass('bg-primary/20', 'text-primary')
    })

    it('calls setCurrentAgentType and clearMessages when clicking an agent', async () => {
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        viewMode: 'chat' as ViewMode,
        currentProject: mockProject1
      })

      render(<Sidebar />)
      await userEvent.click(screen.getByText('Tester'))

      expect(mockSetCurrentAgentType).toHaveBeenCalledWith('tester')
      expect(mockClearMessages).toHaveBeenCalled()
    })

    it('disables agent buttons when no project is selected', () => {
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        viewMode: 'chat' as ViewMode
      })

      render(<Sidebar />)
      const developerButton = screen.getByText('Developer').closest('button')
      expect(developerButton).toBeDisabled()
    })
  })

  describe('Workflow Templates section', () => {
    it('shows templates when viewMode is workflows', () => {
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        viewMode: 'workflows' as ViewMode,
        currentProject: mockProject1
      })

      render(<Sidebar />)
      expect(screen.getByText('Templates')).toBeInTheDocument()
      expect(screen.getByText('Story → Tests')).toBeInTheDocument()
      expect(screen.getByText('Story → Code')).toBeInTheDocument()
      expect(screen.getByText('Review + Security')).toBeInTheDocument()
      expect(screen.getByText('Full Pipeline')).toBeInTheDocument()
    })

    it('does not show templates when viewMode is not workflows', () => {
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        viewMode: 'dashboard' as ViewMode,
        currentProject: mockProject1
      })

      render(<Sidebar />)
      expect(screen.queryByText('Templates')).not.toBeInTheDocument()
    })
  })

  describe('Roadmap info section', () => {
    it('shows roadmap info when viewMode is roadmap', () => {
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        viewMode: 'roadmap' as ViewMode,
        currentProject: mockProject1
      })

      render(<Sidebar />)
      // Check for specific content instead of just 'Roadmap' which appears in multiple places
      expect(screen.getByText('Plan and track epics, features, and milestones.')).toBeInTheDocument()
      expect(screen.getByText('Now - In active development')).toBeInTheDocument()
      expect(screen.getByText('Next - Upcoming work')).toBeInTheDocument()
      expect(screen.getByText('Later - Future planning')).toBeInTheDocument()
    })

    it('does not show roadmap info when viewMode is not roadmap', () => {
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        viewMode: 'dashboard' as ViewMode,
        currentProject: mockProject1
      })

      render(<Sidebar />)
      const roadmapTexts = screen.queryByText('Plan and track epics, features, and milestones.')
      expect(roadmapTexts).not.toBeInTheDocument()
    })
  })

  describe('Task Queue info section', () => {
    it('shows task queue info when viewMode is task-queue', () => {
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        viewMode: 'task-queue' as ViewMode,
        currentProject: mockProject1
      })

      render(<Sidebar />)
      expect(screen.getByText('Task Queue')).toBeInTheDocument()
      expect(screen.getByText('Autonomous task execution with approval controls.')).toBeInTheDocument()
      expect(screen.getByText('Auto')).toBeInTheDocument()
      expect(screen.getByText('Run without stops')).toBeInTheDocument()
      expect(screen.getByText('Gates')).toBeInTheDocument()
      expect(screen.getByText('Pause at checkpoints')).toBeInTheDocument()
      expect(screen.getByText('Supervised')).toBeInTheDocument()
      expect(screen.getByText('Approve each step')).toBeInTheDocument()
    })

    it('does not show task queue info when viewMode is not task-queue', () => {
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        viewMode: 'dashboard' as ViewMode,
        currentProject: mockProject1
      })

      render(<Sidebar />)
      expect(screen.queryByText('Autonomous task execution with approval controls.')).not.toBeInTheDocument()
    })
  })

  describe('Dashboard info section', () => {
    it('shows dashboard info when viewMode is dashboard', () => {
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        viewMode: 'dashboard' as ViewMode,
        currentProject: mockProject1
      })

      render(<Sidebar />)
      expect(screen.getByText('Overview')).toBeInTheDocument()
      expect(screen.getByText('Project metrics, sprint progress, and statistics.')).toBeInTheDocument()
    })
  })

  describe('Stories info section', () => {
    it('shows stories info when viewMode is stories', () => {
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        viewMode: 'stories' as ViewMode,
        currentProject: mockProject1
      })

      render(<Sidebar />)
      // Check for specific content instead of just 'Stories' which appears in multiple places
      expect(screen.getByText('Create and manage user stories.')).toBeInTheDocument()
    })
  })

  describe('Sprints info section', () => {
    it('shows sprints info when viewMode is sprints', () => {
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        viewMode: 'sprints' as ViewMode,
        currentProject: mockProject1
      })

      render(<Sidebar />)
      // Check for specific content instead of just 'Sprints' which appears in multiple places
      expect(screen.getByText('Kanban board for sprint management.')).toBeInTheDocument()
    })
  })

  describe('Git info section', () => {
    it('shows git info when viewMode is git', () => {
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        viewMode: 'git' as ViewMode,
        currentProject: mockProject1
      })

      render(<Sidebar />)
      // Check for specific content instead of just 'Git' which appears in multiple places
      expect(screen.getByText('Repository status and commits.')).toBeInTheDocument()
    })
  })

  describe('Current project path', () => {
    it('shows current project path at bottom when project is selected', () => {
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        currentProject: mockProject1
      })

      render(<Sidebar />)
      expect(screen.getByText('/path/to/project1')).toBeInTheDocument()
    })

    it('does not show project path when no project is selected', () => {
      render(<Sidebar />)
      expect(screen.queryByText('/path/to/project1')).not.toBeInTheDocument()
    })

    it('has correct title attribute with full path', () => {
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        currentProject: mockProject1
      })

      render(<Sidebar />)
      const pathElement = screen.getByText('/path/to/project1')
      expect(pathElement).toHaveAttribute('title', '/path/to/project1')
    })
  })

  describe('Integration tests', () => {
    it('switches view mode and shows corresponding content', async () => {
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        currentProject: mockProject1,
        viewMode: 'dashboard' as ViewMode
      })

      const { rerender } = render(<Sidebar />)
      expect(screen.getByText('Overview')).toBeInTheDocument()

      // Simulate switching to chat view
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        currentProject: mockProject1,
        viewMode: 'chat' as ViewMode
      })

      rerender(<Sidebar />)
      expect(screen.getByText('AI Agents')).toBeInTheDocument()
      expect(screen.queryByText('Overview')).not.toBeInTheDocument()
    })

    it('handles complete project workflow: add, select, delete', async () => {
      // Start with no projects
      const { rerender } = render(<Sidebar />)
      expect(screen.getByText('No projects yet')).toBeInTheDocument()

      // Add a project
      window.electronAPI.projects.selectFolder = vi.fn().mockResolvedValue('/new/project')
      window.electronAPI.projects.create = vi.fn().mockResolvedValue(mockProject1)

      await userEvent.click(screen.getByTitle('Add project'))

      await waitFor(() => {
        expect(mockAddProject).toHaveBeenCalled()
        expect(mockSetCurrentProject).toHaveBeenCalled()
      })

      // Rerender with new project
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        projects: [mockProject1],
        currentProject: mockProject1
      })

      rerender(<Sidebar />)
      expect(screen.getByText('Test Project 1')).toBeInTheDocument()

      // Delete the project
      window.electronAPI.projects.delete = vi.fn().mockResolvedValue(undefined)
      await userEvent.click(screen.getByTitle('Remove project'))

      await waitFor(() => {
        expect(mockRemoveProject).toHaveBeenCalledWith('project-1')
      })
    })
  })
})
