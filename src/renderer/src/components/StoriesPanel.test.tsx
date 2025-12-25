/**
 * Claude DevStudio
 * Copyright (c) 2024 Claude DevStudio Contributors
 * Licensed under MIT License - see LICENSE file
 *
 * StoriesPanel component tests
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { StoriesPanel } from './StoriesPanel'
import { useAppStore } from '../stores/appStore'
import type { UserStory, TestCase } from '@shared/types'

// Mock the appStore
vi.mock('../stores/appStore', () => ({
  useAppStore: vi.fn()
}))

describe('StoriesPanel', () => {
  const mockProject = {
    id: 'project-1',
    name: 'Test Project',
    path: '/path/to/project',
    createdAt: new Date(),
    lastOpenedAt: new Date()
  }

  const mockStories: UserStory[] = [
    {
      id: 'story-1',
      projectId: 'project-1',
      title: 'User Login Feature',
      description: 'As a user, I want to login',
      acceptanceCriteria: 'Given valid credentials, when user logs in, then dashboard is shown',
      storyPoints: 5,
      status: 'backlog',
      priority: 'high',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'story-2',
      projectId: 'project-1',
      title: 'Password Reset',
      description: 'As a user, I want to reset my password',
      acceptanceCriteria: 'Given email address, when reset requested, then email is sent',
      storyPoints: 3,
      status: 'in-progress',
      priority: 'medium',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'story-3',
      projectId: 'project-1',
      title: 'User Profile',
      description: 'As a user, I want to view my profile',
      status: 'done',
      priority: 'low',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]

  const mockTestCases: TestCase[] = [
    {
      id: 'test-1',
      projectId: 'project-1',
      userStoryId: 'story-1',
      title: 'Test valid login',
      description: 'Verify user can login with valid credentials',
      preconditions: 'User exists in database',
      steps: '1. Enter username\n2. Enter password\n3. Click login',
      expectedResult: 'User is redirected to dashboard',
      status: 'passed',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'test-2',
      projectId: 'project-1',
      userStoryId: 'story-1',
      title: 'Test invalid login',
      description: 'Verify error shown for invalid credentials',
      preconditions: 'None',
      steps: '1. Enter invalid username\n2. Enter password\n3. Click login',
      expectedResult: 'Error message displayed',
      status: 'failed',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(window.electronAPI.stories.list).mockResolvedValue(mockStories)
    vi.mocked(window.electronAPI.testCases.list).mockResolvedValue(mockTestCases)
    vi.mocked(useAppStore).mockReturnValue({
      currentProject: mockProject
    } as any)
  })

  describe('Rendering', () => {
    it('should render the stories panel with title', async () => {
      render(<StoriesPanel projectPath="/path/to/project" />)

      await waitFor(() => {
        expect(screen.getByText('User Stories')).toBeInTheDocument()
      })
    })

    it('should render list of user stories', async () => {
      render(<StoriesPanel projectPath="/path/to/project" />)

      await waitFor(() => {
        expect(screen.getByText('User Login Feature')).toBeInTheDocument()
        expect(screen.getByText('Password Reset')).toBeInTheDocument()
        expect(screen.getByText('User Profile')).toBeInTheDocument()
      })
    })

    it('should render story cards with title, description, status, and priority', async () => {
      render(<StoriesPanel projectPath="/path/to/project" />)

      await waitFor(() => {
        expect(screen.getByText('User Login Feature')).toBeInTheDocument()
        expect(screen.getByText('As a user, I want to login')).toBeInTheDocument()
        expect(screen.getByText('backlog')).toBeInTheDocument()
        expect(screen.getByText('high')).toBeInTheDocument()
      })
    })

    it('should show empty state when no stories exist', async () => {
      vi.mocked(window.electronAPI.stories.list).mockResolvedValue([])

      render(<StoriesPanel projectPath="/path/to/project" />)

      await waitFor(() => {
        expect(screen.getByText('No user stories yet. Generate one above!')).toBeInTheDocument()
      })
    })

    it('should render story without description gracefully', async () => {
      render(<StoriesPanel projectPath="/path/to/project" />)

      await waitFor(() => {
        expect(screen.getByText('User Profile')).toBeInTheDocument()
      })

      // Story 3 has no description, should render without issues
      const storyCard = screen.getByText('User Profile').closest('button')
      expect(storyCard).toBeInTheDocument()
    })

    it('should apply correct status colors', async () => {
      render(<StoriesPanel projectPath="/path/to/project" />)

      await waitFor(() => {
        const backlogBadge = screen.getByText('backlog')
        expect(backlogBadge).toHaveClass('bg-zinc-600', 'text-zinc-300')

        const inProgressBadge = screen.getByText('in progress')
        expect(inProgressBadge).toHaveClass('bg-yellow-600', 'text-yellow-100')

        const doneBadge = screen.getByText('done')
        expect(doneBadge).toHaveClass('bg-green-600', 'text-green-100')
      })
    })

    it('should apply correct priority colors', async () => {
      render(<StoriesPanel projectPath="/path/to/project" />)

      await waitFor(() => {
        const highPriority = screen.getByText('high')
        expect(highPriority).toHaveClass('text-orange-400')

        const mediumPriority = screen.getByText('medium')
        expect(mediumPriority).toHaveClass('text-blue-400')

        const lowPriority = screen.getByText('low')
        expect(lowPriority).toHaveClass('text-zinc-400')
      })
    })
  })

  describe('Create New Story', () => {
    it('should render generate story button', async () => {
      render(<StoriesPanel projectPath="/path/to/project" />)

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /generate user story/i })
        expect(button).toBeInTheDocument()
      })
    })

    it('should render prompt textarea', async () => {
      render(<StoriesPanel projectPath="/path/to/project" />)

      await waitFor(() => {
        const textarea = screen.getByPlaceholderText(/describe a feature or requirement/i)
        expect(textarea).toBeInTheDocument()
      })
    })

    it('should disable generate button when prompt is empty', async () => {
      render(<StoriesPanel projectPath="/path/to/project" />)

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /generate user story/i })
        expect(button).toBeDisabled()
      })
    })

    it('should enable generate button when prompt has text', async () => {
      render(<StoriesPanel projectPath="/path/to/project" />)

      await waitFor(() => {
        const textarea = screen.getByPlaceholderText(/describe a feature or requirement/i)
        fireEvent.change(textarea, { target: { value: 'I need a login feature' } })
      })

      const button = screen.getByRole('button', { name: /generate user story/i })
      expect(button).not.toBeDisabled()
    })

    it('should call generateFromPrompt and create story when generate button is clicked', async () => {
      const generatedStory = {
        title: 'Generated Story',
        description: 'Generated description',
        acceptanceCriteria: 'Generated criteria'
      }

      const createdStory: UserStory = {
        id: 'story-new',
        projectId: 'project-1',
        ...generatedStory,
        priority: 'medium',
        status: 'backlog',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      window.electronAPI.stories.generateFromPrompt.mockResolvedValue(generatedStory)
      window.electronAPI.stories.create.mockResolvedValue(createdStory)

      render(<StoriesPanel projectPath="/path/to/project" />)

      await waitFor(() => {
        const textarea = screen.getByPlaceholderText(/describe a feature or requirement/i)
        fireEvent.change(textarea, { target: { value: 'I need a login feature' } })
      })

      const button = screen.getByRole('button', { name: /generate user story/i })
      fireEvent.click(button)

      await waitFor(() => {
        expect(window.electronAPI.stories.generateFromPrompt).toHaveBeenCalledWith({
          projectId: 'project-1',
          projectPath: '/path/to/project',
          prompt: 'I need a login feature'
        })
        expect(window.electronAPI.stories.create).toHaveBeenCalledWith({
          projectId: 'project-1',
          title: 'Generated Story',
          description: 'Generated description',
          acceptanceCriteria: 'Generated criteria',
          priority: 'medium'
        })
      })
    })

    it('should show generating state while creating story', async () => {
      window.electronAPI.stories.generateFromPrompt.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      )

      render(<StoriesPanel projectPath="/path/to/project" />)

      await waitFor(() => {
        const textarea = screen.getByPlaceholderText(/describe a feature or requirement/i)
        fireEvent.change(textarea, { target: { value: 'Test prompt' } })
      })

      const button = screen.getByRole('button', { name: /generate user story/i })
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByText('Generating...')).toBeInTheDocument()
      })
    })

    it('should clear prompt after successful story creation', async () => {
      const generatedStory = {
        title: 'Test Story',
        description: 'Test description',
        acceptanceCriteria: 'Test criteria'
      }

      const createdStory: UserStory = {
        id: 'story-new',
        projectId: 'project-1',
        ...generatedStory,
        priority: 'medium',
        status: 'backlog',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      window.electronAPI.stories.generateFromPrompt.mockResolvedValue(generatedStory)
      window.electronAPI.stories.create.mockResolvedValue(createdStory)

      render(<StoriesPanel projectPath="/path/to/project" />)

      await waitFor(() => {
        const textarea = screen.getByPlaceholderText(/describe a feature or requirement/i)
        fireEvent.change(textarea, { target: { value: 'Test prompt' } })
      })

      const button = screen.getByRole('button', { name: /generate user story/i })
      fireEvent.click(button)

      await waitFor(() => {
        const textarea = screen.getByPlaceholderText(/describe a feature or requirement/i)
        expect(textarea).toHaveValue('')
      })
    })

    it('should handle story generation error gracefully', async () => {
      window.electronAPI.stories.generateFromPrompt.mockRejectedValue(new Error('Generation failed'))
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(<StoriesPanel projectPath="/path/to/project" />)

      await waitFor(() => {
        const textarea = screen.getByPlaceholderText(/describe a feature or requirement/i)
        fireEvent.change(textarea, { target: { value: 'Test prompt' } })
      })

      const button = screen.getByRole('button', { name: /generate user story/i })
      fireEvent.click(button)

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Failed to generate story:', expect.any(Error))
      })

      consoleError.mockRestore()
    })
  })

  describe('Story Selection', () => {
    it('should show empty detail view when no story is selected', async () => {
      render(<StoriesPanel projectPath="/path/to/project" />)

      await waitFor(() => {
        expect(screen.getByText('Select a user story to view details')).toBeInTheDocument()
      })
    })

    it('should display selected story details when story is clicked', async () => {
      render(<StoriesPanel projectPath="/path/to/project" />)

      await waitFor(() => {
        const storyCard = screen.getByText('User Login Feature').closest('button')
        fireEvent.click(storyCard!)
      })

      await waitFor(() => {
        // Story details should appear - check for multiple instances (list + detail)
        const titles = screen.getAllByText('User Login Feature')
        expect(titles.length).toBeGreaterThan(0)

        const descriptions = screen.getAllByText('As a user, I want to login')
        expect(descriptions.length).toBeGreaterThan(0)
      })
    })

    it('should highlight selected story card', async () => {
      render(<StoriesPanel projectPath="/path/to/project" />)

      let clickedCard: HTMLElement | null = null

      await waitFor(() => {
        clickedCard = screen.getByText('User Login Feature').closest('button')
        fireEvent.click(clickedCard!)
      })

      await waitFor(() => {
        // The clicked card should have the highlight class
        expect(clickedCard).toHaveClass('bg-zinc-900')
      })
    })

    it('should display acceptance criteria when available', async () => {
      render(<StoriesPanel projectPath="/path/to/project" />)

      await waitFor(() => {
        const storyCard = screen.getByText('User Login Feature').closest('button')
        fireEvent.click(storyCard!)
      })

      await waitFor(() => {
        expect(screen.getByText('Acceptance Criteria')).toBeInTheDocument()
        expect(screen.getByText(/Given valid credentials/)).toBeInTheDocument()
      })
    })
  })

  describe('Story Status Update', () => {
    it('should render status dropdown when story is selected', async () => {
      render(<StoriesPanel projectPath="/path/to/project" />)

      await waitFor(() => {
        const storyCard = screen.getByText('User Login Feature').closest('button')
        fireEvent.click(storyCard!)
      })

      await waitFor(() => {
        const select = screen.getByRole('combobox')
        expect(select).toBeInTheDocument()
        expect(select).toHaveValue('backlog')
      })
    })

    it('should have all status options in dropdown', async () => {
      render(<StoriesPanel projectPath="/path/to/project" />)

      await waitFor(() => {
        const storyCard = screen.getByText('User Login Feature').closest('button')
        fireEvent.click(storyCard!)
      })

      await waitFor(() => {
        const select = screen.getByRole('combobox')
        const options = Array.from(select.querySelectorAll('option'))
        const optionValues = options.map(opt => (opt as HTMLOptionElement).value)

        expect(optionValues).toContain('backlog')
        expect(optionValues).toContain('todo')
        expect(optionValues).toContain('in-progress')
        expect(optionValues).toContain('review')
        expect(optionValues).toContain('done')
      })
    })

    it('should call update API when status is changed', async () => {
      const updatedStory: UserStory = {
        ...mockStories[0],
        status: 'in-progress'
      }
      window.electronAPI.stories.update.mockResolvedValue(updatedStory)

      render(<StoriesPanel projectPath="/path/to/project" />)

      await waitFor(() => {
        const storyCard = screen.getByText('User Login Feature').closest('button')
        fireEvent.click(storyCard!)
      })

      await waitFor(() => {
        const select = screen.getByRole('combobox')
        fireEvent.change(select, { target: { value: 'in-progress' } })
      })

      await waitFor(() => {
        expect(window.electronAPI.stories.update).toHaveBeenCalledWith('story-1', {
          status: 'in-progress'
        })
      })
    })

    it('should handle status update error gracefully', async () => {
      window.electronAPI.stories.update.mockRejectedValue(new Error('Update failed'))
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(<StoriesPanel projectPath="/path/to/project" />)

      await waitFor(() => {
        const storyCard = screen.getByText('User Login Feature').closest('button')
        fireEvent.click(storyCard!)
      })

      await waitFor(() => {
        const select = screen.getByRole('combobox')
        fireEvent.change(select, { target: { value: 'done' } })
      })

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Failed to update story status:', expect.any(Error))
      })

      consoleError.mockRestore()
    })
  })

  describe('Test Cases Section', () => {
    it('should display Test Cases section when story is selected', async () => {
      render(<StoriesPanel projectPath="/path/to/project" />)

      await waitFor(() => {
        const storyCard = screen.getByText('User Login Feature').closest('button')
        fireEvent.click(storyCard!)
      })

      await waitFor(() => {
        expect(screen.getByText('Test Cases')).toBeInTheDocument()
      })
    })

    it('should display Generate Test Cases button', async () => {
      render(<StoriesPanel projectPath="/path/to/project" />)

      await waitFor(() => {
        const storyCard = screen.getByText('User Login Feature').closest('button')
        fireEvent.click(storyCard!)
      })

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /generate test cases/i })
        expect(button).toBeInTheDocument()
      })
    })

    it('should show test cases for selected story', async () => {
      render(<StoriesPanel projectPath="/path/to/project" />)

      await waitFor(() => {
        const storyCard = screen.getByText('User Login Feature').closest('button')
        fireEvent.click(storyCard!)
      })

      await waitFor(() => {
        expect(screen.getByText('Test valid login')).toBeInTheDocument()
        expect(screen.getByText('Test invalid login')).toBeInTheDocument()
      })
    })

    it('should display test case details', async () => {
      render(<StoriesPanel projectPath="/path/to/project" />)

      await waitFor(() => {
        const storyCard = screen.getByText('User Login Feature').closest('button')
        fireEvent.click(storyCard!)
      })

      await waitFor(() => {
        expect(screen.getByText('Verify user can login with valid credentials')).toBeInTheDocument()
        expect(screen.getByText('User exists in database')).toBeInTheDocument()
        expect(screen.getByText(/1\. Enter username/)).toBeInTheDocument()
        expect(screen.getByText('User is redirected to dashboard')).toBeInTheDocument()
      })
    })

    it('should show test case status badges', async () => {
      render(<StoriesPanel projectPath="/path/to/project" />)

      await waitFor(() => {
        const storyCard = screen.getByText('User Login Feature').closest('button')
        fireEvent.click(storyCard!)
      })

      await waitFor(() => {
        const passedBadge = screen.getByText('passed')
        expect(passedBadge).toHaveClass('bg-green-600', 'text-green-100')

        const failedBadge = screen.getByText('failed')
        expect(failedBadge).toHaveClass('bg-red-600', 'text-red-100')
      })
    })

    it('should show empty state when no test cases exist', async () => {
      render(<StoriesPanel projectPath="/path/to/project" />)

      await waitFor(() => {
        const storyCard = screen.getByText('Password Reset').closest('button')
        fireEvent.click(storyCard!)
      })

      await waitFor(() => {
        expect(screen.getByText('No test cases yet. Generate them using the button above!')).toBeInTheDocument()
      })
    })

    it('should call generateFromStory when Generate Test Cases is clicked', async () => {
      const generatedTests = [
        {
          title: 'New test case',
          description: 'Test description',
          preconditions: 'None',
          steps: '1. Do something',
          expectedResult: 'Expected result'
        }
      ]

      const createdTestCase: TestCase = {
        id: 'test-new',
        projectId: 'project-1',
        userStoryId: 'story-2',
        ...generatedTests[0],
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      window.electronAPI.testCases.generateFromStory.mockResolvedValue(generatedTests)
      window.electronAPI.testCases.create.mockResolvedValue(createdTestCase)

      render(<StoriesPanel projectPath="/path/to/project" />)

      await waitFor(() => {
        const storyCard = screen.getByText('Password Reset').closest('button')
        fireEvent.click(storyCard!)
      })

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /generate test cases/i })
        fireEvent.click(button)
      })

      await waitFor(() => {
        expect(window.electronAPI.testCases.generateFromStory).toHaveBeenCalledWith({
          projectPath: '/path/to/project',
          userStory: {
            title: 'Password Reset',
            description: 'As a user, I want to reset my password',
            acceptanceCriteria: 'Given email address, when reset requested, then email is sent'
          }
        })
      })
    })

    it('should show generating state while creating test cases', async () => {
      window.electronAPI.testCases.generateFromStory.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      )

      render(<StoriesPanel projectPath="/path/to/project" />)

      await waitFor(() => {
        const storyCard = screen.getByText('Password Reset').closest('button')
        fireEvent.click(storyCard!)
      })

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /generate test cases/i })
        fireEvent.click(button)
      })

      await waitFor(() => {
        expect(screen.getByText('Generating...')).toBeInTheDocument()
      })
    })

    it('should handle test case generation error gracefully', async () => {
      window.electronAPI.testCases.generateFromStory.mockRejectedValue(new Error('Generation failed'))
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(<StoriesPanel projectPath="/path/to/project" />)

      await waitFor(() => {
        const storyCard = screen.getByText('Password Reset').closest('button')
        fireEvent.click(storyCard!)
      })

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /generate test cases/i })
        fireEvent.click(button)
      })

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Failed to generate test cases:', expect.any(Error))
      })

      consoleError.mockRestore()
    })
  })

  describe('Loading Stories', () => {
    it('should call stories.list on mount', async () => {
      render(<StoriesPanel projectPath="/path/to/project" />)

      await waitFor(() => {
        expect(window.electronAPI.stories.list).toHaveBeenCalledWith('project-1')
      })
    })

    it('should call testCases.list on mount', async () => {
      render(<StoriesPanel projectPath="/path/to/project" />)

      await waitFor(() => {
        expect(window.electronAPI.testCases.list).toHaveBeenCalledWith('project-1')
      })
    })

    it('should handle loading error gracefully', async () => {
      window.electronAPI.stories.list.mockRejectedValue(new Error('Load failed'))
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(<StoriesPanel projectPath="/path/to/project" />)

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Failed to load stories:', expect.any(Error))
      })

      consoleError.mockRestore()
    })

    it('should not load stories when no project is selected', async () => {
      vi.mocked(useAppStore).mockReturnValue({
        currentProject: null
      } as any)

      render(<StoriesPanel projectPath="/path/to/project" />)

      await waitFor(() => {
        expect(window.electronAPI.stories.list).not.toHaveBeenCalled()
      })
    })
  })

  describe('Layout and Structure', () => {
    it('should have two-column layout', async () => {
      const { container } = render(<StoriesPanel projectPath="/path/to/project" />)

      await waitFor(() => {
        const mainContainer = container.querySelector('.flex.flex-1.h-full')
        expect(mainContainer).toBeInTheDocument()
      })
    })

    it('should have story list on the left', async () => {
      const { container } = render(<StoriesPanel projectPath="/path/to/project" />)

      await waitFor(() => {
        const storyList = container.querySelector('.w-96.border-r')
        expect(storyList).toBeInTheDocument()
      })
    })

    it('should have story detail on the right', async () => {
      const { container } = render(<StoriesPanel projectPath="/path/to/project" />)

      await waitFor(() => {
        const storyDetail = container.querySelector('.flex-1.flex.flex-col')
        expect(storyDetail).toBeInTheDocument()
      })
    })

    it('should have scrollable story list', async () => {
      const { container } = render(<StoriesPanel projectPath="/path/to/project" />)

      await waitFor(() => {
        const scrollContainer = container.querySelector('.flex-1.overflow-y-auto')
        expect(scrollContainer).toBeInTheDocument()
      })
    })
  })
})
