/**
 * Claude DevStudio
 * Copyright (c) 2024 Claude DevStudio Contributors
 * Licensed under MIT License - see LICENSE file
 */

import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StatusBar } from './StatusBar'
import { useAppStore } from '../stores/appStore'
import type { ClaudeStatus, Project } from '@shared/types'

// Mock the appStore
vi.mock('../stores/appStore', () => ({
  useAppStore: vi.fn()
}))

describe('StatusBar', () => {
  const mockUseAppStore = useAppStore as unknown as ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Reset mock before each test
    mockUseAppStore.mockReturnValue({
      claudeStatus: null,
      isLoading: false,
      currentProject: null
    })
  })

  describe('Claude Status Indicator', () => {
    it('should render with no Claude status', () => {
      mockUseAppStore.mockReturnValue({
        claudeStatus: null,
        isLoading: false,
        currentProject: null
      })

      render(<StatusBar />)

      // Should show red dot and "Claude Not Found" text
      const statusContainer = screen.getByText('Claude Not Found').parentElement
      expect(statusContainer).toBeInTheDocument()
      const redDot = statusContainer?.querySelector('.bg-red-500')
      expect(redDot).toBeInTheDocument()
    })

    it('should show green dot when Claude is installed and authenticated', () => {
      const claudeStatus: ClaudeStatus = {
        installed: true,
        authenticated: true,
        version: '1.0.0'
      }

      mockUseAppStore.mockReturnValue({
        claudeStatus,
        isLoading: false,
        currentProject: null
      })

      render(<StatusBar />)

      expect(screen.getByText('Claude Connected')).toBeInTheDocument()
      const statusContainer = screen.getByText('Claude Connected').parentElement
      const greenDot = statusContainer?.querySelector('.bg-green-500')
      expect(greenDot).toBeInTheDocument()
    })

    it('should show yellow dot when Claude is installed but not authenticated', () => {
      const claudeStatus: ClaudeStatus = {
        installed: true,
        authenticated: false,
        version: null
      }

      mockUseAppStore.mockReturnValue({
        claudeStatus,
        isLoading: false,
        currentProject: null
      })

      render(<StatusBar />)

      expect(screen.getByText('Auth Required')).toBeInTheDocument()
      const statusContainer = screen.getByText('Auth Required').parentElement
      const yellowDot = statusContainer?.querySelector('.bg-yellow-500')
      expect(yellowDot).toBeInTheDocument()
    })

    it('should show red dot when Claude is not installed', () => {
      const claudeStatus: ClaudeStatus = {
        installed: false,
        authenticated: false,
        version: null
      }

      mockUseAppStore.mockReturnValue({
        claudeStatus,
        isLoading: false,
        currentProject: null
      })

      render(<StatusBar />)

      expect(screen.getByText('Claude Not Found')).toBeInTheDocument()
      const statusContainer = screen.getByText('Claude Not Found').parentElement
      const redDot = statusContainer?.querySelector('.bg-red-500')
      expect(redDot).toBeInTheDocument()
    })
  })

  describe('Loading Indicator', () => {
    it('should show loading spinner when isLoading is true', () => {
      mockUseAppStore.mockReturnValue({
        claudeStatus: null,
        isLoading: true,
        currentProject: null
      })

      render(<StatusBar />)

      expect(screen.getByText('Processing...')).toBeInTheDocument()
      // Check for spinner with animation class
      const spinner = screen.getByText('Processing...').parentElement?.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
      expect(spinner).toHaveClass('w-3', 'h-3', 'border-2', 'border-primary', 'border-t-transparent', 'rounded-full')
    })

    it('should not show loading spinner when isLoading is false', () => {
      mockUseAppStore.mockReturnValue({
        claudeStatus: null,
        isLoading: false,
        currentProject: null
      })

      render(<StatusBar />)

      expect(screen.queryByText('Processing...')).not.toBeInTheDocument()
    })
  })

  describe('Current Project Display', () => {
    it('should show current project name when project is selected', () => {
      const currentProject: Project = {
        id: 'project-1',
        name: 'Test Project',
        path: '/Users/test/project',
        createdAt: new Date(),
        lastOpenedAt: new Date()
      }

      mockUseAppStore.mockReturnValue({
        claudeStatus: null,
        isLoading: false,
        currentProject
      })

      render(<StatusBar />)

      const projectElement = screen.getByText('Test Project')
      expect(projectElement).toBeInTheDocument()
      expect(projectElement).toHaveAttribute('title', '/Users/test/project')
      expect(projectElement).toHaveClass('truncate', 'max-w-[200px]')
    })

    it('should not show project when none is selected', () => {
      mockUseAppStore.mockReturnValue({
        claudeStatus: null,
        isLoading: false,
        currentProject: null
      })

      const { container } = render(<StatusBar />)

      // Check that there's no project name in the right side section
      const rightSection = container.querySelector('.flex.items-center.gap-4:last-child')
      expect(rightSection?.textContent).not.toContain('Test Project')
    })
  })

  describe('Claude Version Display', () => {
    it('should show Claude version when available', () => {
      const claudeStatus: ClaudeStatus = {
        installed: true,
        authenticated: true,
        version: '1.2.3'
      }

      mockUseAppStore.mockReturnValue({
        claudeStatus,
        isLoading: false,
        currentProject: null
      })

      render(<StatusBar />)

      expect(screen.getByText('Claude 1.2.3')).toBeInTheDocument()
      const versionElement = screen.getByText('Claude 1.2.3')
      expect(versionElement).toHaveClass('opacity-60')
    })

    it('should not show Claude version when not available', () => {
      const claudeStatus: ClaudeStatus = {
        installed: true,
        authenticated: true,
        version: null
      }

      mockUseAppStore.mockReturnValue({
        claudeStatus,
        isLoading: false,
        currentProject: null
      })

      render(<StatusBar />)

      expect(screen.queryByText(/Claude \d/)).not.toBeInTheDocument()
    })

    it('should not show Claude version when status is null', () => {
      mockUseAppStore.mockReturnValue({
        claudeStatus: null,
        isLoading: false,
        currentProject: null
      })

      render(<StatusBar />)

      expect(screen.queryByText(/Claude \d/)).not.toBeInTheDocument()
    })
  })

  describe('Combined States', () => {
    it('should show all elements when fully configured', () => {
      const claudeStatus: ClaudeStatus = {
        installed: true,
        authenticated: true,
        version: '2.0.0'
      }

      const currentProject: Project = {
        id: 'project-2',
        name: 'My Awesome Project',
        path: '/home/user/projects/awesome',
        description: 'An awesome project',
        createdAt: new Date(),
        lastOpenedAt: new Date()
      }

      mockUseAppStore.mockReturnValue({
        claudeStatus,
        isLoading: true,
        currentProject
      })

      render(<StatusBar />)

      // Should show all elements
      expect(screen.getByText('Claude Connected')).toBeInTheDocument()
      expect(screen.getByText('Processing...')).toBeInTheDocument()
      expect(screen.getByText('My Awesome Project')).toBeInTheDocument()
      expect(screen.getByText('Claude 2.0.0')).toBeInTheDocument()
    })

    it('should show correct status for installed but unauthenticated with project', () => {
      const claudeStatus: ClaudeStatus = {
        installed: true,
        authenticated: false,
        version: '1.5.0'
      }

      const currentProject: Project = {
        id: 'project-3',
        name: 'Another Project',
        path: '/var/projects/another',
        createdAt: new Date(),
        lastOpenedAt: new Date()
      }

      mockUseAppStore.mockReturnValue({
        claudeStatus,
        isLoading: false,
        currentProject
      })

      render(<StatusBar />)

      expect(screen.getByText('Auth Required')).toBeInTheDocument()
      expect(screen.getByText('Another Project')).toBeInTheDocument()
      expect(screen.getByText('Claude 1.5.0')).toBeInTheDocument()
      expect(screen.queryByText('Processing...')).not.toBeInTheDocument()
    })
  })

  describe('Layout and Styling', () => {
    it('should have correct layout classes', () => {
      const { container } = render(<StatusBar />)

      const statusBar = container.firstChild as HTMLElement
      expect(statusBar).toHaveClass(
        'h-6',
        'bg-card',
        'border-t',
        'border-border',
        'flex',
        'items-center',
        'justify-between',
        'px-4',
        'text-xs',
        'text-muted-foreground'
      )
    })

    it('should have left and right sections with correct structure', () => {
      const claudeStatus: ClaudeStatus = {
        installed: true,
        authenticated: true,
        version: '1.0.0'
      }

      const currentProject: Project = {
        id: 'project-1',
        name: 'Test',
        path: '/test',
        createdAt: new Date(),
        lastOpenedAt: new Date()
      }

      mockUseAppStore.mockReturnValue({
        claudeStatus,
        isLoading: true,
        currentProject
      })

      const { container } = render(<StatusBar />)

      const sections = container.querySelectorAll('.flex.items-center.gap-4')
      expect(sections).toHaveLength(2) // Left and right sections

      // Left section should contain Claude status and loading indicator
      const leftSection = sections[0]
      expect(leftSection.textContent).toContain('Claude Connected')
      expect(leftSection.textContent).toContain('Processing...')

      // Right section should contain project name and version
      const rightSection = sections[1]
      expect(rightSection.textContent).toContain('Test')
      expect(rightSection.textContent).toContain('Claude 1.0.0')
    })
  })
})
