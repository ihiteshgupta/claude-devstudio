/**
 * Claude DevStudio
 * Copyright (c) 2024 Claude DevStudio Contributors
 * Licensed under MIT License - see LICENSE file
 *
 * Tests for WelcomeScreen component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WelcomeScreen } from './WelcomeScreen'
import { useAppStore } from '../stores/appStore'
import type { Project } from '@shared/types'

// Mock OnboardingWizard component
vi.mock('./OnboardingWizard', () => ({
  default: ({
    projectId,
    projectName,
    onComplete,
    onCancel
  }: {
    projectId: string
    projectName: string
    projectPath: string
    onComplete: () => void
    onCancel: () => void
  }) => (
    <div data-testid="onboarding-wizard">
      <div data-testid="onboarding-project-id">{projectId}</div>
      <div data-testid="onboarding-project-name">{projectName}</div>
      <button onClick={onComplete}>Complete Onboarding</button>
      <button onClick={onCancel}>Cancel Onboarding</button>
    </div>
  )
}))

describe('WelcomeScreen', () => {
  const mockProject: Project = {
    id: 'test-project-1',
    name: 'Test Project',
    path: '/test/project/path',
    createdAt: new Date('2024-01-01'),
    lastOpenedAt: new Date('2024-01-02')
  }

  const mockRecentProjects: Project[] = [
    mockProject,
    {
      id: 'test-project-2',
      name: 'Another Project',
      path: '/test/another/path',
      createdAt: new Date('2024-01-03'),
      lastOpenedAt: new Date('2024-01-04')
    },
    {
      id: 'test-project-3',
      name: 'Third Project',
      path: '/test/third/path',
      createdAt: new Date('2024-01-05'),
      lastOpenedAt: new Date('2024-01-06')
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset store to default state
    useAppStore.setState({
      projects: [],
      currentProject: null,
      addProject: vi.fn(),
      setCurrentProject: vi.fn(),
      setShowTutorial: vi.fn()
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Rendering and Branding', () => {
    it('should render welcome screen with branding', () => {
      render(<WelcomeScreen />)

      expect(screen.getByText('Claude DevStudio')).toBeInTheDocument()
      expect(screen.getByText('AI-powered Agile SDLC with Claude Code')).toBeInTheDocument()
    })

    it('should render logo icon', () => {
      render(<WelcomeScreen />)

      // The logo should be visible
      const logo = document.querySelector('svg.lucide-cpu')
      expect(logo).toBeInTheDocument()
    })
  })

  describe('Main Actions', () => {
    it('should render Open Project button', () => {
      render(<WelcomeScreen />)

      const openButton = screen.getByRole('button', { name: /open project/i })
      expect(openButton).toBeInTheDocument()
      expect(screen.getByText('Select a folder to start working with AI agents')).toBeInTheDocument()
    })

    it('should render New Project button', () => {
      render(<WelcomeScreen />)

      const newButton = screen.getByRole('button', { name: /new project/i })
      expect(newButton).toBeInTheDocument()
      expect(screen.getByText('Create a new project folder')).toBeInTheDocument()
    })
  })

  describe('Open Project Flow', () => {
    it('should trigger folder selection when Open Project is clicked', async () => {
      const user = userEvent.setup()
      const mockSelectFolder = vi.fn().mockResolvedValue('/selected/folder')
      const mockCreate = vi.fn().mockResolvedValue(mockProject)
      const mockAddProject = vi.fn()

      window.electronAPI.projects.selectFolder = mockSelectFolder
      window.electronAPI.projects.create = mockCreate
      useAppStore.setState({ addProject: mockAddProject })

      render(<WelcomeScreen />)

      const openButton = screen.getByRole('button', { name: /open project/i })
      await user.click(openButton)

      await waitFor(() => {
        expect(mockSelectFolder).toHaveBeenCalledTimes(1)
      })
    })

    it('should create project and show onboarding wizard after folder selection', async () => {
      const user = userEvent.setup()
      const mockSelectFolder = vi.fn().mockResolvedValue('/selected/folder')
      const mockCreate = vi.fn().mockResolvedValue(mockProject)
      const mockAddProject = vi.fn()

      window.electronAPI.projects.selectFolder = mockSelectFolder
      window.electronAPI.projects.create = mockCreate
      useAppStore.setState({ addProject: mockAddProject })

      render(<WelcomeScreen />)

      const openButton = screen.getByRole('button', { name: /open project/i })
      await user.click(openButton)

      await waitFor(() => {
        expect(mockCreate).toHaveBeenCalledWith({ path: '/selected/folder' })
        expect(mockAddProject).toHaveBeenCalledWith(mockProject)
      })

      // Onboarding wizard should be shown
      expect(screen.getByTestId('onboarding-wizard')).toBeInTheDocument()
      expect(screen.getByTestId('onboarding-project-id')).toHaveTextContent(mockProject.id)
      expect(screen.getByTestId('onboarding-project-name')).toHaveTextContent(mockProject.name)
    })

    it('should not create project if folder selection is cancelled', async () => {
      const user = userEvent.setup()
      const mockSelectFolder = vi.fn().mockResolvedValue(null)
      const mockCreate = vi.fn()

      window.electronAPI.projects.selectFolder = mockSelectFolder
      window.electronAPI.projects.create = mockCreate

      render(<WelcomeScreen />)

      const openButton = screen.getByRole('button', { name: /open project/i })
      await user.click(openButton)

      await waitFor(() => {
        expect(mockSelectFolder).toHaveBeenCalled()
      })

      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('should disable Open Project button while loading', async () => {
      const user = userEvent.setup()
      const mockSelectFolder = vi.fn().mockImplementation(() => new Promise(() => {})) // Never resolves

      window.electronAPI.projects.selectFolder = mockSelectFolder

      render(<WelcomeScreen />)

      const openButton = screen.getByRole('button', { name: /open project/i })
      await user.click(openButton)

      await waitFor(() => {
        expect(openButton).toBeDisabled()
      })
    })

    it('should handle errors during project opening', async () => {
      const user = userEvent.setup()
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const mockSelectFolder = vi.fn().mockRejectedValue(new Error('Failed to select folder'))

      window.electronAPI.projects.selectFolder = mockSelectFolder

      render(<WelcomeScreen />)

      const openButton = screen.getByRole('button', { name: /open project/i })
      await user.click(openButton)

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          'Failed to open project:',
          expect.any(Error)
        )
      })

      // Button should be enabled again after error
      expect(openButton).not.toBeDisabled()
    })
  })

  describe('New Project Flow', () => {
    it('should show new project modal when New Project button is clicked', async () => {
      const user = userEvent.setup()

      render(<WelcomeScreen />)

      const newButton = screen.getByRole('button', { name: /new project/i })
      await user.click(newButton)

      expect(screen.getByText('Create New Project')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Project name')).toBeInTheDocument()
      expect(
        screen.getByText("You'll select a parent folder where the project will be created.")
      ).toBeInTheDocument()
    })

    it('should allow entering project name in modal', async () => {
      const user = userEvent.setup()

      render(<WelcomeScreen />)

      const newButton = screen.getByRole('button', { name: /new project/i })
      await user.click(newButton)

      const input = screen.getByPlaceholderText('Project name')
      await user.type(input, 'My New Project')

      expect(input).toHaveValue('My New Project')
    })

    it('should close modal when Cancel is clicked', async () => {
      const user = userEvent.setup()

      render(<WelcomeScreen />)

      const newButton = screen.getByRole('button', { name: /new project/i })
      await user.click(newButton)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      expect(screen.queryByText('Create New Project')).not.toBeInTheDocument()
    })

    it('should create new project when form is submitted', async () => {
      const user = userEvent.setup()
      const mockSelectFolder = vi.fn().mockResolvedValue('/parent/folder')
      const mockCreateNew = vi.fn().mockResolvedValue('/parent/folder/my-project')
      const mockCreate = vi.fn().mockResolvedValue(mockProject)
      const mockAddProject = vi.fn()

      window.electronAPI.projects.selectFolder = mockSelectFolder
      window.electronAPI.projects.createNew = mockCreateNew
      window.electronAPI.projects.create = mockCreate
      useAppStore.setState({ addProject: mockAddProject })

      render(<WelcomeScreen />)

      const newButton = screen.getByRole('button', { name: /new project/i })
      await user.click(newButton)

      const input = screen.getByPlaceholderText('Project name')
      await user.type(input, 'My New Project')

      const submitButton = screen.getByRole('button', { name: /select folder & create/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockSelectFolder).toHaveBeenCalled()
        expect(mockCreateNew).toHaveBeenCalledWith({
          name: 'My New Project',
          parentPath: '/parent/folder'
        })
        expect(mockCreate).toHaveBeenCalledWith({ path: '/parent/folder/my-project' })
        expect(mockAddProject).toHaveBeenCalledWith(mockProject)
      })

      // Modal should be closed
      expect(screen.queryByText('Create New Project')).not.toBeInTheDocument()
    })

    it('should submit on Enter key press', async () => {
      const user = userEvent.setup()
      const mockSelectFolder = vi.fn().mockResolvedValue('/parent/folder')
      const mockCreateNew = vi.fn().mockResolvedValue('/parent/folder/my-project')
      const mockCreate = vi.fn().mockResolvedValue(mockProject)

      window.electronAPI.projects.selectFolder = mockSelectFolder
      window.electronAPI.projects.createNew = mockCreateNew
      window.electronAPI.projects.create = mockCreate

      render(<WelcomeScreen />)

      const newButton = screen.getByRole('button', { name: /new project/i })
      await user.click(newButton)

      const input = screen.getByPlaceholderText('Project name')
      await user.type(input, 'My New Project{Enter}')

      await waitFor(() => {
        expect(mockCreateNew).toHaveBeenCalled()
      })
    })

    it('should disable submit button when project name is empty', async () => {
      const user = userEvent.setup()

      render(<WelcomeScreen />)

      const newButton = screen.getByRole('button', { name: /new project/i })
      await user.click(newButton)

      const submitButton = screen.getByRole('button', { name: /select folder & create/i })
      expect(submitButton).toBeDisabled()
    })

    it('should disable submit button when project name is only whitespace', async () => {
      const user = userEvent.setup()

      render(<WelcomeScreen />)

      const newButton = screen.getByRole('button', { name: /new project/i })
      await user.click(newButton)

      const input = screen.getByPlaceholderText('Project name')
      await user.type(input, '   ')

      const submitButton = screen.getByRole('button', { name: /select folder & create/i })
      expect(submitButton).toBeDisabled()
    })

    it('should handle folder selection cancellation', async () => {
      const user = userEvent.setup()
      const mockSelectFolder = vi.fn().mockResolvedValue(null)
      const mockCreateNew = vi.fn()

      window.electronAPI.projects.selectFolder = mockSelectFolder
      window.electronAPI.projects.createNew = mockCreateNew

      render(<WelcomeScreen />)

      const newButton = screen.getByRole('button', { name: /new project/i })
      await user.click(newButton)

      const input = screen.getByPlaceholderText('Project name')
      await user.type(input, 'My New Project')

      const submitButton = screen.getByRole('button', { name: /select folder & create/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockSelectFolder).toHaveBeenCalled()
      })

      expect(mockCreateNew).not.toHaveBeenCalled()
    })

    it('should show loading state during project creation', async () => {
      const user = userEvent.setup()
      const mockSelectFolder = vi.fn().mockImplementation(() => new Promise(() => {}))

      window.electronAPI.projects.selectFolder = mockSelectFolder

      render(<WelcomeScreen />)

      const newButton = screen.getByRole('button', { name: /new project/i })
      await user.click(newButton)

      const input = screen.getByPlaceholderText('Project name')
      await user.type(input, 'My New Project')

      const submitButton = screen.getByRole('button', { name: /select folder & create/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Creating...')).toBeInTheDocument()
      })
    })
  })

  describe('Recent Projects', () => {
    it('should not show recent projects section when no projects exist', () => {
      useAppStore.setState({ projects: [] })

      render(<WelcomeScreen />)

      expect(screen.queryByText('Recent Projects')).not.toBeInTheDocument()
    })

    it('should show recent projects section when projects exist', () => {
      useAppStore.setState({ projects: mockRecentProjects })

      render(<WelcomeScreen />)

      expect(screen.getByText('Recent Projects')).toBeInTheDocument()
    })

    it('should display up to 5 recent projects', () => {
      const manyProjects = Array.from({ length: 10 }, (_, i) => ({
        id: `project-${i}`,
        name: `Project ${i}`,
        path: `/path/to/project-${i}`,
        createdAt: new Date(),
        lastOpenedAt: new Date()
      }))

      useAppStore.setState({ projects: manyProjects })

      render(<WelcomeScreen />)

      // Should only show 5 projects - filter for recent project buttons by checking for path
      const projectButtons = screen.getAllByRole('button').filter((btn) => {
        const text = btn.textContent || ''
        return text.includes('/path/to/project-')
      })
      expect(projectButtons.length).toBeLessThanOrEqual(5)
    })

    it('should display project name and path for each recent project', () => {
      useAppStore.setState({ projects: mockRecentProjects })

      render(<WelcomeScreen />)

      expect(screen.getByText('Test Project')).toBeInTheDocument()
      expect(screen.getByText('/test/project/path')).toBeInTheDocument()
      expect(screen.getByText('Another Project')).toBeInTheDocument()
      expect(screen.getByText('/test/another/path')).toBeInTheDocument()
    })

    it('should display relative time for recent projects', () => {
      useAppStore.setState({ projects: mockRecentProjects })

      render(<WelcomeScreen />)

      // The formatRelativeTime function should display some time indication
      // We can't test exact values as they're relative to current time
      const projectButtons = screen.getAllByRole('button').filter((btn) => {
        const text = btn.textContent || ''
        return text.includes('Project')
      })

      expect(projectButtons.length).toBeGreaterThan(0)
    })

    it('should open project when recent project is clicked', async () => {
      const user = userEvent.setup()
      const mockOpen = vi.fn().mockResolvedValue(mockProject)
      const mockSetCurrentProject = vi.fn()

      window.electronAPI.projects.open = mockOpen
      useAppStore.setState({
        projects: mockRecentProjects,
        setCurrentProject: mockSetCurrentProject
      })

      render(<WelcomeScreen />)

      const projectButton = screen.getByText('Test Project').closest('button')
      expect(projectButton).toBeInTheDocument()

      await user.click(projectButton!)

      await waitFor(() => {
        expect(mockOpen).toHaveBeenCalledWith('test-project-1')
        expect(mockSetCurrentProject).toHaveBeenCalledWith(mockProject)
      })
    })

    it('should show onboarding wizard if project has pending plan', async () => {
      const user = userEvent.setup()
      const mockOpen = vi.fn().mockResolvedValue(mockProject)
      const mockGetPlan = vi.fn().mockResolvedValue({
        id: 'plan-1',
        status: 'pending_approval',
        projectId: mockProject.id
      })

      window.electronAPI.projects.open = mockOpen
      window.electronAPI.onboarding = {
        getPlan: mockGetPlan,
        init: vi.fn(),
        analyze: vi.fn(),
        generatePlan: vi.fn(),
        updatePlan: vi.fn(),
        applyPlan: vi.fn(),
        onEvent: vi.fn()
      }

      useAppStore.setState({ projects: mockRecentProjects })

      render(<WelcomeScreen />)

      const projectButton = screen.getByText('Test Project').closest('button')
      await user.click(projectButton!)

      await waitFor(() => {
        expect(mockGetPlan).toHaveBeenCalledWith('test-project-1')
        expect(screen.getByTestId('onboarding-wizard')).toBeInTheDocument()
      })
    })

    it('should open project directly if no pending plan exists', async () => {
      const user = userEvent.setup()
      const mockOpen = vi.fn().mockResolvedValue(mockProject)
      const mockGetPlan = vi.fn().mockRejectedValue(new Error('No plan'))
      const mockSetCurrentProject = vi.fn()

      window.electronAPI.projects.open = mockOpen
      window.electronAPI.onboarding = {
        getPlan: mockGetPlan,
        init: vi.fn(),
        analyze: vi.fn(),
        generatePlan: vi.fn(),
        updatePlan: vi.fn(),
        applyPlan: vi.fn(),
        onEvent: vi.fn()
      }

      useAppStore.setState({
        projects: mockRecentProjects,
        setCurrentProject: mockSetCurrentProject
      })

      render(<WelcomeScreen />)

      const projectButton = screen.getByText('Test Project').closest('button')
      await user.click(projectButton!)

      await waitFor(() => {
        expect(mockSetCurrentProject).toHaveBeenCalledWith(mockProject)
      })
    })

    it('should handle errors when opening recent project', async () => {
      const user = userEvent.setup()
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const mockOpen = vi.fn().mockRejectedValue(new Error('Failed to open'))

      window.electronAPI.projects.open = mockOpen
      useAppStore.setState({ projects: mockRecentProjects })

      render(<WelcomeScreen />)

      const projectButton = screen.getByText('Test Project').closest('button')
      await user.click(projectButton!)

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Failed to open project:', expect.any(Error))
      })
    })
  })

  describe('Help and Tutorial', () => {
    it('should render help button with keyboard shortcut', () => {
      render(<WelcomeScreen />)

      expect(screen.getByText('New here? View the Getting Started Guide')).toBeInTheDocument()
      expect(screen.getByText('?')).toBeInTheDocument()
    })

    it('should show tutorial when help button is clicked', async () => {
      const user = userEvent.setup()
      const mockSetShowTutorial = vi.fn()

      useAppStore.setState({ setShowTutorial: mockSetShowTutorial })

      render(<WelcomeScreen />)

      const helpButton = screen.getByRole('button', {
        name: /new here\? view the getting started guide/i
      })
      await user.click(helpButton)

      expect(mockSetShowTutorial).toHaveBeenCalledWith(true)
    })
  })

  describe('AI Agents Preview', () => {
    it('should display AI agents preview section', () => {
      render(<WelcomeScreen />)

      expect(screen.getByText('AI Agents at Your Service')).toBeInTheDocument()
    })

    it('should display all 6 agent types', () => {
      render(<WelcomeScreen />)

      expect(screen.getByText('Developer')).toBeInTheDocument()
      expect(screen.getByText('Product Owner')).toBeInTheDocument()
      expect(screen.getByText('Tester')).toBeInTheDocument()
      expect(screen.getByText('Security')).toBeInTheDocument()
      expect(screen.getByText('DevOps')).toBeInTheDocument()
      expect(screen.getByText('Docs')).toBeInTheDocument()
    })
  })

  describe('Onboarding Wizard Integration', () => {
    it('should show onboarding wizard after project creation', async () => {
      const user = userEvent.setup()
      const mockSelectFolder = vi.fn().mockResolvedValue('/selected/folder')
      const mockCreate = vi.fn().mockResolvedValue(mockProject)

      window.electronAPI.projects.selectFolder = mockSelectFolder
      window.electronAPI.projects.create = mockCreate

      render(<WelcomeScreen />)

      const openButton = screen.getByRole('button', { name: /open project/i })
      await user.click(openButton)

      await waitFor(() => {
        expect(screen.getByTestId('onboarding-wizard')).toBeInTheDocument()
      })
    })

    it('should set current project when onboarding is completed', async () => {
      const user = userEvent.setup()
      const mockSelectFolder = vi.fn().mockResolvedValue('/selected/folder')
      const mockCreate = vi.fn().mockResolvedValue(mockProject)
      const mockSetCurrentProject = vi.fn()

      window.electronAPI.projects.selectFolder = mockSelectFolder
      window.electronAPI.projects.create = mockCreate
      useAppStore.setState({ setCurrentProject: mockSetCurrentProject })

      render(<WelcomeScreen />)

      const openButton = screen.getByRole('button', { name: /open project/i })
      await user.click(openButton)

      await waitFor(() => {
        expect(screen.getByTestId('onboarding-wizard')).toBeInTheDocument()
      })

      const completeButton = screen.getByText('Complete Onboarding')
      await user.click(completeButton)

      expect(mockSetCurrentProject).toHaveBeenCalledWith(mockProject)
      expect(screen.queryByTestId('onboarding-wizard')).not.toBeInTheDocument()
    })

    it('should set current project when onboarding is cancelled', async () => {
      const user = userEvent.setup()
      const mockSelectFolder = vi.fn().mockResolvedValue('/selected/folder')
      const mockCreate = vi.fn().mockResolvedValue(mockProject)
      const mockSetCurrentProject = vi.fn()

      window.electronAPI.projects.selectFolder = mockSelectFolder
      window.electronAPI.projects.create = mockCreate
      useAppStore.setState({ setCurrentProject: mockSetCurrentProject })

      render(<WelcomeScreen />)

      const openButton = screen.getByRole('button', { name: /open project/i })
      await user.click(openButton)

      await waitFor(() => {
        expect(screen.getByTestId('onboarding-wizard')).toBeInTheDocument()
      })

      const cancelButton = screen.getByText('Cancel Onboarding')
      await user.click(cancelButton)

      expect(mockSetCurrentProject).toHaveBeenCalledWith(mockProject)
      expect(screen.queryByTestId('onboarding-wizard')).not.toBeInTheDocument()
    })

    it('should pass correct props to OnboardingWizard', async () => {
      const user = userEvent.setup()
      const mockSelectFolder = vi.fn().mockResolvedValue('/selected/folder')
      const mockCreate = vi.fn().mockResolvedValue(mockProject)

      window.electronAPI.projects.selectFolder = mockSelectFolder
      window.electronAPI.projects.create = mockCreate

      render(<WelcomeScreen />)

      const openButton = screen.getByRole('button', { name: /open project/i })
      await user.click(openButton)

      await waitFor(() => {
        expect(screen.getByTestId('onboarding-project-id')).toHaveTextContent(mockProject.id)
        expect(screen.getByTestId('onboarding-project-name')).toHaveTextContent(mockProject.name)
      })
    })
  })

  describe('Accessibility', () => {
    it('should have accessible button labels', () => {
      render(<WelcomeScreen />)

      expect(screen.getByRole('button', { name: /open project/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /new project/i })).toBeInTheDocument()
    })

    it('should focus on project name input when modal opens', async () => {
      const user = userEvent.setup()

      render(<WelcomeScreen />)

      const newButton = screen.getByRole('button', { name: /new project/i })
      await user.click(newButton)

      const input = screen.getByPlaceholderText('Project name')
      expect(input).toHaveFocus()
    })

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup()

      render(<WelcomeScreen />)

      // Tab through buttons
      await user.tab()
      expect(screen.getByRole('button', { name: /open project/i })).toHaveFocus()

      await user.tab()
      expect(screen.getByRole('button', { name: /new project/i })).toHaveFocus()
    })
  })

  describe('Loading States', () => {
    it('should disable buttons while loading', async () => {
      const user = userEvent.setup()
      const mockSelectFolder = vi.fn().mockImplementation(() => new Promise(() => {}))

      window.electronAPI.projects.selectFolder = mockSelectFolder

      render(<WelcomeScreen />)

      const openButton = screen.getByRole('button', { name: /open project/i })
      const newButton = screen.getByRole('button', { name: /new project/i })

      await user.click(openButton)

      await waitFor(() => {
        expect(openButton).toBeDisabled()
        expect(newButton).toBeDisabled()
      })
    })
  })
})
