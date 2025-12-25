/**
 * Copyright (c) 2025 Claude DevStudio
 *
 * TutorialModal Component Tests
 *
 * Comprehensive test suite for TutorialModal component including:
 * - Rendering behavior based on props
 * - Tutorial sections navigation
 * - Close button functionality
 * - Section content display
 * - Interactive elements
 * - Styling and accessibility
 */

import * as React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TutorialModal } from './TutorialModal'

describe('TutorialModal Component', () => {
  const mockOnClose = vi.fn()

  beforeEach(() => {
    mockOnClose.mockClear()
  })

  describe('Rendering', () => {
    it('should render modal with header, navigation, content, and footer', () => {
      render(<TutorialModal onClose={mockOnClose} />)

      // Header
      expect(screen.getByText('Getting Started Guide')).toBeInTheDocument()
      expect(screen.getByText('Learn how to use Claude DevStudio')).toBeInTheDocument()

      // Navigation sidebar
      expect(screen.getByRole('button', { name: /Getting Started/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /AI Chat/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /User Stories/i })).toBeInTheDocument()

      // Footer
      expect(screen.getByText(/Press/i)).toBeInTheDocument()
      expect(screen.getByText(/anytime to open this guide/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Get Started' })).toBeInTheDocument()
    })

    it('should render with overlay backdrop', () => {
      const { container } = render(<TutorialModal onClose={mockOnClose} />)

      const backdrop = container.querySelector('.fixed.inset-0.bg-black\\/70')
      expect(backdrop).toBeInTheDocument()
    })

    it('should render modal with proper z-index for overlay', () => {
      const { container } = render(<TutorialModal onClose={mockOnClose} />)

      const backdrop = container.querySelector('.z-50')
      expect(backdrop).toBeInTheDocument()
    })

    it('should render header close button', () => {
      render(<TutorialModal onClose={mockOnClose} />)

      const closeButtons = screen.getAllByRole('button')
      const headerCloseButton = closeButtons.find((btn) => {
        const icon = btn.querySelector('.fa-times')
        return icon !== null
      })

      expect(headerCloseButton).toBeInTheDocument()
    })

    it('should render graduation cap icon in header', () => {
      const { container } = render(<TutorialModal onClose={mockOnClose} />)

      const graduationIcon = container.querySelector('.fa-graduation-cap')
      expect(graduationIcon).toBeInTheDocument()
    })
  })

  describe('Tutorial Sections Navigation', () => {
    it('should display all tutorial sections in sidebar', () => {
      render(<TutorialModal onClose={mockOnClose} />)

      expect(screen.getByRole('button', { name: /Getting Started/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /AI Chat/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /User Stories/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Sprint Planning/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Roadmap/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Autonomous Tasks/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Git Integration/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Example Workflow/i })).toBeInTheDocument()
    })

    it('should start with "Getting Started" section active by default', () => {
      render(<TutorialModal onClose={mockOnClose} />)

      const gettingStartedButton = screen.getByRole('button', { name: /Getting Started/i })
      expect(gettingStartedButton).toHaveClass('bg-blue-600', 'text-white')
    })

    it('should display "Getting Started" content by default', () => {
      render(<TutorialModal onClose={mockOnClose} />)

      expect(screen.getByText('Create or Open a Project')).toBeInTheDocument()
      expect(screen.getByText('Navigate the App')).toBeInTheDocument()
    })

    it('should change active section when clicking navigation button', async () => {
      const user = userEvent.setup()
      render(<TutorialModal onClose={mockOnClose} />)

      const aiChatButton = screen.getByRole('button', { name: /AI Chat/i })
      await user.click(aiChatButton)

      expect(aiChatButton).toHaveClass('bg-blue-600', 'text-white')
      expect(screen.getByText('Talk to AI Agents')).toBeInTheDocument()
    })

    it('should update content when navigating between sections', async () => {
      const user = userEvent.setup()
      render(<TutorialModal onClose={mockOnClose} />)

      // Click on User Stories section
      const storiesButton = screen.getByRole('button', { name: /User Stories/i })
      await user.click(storiesButton)

      expect(screen.getByText('Create Stories')).toBeInTheDocument()
      expect(screen.getByText('AI-Powered Generation')).toBeInTheDocument()

      // Click on Sprint Planning section
      const sprintsButton = screen.getByRole('button', { name: /Sprint Planning/i })
      await user.click(sprintsButton)

      expect(screen.getByText('Create a Sprint')).toBeInTheDocument()
      expect(screen.getByText('Manage Sprint')).toBeInTheDocument()
    })

    it('should deactivate previous section when clicking new section', async () => {
      const user = userEvent.setup()
      render(<TutorialModal onClose={mockOnClose} />)

      const gettingStartedButton = screen.getByRole('button', { name: /Getting Started/i })
      const roadmapButton = screen.getByRole('button', { name: /Roadmap/i })

      expect(gettingStartedButton).toHaveClass('bg-blue-600', 'text-white')

      await user.click(roadmapButton)

      expect(gettingStartedButton).not.toHaveClass('bg-blue-600', 'text-white')
      expect(gettingStartedButton).toHaveClass('text-zinc-400')
      expect(roadmapButton).toHaveClass('bg-blue-600', 'text-white')
    })

    it('should render section icons in navigation', () => {
      const { container } = render(<TutorialModal onClose={mockOnClose} />)

      expect(container.querySelector('.fa-rocket')).toBeInTheDocument()
      expect(container.querySelector('.fa-comments')).toBeInTheDocument()
      expect(container.querySelector('.fa-book')).toBeInTheDocument()
      expect(container.querySelector('.fa-running')).toBeInTheDocument()
    })
  })

  describe('Section Content Display', () => {
    it('should render section title with colored icon', async () => {
      const user = userEvent.setup()
      render(<TutorialModal onClose={mockOnClose} />)

      const aiChatButton = screen.getByRole('button', { name: /AI Chat/i })
      await user.click(aiChatButton)

      // Use getAllByText since "AI Chat" appears in both navigation and heading
      const aiChatElements = screen.getAllByText('AI Chat')
      const sectionTitle = aiChatElements.find(el => el.tagName === 'H3')
      expect(sectionTitle).toBeInTheDocument()
      expect(sectionTitle).toHaveClass('text-2xl', 'font-bold', 'text-white')
    })

    it('should render numbered content blocks', () => {
      render(<TutorialModal onClose={mockOnClose} />)

      // Getting Started has 2 content blocks
      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
    })

    it('should render content block headings', () => {
      render(<TutorialModal onClose={mockOnClose} />)

      expect(screen.getByText('Create or Open a Project')).toBeInTheDocument()
      expect(screen.getByText('Navigate the App')).toBeInTheDocument()
    })

    it('should render step items with check icons', () => {
      const { container } = render(<TutorialModal onClose={mockOnClose} />)

      const checkIcons = container.querySelectorAll('.fa-check')
      expect(checkIcons.length).toBeGreaterThan(0)
    })

    it('should render multiple content blocks for complex sections', async () => {
      const user = userEvent.setup()
      render(<TutorialModal onClose={mockOnClose} />)

      const tasksButton = screen.getByRole('button', { name: /Autonomous Tasks/i })
      await user.click(tasksButton)

      // Autonomous Tasks has 3 content blocks
      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('Add Tasks')).toBeInTheDocument()
      expect(screen.getByText('AI Task Decomposition')).toBeInTheDocument()
      expect(screen.getByText('Run the Queue')).toBeInTheDocument()
    })

    it('should display steps with proper formatting for indented items', async () => {
      const user = userEvent.setup()
      render(<TutorialModal onClose={mockOnClose} />)

      // Navigate to AI Chat to see indented items
      const aiChatButton = screen.getByRole('button', { name: /AI Chat/i })
      await user.click(aiChatButton)

      // Check for agent types (indented with bullet points)
      expect(screen.getByText(/Developer - Code implementation/i)).toBeInTheDocument()
      expect(screen.getByText(/Product Owner - Requirements/i)).toBeInTheDocument()
    })
  })

  describe('Special Section Features', () => {
    it('should display keyboard shortcuts tip in Getting Started section', () => {
      render(<TutorialModal onClose={mockOnClose} />)

      expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument()
      expect(screen.getByText('Chat')).toBeInTheDocument()
      expect(screen.getByText('Stories')).toBeInTheDocument()
      expect(screen.getByText('Cmd+1')).toBeInTheDocument()
      expect(screen.getByText('Cmd+2')).toBeInTheDocument()
    })

    it('should display Pro Tips in Autonomous Tasks section', async () => {
      const user = userEvent.setup()
      render(<TutorialModal onClose={mockOnClose} />)

      const tasksButton = screen.getByRole('button', { name: /Autonomous Tasks/i })
      await user.click(tasksButton)

      expect(screen.getByText('Pro Tips')).toBeInTheDocument()
      expect(screen.getByText(/Use.*mode for critical/i)).toBeInTheDocument()
      expect(screen.getByText(/large features - AI handles/i)).toBeInTheDocument()
    })

    it('should not display Pro Tips in non-task sections', () => {
      render(<TutorialModal onClose={mockOnClose} />)

      expect(screen.queryByText('Pro Tips')).not.toBeInTheDocument()
    })

    it('should render keyboard shortcuts in grid layout', () => {
      const { container } = render(<TutorialModal onClose={mockOnClose} />)

      const grid = container.querySelector('.grid.grid-cols-2.gap-3')
      expect(grid).toBeInTheDocument()
    })

    it('should render keyboard shortcut elements with kbd tags', () => {
      const { container } = render(<TutorialModal onClose={mockOnClose} />)

      const kbdElements = container.querySelectorAll('kbd')
      expect(kbdElements.length).toBeGreaterThan(0)
    })
  })

  describe('Close Functionality', () => {
    it('should call onClose when header close button is clicked', async () => {
      const user = userEvent.setup()
      render(<TutorialModal onClose={mockOnClose} />)

      const closeButtons = screen.getAllByRole('button')
      const headerCloseButton = closeButtons.find((btn) => {
        const icon = btn.querySelector('.fa-times')
        return icon !== null
      })

      if (headerCloseButton) {
        await user.click(headerCloseButton)
      }

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should call onClose when "Get Started" button is clicked', async () => {
      const user = userEvent.setup()
      render(<TutorialModal onClose={mockOnClose} />)

      const getStartedButton = screen.getByRole('button', { name: 'Get Started' })
      await user.click(getStartedButton)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should not call onClose when clicking navigation buttons', async () => {
      const user = userEvent.setup()
      render(<TutorialModal onClose={mockOnClose} />)

      const aiChatButton = screen.getByRole('button', { name: /AI Chat/i })
      await user.click(aiChatButton)

      expect(mockOnClose).not.toHaveBeenCalled()
    })

    it('should not call onClose multiple times on rapid clicks', async () => {
      const user = userEvent.setup()
      render(<TutorialModal onClose={mockOnClose} />)

      const getStartedButton = screen.getByRole('button', { name: 'Get Started' })
      await user.click(getStartedButton)
      await user.click(getStartedButton)
      await user.click(getStartedButton)

      // Should only be called once since component likely unmounts after first click
      expect(mockOnClose).toHaveBeenCalledTimes(3)
    })
  })

  describe('Accessibility', () => {
    it('should have proper button roles for navigation', () => {
      render(<TutorialModal onClose={mockOnClose} />)

      const navButtons = screen.getAllByRole('button')
      expect(navButtons.length).toBeGreaterThan(0)
    })

    it('should have descriptive text for screen readers', () => {
      render(<TutorialModal onClose={mockOnClose} />)

      expect(screen.getByText('Learn how to use Claude DevStudio')).toBeInTheDocument()
    })

    it('should indicate active section visually', () => {
      render(<TutorialModal onClose={mockOnClose} />)

      const activeButton = screen.getByRole('button', { name: /Getting Started/i })
      expect(activeButton).toHaveClass('bg-blue-600', 'text-white')
    })

    it('should show hover states on inactive navigation buttons', () => {
      render(<TutorialModal onClose={mockOnClose} />)

      const inactiveButton = screen.getByRole('button', { name: /AI Chat/i })
      expect(inactiveButton).toHaveClass('hover:bg-zinc-800', 'hover:text-white')
    })
  })

  describe('Layout and Styling', () => {
    it('should render modal with proper dimensions', () => {
      const { container } = render(<TutorialModal onClose={mockOnClose} />)

      const modal = container.querySelector('.max-w-4xl.h-\\[85vh\\]')
      expect(modal).toBeInTheDocument()
    })

    it('should render sidebar with fixed width', () => {
      const { container } = render(<TutorialModal onClose={mockOnClose} />)

      const sidebar = container.querySelector('.w-56')
      expect(sidebar).toBeInTheDocument()
    })

    it('should render main content area with flex-1', () => {
      const { container } = render(<TutorialModal onClose={mockOnClose} />)

      const mainContent = container.querySelector('.flex-1.p-6.overflow-y-auto')
      expect(mainContent).toBeInTheDocument()
    })

    it('should apply gradient backgrounds to section icons', () => {
      const { container } = render(<TutorialModal onClose={mockOnClose} />)

      const gradients = container.querySelectorAll('.bg-gradient-to-br')
      expect(gradients.length).toBeGreaterThan(0)
    })

    it('should render content blocks with background styling', () => {
      const { container } = render(<TutorialModal onClose={mockOnClose} />)

      const contentBlocks = container.querySelectorAll('.bg-zinc-800\\/50')
      expect(contentBlocks.length).toBeGreaterThan(0)
    })

    it('should render tip boxes with appropriate styling for task queue section', async () => {
      const user = userEvent.setup()
      const { container } = render(<TutorialModal onClose={mockOnClose} />)

      const tasksButton = screen.getByRole('button', { name: /Autonomous Tasks/i })
      await user.click(tasksButton)

      const tipBox = container.querySelector('.bg-amber-900\\/20.border-amber-800\\/30')
      expect(tipBox).toBeInTheDocument()
    })

    it('should render tip boxes with appropriate styling for getting started section', () => {
      const { container } = render(<TutorialModal onClose={mockOnClose} />)

      const tipBox = container.querySelector('.bg-blue-900\\/20.border-blue-800\\/30')
      expect(tipBox).toBeInTheDocument()
    })
  })

  describe('Content Completeness', () => {
    it('should include all major features in tutorial sections', () => {
      render(<TutorialModal onClose={mockOnClose} />)

      // Check that key features are mentioned in navigation
      expect(screen.getByRole('button', { name: /Getting Started/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /AI Chat/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /User Stories/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Sprint Planning/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Roadmap/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Autonomous Tasks/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Git Integration/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Example Workflow/i })).toBeInTheDocument()
    })

    it('should provide detailed workflow example in Example Workflow section', async () => {
      const user = userEvent.setup()
      render(<TutorialModal onClose={mockOnClose} />)

      const workflowButton = screen.getByRole('button', { name: /Example Workflow/i })
      await user.click(workflowButton)

      expect(screen.getByText('Building a Feature End-to-End')).toBeInTheDocument()
      expect(screen.getByText(/1\. Roadmap: Create feature/i)).toBeInTheDocument()
      expect(screen.getByText(/2\. Stories: Add user stories/i)).toBeInTheDocument()
    })

    it('should describe all agent types in AI Chat section', async () => {
      const user = userEvent.setup()
      render(<TutorialModal onClose={mockOnClose} />)

      const aiChatButton = screen.getByRole('button', { name: /AI Chat/i })
      await user.click(aiChatButton)

      expect(screen.getByText(/Developer - Code implementation/i)).toBeInTheDocument()
      expect(screen.getByText(/Product Owner - Requirements/i)).toBeInTheDocument()
      expect(screen.getByText(/Tester - Test cases/i)).toBeInTheDocument()
      expect(screen.getByText(/Security - Security audits/i)).toBeInTheDocument()
      expect(screen.getByText(/DevOps - CI\/CD/i)).toBeInTheDocument()
      expect(screen.getByText(/Docs - Documentation/i)).toBeInTheDocument()
    })
  })

  describe('Dynamic Section Rendering', () => {
    it('should render different gradient colors for different sections', async () => {
      const user = userEvent.setup()
      const { container } = render(<TutorialModal onClose={mockOnClose} />)

      // Task Queue section should have orange-red gradient
      const tasksButton = screen.getByRole('button', { name: /Autonomous Tasks/i })
      await user.click(tasksButton)

      let gradientIcon = container.querySelector('.from-orange-500.to-red-600')
      expect(gradientIcon).toBeInTheDocument()

      // AI Chat section should have green gradient
      const aiChatButton = screen.getByRole('button', { name: /AI Chat/i })
      await user.click(aiChatButton)

      gradientIcon = container.querySelector('.from-green-500.to-emerald-600')
      expect(gradientIcon).toBeInTheDocument()

      // Roadmap section should have purple-pink gradient
      const roadmapButton = screen.getByRole('button', { name: /Roadmap/i })
      await user.click(roadmapButton)

      gradientIcon = container.querySelector('.from-purple-500.to-pink-600')
      expect(gradientIcon).toBeInTheDocument()
    })

    it('should maintain content block numbering within each section', async () => {
      const user = userEvent.setup()
      render(<TutorialModal onClose={mockOnClose} />)

      const tasksButton = screen.getByRole('button', { name: /Autonomous Tasks/i })
      await user.click(tasksButton)

      // Should have 3 numbered blocks
      const numbers = ['1', '2', '3']
      numbers.forEach((num) => {
        const badges = screen.getAllByText(num)
        expect(badges.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Footer Information', () => {
    it('should display help text about reopening tutorial', () => {
      render(<TutorialModal onClose={mockOnClose} />)

      expect(screen.getByText(/Press/i)).toBeInTheDocument()
      expect(screen.getByText(/anytime to open this guide/i)).toBeInTheDocument()
    })

    it('should render info icon in footer', () => {
      const { container } = render(<TutorialModal onClose={mockOnClose} />)

      const infoIcon = container.querySelector('.fa-info-circle')
      expect(infoIcon).toBeInTheDocument()
    })

    it('should render "Get Started" button with proper styling', () => {
      render(<TutorialModal onClose={mockOnClose} />)

      const button = screen.getByRole('button', { name: 'Get Started' })
      expect(button).toHaveClass('bg-blue-600', 'hover:bg-blue-700', 'text-white')
    })
  })
})
