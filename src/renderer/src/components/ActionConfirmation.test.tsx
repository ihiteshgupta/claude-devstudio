/**
 * Claude DevStudio
 * Copyright (c) 2024 Claude DevStudio Contributors
 * Licensed under MIT License - see LICENSE file
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  ActionConfirmation,
  type ActionWithDuplicates,
  type ExecutionResult,
  type ActionType,
} from './ActionConfirmation'

describe('ActionConfirmation', () => {
  let mockExecute: ReturnType<typeof vi.fn>
  let mockOnActionExecuted: ReturnType<typeof vi.fn>
  let mockOnActionRejected: ReturnType<typeof vi.fn>
  let mockOnDismiss: ReturnType<typeof vi.fn>

  const createMockAction = (
    overrides: Partial<ActionWithDuplicates> = {}
  ): ActionWithDuplicates => ({
    id: `action-${Math.random()}`,
    type: 'create-story' as ActionType,
    title: 'Test Story',
    description: 'Test description',
    metadata: { priority: 'high' },
    confidence: 0.85,
    sourceText: 'Create a test story',
    status: 'proposed',
    ...overrides,
  })

  beforeEach(() => {
    mockExecute = vi.fn()
    mockOnActionExecuted = vi.fn()
    mockOnActionRejected = vi.fn()
    mockOnDismiss = vi.fn()

    // Mock the electronAPI actions
    window.electronAPI = {
      ...window.electronAPI,
      actions: {
        execute: mockExecute,
      },
    } as any
  })

  describe('Rendering', () => {
    it('should render nothing when actions array is empty', () => {
      const { container } = render(
        <ActionConfirmation
          actions={[]}
          projectId="test-project"
        />
      )

      expect(container.firstChild).toBeNull()
    })

    it('should render the component with actions', () => {
      const actions = [createMockAction()]

      render(
        <ActionConfirmation
          actions={actions}
          projectId="test-project"
        />
      )

      expect(screen.getByText('Detected Actions')).toBeInTheDocument()
      expect(screen.getByText('1 action found')).toBeInTheDocument()
    })

    it('should render multiple actions count correctly', () => {
      const actions = [
        createMockAction({ id: 'action-1' }),
        createMockAction({ id: 'action-2' }),
        createMockAction({ id: 'action-3' }),
      ]

      render(
        <ActionConfirmation
          actions={actions}
          projectId="test-project"
        />
      )

      expect(screen.getByText('3 actions found')).toBeInTheDocument()
    })

    it('should render action details', () => {
      const action = createMockAction({
        title: 'Create Authentication Story',
        description: 'Implement user authentication',
        type: 'create-story',
      })

      render(
        <ActionConfirmation
          actions={[action]}
          projectId="test-project"
        />
      )

      expect(screen.getByText('Create Authentication Story')).toBeInTheDocument()
      expect(screen.getByText('Implement user authentication')).toBeInTheDocument()
      expect(screen.getByText('User Story')).toBeInTheDocument()
    })

    it('should render confidence badge with correct percentage', () => {
      const action = createMockAction({ confidence: 0.92 })

      render(
        <ActionConfirmation
          actions={[action]}
          projectId="test-project"
        />
      )

      expect(screen.getByText('92%')).toBeInTheDocument()
    })

    it('should render duplicate warning when duplicates found', () => {
      const action = createMockAction({
        duplicateCheck: {
          hasDuplicate: true,
          matches: [
            { id: 'existing-1', title: 'Similar Story', type: 'story', similarity: 0.87 },
          ],
        },
      })

      render(
        <ActionConfirmation
          actions={[action]}
          projectId="test-project"
        />
      )

      expect(screen.getByText('Possible duplicate')).toBeInTheDocument()
      expect(screen.getByText('Similar items found:')).toBeInTheDocument()
      expect(screen.getByText('Similar Story')).toBeInTheDocument()
      expect(screen.getByText('87% match')).toBeInTheDocument()
    })

    it('should render different action types with correct icons and labels', () => {
      const actionTypes: ActionType[] = [
        'create-story',
        'create-task',
        'create-roadmap-item',
        'create-test',
        'create-file',
        'run-command',
      ]

      const actions = actionTypes.map((type) =>
        createMockAction({ id: `action-${type}`, type })
      )

      render(
        <ActionConfirmation
          actions={actions}
          projectId="test-project"
        />
      )

      expect(screen.getByText('User Story')).toBeInTheDocument()
      expect(screen.getByText('Task')).toBeInTheDocument()
      expect(screen.getByText('Roadmap Item')).toBeInTheDocument()
      expect(screen.getByText('Test Case')).toBeInTheDocument()
      expect(screen.getByText('File')).toBeInTheDocument()
      expect(screen.getByText('Command')).toBeInTheDocument()
    })
  })

  describe('Expand/Collapse Functionality', () => {
    it('should start in expanded state by default', () => {
      const action = createMockAction()

      render(
        <ActionConfirmation
          actions={[action]}
          projectId="test-project"
        />
      )

      // Action title should be visible (meaning expanded)
      expect(screen.getByText('Test Story')).toBeInTheDocument()
    })

    it('should collapse when header is clicked', async () => {
      const user = userEvent.setup()
      const action = createMockAction()

      render(
        <ActionConfirmation
          actions={[action]}
          projectId="test-project"
        />
      )

      const header = screen.getByText('Detected Actions').closest('div')
      expect(header).toBeInTheDocument()

      await user.click(header!)

      // Action title should not be visible after collapse
      await waitFor(() => {
        expect(screen.queryByText('Test Story')).not.toBeInTheDocument()
      })
    })

    it('should expand again when clicked a second time', async () => {
      const user = userEvent.setup()
      const action = createMockAction()

      render(
        <ActionConfirmation
          actions={[action]}
          projectId="test-project"
        />
      )

      const header = screen.getByText('Detected Actions').closest('div')!

      // Collapse
      await user.click(header)
      await waitFor(() => {
        expect(screen.queryByText('Test Story')).not.toBeInTheDocument()
      })

      // Expand
      await user.click(header)
      await waitFor(() => {
        expect(screen.getByText('Test Story')).toBeInTheDocument()
      })
    })
  })

  describe('Action Details Toggle', () => {
    it('should show details button when metadata exists', () => {
      const action = createMockAction({
        metadata: { priority: 'high', tags: ['auth', 'security'] },
      })

      render(
        <ActionConfirmation
          actions={[action]}
          projectId="test-project"
        />
      )

      expect(screen.getByText('Show details')).toBeInTheDocument()
    })

    it('should not show details button when metadata is empty', () => {
      const action = createMockAction({ metadata: {} })

      render(
        <ActionConfirmation
          actions={[action]}
          projectId="test-project"
        />
      )

      expect(screen.queryByText('Show details')).not.toBeInTheDocument()
    })

    it('should toggle metadata details when clicked', async () => {
      const user = userEvent.setup()
      const action = createMockAction({
        metadata: { priority: 'high', tags: ['auth'] },
      })

      render(
        <ActionConfirmation
          actions={[action]}
          projectId="test-project"
        />
      )

      const detailsButton = screen.getByText('Show details')
      await user.click(detailsButton)

      expect(screen.getByText('Hide details')).toBeInTheDocument()
      expect(screen.getByText(/"priority": "high"/)).toBeInTheDocument()

      await user.click(screen.getByText('Hide details'))
      expect(screen.queryByText(/"priority": "high"/)).not.toBeInTheDocument()
    })
  })

  describe('Approve Action', () => {
    it('should call execute when approve button is clicked', async () => {
      const user = userEvent.setup()
      const action = createMockAction()

      mockExecute.mockResolvedValue({
        actionId: action.id,
        success: true,
        createdItemId: 'item-123',
        createdItemType: 'story',
      })

      render(
        <ActionConfirmation
          actions={[action]}
          projectId="test-project"
          onActionExecuted={mockOnActionExecuted}
        />
      )

      const approveButton = screen.getByTitle('Create')
      await user.click(approveButton)

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            id: action.id,
            type: action.type,
            title: action.title,
            status: 'approved',
          }),
          'test-project',
          { skipDuplicateCheck: false, forceCreate: false }
        )
      })
    })

    it('should show loading state during execution', async () => {
      const user = userEvent.setup()
      const action = createMockAction()

      mockExecute.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      )

      render(
        <ActionConfirmation
          actions={[action]}
          projectId="test-project"
        />
      )

      const approveButton = screen.getByTitle('Create')
      await user.click(approveButton)

      // Should show loading spinner
      await waitFor(() => {
        const spinner = document.querySelector('.animate-spin')
        expect(spinner).toBeInTheDocument()
      })
    })

    it('should show success state after successful execution', async () => {
      const user = userEvent.setup()
      const action = createMockAction()

      mockExecute.mockResolvedValue({
        actionId: action.id,
        success: true,
        createdItemId: 'item-123',
        createdItemType: 'story',
      })

      render(
        <ActionConfirmation
          actions={[action]}
          projectId="test-project"
        />
      )

      const approveButton = screen.getByTitle('Create')
      await user.click(approveButton)

      await waitFor(() => {
        expect(screen.getByText(/Created story: item-123/i)).toBeInTheDocument()
      })
    })

    it('should show error state on execution failure', async () => {
      const user = userEvent.setup()
      const action = createMockAction()

      mockExecute.mockResolvedValue({
        actionId: action.id,
        success: false,
        error: 'Failed to create item',
      })

      render(
        <ActionConfirmation
          actions={[action]}
          projectId="test-project"
        />
      )

      const approveButton = screen.getByTitle('Create')
      await user.click(approveButton)

      await waitFor(() => {
        expect(screen.getByText('Failed to create item')).toBeInTheDocument()
      })
    })

    it('should handle execution exception gracefully', async () => {
      const user = userEvent.setup()
      const action = createMockAction()

      mockExecute.mockRejectedValue(new Error('Network error'))

      render(
        <ActionConfirmation
          actions={[action]}
          projectId="test-project"
        />
      )

      const approveButton = screen.getByTitle('Create')
      await user.click(approveButton)

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
    })

    it('should call onActionExecuted callback on success', async () => {
      const user = userEvent.setup()
      const action = createMockAction()

      const result: ExecutionResult = {
        actionId: action.id,
        success: true,
        createdItemId: 'item-123',
        createdItemType: 'story',
      }

      mockExecute.mockResolvedValue(result)

      render(
        <ActionConfirmation
          actions={[action]}
          projectId="test-project"
          onActionExecuted={mockOnActionExecuted}
        />
      )

      const approveButton = screen.getByTitle('Create')
      await user.click(approveButton)

      await waitFor(() => {
        expect(mockOnActionExecuted).toHaveBeenCalledWith(result)
      })
    })
  })

  describe('Reject Action', () => {
    it('should show rejected state when dismiss button is clicked', async () => {
      const user = userEvent.setup()
      const action = createMockAction()

      render(
        <ActionConfirmation
          actions={[action]}
          projectId="test-project"
        />
      )

      const dismissButton = screen.getByTitle('Dismiss')
      await user.click(dismissButton)

      await waitFor(() => {
        expect(screen.getByText('Dismissed')).toBeInTheDocument()
      })
    })

    it('should call onActionRejected callback when dismissed', async () => {
      const user = userEvent.setup()
      const action = createMockAction()

      render(
        <ActionConfirmation
          actions={[action]}
          projectId="test-project"
          onActionRejected={mockOnActionRejected}
        />
      )

      const dismissButton = screen.getByTitle('Dismiss')
      await user.click(dismissButton)

      await waitFor(() => {
        expect(mockOnActionRejected).toHaveBeenCalledWith(action.id)
      })
    })
  })

  describe('Approve All Actions', () => {
    it('should execute all pending actions when Approve All is clicked', async () => {
      const user = userEvent.setup()
      const actions = [
        createMockAction({ id: 'action-1' }),
        createMockAction({ id: 'action-2' }),
        createMockAction({ id: 'action-3' }),
      ]

      mockExecute.mockResolvedValue({
        actionId: 'any',
        success: true,
        createdItemId: 'item-123',
      })

      render(
        <ActionConfirmation
          actions={actions}
          projectId="test-project"
        />
      )

      const approveAllButton = screen.getByText('Approve All')
      await user.click(approveAllButton)

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledTimes(3)
      })
    })

    it('should execute actions sequentially', async () => {
      const user = userEvent.setup()
      const executionOrder: string[] = []

      const actions = [
        createMockAction({ id: 'action-1' }),
        createMockAction({ id: 'action-2' }),
      ]

      mockExecute.mockImplementation((action) => {
        executionOrder.push(action.id)
        return Promise.resolve({ actionId: action.id, success: true })
      })

      render(
        <ActionConfirmation
          actions={actions}
          projectId="test-project"
        />
      )

      const approveAllButton = screen.getByText('Approve All')
      await user.click(approveAllButton)

      await waitFor(() => {
        expect(executionOrder).toEqual(['action-1', 'action-2'])
      })
    })
  })

  describe('Reject All Actions', () => {
    it('should reject all pending actions when Dismiss button in header is clicked', async () => {
      const user = userEvent.setup()
      const actions = [
        createMockAction({ id: 'action-1' }),
        createMockAction({ id: 'action-2' }),
      ]

      render(
        <ActionConfirmation
          actions={actions}
          projectId="test-project"
          onActionRejected={mockOnActionRejected}
        />
      )

      // Find the Dismiss button in the header by text (not by title attribute)
      const dismissButton = screen.getByText('Dismiss')
      await user.click(dismissButton)

      await waitFor(() => {
        expect(mockOnActionRejected).toHaveBeenCalledWith('action-1')
        expect(mockOnActionRejected).toHaveBeenCalledWith('action-2')
      })
    })

    it('should stop propagation when dismiss all is clicked', async () => {
      const user = userEvent.setup()
      const actions = [createMockAction()]

      const { container } = render(
        <ActionConfirmation
          actions={actions}
          projectId="test-project"
        />
      )

      // Should be expanded initially
      expect(screen.getByText('Test Story')).toBeInTheDocument()

      // Find the Dismiss button in the header by text (not by title attribute)
      const dismissButton = screen.getByText('Dismiss')
      await user.click(dismissButton)

      // Should still be expanded (stopPropagation worked)
      expect(screen.getByText('Test Story')).toBeInTheDocument()
    })
  })

  describe('Completed Actions Footer', () => {
    it('should show footer when all actions are processed', async () => {
      const user = userEvent.setup()
      const action = createMockAction()

      mockExecute.mockResolvedValue({
        actionId: action.id,
        success: true,
      })

      render(
        <ActionConfirmation
          actions={[action]}
          projectId="test-project"
          onDismiss={mockOnDismiss}
        />
      )

      const approveButton = screen.getByTitle('Create')
      await user.click(approveButton)

      await waitFor(() => {
        expect(screen.getByText('All actions processed')).toBeInTheDocument()
      })
    })

    it('should call onDismiss when Clear button is clicked', async () => {
      const user = userEvent.setup()
      const action = createMockAction()

      mockExecute.mockResolvedValue({
        actionId: action.id,
        success: true,
      })

      render(
        <ActionConfirmation
          actions={[action]}
          projectId="test-project"
          onDismiss={mockOnDismiss}
        />
      )

      const approveButton = screen.getByTitle('Create')
      await user.click(approveButton)

      await waitFor(() => {
        expect(screen.getByText('Clear')).toBeInTheDocument()
      })

      const clearButton = screen.getByText('Clear')
      await user.click(clearButton)

      expect(mockOnDismiss).toHaveBeenCalled()
    })

    it('should not render footer when there are still pending actions', () => {
      const actions = [
        createMockAction({ id: 'action-1' }),
        createMockAction({ id: 'action-2' }),
      ]

      render(
        <ActionConfirmation
          actions={actions}
          projectId="test-project"
        />
      )

      expect(screen.queryByText('All actions processed')).not.toBeInTheDocument()
    })

    it('should show success count in header', async () => {
      const user = userEvent.setup()
      const actions = [
        createMockAction({ id: 'action-1' }),
        createMockAction({ id: 'action-2' }),
      ]

      mockExecute.mockResolvedValue({
        actionId: 'any',
        success: true,
      })

      render(
        <ActionConfirmation
          actions={actions}
          projectId="test-project"
        />
      )

      // Approve first action
      const approveButtons = screen.getAllByTitle('Create')
      await user.click(approveButtons[0])

      await waitFor(() => {
        expect(screen.getByText('2 actions found • 1 completed')).toBeInTheDocument()
      })
    })
  })

  describe('Confidence Badge Colors', () => {
    it('should show green badge for high confidence (>=70%)', () => {
      const action = createMockAction({ confidence: 0.85 })

      render(
        <ActionConfirmation
          actions={[action]}
          projectId="test-project"
        />
      )

      const badge = screen.getByText('85%')
      expect(badge).toHaveClass('text-green-400')
    })

    it('should show amber badge for medium confidence (50-69%)', () => {
      const action = createMockAction({ confidence: 0.6 })

      render(
        <ActionConfirmation
          actions={[action]}
          projectId="test-project"
        />
      )

      const badge = screen.getByText('60%')
      expect(badge).toHaveClass('text-amber-400')
    })

    it('should show red badge for low confidence (<50%)', () => {
      const action = createMockAction({ confidence: 0.3 })

      render(
        <ActionConfirmation
          actions={[action]}
          projectId="test-project"
        />
      )

      const badge = screen.getByText('30%')
      expect(badge).toHaveClass('text-red-400')
    })
  })

  describe('Visual States', () => {
    it('should reduce opacity for processed actions', async () => {
      const user = userEvent.setup()
      const action = createMockAction()

      mockExecute.mockResolvedValue({
        actionId: action.id,
        success: true,
      })

      render(
        <ActionConfirmation
          actions={[action]}
          projectId="test-project"
        />
      )

      // Find the action item container (the outer div with px-4 py-3)
      const actionItem = screen.getByText('Test Story').closest('.px-4.py-3.border-b')

      // Should not have opacity class initially
      expect(actionItem).not.toHaveClass('opacity-70')

      const approveButton = screen.getByTitle('Create')
      await user.click(approveButton)

      await waitFor(() => {
        const processedActionItem = screen.getByText('Test Story').closest('.px-4.py-3.border-b')
        expect(processedActionItem).toHaveClass('opacity-70')
      }, { timeout: 2000 })
    })
  })

  describe('Edge Cases', () => {
    it('should handle actions without description', () => {
      const action = createMockAction({ description: undefined })

      render(
        <ActionConfirmation
          actions={[action]}
          projectId="test-project"
        />
      )

      expect(screen.getByText('Test Story')).toBeInTheDocument()
      // Description should not be rendered
      expect(screen.queryByText('Test description')).not.toBeInTheDocument()
    })

    it('should handle actions with empty metadata', () => {
      const action = createMockAction({ metadata: {} })

      render(
        <ActionConfirmation
          actions={[action]}
          projectId="test-project"
        />
      )

      expect(screen.queryByText('Show details')).not.toBeInTheDocument()
    })

    it('should limit duplicate matches display to 2', () => {
      const action = createMockAction({
        duplicateCheck: {
          hasDuplicate: true,
          matches: [
            { id: '1', title: 'Match 1', type: 'story', similarity: 0.9 },
            { id: '2', title: 'Match 2', type: 'story', similarity: 0.85 },
            { id: '3', title: 'Match 3', type: 'story', similarity: 0.8 },
          ],
        },
      })

      render(
        <ActionConfirmation
          actions={[action]}
          projectId="test-project"
        />
      )

      expect(screen.getByText('Match 1')).toBeInTheDocument()
      expect(screen.getByText('Match 2')).toBeInTheDocument()
      expect(screen.queryByText('Match 3')).not.toBeInTheDocument()
    })

    it('should handle missing action type info gracefully', () => {
      const action = createMockAction({
        type: 'unknown-type' as ActionType,
      })

      render(
        <ActionConfirmation
          actions={[action]}
          projectId="test-project"
        />
      )

      // Should still render the action
      expect(screen.getByText('Test Story')).toBeInTheDocument()
    })
  })

  describe('Button Interactions', () => {
    it('should prevent header collapse when clicking Approve All', async () => {
      const user = userEvent.setup()
      const actions = [createMockAction()]

      mockExecute.mockResolvedValue({
        actionId: 'any',
        success: true,
      })

      render(
        <ActionConfirmation
          actions={actions}
          projectId="test-project"
        />
      )

      // Should be expanded
      expect(screen.getByText('Test Story')).toBeInTheDocument()

      const approveAllButton = screen.getByText('Approve All')
      await user.click(approveAllButton)

      // Should still be expanded (stopPropagation worked)
      await waitFor(() => {
        expect(screen.getByText('Test Story')).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper button titles for screen readers', () => {
      const action = createMockAction()

      render(
        <ActionConfirmation
          actions={[action]}
          projectId="test-project"
        />
      )

      expect(screen.getByTitle('Create')).toBeInTheDocument()
      expect(screen.getByTitle('Dismiss')).toBeInTheDocument()
    })
  })
})
