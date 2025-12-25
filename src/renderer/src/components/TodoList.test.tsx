/**
 * Claude DevStudio
 * Copyright (c) 2024 Claude DevStudio Contributors
 * Licensed under MIT License - see LICENSE file
 *
 * TodoList component tests
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TodoList } from './TodoList'
import type { TodoItem } from '@shared/types'

describe('TodoList', () => {
  const mockTodos: TodoItem[] = [
    {
      id: 'todo-1',
      content: 'Complete user authentication',
      status: 'pending',
      activeForm: 'Completing user authentication'
    },
    {
      id: 'todo-2',
      content: 'Write unit tests',
      status: 'in_progress',
      activeForm: 'Writing unit tests'
    },
    {
      id: 'todo-3',
      content: 'Review pull request',
      status: 'completed',
      activeForm: 'Reviewing pull request'
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should not render anything when todos array is empty', () => {
      const { container } = render(<TodoList todos={[]} />)
      expect(container.firstChild).toBeNull()
    })

    it('should not render anything when todos is null/undefined', () => {
      const { container } = render(<TodoList todos={null as any} />)
      expect(container.firstChild).toBeNull()
    })

    it('should render the task list header with correct title', () => {
      render(<TodoList todos={mockTodos} />)
      expect(screen.getByText('Tasks')).toBeInTheDocument()
    })

    it('should render all todo items', () => {
      render(<TodoList todos={mockTodos} />)
      expect(screen.getByText('Complete user authentication')).toBeInTheDocument()
      expect(screen.getByText('Write unit tests')).toBeInTheDocument()
      expect(screen.getByText('Review pull request')).toBeInTheDocument()
    })

    it('should render clipboard icon in header', () => {
      const { container } = render(<TodoList todos={mockTodos} />)
      // Look for the clipboard icon specifically by finding the path with the clipboard's characteristic path data
      const clipboardPath = container.querySelector('path[d*="M9 5H7a2 2 0 00-2 2v12"]')
      expect(clipboardPath).toBeInTheDocument()
      // Verify it's within an SVG
      const clipboardIcon = clipboardPath?.closest('svg')
      expect(clipboardIcon).toBeInTheDocument()
    })

    it('should display correct task counts in header', () => {
      render(<TodoList todos={mockTodos} />)
      expect(screen.getByText('1')).toBeInTheDocument() // completed count
      expect(screen.getByText('3')).toBeInTheDocument() // total count
    })

    it('should display active task count when in-progress tasks exist', () => {
      render(<TodoList todos={mockTodos} />)
      expect(screen.getByText('(1 active)')).toBeInTheDocument()
    })

    it('should not display active count when no in-progress tasks', () => {
      const todosWithoutInProgress: TodoItem[] = [
        { id: '1', content: 'Task 1', status: 'pending', activeForm: 'Task 1' },
        { id: '2', content: 'Task 2', status: 'completed', activeForm: 'Task 2' }
      ]
      render(<TodoList todos={todosWithoutInProgress} />)
      expect(screen.queryByText(/active/i)).not.toBeInTheDocument()
    })
  })

  describe('Todo Status Display', () => {
    it('should render pending todos with correct icon', () => {
      const { container } = render(<TodoList todos={mockTodos} />)
      const pendingContent = screen.getByText('Complete user authentication')
      const pendingItem = pendingContent.closest('div')
      expect(pendingItem?.querySelector('span[title="Pending"]')?.textContent).toBe('○')
    })

    it('should render in-progress todos with correct icon', () => {
      const { container } = render(<TodoList todos={mockTodos} />)
      const inProgressContent = screen.getByText('Write unit tests')
      const inProgressItem = inProgressContent.closest('div')
      expect(inProgressItem?.querySelector('span[title="In Progress"]')?.textContent).toBe('◐')
    })

    it('should render completed todos with correct icon', () => {
      const { container } = render(<TodoList todos={mockTodos} />)
      const completedContent = screen.getByText('Review pull request')
      const completedItem = completedContent.closest('div')
      expect(completedItem?.querySelector('span[title="Completed"]')?.textContent).toBe('●')
    })

    it('should apply line-through styling to completed todos', () => {
      render(<TodoList todos={mockTodos} />)
      const completedText = screen.getByText('Review pull request')
      expect(completedText).toHaveClass('line-through')
      expect(completedText).toHaveClass('text-muted-foreground')
    })

    it('should not apply line-through styling to pending todos', () => {
      render(<TodoList todos={mockTodos} />)
      const pendingText = screen.getByText('Complete user authentication')
      expect(pendingText).not.toHaveClass('line-through')
      expect(pendingText).toHaveClass('text-foreground')
    })

    it('should not apply line-through styling to in-progress todos', () => {
      render(<TodoList todos={mockTodos} />)
      const inProgressText = screen.getByText('Write unit tests')
      expect(inProgressText).not.toHaveClass('line-through')
      expect(inProgressText).toHaveClass('text-foreground')
    })

    it('should display pulsing dots for in-progress todos', () => {
      const { container } = render(<TodoList todos={mockTodos} />)
      const inProgressContent = screen.getByText('Write unit tests')
      const inProgressItem = inProgressContent.closest('div')
      const pulsingDots = inProgressItem?.querySelectorAll('.animate-pulse')
      expect(pulsingDots?.length).toBe(3)
    })

    it('should not display pulsing dots for pending todos', () => {
      const { container } = render(<TodoList todos={mockTodos} />)
      const pendingContent = screen.getByText('Complete user authentication')
      const pendingItem = pendingContent.closest('div')
      const pulsingDots = pendingItem?.querySelectorAll('.animate-pulse')
      expect(pulsingDots?.length).toBe(0)
    })

    it('should not display pulsing dots for completed todos', () => {
      const { container } = render(<TodoList todos={mockTodos} />)
      const completedContent = screen.getByText('Review pull request')
      const completedItem = completedContent.closest('div')
      const pulsingDots = completedItem?.querySelectorAll('.animate-pulse')
      expect(pulsingDots?.length).toBe(0)
    })
  })

  describe('Status Colors and Backgrounds', () => {
    it('should apply correct background color for pending todos', () => {
      const { container } = render(<TodoList todos={mockTodos} />)
      const pendingContent = screen.getByText('Complete user authentication')
      const pendingItem = pendingContent.closest('div')
      expect(pendingItem).toHaveClass('bg-secondary/30')
    })

    it('should apply correct background color for in-progress todos', () => {
      const { container } = render(<TodoList todos={mockTodos} />)
      const inProgressContent = screen.getByText('Write unit tests')
      const inProgressItem = inProgressContent.closest('div')
      expect(inProgressItem).toHaveClass('bg-yellow-400/10')
    })

    it('should apply correct background color for completed todos', () => {
      const { container } = render(<TodoList todos={mockTodos} />)
      const completedContent = screen.getByText('Review pull request')
      const completedItem = completedContent.closest('div')
      expect(completedItem).toHaveClass('bg-green-400/10')
    })

    it('should apply correct icon color for pending status', () => {
      const { container } = render(<TodoList todos={mockTodos} />)
      const pendingContent = screen.getByText('Complete user authentication')
      const pendingItem = pendingContent.closest('div')
      const icon = pendingItem?.querySelector('span[title="Pending"]')
      expect(icon).toHaveClass('text-muted-foreground')
    })

    it('should apply correct icon color for in-progress status', () => {
      const { container } = render(<TodoList todos={mockTodos} />)
      const inProgressContent = screen.getByText('Write unit tests')
      const inProgressItem = inProgressContent.closest('div')
      const icon = inProgressItem?.querySelector('span[title="In Progress"]')
      expect(icon).toHaveClass('text-yellow-400')
    })

    it('should apply correct icon color for completed status', () => {
      const { container } = render(<TodoList todos={mockTodos} />)
      const completedContent = screen.getByText('Review pull request')
      const completedItem = completedContent.closest('div')
      const icon = completedItem?.querySelector('span[title="Completed"]')
      expect(icon).toHaveClass('text-green-400')
    })
  })

  describe('Expand/Collapse Functionality', () => {
    it('should render todos expanded by default', () => {
      render(<TodoList todos={mockTodos} />)
      expect(screen.getByText('Complete user authentication')).toBeInTheDocument()
      expect(screen.getByText('Write unit tests')).toBeInTheDocument()
      expect(screen.getByText('Review pull request')).toBeInTheDocument()
    })

    it('should collapse todos when header is clicked', () => {
      render(<TodoList todos={mockTodos} />)
      const toggleButton = screen.getByRole('button')

      fireEvent.click(toggleButton)

      expect(screen.queryByText('Complete user authentication')).not.toBeInTheDocument()
      expect(screen.queryByText('Write unit tests')).not.toBeInTheDocument()
      expect(screen.queryByText('Review pull request')).not.toBeInTheDocument()
    })

    it('should expand todos when header is clicked again', () => {
      render(<TodoList todos={mockTodos} />)
      const toggleButton = screen.getByRole('button')

      fireEvent.click(toggleButton)
      fireEvent.click(toggleButton)

      expect(screen.getByText('Complete user authentication')).toBeInTheDocument()
      expect(screen.getByText('Write unit tests')).toBeInTheDocument()
      expect(screen.getByText('Review pull request')).toBeInTheDocument()
    })

    it('should rotate chevron icon when expanded', () => {
      const { container } = render(<TodoList todos={mockTodos} />)
      const chevronIcon = container.querySelector('svg.rotate-90')
      expect(chevronIcon).toBeInTheDocument()
    })

    it('should not rotate chevron icon when collapsed', () => {
      const { container } = render(<TodoList todos={mockTodos} />)
      const toggleButton = screen.getByRole('button')

      fireEvent.click(toggleButton)

      const chevronIcon = container.querySelector('svg.rotate-90')
      expect(chevronIcon).not.toBeInTheDocument()
    })
  })

  describe('Progress Bar', () => {
    it('should render progress bar at the bottom', () => {
      const { container } = render(<TodoList todos={mockTodos} />)
      const progressBar = container.querySelector('.h-1.bg-secondary')
      expect(progressBar).toBeInTheDocument()
    })

    it('should show correct progress percentage', () => {
      const { container } = render(<TodoList todos={mockTodos} />)
      const progressFill = container.querySelector('.bg-gradient-to-r')
      expect(progressFill).toHaveStyle({ width: '33.33333333333333%' }) // 1 of 3 completed
    })

    it('should show 0% progress when no tasks are completed', () => {
      const pendingTodos: TodoItem[] = [
        { id: '1', content: 'Task 1', status: 'pending', activeForm: 'Task 1' },
        { id: '2', content: 'Task 2', status: 'pending', activeForm: 'Task 2' }
      ]
      const { container } = render(<TodoList todos={pendingTodos} />)
      const progressFill = container.querySelector('.bg-gradient-to-r')
      expect(progressFill).toHaveStyle({ width: '0%' })
    })

    it('should show 100% progress when all tasks are completed', () => {
      const completedTodos: TodoItem[] = [
        { id: '1', content: 'Task 1', status: 'completed', activeForm: 'Task 1' },
        { id: '2', content: 'Task 2', status: 'completed', activeForm: 'Task 2' }
      ]
      const { container } = render(<TodoList todos={completedTodos} />)
      const progressFill = container.querySelector('.bg-gradient-to-r')
      expect(progressFill).toHaveStyle({ width: '100%' })
    })

    it('should use gradient colors for progress bar', () => {
      const { container } = render(<TodoList todos={mockTodos} />)
      const progressFill = container.querySelector('.bg-gradient-to-r')
      expect(progressFill).toHaveClass('from-green-500')
      expect(progressFill).toHaveClass('to-green-400')
    })
  })

  describe('Streaming Indicator', () => {
    it('should show streaming indicator when isStreaming is true', () => {
      const { container } = render(<TodoList todos={mockTodos} isStreaming={true} />)
      const streamingDots = container.querySelectorAll('.animate-bounce')
      expect(streamingDots.length).toBe(3)
    })

    it('should not show streaming indicator when isStreaming is false', () => {
      const { container } = render(<TodoList todos={mockTodos} isStreaming={false} />)
      const streamingDots = container.querySelectorAll('.animate-bounce')
      expect(streamingDots.length).toBe(0)
    })

    it('should not show streaming indicator when isStreaming is undefined', () => {
      const { container } = render(<TodoList todos={mockTodos} />)
      const streamingDots = container.querySelectorAll('.animate-bounce')
      expect(streamingDots.length).toBe(0)
    })

    it('should apply staggered animation delays to streaming dots', () => {
      const { container } = render(<TodoList todos={mockTodos} isStreaming={true} />)
      const streamingDots = container.querySelectorAll('.animate-bounce')

      expect((streamingDots[0] as HTMLElement).style.animationDelay).toBe('0ms')
      expect((streamingDots[1] as HTMLElement).style.animationDelay).toBe('150ms')
      expect((streamingDots[2] as HTMLElement).style.animationDelay).toBe('300ms')
    })
  })

  describe('Edge Cases', () => {
    it('should handle todos without IDs gracefully', () => {
      const todosWithoutIds: TodoItem[] = [
        { content: 'Task 1', status: 'pending', activeForm: 'Task 1' },
        { content: 'Task 2', status: 'completed', activeForm: 'Task 2' }
      ]
      render(<TodoList todos={todosWithoutIds} />)
      expect(screen.getByText('Task 1')).toBeInTheDocument()
      expect(screen.getByText('Task 2')).toBeInTheDocument()
    })

    it('should handle single todo item', () => {
      const singleTodo: TodoItem[] = [
        { id: '1', content: 'Only task', status: 'pending', activeForm: 'Only task' }
      ]
      render(<TodoList todos={singleTodo} />)
      expect(screen.getByText('Only task')).toBeInTheDocument()
      expect(screen.getByText('0')).toBeInTheDocument() // completed count
      expect(screen.getByText('1')).toBeInTheDocument() // total count
    })

    it('should handle long todo content', () => {
      const longContentTodo: TodoItem[] = [
        {
          id: '1',
          content: 'This is a very long todo content that should wrap properly and not break the layout when rendered in the component',
          status: 'pending',
          activeForm: 'Long content'
        }
      ]
      render(<TodoList todos={longContentTodo} />)
      expect(screen.getByText(/This is a very long todo content/)).toBeInTheDocument()
    })

    it('should handle special characters in todo content', () => {
      const specialCharTodo: TodoItem[] = [
        {
          id: '1',
          content: 'Task with <>&"\' special characters',
          status: 'pending',
          activeForm: 'Special task'
        }
      ]
      render(<TodoList todos={specialCharTodo} />)
      expect(screen.getByText('Task with <>&"\' special characters')).toBeInTheDocument()
    })

    it('should handle multiple in-progress tasks', () => {
      const multipleInProgress: TodoItem[] = [
        { id: '1', content: 'Task 1', status: 'in_progress', activeForm: 'Task 1' },
        { id: '2', content: 'Task 2', status: 'in_progress', activeForm: 'Task 2' },
        { id: '3', content: 'Task 3', status: 'in_progress', activeForm: 'Task 3' }
      ]
      render(<TodoList todos={multipleInProgress} />)
      expect(screen.getByText('(3 active)')).toBeInTheDocument()
    })

    it('should handle all tasks in same status', () => {
      const allPending: TodoItem[] = [
        { id: '1', content: 'Task 1', status: 'pending', activeForm: 'Task 1' },
        { id: '2', content: 'Task 2', status: 'pending', activeForm: 'Task 2' }
      ]
      render(<TodoList todos={allPending} />)
      expect(screen.getByText('0')).toBeInTheDocument() // completed count
      expect(screen.getByText('2')).toBeInTheDocument() // total count
      expect(screen.queryByText(/active/i)).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have semantic button for toggle', () => {
      render(<TodoList todos={mockTodos} />)
      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
    })

    it('should have title attributes on status icons', () => {
      render(<TodoList todos={mockTodos} />)
      const pendingIcon = screen.getByTitle('Pending')
      const inProgressIcon = screen.getByTitle('In Progress')
      const completedIcon = screen.getByTitle('Completed')

      expect(pendingIcon).toBeInTheDocument()
      expect(inProgressIcon).toBeInTheDocument()
      expect(completedIcon).toBeInTheDocument()
    })

    it('should have proper SVG viewBox attributes', () => {
      const { container } = render(<TodoList todos={mockTodos} />)
      const svgs = container.querySelectorAll('svg')
      svgs.forEach(svg => {
        expect(svg).toHaveAttribute('viewBox')
      })
    })
  })

  describe('Layout and Structure', () => {
    it('should have proper container styling', () => {
      const { container } = render(<TodoList todos={mockTodos} />)
      const mainContainer = container.querySelector('.mb-3.border.border-border\\/50')
      expect(mainContainer).toBeInTheDocument()
      expect(mainContainer).toHaveClass('rounded-lg')
      expect(mainContainer).toHaveClass('overflow-hidden')
      expect(mainContainer).toHaveClass('bg-secondary/30')
    })

    it('should have proper header button styling', () => {
      render(<TodoList todos={mockTodos} />)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('w-full')
      expect(button).toHaveClass('flex')
      expect(button).toHaveClass('items-center')
    })

    it('should render todos with border between items', () => {
      const { container } = render(<TodoList todos={mockTodos} />)
      const todoItems = container.querySelectorAll('.border-b.border-border\\/30')
      expect(todoItems.length).toBeGreaterThan(0)
    })

    it('should not have bottom border on last todo item', () => {
      const { container } = render(<TodoList todos={mockTodos} />)
      const todoItems = container.querySelectorAll('.last\\:border-b-0')
      expect(todoItems.length).toBeGreaterThan(0)
    })
  })
})
