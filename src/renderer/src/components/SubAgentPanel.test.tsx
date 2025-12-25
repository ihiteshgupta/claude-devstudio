/**
 * Copyright (c) 2025 Claude DevStudio
 * Tests for SubAgentPanel component
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SubAgentPanel } from './SubAgentPanel'
import type { SubAgentAction } from '@shared/types'

describe('SubAgentPanel', () => {
  const createMockAction = (overrides?: Partial<SubAgentAction>): SubAgentAction => ({
    id: 'test-action-1',
    type: 'Explore',
    description: 'Searching for user authentication files',
    status: 'running',
    ...overrides
  })

  describe('Rendering', () => {
    it('should render nothing when actions array is empty', () => {
      const { container } = render(<SubAgentPanel actions={[]} />)
      expect(container.firstChild).toBeNull()
    })

    it('should render nothing when actions is undefined', () => {
      const { container } = render(<SubAgentPanel actions={undefined as any} />)
      expect(container.firstChild).toBeNull()
    })

    it('should render sub-agents panel with header', () => {
      const actions = [createMockAction()]
      render(<SubAgentPanel actions={actions} />)

      expect(screen.getByText('Sub-Agents')).toBeInTheDocument()
    })

    it('should render all actions in the list', () => {
      const actions = [
        createMockAction({ id: '1', description: 'First action' }),
        createMockAction({ id: '2', description: 'Second action' }),
        createMockAction({ id: '3', description: 'Third action' })
      ]
      render(<SubAgentPanel actions={actions} />)

      expect(screen.getByText(/First action/)).toBeInTheDocument()
      expect(screen.getByText(/Second action/)).toBeInTheDocument()
      expect(screen.getByText(/Third action/)).toBeInTheDocument()
    })

    it('should display progress bar at the bottom', () => {
      const actions = [createMockAction({ status: 'completed' })]
      const { container } = render(<SubAgentPanel actions={actions} />)

      const progressContainer = container.querySelector('.h-1.bg-secondary')
      expect(progressContainer).toBeInTheDocument()
    })
  })

  describe('Agent Type Display', () => {
    it('should display Explore agent type with correct label', () => {
      const actions = [createMockAction({ type: 'Explore', description: 'Searching codebase' })]
      render(<SubAgentPanel actions={actions} />)

      expect(screen.getByText('Exploring:')).toBeInTheDocument()
      expect(screen.getByText(/Searching codebase/)).toBeInTheDocument()
    })

    it('should display Plan agent type with correct label', () => {
      const actions = [createMockAction({ type: 'Plan', description: 'Designing approach' })]
      render(<SubAgentPanel actions={actions} />)

      expect(screen.getByText('Planning:')).toBeInTheDocument()
      expect(screen.getByText(/Designing approach/)).toBeInTheDocument()
    })

    it('should display Task agent type with correct label', () => {
      const actions = [createMockAction({ type: 'Task', description: 'Running sub-agent' })]
      render(<SubAgentPanel actions={actions} />)

      expect(screen.getByText('Task:')).toBeInTheDocument()
      expect(screen.getByText(/Running sub-agent/)).toBeInTheDocument()
    })

    it('should display description alongside agent type', () => {
      const actions = [
        createMockAction({
          type: 'Explore',
          description: 'Analyzing authentication middleware'
        })
      ]
      render(<SubAgentPanel actions={actions} />)

      expect(screen.getByText('Exploring:')).toBeInTheDocument()
      expect(screen.getByText(/Analyzing authentication middleware/)).toBeInTheDocument()
    })
  })

  describe('Status Display', () => {
    it('should display running status with animated dots', () => {
      const actions = [createMockAction({ status: 'running' })]
      const { container } = render(<SubAgentPanel actions={actions} />)

      const animatedDots = container.querySelectorAll('.animate-pulse')
      expect(animatedDots.length).toBeGreaterThan(0)
    })

    it('should display completed status with check icon', () => {
      const actions = [createMockAction({ status: 'completed' })]
      const { container } = render(<SubAgentPanel actions={actions} />)

      // Check for completed styling
      const completedBg = container.querySelector('.bg-green-400\\/10')
      expect(completedBg).toBeInTheDocument()
    })

    it('should display failed status with X icon', () => {
      const actions = [createMockAction({ status: 'failed' })]
      const { container } = render(<SubAgentPanel actions={actions} />)

      // Check for failed styling
      const failedBg = container.querySelector('.bg-red-400\\/10')
      expect(failedBg).toBeInTheDocument()
    })

    it('should apply correct background color for running status', () => {
      const actions = [createMockAction({ status: 'running' })]
      const { container } = render(<SubAgentPanel actions={actions} />)

      const runningBg = container.querySelector('.bg-blue-400\\/10')
      expect(runningBg).toBeInTheDocument()
    })

    it('should apply correct background color for completed status', () => {
      const actions = [createMockAction({ status: 'completed' })]
      const { container } = render(<SubAgentPanel actions={actions} />)

      const completedBg = container.querySelector('.bg-green-400\\/10')
      expect(completedBg).toBeInTheDocument()
    })

    it('should apply correct background color for failed status', () => {
      const actions = [createMockAction({ status: 'failed' })]
      const { container } = render(<SubAgentPanel actions={actions} />)

      const failedBg = container.querySelector('.bg-red-400\\/10')
      expect(failedBg).toBeInTheDocument()
    })
  })

  describe('Count Display', () => {
    it('should display total count of actions', () => {
      const actions = [
        createMockAction({ id: '1', status: 'completed' }),
        createMockAction({ id: '2', status: 'running' }),
        createMockAction({ id: '3', status: 'completed' })
      ]
      render(<SubAgentPanel actions={actions} />)

      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('should display completed count', () => {
      const actions = [
        createMockAction({ id: '1', status: 'completed' }),
        createMockAction({ id: '2', status: 'running' }),
        createMockAction({ id: '3', status: 'completed' })
      ]
      render(<SubAgentPanel actions={actions} />)

      expect(screen.getByText('2')).toBeInTheDocument() // completed count
    })

    it('should display running count when streaming', () => {
      const actions = [
        createMockAction({ id: '1', status: 'running' }),
        createMockAction({ id: '2', status: 'completed' })
      ]
      render(<SubAgentPanel actions={actions} isStreaming={true} />)

      expect(screen.getByText('1 running')).toBeInTheDocument()
    })

    it('should not display running count when not streaming', () => {
      const actions = [
        createMockAction({ id: '1', status: 'running' }),
        createMockAction({ id: '2', status: 'completed' })
      ]
      render(<SubAgentPanel actions={actions} isStreaming={false} />)

      expect(screen.queryByText('1 running')).not.toBeInTheDocument()
    })

    it('should not display running count when no actions are running', () => {
      const actions = [
        createMockAction({ id: '1', status: 'completed' }),
        createMockAction({ id: '2', status: 'completed' })
      ]
      render(<SubAgentPanel actions={actions} isStreaming={true} />)

      expect(screen.queryByText(/running/)).not.toBeInTheDocument()
    })

    it('should display correct running count with multiple running actions', () => {
      const actions = [
        createMockAction({ id: '1', status: 'running' }),
        createMockAction({ id: '2', status: 'running' }),
        createMockAction({ id: '3', status: 'completed' })
      ]
      render(<SubAgentPanel actions={actions} isStreaming={true} />)

      expect(screen.getByText('2 running')).toBeInTheDocument()
    })
  })

  describe('Streaming Indicator', () => {
    it('should show animated dots in header when streaming with running actions', () => {
      const actions = [createMockAction({ status: 'running' })]
      const { container } = render(<SubAgentPanel actions={actions} isStreaming={true} />)

      const headerDots = container.querySelectorAll('.bg-cyan-400.rounded-full.animate-bounce')
      expect(headerDots).toHaveLength(3)
    })

    it('should not show animated dots when not streaming', () => {
      const actions = [createMockAction({ status: 'running' })]
      const { container } = render(<SubAgentPanel actions={actions} isStreaming={false} />)

      const headerDots = container.querySelectorAll('.bg-cyan-400.rounded-full.animate-bounce')
      expect(headerDots).toHaveLength(0)
    })

    it('should not show animated dots when no running actions', () => {
      const actions = [createMockAction({ status: 'completed' })]
      const { container } = render(<SubAgentPanel actions={actions} isStreaming={true} />)

      const headerDots = container.querySelectorAll('.bg-cyan-400.rounded-full.animate-bounce')
      expect(headerDots).toHaveLength(0)
    })

    it('should apply staggered animation delays to dots', () => {
      const actions = [createMockAction({ status: 'running' })]
      const { container } = render(<SubAgentPanel actions={actions} isStreaming={true} />)

      const dots = container.querySelectorAll('.bg-cyan-400.rounded-full.animate-bounce')
      expect((dots[0] as HTMLElement).style.animationDelay).toBe('0ms')
      expect((dots[1] as HTMLElement).style.animationDelay).toBe('150ms')
      expect((dots[2] as HTMLElement).style.animationDelay).toBe('300ms')
    })
  })

  describe('Result Expansion', () => {
    it('should show chevron icon when action has result', () => {
      const actions = [
        createMockAction({
          status: 'completed',
          result: 'Found 5 authentication files'
        })
      ]
      const { container } = render(<SubAgentPanel actions={actions} />)

      const chevron = container.querySelector('.rotate-90, .transition-transform')
      expect(chevron).toBeInTheDocument()
    })

    it('should not show chevron icon when action has no result', () => {
      const actions = [
        createMockAction({
          status: 'running',
          result: undefined
        })
      ]
      const { container } = render(<SubAgentPanel actions={actions} />)

      // Chevron should not be in DOM when there's no result
      const buttons = container.querySelectorAll('button')
      const button = buttons[0]
      const chevronInButton = button.querySelector('.transition-transform')
      expect(chevronInButton).toBeNull()
    })

    it('should not show result initially', () => {
      const actions = [
        createMockAction({
          status: 'completed',
          result: 'Found 5 authentication files'
        })
      ]
      render(<SubAgentPanel actions={actions} />)

      expect(screen.queryByText('Found 5 authentication files')).not.toBeInTheDocument()
    })

    it('should expand and show result when clicked', () => {
      const actions = [
        createMockAction({
          status: 'completed',
          result: 'Found 5 authentication files'
        })
      ]
      const { container } = render(<SubAgentPanel actions={actions} />)

      const button = container.querySelector('button')
      expect(button).toBeInTheDocument()

      fireEvent.click(button!)
      expect(screen.getByText('Found 5 authentication files')).toBeInTheDocument()
    })

    it('should collapse result when clicked again', () => {
      const actions = [
        createMockAction({
          status: 'completed',
          result: 'Found 5 authentication files'
        })
      ]
      const { container } = render(<SubAgentPanel actions={actions} />)

      const button = container.querySelector('button')!

      // Expand
      fireEvent.click(button)
      expect(screen.getByText('Found 5 authentication files')).toBeInTheDocument()

      // Collapse
      fireEvent.click(button)
      expect(screen.queryByText('Found 5 authentication files')).not.toBeInTheDocument()
    })

    it('should toggle chevron rotation when expanding/collapsing', () => {
      const actions = [
        createMockAction({
          status: 'completed',
          result: 'Test result'
        })
      ]
      const { container } = render(<SubAgentPanel actions={actions} />)

      const button = container.querySelector('button')!
      const chevron = container.querySelector('.transition-transform')

      // Initially not rotated
      expect(chevron).not.toHaveClass('rotate-90')

      // Click to expand
      fireEvent.click(button)
      expect(chevron).toHaveClass('rotate-90')

      // Click to collapse
      fireEvent.click(button)
      expect(chevron).not.toHaveClass('rotate-90')
    })

    it('should display result in monospace font', () => {
      const actions = [
        createMockAction({
          status: 'completed',
          result: 'File: /src/auth.ts\nLine: 42'
        })
      ]
      const { container } = render(<SubAgentPanel actions={actions} />)

      const button = container.querySelector('button')!
      fireEvent.click(button)

      const resultElement = container.querySelector('.font-mono')
      expect(resultElement).toBeInTheDocument()
      expect(resultElement).toHaveTextContent('File: /src/auth.ts')
    })

    it('should preserve whitespace in result', () => {
      const actions = [
        createMockAction({
          status: 'completed',
          result: 'Line 1\n  Indented line 2\n    More indent'
        })
      ]
      const { container } = render(<SubAgentPanel actions={actions} />)

      const button = container.querySelector('button')!
      fireEvent.click(button)

      const resultElement = container.querySelector('.whitespace-pre-wrap')
      expect(resultElement).toBeInTheDocument()
    })

    it('should handle multiple expanded actions independently', () => {
      const actions = [
        createMockAction({ id: '1', status: 'completed', result: 'Result 1' }),
        createMockAction({ id: '2', status: 'completed', result: 'Result 2' })
      ]
      const { container } = render(<SubAgentPanel actions={actions} />)

      const buttons = container.querySelectorAll('button')

      // Expand first
      fireEvent.click(buttons[0])
      expect(screen.getByText('Result 1')).toBeInTheDocument()
      expect(screen.queryByText('Result 2')).not.toBeInTheDocument()

      // Expand second
      fireEvent.click(buttons[1])
      expect(screen.getByText('Result 1')).toBeInTheDocument()
      expect(screen.getByText('Result 2')).toBeInTheDocument()

      // Collapse first
      fireEvent.click(buttons[0])
      expect(screen.queryByText('Result 1')).not.toBeInTheDocument()
      expect(screen.getByText('Result 2')).toBeInTheDocument()
    })
  })

  describe('Progress Bar', () => {
    it('should show 0% progress when no actions are completed', () => {
      const actions = [
        createMockAction({ id: '1', status: 'running' }),
        createMockAction({ id: '2', status: 'running' })
      ]
      const { container } = render(<SubAgentPanel actions={actions} />)

      const progressBar = container.querySelector('.bg-gradient-to-r.from-cyan-500')
      expect(progressBar).toHaveStyle({ width: '0%' })
    })

    it('should show 50% progress when half actions are completed', () => {
      const actions = [
        createMockAction({ id: '1', status: 'completed' }),
        createMockAction({ id: '2', status: 'running' })
      ]
      const { container } = render(<SubAgentPanel actions={actions} />)

      const progressBar = container.querySelector('.bg-gradient-to-r.from-cyan-500')
      expect(progressBar).toHaveStyle({ width: '50%' })
    })

    it('should show 100% progress when all actions are completed', () => {
      const actions = [
        createMockAction({ id: '1', status: 'completed' }),
        createMockAction({ id: '2', status: 'completed' })
      ]
      const { container } = render(<SubAgentPanel actions={actions} />)

      const progressBar = container.querySelector('.bg-gradient-to-r.from-cyan-500')
      expect(progressBar).toHaveStyle({ width: '100%' })
    })

    it('should include failed actions in total but not in progress', () => {
      const actions = [
        createMockAction({ id: '1', status: 'completed' }),
        createMockAction({ id: '2', status: 'failed' }),
        createMockAction({ id: '3', status: 'running' })
      ]
      const { container } = render(<SubAgentPanel actions={actions} />)

      const progressBar = container.querySelector('.bg-gradient-to-r.from-cyan-500')
      // Only 1 completed out of 3 total = 33.33%
      expect(progressBar).toHaveStyle({ width: '33.33333333333333%' })
    })

    it('should apply gradient styling to progress bar', () => {
      const actions = [createMockAction({ status: 'completed' })]
      const { container } = render(<SubAgentPanel actions={actions} />)

      const progressBar = container.querySelector('.bg-gradient-to-r.from-cyan-500.to-cyan-400')
      expect(progressBar).toBeInTheDocument()
    })

    it('should apply transition animation to progress bar', () => {
      const actions = [createMockAction({ status: 'completed' })]
      const { container } = render(<SubAgentPanel actions={actions} />)

      const progressBar = container.querySelector('.transition-all.duration-300')
      expect(progressBar).toBeInTheDocument()
    })
  })

  describe('Empty State', () => {
    it('should render nothing when actions array is empty', () => {
      const { container } = render(<SubAgentPanel actions={[]} />)
      expect(container.firstChild).toBeNull()
    })

    it('should render nothing when actions is null', () => {
      const { container } = render(<SubAgentPanel actions={null as any} />)
      expect(container.firstChild).toBeNull()
    })
  })

  describe('Interaction', () => {
    it('should be clickable to expand/collapse actions', () => {
      const actions = [
        createMockAction({
          status: 'completed',
          result: 'Test result'
        })
      ]
      const { container } = render(<SubAgentPanel actions={actions} />)

      const button = container.querySelector('button')!
      expect(button).toBeEnabled()

      fireEvent.click(button)
      expect(screen.getByText('Test result')).toBeInTheDocument()
    })

    it('should apply hover effect to action buttons', () => {
      const actions = [createMockAction()]
      const { container } = render(<SubAgentPanel actions={actions} />)

      const button = container.querySelector('button')!
      expect(button).toHaveClass('hover:bg-secondary/50')
    })
  })

  describe('Edge Cases', () => {
    it('should handle actions with very long descriptions', () => {
      const longDescription = 'A'.repeat(200)
      const actions = [createMockAction({ description: longDescription })]
      const { container } = render(<SubAgentPanel actions={actions} />)

      const descriptionElement = container.querySelector('.truncate')
      expect(descriptionElement).toBeInTheDocument()
    })

    it('should handle actions with multiline results', () => {
      const multilineResult = 'Line 1\nLine 2\nLine 3\nLine 4'
      const actions = [
        createMockAction({ status: 'completed', result: multilineResult })
      ]
      const { container } = render(<SubAgentPanel actions={actions} />)

      const button = container.querySelector('button')!
      fireEvent.click(button)

      const resultContainer = container.querySelector('.font-mono')
      expect(resultContainer).toBeInTheDocument()
      expect(resultContainer?.textContent).toBe(multilineResult)
    })

    it('should handle empty result string', () => {
      const actions = [createMockAction({ status: 'completed', result: '' })]
      const { container } = render(<SubAgentPanel actions={actions} />)

      const button = container.querySelector('button')!
      fireEvent.click(button)

      // Should show empty result container
      const resultContainer = container.querySelector('.font-mono')
      expect(resultContainer).toBeInTheDocument()
    })

    it('should handle single action', () => {
      const actions = [createMockAction()]
      render(<SubAgentPanel actions={actions} />)

      expect(screen.getByText('1')).toBeInTheDocument() // total count
    })

    it('should handle large number of actions', () => {
      const actions = Array.from({ length: 50 }, (_, i) =>
        createMockAction({ id: `action-${i}`, description: `Action ${i}` })
      )
      const { container } = render(<SubAgentPanel actions={actions} />)

      const actionElements = container.querySelectorAll('button')
      expect(actionElements).toHaveLength(50)
    })
  })

  describe('Visual Styling', () => {
    it('should apply border styling to panel', () => {
      const actions = [createMockAction()]
      const { container } = render(<SubAgentPanel actions={actions} />)

      const panel = container.querySelector('.border.border-border\\/50.rounded-lg')
      expect(panel).toBeInTheDocument()
    })

    it('should apply dividers between actions', () => {
      const actions = [
        createMockAction({ id: '1' }),
        createMockAction({ id: '2' })
      ]
      const { container } = render(<SubAgentPanel actions={actions} />)

      const divider = container.querySelector('.divide-y.divide-border\\/30')
      expect(divider).toBeInTheDocument()
    })

    it('should apply margin to panel container', () => {
      const actions = [createMockAction()]
      const { container } = render(<SubAgentPanel actions={actions} />)

      const panel = container.querySelector('.mb-3')
      expect(panel).toBeInTheDocument()
    })
  })
})
