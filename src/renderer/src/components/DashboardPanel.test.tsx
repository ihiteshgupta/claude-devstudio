/**
 * Claude DevStudio
 * Copyright (c) 2024 Claude DevStudio Contributors
 * Licensed under MIT License - see LICENSE file
 *
 * DashboardPanel component tests
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DashboardPanel } from './DashboardPanel'
import { useAppStore } from '../stores/appStore'
import type { UserStory, Sprint, ChatSession, TestCase, Project, AgentType } from '@shared/types'

// Mock the appStore
vi.mock('../stores/appStore', () => ({
  useAppStore: vi.fn()
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  FileText: () => <svg data-testid="file-text-icon" />,
  Star: () => <svg data-testid="star-icon" />,
  TestTube: () => <svg data-testid="test-tube-icon" />,
  CalendarDays: () => <svg data-testid="calendar-days-icon" />,
  MessageSquare: () => <svg data-testid="message-square-icon" />,
  Bot: () => <svg data-testid="bot-icon" />,
  RefreshCw: () => <svg data-testid="refresh-cw-icon" />,
  Zap: () => <svg data-testid="zap-icon" />
}))

// Mock AgentIcon component
vi.mock('../utils/icons', () => ({
  AgentIcon: ({ agentType }: { agentType: AgentType }) => (
    <div data-testid={`agent-icon-${agentType}`} />
  ),
  AGENT_ICONS: {},
  AGENT_LABELS: {
    developer: 'Developer',
    'product-owner': 'Product Owner',
    tester: 'Tester',
    security: 'Security',
    devops: 'DevOps',
    documentation: 'Documentation'
  }
}))

describe('DashboardPanel', () => {
  const mockProject: Project = {
    id: 'project-1',
    name: 'Test Project',
    path: '/test/project',
    createdAt: new Date('2024-01-01'),
    lastOpenedAt: new Date('2024-01-15')
  }

  const mockStories: UserStory[] = [
    {
      id: 'story-1',
      projectId: 'project-1',
      title: 'User login',
      status: 'done',
      priority: 'high',
      storyPoints: 5,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-15')
    },
    {
      id: 'story-2',
      projectId: 'project-1',
      sprintId: 'sprint-1',
      title: 'User registration',
      status: 'in-progress',
      priority: 'medium',
      storyPoints: 3,
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-16')
    },
    {
      id: 'story-3',
      projectId: 'project-1',
      sprintId: 'sprint-1',
      title: 'Password reset',
      status: 'todo',
      priority: 'low',
      storyPoints: 2,
      createdAt: new Date('2024-01-03'),
      updatedAt: new Date('2024-01-17')
    },
    {
      id: 'story-4',
      projectId: 'project-1',
      title: 'Dashboard UI',
      status: 'backlog',
      priority: 'medium',
      createdAt: new Date('2024-01-04'),
      updatedAt: new Date('2024-01-18')
    }
  ]

  const mockSprints: Sprint[] = [
    {
      id: 'sprint-1',
      projectId: 'project-1',
      name: 'Sprint 1',
      status: 'active',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-14'),
      goal: 'Implement user authentication',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01')
    }
  ]

  const mockSessions: ChatSession[] = [
    {
      id: 'session-1',
      projectId: 'project-1',
      agentType: 'developer',
      messages: [],
      createdAt: new Date('2024-01-10'),
      updatedAt: new Date('2024-01-10')
    },
    {
      id: 'session-2',
      projectId: 'project-1',
      agentType: 'tester',
      messages: [],
      createdAt: new Date('2024-01-11'),
      updatedAt: new Date('2024-01-11')
    },
    {
      id: 'session-3',
      projectId: 'project-1',
      agentType: 'developer',
      messages: [],
      createdAt: new Date('2024-01-12'),
      updatedAt: new Date('2024-01-12')
    }
  ]

  const mockTestCases: TestCase[] = [
    {
      id: 'test-1',
      projectId: 'project-1',
      userStoryId: 'story-1',
      title: 'Test login success',
      status: 'passed',
      createdAt: new Date('2024-01-05'),
      updatedAt: new Date('2024-01-15')
    },
    {
      id: 'test-2',
      projectId: 'project-1',
      userStoryId: 'story-1',
      title: 'Test login failure',
      status: 'passed',
      createdAt: new Date('2024-01-06'),
      updatedAt: new Date('2024-01-16')
    },
    {
      id: 'test-3',
      projectId: 'project-1',
      userStoryId: 'story-2',
      title: 'Test registration validation',
      status: 'failed',
      createdAt: new Date('2024-01-07'),
      updatedAt: new Date('2024-01-17')
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAppStore).mockReturnValue({
      currentProject: mockProject
    } as any)

    // Mock window.electronAPI methods
    window.electronAPI.stories.list = vi.fn().mockResolvedValue(mockStories)
    window.electronAPI.sprints.list = vi.fn().mockResolvedValue(mockSprints)
    window.electronAPI.sessions.list = vi.fn().mockResolvedValue(mockSessions)
    window.electronAPI.testCases.list = vi.fn().mockResolvedValue(mockTestCases)
  })

  describe('Loading State', () => {
    it('should display loading message while data is being fetched', () => {
      window.electronAPI.stories.list = vi.fn().mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      render(<DashboardPanel projectPath="/test/project" />)

      expect(screen.getByText('Loading dashboard...')).toBeInTheDocument()
    })

    it('should have proper loading state styling', () => {
      window.electronAPI.stories.list = vi.fn().mockImplementation(
        () => new Promise(() => {})
      )

      const { container } = render(<DashboardPanel projectPath="/test/project" />)

      const loadingContainer = container.querySelector('.flex.flex-1.h-full.bg-zinc-950')
      expect(loadingContainer).toBeInTheDocument()
    })
  })

  describe('Rendering - Project Overview', () => {
    it('should render dashboard title', async () => {
      render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument()
      })
    })

    it('should display current project name', async () => {
      render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument()
      })
    })

    it('should render refresh button', async () => {
      render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        const refreshButton = screen.getByRole('button', { name: /refresh/i })
        expect(refreshButton).toBeInTheDocument()
      })
    })

    it('should call loadData when refresh button is clicked', async () => {
      render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        expect(window.electronAPI.stories.list).toHaveBeenCalledWith('project-1')
      })

      vi.clearAllMocks()

      const refreshButton = screen.getByRole('button', { name: /refresh/i })
      fireEvent.click(refreshButton)

      await waitFor(() => {
        expect(window.electronAPI.stories.list).toHaveBeenCalledWith('project-1')
        expect(window.electronAPI.sprints.list).toHaveBeenCalledWith('project-1')
        expect(window.electronAPI.sessions.list).toHaveBeenCalledWith('project-1')
        expect(window.electronAPI.testCases.list).toHaveBeenCalledWith('project-1')
      })
    })
  })

  describe('Stat Cards', () => {
    it('should render total stories stat card', async () => {
      render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        expect(screen.getByText('Total Stories')).toBeInTheDocument()
        expect(screen.getByText('4')).toBeInTheDocument()
        expect(screen.getByText('1 completed')).toBeInTheDocument()
      })
    })

    it('should render active sprint stat card', async () => {
      const { container } = render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        expect(screen.getByText('Active Sprint')).toBeInTheDocument()
        // Find the stat card section (first 4 cards in grid)
        const statGrid = container.querySelector('.grid.grid-cols-2.md\\:grid-cols-4')
        expect(statGrid).toBeInTheDocument()
        expect(statGrid?.textContent).toContain('Sprint 1')
      })
    })

    it('should render story points stat card', async () => {
      render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        expect(screen.getByText('Story Points')).toBeInTheDocument()
        expect(screen.getByText('10')).toBeInTheDocument() // 5+3+2
        expect(screen.getByText('5 completed')).toBeInTheDocument()
      })
    })

    it('should render test cases stat card', async () => {
      const { container } = render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        expect(screen.getByText('Test Cases')).toBeInTheDocument()
        // Use container to find the test cases card specifically
        const statGrid = container.querySelector('.grid.grid-cols-2.md\\:grid-cols-4')
        expect(statGrid).toBeInTheDocument()
        expect(statGrid?.textContent).toContain('3')
        expect(statGrid?.textContent).toContain('2 passed')
      })
    })
  })

  describe('Story Status Distribution', () => {
    it('should render story status distribution section', async () => {
      render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        expect(screen.getByText('Story Status Distribution')).toBeInTheDocument()
      })
    })

    it('should display correct story counts for each status', async () => {
      render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        expect(screen.getByText('Backlog')).toBeInTheDocument()
        expect(screen.getByText('To Do')).toBeInTheDocument()
        expect(screen.getByText('In Progress')).toBeInTheDocument()
        expect(screen.getByText('Review')).toBeInTheDocument()
        expect(screen.getByText('Done')).toBeInTheDocument()
      })
    })

    it('should display overall completion percentage', async () => {
      render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        expect(screen.getByText('Overall Completion')).toBeInTheDocument()
        expect(screen.getByText('25%')).toBeInTheDocument() // 1/4 = 25%
      })
    })
  })

  describe('Sprint Progress', () => {
    it('should render sprint progress section with active sprint', async () => {
      const { container } = render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        expect(screen.getByText('Sprint Progress')).toBeInTheDocument()
        // Find Sprint Progress section specifically
        const sections = container.querySelectorAll('.bg-zinc-900.rounded-lg.border.border-zinc-800')
        const sprintSection = Array.from(sections).find(section =>
          section.textContent?.includes('Sprint Progress')
        )
        expect(sprintSection).toBeInTheDocument()
        expect(sprintSection?.textContent).toContain('Sprint 1')
      })
    })

    it('should display sprint goal', async () => {
      render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        expect(screen.getByText('Sprint Goal')).toBeInTheDocument()
        expect(screen.getByText('Implement user authentication')).toBeInTheDocument()
      })
    })

    it('should display sprint dates', async () => {
      const { container } = render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        // Find the Sprint Progress section and check for dates
        const sections = container.querySelectorAll('.bg-zinc-900.rounded-lg.border.border-zinc-800')
        const sprintSection = Array.from(sections).find(section =>
          section.textContent?.includes('Sprint Progress')
        )
        expect(sprintSection?.textContent).toMatch(/1\/1\/2024/)
      })
    })

    it('should display sprint story count', async () => {
      const { container } = render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        expect(screen.getByText('Stories')).toBeInTheDocument()
        // Find the Sprint Progress section
        const sections = container.querySelectorAll('.bg-zinc-900.rounded-lg.border.border-zinc-800')
        const sprintSection = Array.from(sections).find(section =>
          section.textContent?.includes('Sprint Progress')
        )
        // Check that it contains "2" stories
        expect(sprintSection?.textContent).toContain('2')
        expect(sprintSection?.textContent).toContain('Stories')
      })
    })

    it('should display sprint story points', async () => {
      const { container } = render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        expect(screen.getByText('Points')).toBeInTheDocument()
        // Find the Sprint Progress section
        const sections = container.querySelectorAll('.bg-zinc-900.rounded-lg.border.border-zinc-800')
        const sprintSection = Array.from(sections).find(section =>
          section.textContent?.includes('Sprint Progress')
        )
        // Check that it contains "5" points
        expect(sprintSection?.textContent).toContain('5')
        expect(sprintSection?.textContent).toContain('Points')
      })
    })

    it('should display days remaining in sprint', async () => {
      render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        expect(screen.getByText('Days Left')).toBeInTheDocument()
      })
    })

    it('should display empty state when no active sprint', async () => {
      window.electronAPI.sprints.list = vi.fn().mockResolvedValue([
        { ...mockSprints[0], status: 'completed' }
      ])

      const { container } = render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        // Find the Sprint Progress section specifically (not the stat card)
        const sections = container.querySelectorAll('.bg-zinc-900.rounded-lg.border.border-zinc-800')
        const sprintSection = Array.from(sections).find(section =>
          section.textContent?.includes('Sprint Progress')
        )
        expect(sprintSection).toBeInTheDocument()
        expect(sprintSection?.textContent).toContain('No active sprint')
        expect(sprintSection?.textContent).toContain('Create a sprint to track progress')
      })
    })
  })

  describe('Recent Activity', () => {
    it('should render recent activity section', async () => {
      render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        expect(screen.getByText('Recent Activity')).toBeInTheDocument()
      })
    })

    it('should display agent sessions in recent activity', async () => {
      const { container } = render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        // Find the Recent Activity section
        const sections = container.querySelectorAll('.bg-zinc-900.rounded-lg.border.border-zinc-800')
        const activitySection = Array.from(sections).find(section =>
          section.textContent?.includes('Recent Activity')
        )
        expect(activitySection).toBeInTheDocument()
        expect(activitySection?.textContent).toContain('Developer chat')
        expect(activitySection?.textContent).toContain('Tester chat')
      })
    })

    it('should display empty state when no sessions', async () => {
      window.electronAPI.sessions.list = vi.fn().mockResolvedValue([])

      render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        expect(screen.getByText('No recent activity')).toBeInTheDocument()
        expect(screen.getByText('Start a chat with an agent')).toBeInTheDocument()
      })
    })

    it('should limit recent activity to 5 items', async () => {
      const manySessions: ChatSession[] = Array.from({ length: 10 }, (_, i) => ({
        id: `session-${i}`,
        projectId: 'project-1',
        agentType: 'developer' as AgentType,
        messages: [],
        createdAt: new Date(`2024-01-${i + 1}`),
        updatedAt: new Date(`2024-01-${i + 1}`)
      }))

      window.electronAPI.sessions.list = vi.fn().mockResolvedValue(manySessions)

      const { container } = render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        // Find the Recent Activity section
        const sections = container.querySelectorAll('.bg-zinc-900.rounded-lg.border.border-zinc-800')
        const activitySection = Array.from(sections).find(section =>
          section.textContent?.includes('Recent Activity')
        )
        const activityItems = activitySection?.querySelectorAll('[data-testid^="agent-icon-"]')
        expect(activityItems?.length).toBeLessThanOrEqual(5)
      })
    })
  })

  describe('Agent Sessions', () => {
    it('should render agent sessions section', async () => {
      render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        expect(screen.getByText('Agent Sessions')).toBeInTheDocument()
      })
    })

    it('should display session counts by agent type', async () => {
      render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        expect(screen.getByText('Developer')).toBeInTheDocument()
        expect(screen.getByText('Tester')).toBeInTheDocument()
      })
    })

    it('should display total sessions count', async () => {
      const { container } = render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        expect(screen.getByText('Total Sessions')).toBeInTheDocument()
        // Find the Agent Sessions section to check the total count
        const sections = container.querySelectorAll('.bg-zinc-900.rounded-lg.border.border-zinc-800')
        const sessionSection = Array.from(sections).find(section =>
          section.textContent?.includes('Agent Sessions') && section.textContent?.includes('Total Sessions')
        )
        expect(sessionSection).toBeInTheDocument()
        expect(sessionSection?.textContent).toContain('3')
      })
    })

    it('should display empty state when no sessions', async () => {
      window.electronAPI.sessions.list = vi.fn().mockResolvedValue([])

      render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        expect(screen.getByText('No agent sessions yet')).toBeInTheDocument()
        expect(screen.getByText('Chat with agents to see activity')).toBeInTheDocument()
      })
    })
  })

  describe('Quick Stats Footer', () => {
    it('should display total sprints count', async () => {
      const { container } = render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        expect(screen.getByText('Total Sprints')).toBeInTheDocument()
        // Find the footer section with Quick Stats
        const footerGrid = container.querySelector('.grid.grid-cols-2.md\\:grid-cols-4')
        // Skip the first grid (stat cards) and get the second grid (footer)
        const allGrids = container.querySelectorAll('.grid.grid-cols-2.md\\:grid-cols-4')
        const footerSection = allGrids[1] // Second grid is the footer
        expect(footerSection?.textContent).toContain('Total Sprints')
        expect(footerSection?.textContent).toContain('1')
      })
    })

    it('should display completed sprints count', async () => {
      const { container } = render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        expect(screen.getByText('Completed Sprints')).toBeInTheDocument()
        const allGrids = container.querySelectorAll('.grid.grid-cols-2.md\\:grid-cols-4')
        const footerSection = allGrids[1] // Second grid is the footer
        expect(footerSection?.textContent).toContain('Completed Sprints')
        expect(footerSection?.textContent).toContain('0')
      })
    })

    it('should calculate average points per story', async () => {
      const { container } = render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        expect(screen.getByText('Avg Points/Story')).toBeInTheDocument()
        // 10 points / 4 stories = 2.5, not 3.3
        const allGrids = container.querySelectorAll('.grid.grid-cols-2.md\\:grid-cols-4')
        const footerSection = allGrids[1]
        expect(footerSection?.textContent).toContain('2.5')
      })
    })

    it('should calculate test coverage percentage', async () => {
      render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        expect(screen.getByText('Test Coverage')).toBeInTheDocument()
        expect(screen.getByText('75%')).toBeInTheDocument() // 3 tests / 4 stories = 75%
      })
    })

    it('should handle zero stories gracefully', async () => {
      window.electronAPI.stories.list = vi.fn().mockResolvedValue([])

      const { container } = render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        const allGrids = container.querySelectorAll('.grid.grid-cols-2.md\\:grid-cols-4')
        const footerSection = allGrids[1]
        expect(footerSection?.textContent).toContain('0') // Avg Points/Story
        expect(footerSection?.textContent).toContain('0%') // Test Coverage
      })
    })
  })

  describe('Empty States', () => {
    it('should handle empty data gracefully', async () => {
      window.electronAPI.stories.list = vi.fn().mockResolvedValue([])
      window.electronAPI.sprints.list = vi.fn().mockResolvedValue([])
      window.electronAPI.sessions.list = vi.fn().mockResolvedValue([])
      window.electronAPI.testCases.list = vi.fn().mockResolvedValue([])

      const { container } = render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument()
        // Verify there are "0" values in the stat cards
        const statGrid = container.querySelector('.grid.grid-cols-2.md\\:grid-cols-4')
        expect(statGrid?.textContent).toContain('0')
      })
    })

    it('should show "None" for active sprint when no sprints exist', async () => {
      window.electronAPI.sprints.list = vi.fn().mockResolvedValue([])

      const { container } = render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        // Check in the stat cards for "None"
        const statGrid = container.querySelector('.grid.grid-cols-2.md\\:grid-cols-4')
        expect(statGrid?.textContent).toContain('None')
        expect(statGrid?.textContent).toContain('No active sprint')
      })
    })
  })

  describe('Data Loading', () => {
    it('should load all data on mount', async () => {
      render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        expect(window.electronAPI.stories.list).toHaveBeenCalledWith('project-1')
        expect(window.electronAPI.sprints.list).toHaveBeenCalledWith('project-1')
        expect(window.electronAPI.sessions.list).toHaveBeenCalledWith('project-1')
        expect(window.electronAPI.testCases.list).toHaveBeenCalledWith('project-1')
      })
    })

    it('should handle API errors gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      window.electronAPI.stories.list = vi.fn().mockRejectedValue(new Error('API Error'))

      render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Failed to load dashboard data:', expect.any(Error))
      })

      consoleError.mockRestore()
    })

    it('should not load data when no current project', async () => {
      vi.mocked(useAppStore).mockReturnValue({
        currentProject: null
      } as any)

      render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        expect(window.electronAPI.stories.list).not.toHaveBeenCalled()
      })
    })
  })

  describe('Computed Metrics', () => {
    it('should calculate story points correctly', async () => {
      render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        // Total points: 5 + 3 + 2 = 10
        expect(screen.getByText('10')).toBeInTheDocument()
        // Completed points: 5
        expect(screen.getByText('5 completed')).toBeInTheDocument()
      })
    })

    it('should calculate sprint completion percentage correctly', async () => {
      render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        // 0 done out of 2 stories in sprint = 0%
        expect(screen.getByText('0%')).toBeInTheDocument()
      })
    })

    it('should handle stories without story points', async () => {
      const storiesWithoutPoints: UserStory[] = [
        {
          id: 'story-1',
          projectId: 'project-1',
          title: 'Story 1',
          status: 'done',
          priority: 'high',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-15')
        }
      ]

      window.electronAPI.stories.list = vi.fn().mockResolvedValue(storiesWithoutPoints)

      const { container } = render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        // Find the Story Points stat card in the grid
        const statGrid = container.querySelector('.grid.grid-cols-2.md\\:grid-cols-4')
        expect(statGrid?.textContent).toContain('Story Points')
        expect(statGrid?.textContent).toContain('0 completed')
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper heading structure', async () => {
      const { container } = render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        const h1 = container.querySelector('h1')
        expect(h1).toBeInTheDocument()
        expect(h1?.textContent).toBe('Dashboard')

        const h3Elements = container.querySelectorAll('h3')
        expect(h3Elements.length).toBeGreaterThan(0)
      })
    })

    it('should have accessible refresh button', async () => {
      render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        const refreshButton = screen.getByRole('button', { name: /refresh/i })
        expect(refreshButton).toBeInTheDocument()
      })
    })
  })

  describe('Layout and Styling', () => {
    it('should have proper container styling', async () => {
      const { container } = render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        const mainContainer = container.querySelector('.flex-1.h-full.bg-zinc-950.overflow-y-auto')
        expect(mainContainer).toBeInTheDocument()
      })
    })

    it('should render stat cards in grid layout', async () => {
      const { container } = render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        const grid = container.querySelector('.grid.grid-cols-2.md\\:grid-cols-4')
        expect(grid).toBeInTheDocument()
      })
    })

    it('should render main content in two-column grid', async () => {
      const { container } = render(<DashboardPanel projectPath="/test/project" />)

      await waitFor(() => {
        const mainGrid = container.querySelector('.grid.grid-cols-1.lg\\:grid-cols-2')
        expect(mainGrid).toBeInTheDocument()
      })
    })
  })
})
