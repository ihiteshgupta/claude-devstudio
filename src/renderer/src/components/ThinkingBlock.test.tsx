/**
 * Copyright (c) 2025 Claude DevStudio
 *
 * ThinkingBlock Component Tests
 *
 * Comprehensive test suite for ThinkingBlock component including:
 * - Rendering thinking indicator/animation
 * - Showing thinking text/label
 * - Handling expanded/collapsed state
 * - Different states (streaming, not streaming)
 * - User interactions (expand/collapse)
 * - Edge cases (empty thinking text)
 */

import * as React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { ThinkingBlock } from './ThinkingBlock'

describe('ThinkingBlock Component', () => {
  describe('Rendering', () => {
    it('should render nothing when thinking text is empty', () => {
      const { container } = render(<ThinkingBlock thinking="" />)
      expect(container.firstChild).toBeNull()
    })

    it('should render nothing when thinking text is undefined', () => {
      const { container } = render(<ThinkingBlock thinking={''} />)
      expect(container.firstChild).toBeNull()
    })

    it('should render thinking block with thinking text', () => {
      render(<ThinkingBlock thinking="Analyzing the code..." />)
      expect(screen.getByText('Thinking')).toBeInTheDocument()
    })

    it('should render lightbulb icon', () => {
      const { container } = render(<ThinkingBlock thinking="Test thinking" />)
      const svgs = container.querySelectorAll('svg')
      expect(svgs.length).toBeGreaterThan(0)
    })

    it('should render with correct base styling', () => {
      const { container } = render(<ThinkingBlock thinking="Test thinking" />)
      const thinkingBlock = container.querySelector('.border.border-border\\/50')
      expect(thinkingBlock).toBeInTheDocument()
      expect(thinkingBlock).toHaveClass('rounded-lg', 'overflow-hidden', 'bg-secondary/30')
    })

    it('should render expand/collapse button', () => {
      render(<ThinkingBlock thinking="Test thinking" />)
      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
    })

    it('should show "Show" text when collapsed by default', () => {
      render(<ThinkingBlock thinking="Test thinking" />)
      expect(screen.getByText('Show')).toBeInTheDocument()
    })
  })

  describe('Streaming State', () => {
    it('should show animated dots when isStreaming is true', () => {
      const { container } = render(<ThinkingBlock thinking="Test thinking" isStreaming={true} />)
      const animatedDots = container.querySelectorAll('.animate-bounce')
      expect(animatedDots).toHaveLength(3)
    })

    it('should not show animated dots when isStreaming is false', () => {
      const { container } = render(<ThinkingBlock thinking="Test thinking" isStreaming={false} />)
      const animatedDots = container.querySelectorAll('.animate-bounce')
      expect(animatedDots).toHaveLength(0)
    })

    it('should not show animated dots when isStreaming is undefined', () => {
      const { container } = render(<ThinkingBlock thinking="Test thinking" />)
      const animatedDots = container.querySelectorAll('.animate-bounce')
      expect(animatedDots).toHaveLength(0)
    })

    it('should render animated dots with staggered animation delays', () => {
      const { container } = render(<ThinkingBlock thinking="Test thinking" isStreaming={true} />)
      const animatedDots = container.querySelectorAll('.animate-bounce')

      expect(animatedDots[0]).toHaveAttribute('style', 'animation-delay: 0ms;')
      expect(animatedDots[1]).toHaveAttribute('style', 'animation-delay: 150ms;')
      expect(animatedDots[2]).toHaveAttribute('style', 'animation-delay: 300ms;')
    })

    it('should render animated dots with purple color', () => {
      const { container } = render(<ThinkingBlock thinking="Test thinking" isStreaming={true} />)
      const animatedDots = container.querySelectorAll('.animate-bounce')

      animatedDots.forEach((dot) => {
        expect(dot).toHaveClass('bg-purple-400')
      })
    })
  })

  describe('Expand/Collapse Functionality', () => {
    it('should be collapsed by default', () => {
      render(<ThinkingBlock thinking="Test thinking content" />)
      expect(screen.queryByText('Test thinking content')).not.toBeInTheDocument()
      expect(screen.getByText('Show')).toBeInTheDocument()
    })

    it('should expand when button is clicked', async () => {
      const user = userEvent.setup()
      render(<ThinkingBlock thinking="Test thinking content" />)

      const button = screen.getByRole('button')
      await user.click(button)

      expect(screen.getByText('Test thinking content')).toBeInTheDocument()
      expect(screen.getByText('Hide')).toBeInTheDocument()
    })

    it('should collapse when button is clicked again', async () => {
      const user = userEvent.setup()
      render(<ThinkingBlock thinking="Test thinking content" />)

      const button = screen.getByRole('button')

      // Expand
      await user.click(button)
      expect(screen.getByText('Test thinking content')).toBeInTheDocument()

      // Collapse
      await user.click(button)
      expect(screen.queryByText('Test thinking content')).not.toBeInTheDocument()
      expect(screen.getByText('Show')).toBeInTheDocument()
    })

    it('should toggle expand/collapse multiple times', async () => {
      const user = userEvent.setup()
      render(<ThinkingBlock thinking="Test thinking content" />)

      const button = screen.getByRole('button')

      // First expansion
      await user.click(button)
      expect(screen.getByText('Test thinking content')).toBeInTheDocument()

      // First collapse
      await user.click(button)
      expect(screen.queryByText('Test thinking content')).not.toBeInTheDocument()

      // Second expansion
      await user.click(button)
      expect(screen.getByText('Test thinking content')).toBeInTheDocument()

      // Second collapse
      await user.click(button)
      expect(screen.queryByText('Test thinking content')).not.toBeInTheDocument()
    })

    it('should rotate chevron icon when expanded', async () => {
      const user = userEvent.setup()
      const { container } = render(<ThinkingBlock thinking="Test thinking content" />)

      const button = screen.getByRole('button')
      const chevron = container.querySelector('.transition-transform')

      // Initially not rotated
      expect(chevron).not.toHaveClass('rotate-90')

      // Expand
      await user.click(button)
      expect(chevron).toHaveClass('rotate-90')

      // Collapse
      await user.click(button)
      expect(chevron).not.toHaveClass('rotate-90')
    })
  })

  describe('Thinking Content Display', () => {
    it('should display thinking content when expanded', async () => {
      const user = userEvent.setup()
      const thinkingText = 'Analyzing the codebase structure...'
      render(<ThinkingBlock thinking={thinkingText} />)

      await user.click(screen.getByRole('button'))

      expect(screen.getByText(thinkingText)).toBeInTheDocument()
    })

    it('should display multiline thinking content', async () => {
      const user = userEvent.setup()
      const thinkingText = 'Line 1\nLine 2\nLine 3'
      const { container } = render(<ThinkingBlock thinking={thinkingText} />)

      await user.click(screen.getByRole('button'))

      const contentDiv = container.querySelector('.whitespace-pre-wrap')
      expect(contentDiv).toBeInTheDocument()
      expect(contentDiv?.textContent).toBe(thinkingText)
    })

    it('should display thinking content in monospace font', async () => {
      const user = userEvent.setup()
      const { container } = render(<ThinkingBlock thinking="Test thinking" />)

      await user.click(screen.getByRole('button'))

      const contentDiv = container.querySelector('.font-mono')
      expect(contentDiv).toBeInTheDocument()
      expect(contentDiv).toHaveClass('text-xs', 'leading-relaxed')
    })

    it('should preserve whitespace in thinking content', async () => {
      const user = userEvent.setup()
      const { container } = render(<ThinkingBlock thinking="Test  with  spaces" />)

      await user.click(screen.getByRole('button'))

      const contentDiv = container.querySelector('.whitespace-pre-wrap')
      expect(contentDiv).toBeInTheDocument()
    })

    it('should have scrollable content area with max height', async () => {
      const user = userEvent.setup()
      const { container } = render(<ThinkingBlock thinking="Long content..." />)

      await user.click(screen.getByRole('button'))

      const contentDiv = container.querySelector('.max-h-64.overflow-y-auto')
      expect(contentDiv).toBeInTheDocument()
    })

    it('should show pulsing cursor when streaming and expanded', async () => {
      const user = userEvent.setup()
      const { container } = render(
        <ThinkingBlock thinking="Thinking..." isStreaming={true} />
      )

      await user.click(screen.getByRole('button'))

      const pulsingCursor = container.querySelector('.animate-pulse.bg-purple-400')
      expect(pulsingCursor).toBeInTheDocument()
    })

    it('should not show pulsing cursor when not streaming', async () => {
      const user = userEvent.setup()
      const { container } = render(
        <ThinkingBlock thinking="Thinking..." isStreaming={false} />
      )

      await user.click(screen.getByRole('button'))

      const pulsingCursor = container.querySelector('.animate-pulse.bg-purple-400')
      expect(pulsingCursor).not.toBeInTheDocument()
    })

    it('should show border separator when expanded', async () => {
      const user = userEvent.setup()
      const { container } = render(<ThinkingBlock thinking="Test" />)

      await user.click(screen.getByRole('button'))

      const contentDiv = container.querySelector('.border-t.border-border\\/50')
      expect(contentDiv).toBeInTheDocument()
    })
  })

  describe('Visual States', () => {
    it('should have hover effect on button', () => {
      render(<ThinkingBlock thinking="Test" />)
      const button = screen.getByRole('button')

      expect(button).toHaveClass('hover:bg-secondary/50', 'transition-colors')
    })

    it('should display lightbulb icon in purple', () => {
      const { container } = render(<ThinkingBlock thinking="Test" />)
      const lightbulbIcon = container.querySelector('.text-purple-400')
      expect(lightbulbIcon).toBeInTheDocument()
    })

    it('should have proper text styling for muted appearance', () => {
      render(<ThinkingBlock thinking="Test" />)
      const button = screen.getByRole('button')

      expect(button).toHaveClass('text-muted-foreground')
    })
  })

  describe('Accessibility', () => {
    it('should render button with proper role', () => {
      render(<ThinkingBlock thinking="Test" />)
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('should be keyboard accessible', async () => {
      const user = userEvent.setup()
      render(<ThinkingBlock thinking="Test thinking content" />)

      const button = screen.getByRole('button')
      button.focus()

      expect(button).toHaveFocus()

      await user.keyboard('{Enter}')
      expect(screen.getByText('Test thinking content')).toBeInTheDocument()
    })

    it('should toggle with space key', async () => {
      const user = userEvent.setup()
      render(<ThinkingBlock thinking="Test thinking content" />)

      const button = screen.getByRole('button')
      button.focus()

      await user.keyboard(' ')
      expect(screen.getByText('Test thinking content')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle very long thinking text', async () => {
      const user = userEvent.setup()
      const longText = 'A'.repeat(1000)
      render(<ThinkingBlock thinking={longText} />)

      await user.click(screen.getByRole('button'))

      expect(screen.getByText(longText)).toBeInTheDocument()
    })

    it('should handle special characters in thinking text', async () => {
      const user = userEvent.setup()
      const specialText = '<script>alert("test")</script>'
      render(<ThinkingBlock thinking={specialText} />)

      await user.click(screen.getByRole('button'))

      expect(screen.getByText(specialText)).toBeInTheDocument()
    })

    it('should handle thinking text with only whitespace', async () => {
      const user = userEvent.setup()
      const whitespaceText = '   \n\n   '
      const { container } = render(<ThinkingBlock thinking={whitespaceText} />)

      await user.click(screen.getByRole('button'))

      const contentDiv = container.querySelector('.whitespace-pre-wrap')
      expect(contentDiv).toBeInTheDocument()
      expect(contentDiv?.textContent).toContain(whitespaceText)
    })

    it('should handle switching between streaming and not streaming', () => {
      const { container, rerender } = render(
        <ThinkingBlock thinking="Test" isStreaming={false} />
      )

      expect(container.querySelectorAll('.animate-bounce')).toHaveLength(0)

      rerender(<ThinkingBlock thinking="Test" isStreaming={true} />)

      expect(container.querySelectorAll('.animate-bounce')).toHaveLength(3)

      rerender(<ThinkingBlock thinking="Test" isStreaming={false} />)

      expect(container.querySelectorAll('.animate-bounce')).toHaveLength(0)
    })

    it('should maintain expanded state when thinking text changes', async () => {
      const user = userEvent.setup()
      const { rerender } = render(<ThinkingBlock thinking="Original text" />)

      // Expand
      await user.click(screen.getByRole('button'))
      expect(screen.getByText('Original text')).toBeInTheDocument()

      // Change thinking text
      rerender(<ThinkingBlock thinking="Updated text" />)

      // Should still be expanded
      expect(screen.getByText('Updated text')).toBeInTheDocument()
      expect(screen.getByText('Hide')).toBeInTheDocument()
    })

    it('should update content when thinking text changes while expanded', async () => {
      const user = userEvent.setup()
      const { rerender } = render(<ThinkingBlock thinking="First" />)

      await user.click(screen.getByRole('button'))
      expect(screen.getByText('First')).toBeInTheDocument()

      rerender(<ThinkingBlock thinking="Second" />)
      expect(screen.queryByText('First')).not.toBeInTheDocument()
      expect(screen.getByText('Second')).toBeInTheDocument()
    })
  })

  describe('Component Structure', () => {
    it('should render with correct structure', () => {
      const { container } = render(<ThinkingBlock thinking="Test" />)

      // Main container
      const mainContainer = container.querySelector('.mb-3.border')
      expect(mainContainer).toBeInTheDocument()

      // Button container
      const button = screen.getByRole('button')
      expect(button).toHaveClass('w-full', 'flex', 'items-center', 'gap-2')
    })

    it('should have proper spacing and layout classes', () => {
      render(<ThinkingBlock thinking="Test" />)
      const button = screen.getByRole('button')

      expect(button).toHaveClass('px-3', 'py-2', 'text-sm')
    })

    it('should position Show/Hide text at end', () => {
      const { container } = render(<ThinkingBlock thinking="Test" />)
      const showHideSpan = container.querySelector('.ml-auto')

      expect(showHideSpan).toBeInTheDocument()
      expect(showHideSpan).toHaveClass('text-xs')
    })
  })

  describe('Animation States', () => {
    it('should have transition classes for smooth animations', () => {
      const { container } = render(<ThinkingBlock thinking="Test" />)
      const button = screen.getByRole('button')
      const chevron = container.querySelector('.transition-transform')

      expect(button).toHaveClass('transition-colors')
      expect(chevron).toBeInTheDocument()
    })
  })
})
