/**
 * Claude DevStudio
 * Copyright (c) 2024 Claude DevStudio Contributors
 * Licensed under MIT License - see LICENSE file
 *
 * Titlebar component tests
 *
 * @vitest-environment jsdom
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Titlebar } from './Titlebar'
import { useAppStore } from '../stores/appStore'

// Mock the appStore
vi.mock('../stores/appStore', () => ({
  useAppStore: vi.fn()
}))

describe('Titlebar', () => {
  const mockToggleSidebar = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render the titlebar with default app name when no project is selected', () => {
      vi.mocked(useAppStore).mockReturnValue({
        currentProject: null,
        toggleSidebar: mockToggleSidebar,
        isSidebarOpen: true
      } as any)

      render(<Titlebar />)

      expect(screen.getByText('Claude DevStudio')).toBeInTheDocument()
    })

    it('should render the titlebar with project name when project is selected', () => {
      const mockProject = {
        id: 'project-1',
        name: 'My Awesome Project',
        path: '/path/to/project',
        createdAt: Date.now()
      }

      vi.mocked(useAppStore).mockReturnValue({
        currentProject: mockProject,
        toggleSidebar: mockToggleSidebar,
        isSidebarOpen: true
      } as any)

      render(<Titlebar />)

      expect(screen.getByText('My Awesome Project')).toBeInTheDocument()
      expect(screen.queryByText('Claude DevStudio')).not.toBeInTheDocument()
    })

    it('should render the app logo icon', () => {
      vi.mocked(useAppStore).mockReturnValue({
        currentProject: null,
        toggleSidebar: mockToggleSidebar,
        isSidebarOpen: true
      } as any)

      const { container } = render(<Titlebar />)

      // Check for SVG logo with specific color (select by fill attribute to distinguish from hamburger menu)
      const logoSvg = container.querySelector('svg[fill="currentColor"]')
      expect(logoSvg).toBeInTheDocument()
      expect(logoSvg).toHaveClass('text-[#D97757]')
    })

    it('should render version information', () => {
      vi.mocked(useAppStore).mockReturnValue({
        currentProject: null,
        toggleSidebar: mockToggleSidebar,
        isSidebarOpen: true
      } as any)

      render(<Titlebar />)

      expect(screen.getByText('MVP v0.1')).toBeInTheDocument()
    })

    it('should render sidebar toggle button', () => {
      vi.mocked(useAppStore).mockReturnValue({
        currentProject: null,
        toggleSidebar: mockToggleSidebar,
        isSidebarOpen: true
      } as any)

      render(<Titlebar />)

      const toggleButton = screen.getByRole('button', { name: /hide sidebar/i })
      expect(toggleButton).toBeInTheDocument()
    })

    it('should have titlebar-drag class for window dragging', () => {
      vi.mocked(useAppStore).mockReturnValue({
        currentProject: null,
        toggleSidebar: mockToggleSidebar,
        isSidebarOpen: true
      } as any)

      const { container } = render(<Titlebar />)

      const titlebar = container.querySelector('.titlebar-drag')
      expect(titlebar).toBeInTheDocument()
    })

    it('should have titlebar-no-drag class on interactive elements', () => {
      vi.mocked(useAppStore).mockReturnValue({
        currentProject: null,
        toggleSidebar: mockToggleSidebar,
        isSidebarOpen: true
      } as any)

      const { container } = render(<Titlebar />)

      const noDragElements = container.querySelectorAll('.titlebar-no-drag')
      expect(noDragElements.length).toBeGreaterThan(0)
    })
  })

  describe('Sidebar Toggle', () => {
    it('should call toggleSidebar when toggle button is clicked', () => {
      vi.mocked(useAppStore).mockReturnValue({
        currentProject: null,
        toggleSidebar: mockToggleSidebar,
        isSidebarOpen: true
      } as any)

      render(<Titlebar />)

      const toggleButton = screen.getByRole('button', { name: /hide sidebar/i })
      fireEvent.click(toggleButton)

      expect(mockToggleSidebar).toHaveBeenCalledTimes(1)
    })

    it('should show "Hide sidebar" title when sidebar is open', () => {
      vi.mocked(useAppStore).mockReturnValue({
        currentProject: null,
        toggleSidebar: mockToggleSidebar,
        isSidebarOpen: true
      } as any)

      render(<Titlebar />)

      const toggleButton = screen.getByRole('button', { name: /hide sidebar/i })
      expect(toggleButton).toHaveAttribute('title', 'Hide sidebar')
    })

    it('should show "Show sidebar" title when sidebar is closed', () => {
      vi.mocked(useAppStore).mockReturnValue({
        currentProject: null,
        toggleSidebar: mockToggleSidebar,
        isSidebarOpen: false
      } as any)

      render(<Titlebar />)

      const toggleButton = screen.getByRole('button', { name: /show sidebar/i })
      expect(toggleButton).toHaveAttribute('title', 'Show sidebar')
    })

    it('should display hamburger menu icon on toggle button', () => {
      vi.mocked(useAppStore).mockReturnValue({
        currentProject: null,
        toggleSidebar: mockToggleSidebar,
        isSidebarOpen: true
      } as any)

      const { container } = render(<Titlebar />)

      const toggleButton = screen.getByRole('button', { name: /hide sidebar/i })
      const hamburgerIcon = toggleButton.querySelector('svg')

      expect(hamburgerIcon).toBeInTheDocument()
      expect(hamburgerIcon?.querySelector('path')).toHaveAttribute('d', 'M4 6h16M4 12h16M4 18h16')
    })
  })

  describe('Layout and Structure', () => {
    it('should have proper height and styling classes', () => {
      vi.mocked(useAppStore).mockReturnValue({
        currentProject: null,
        toggleSidebar: mockToggleSidebar,
        isSidebarOpen: true
      } as any)

      const { container } = render(<Titlebar />)

      const titlebar = container.firstChild as HTMLElement
      expect(titlebar).toHaveClass('h-12')
      expect(titlebar).toHaveClass('bg-card')
      expect(titlebar).toHaveClass('border-b')
      expect(titlebar).toHaveClass('border-border')
    })

    it('should center the title using absolute positioning', () => {
      vi.mocked(useAppStore).mockReturnValue({
        currentProject: null,
        toggleSidebar: mockToggleSidebar,
        isSidebarOpen: true
      } as any)

      const { container } = render(<Titlebar />)

      const titleContainer = container.querySelector('.absolute.left-1\\/2')
      expect(titleContainer).toBeInTheDocument()
      expect(titleContainer).toHaveClass('transform')
      expect(titleContainer).toHaveClass('-translate-x-1/2')
    })

    it('should allocate space for macOS traffic lights', () => {
      vi.mocked(useAppStore).mockReturnValue({
        currentProject: null,
        toggleSidebar: mockToggleSidebar,
        isSidebarOpen: true
      } as any)

      const { container } = render(<Titlebar />)

      const trafficLightSpace = container.querySelector('.w-20')
      expect(trafficLightSpace).toBeInTheDocument()
    })

    it('should arrange elements with flexbox', () => {
      vi.mocked(useAppStore).mockReturnValue({
        currentProject: null,
        toggleSidebar: mockToggleSidebar,
        isSidebarOpen: true
      } as any)

      const { container } = render(<Titlebar />)

      const titlebar = container.firstChild as HTMLElement
      expect(titlebar).toHaveClass('flex')
      expect(titlebar).toHaveClass('items-center')
      expect(titlebar).toHaveClass('justify-between')
    })
  })

  describe('Project State Handling', () => {
    it('should update title when project changes from null to selected', () => {
      const { rerender } = render(<Titlebar />)

      // Initial render with no project
      vi.mocked(useAppStore).mockReturnValue({
        currentProject: null,
        toggleSidebar: mockToggleSidebar,
        isSidebarOpen: true
      } as any)

      rerender(<Titlebar />)
      expect(screen.getByText('Claude DevStudio')).toBeInTheDocument()

      // Update with project selected
      vi.mocked(useAppStore).mockReturnValue({
        currentProject: {
          id: 'proj-1',
          name: 'New Project',
          path: '/path',
          createdAt: Date.now()
        },
        toggleSidebar: mockToggleSidebar,
        isSidebarOpen: true
      } as any)

      rerender(<Titlebar />)
      expect(screen.getByText('New Project')).toBeInTheDocument()
      expect(screen.queryByText('Claude DevStudio')).not.toBeInTheDocument()
    })

    it('should handle project with empty name gracefully', () => {
      vi.mocked(useAppStore).mockReturnValue({
        currentProject: {
          id: 'proj-1',
          name: '',
          path: '/path',
          createdAt: Date.now()
        },
        toggleSidebar: mockToggleSidebar,
        isSidebarOpen: true
      } as any)

      const { container } = render(<Titlebar />)

      // Should render empty string, not crash
      const title = container.querySelector('h1')
      expect(title).toBeInTheDocument()
      expect(title?.textContent).toBe('')
    })

    it('should handle project with special characters in name', () => {
      vi.mocked(useAppStore).mockReturnValue({
        currentProject: {
          id: 'proj-1',
          name: 'Project <>&"\'',
          path: '/path',
          createdAt: Date.now()
        },
        toggleSidebar: mockToggleSidebar,
        isSidebarOpen: true
      } as any)

      render(<Titlebar />)

      expect(screen.getByText('Project <>&"\'')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have accessible button with proper title attribute', () => {
      vi.mocked(useAppStore).mockReturnValue({
        currentProject: null,
        toggleSidebar: mockToggleSidebar,
        isSidebarOpen: true
      } as any)

      render(<Titlebar />)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('title')
    })

    it('should render semantic HTML heading for title', () => {
      vi.mocked(useAppStore).mockReturnValue({
        currentProject: null,
        toggleSidebar: mockToggleSidebar,
        isSidebarOpen: true
      } as any)

      const { container } = render(<Titlebar />)

      const heading = container.querySelector('h1')
      expect(heading).toBeInTheDocument()
      expect(heading?.textContent).toBe('Claude DevStudio')
    })

    it('should have proper SVG attributes for accessibility', () => {
      vi.mocked(useAppStore).mockReturnValue({
        currentProject: null,
        toggleSidebar: mockToggleSidebar,
        isSidebarOpen: true
      } as any)

      const { container } = render(<Titlebar />)

      const svgs = container.querySelectorAll('svg')
      svgs.forEach(svg => {
        expect(svg).toHaveAttribute('viewBox')
      })
    })
  })
})
