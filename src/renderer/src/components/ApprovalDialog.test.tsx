/**
 * Claude DevStudio
 * Copyright (c) 2024 Claude DevStudio Contributors
 * Licensed under MIT License - see LICENSE file
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ApprovalDialog } from './ApprovalDialog'
import type { ApprovalGate, QueuedTask, GateType } from '@shared/types'

describe('ApprovalDialog', () => {
  const mockOnApprove = vi.fn()
  const mockOnReject = vi.fn()
  const mockOnClose = vi.fn()

  const createMockGate = (overrides?: Partial<ApprovalGate>): ApprovalGate => ({
    id: 'gate-1',
    taskId: 'task-1',
    gateType: 'manual',
    title: 'Manual Approval Required',
    description: 'Please review the task before proceeding',
    status: 'pending',
    requiresReview: true,
    reviewData: undefined,
    createdAt: new Date('2025-01-01T12:00:00Z'),
    ...overrides
  })

  const createMockTask = (overrides?: Partial<QueuedTask>): QueuedTask => ({
    id: 'task-1',
    projectId: 'proj-1',
    title: 'Test Task',
    description: 'This is a test task',
    taskType: 'code-generation',
    autonomyLevel: 'approval_gates',
    status: 'waiting_approval',
    agentType: 'developer',
    priority: 50,
    approvalRequired: true,
    retryCount: 0,
    maxRetries: 3,
    createdAt: new Date('2025-01-01T11:00:00Z'),
    ...overrides
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render dialog with gate information', () => {
      const gate = createMockGate()
      render(
        <ApprovalDialog
          gate={gate}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText('Manual Approval')).toBeInTheDocument()
      expect(screen.getByText('Manual Approval Required')).toBeInTheDocument()
      expect(screen.getByText('Please review the task before proceeding')).toBeInTheDocument()
    })

    it('should render task details when task is provided', () => {
      const gate = createMockGate()
      const task = createMockTask()
      render(
        <ApprovalDialog
          gate={gate}
          task={task}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText('Task Details')).toBeInTheDocument()
      expect(screen.getByText('Test Task')).toBeInTheDocument()
      expect(screen.getByText('This is a test task')).toBeInTheDocument()
      expect(screen.getByText('code generation')).toBeInTheDocument()
      expect(screen.getByText('developer')).toBeInTheDocument()
      expect(screen.getByText('approval gates')).toBeInTheDocument()
    })

    it('should render without task details when task is not provided', () => {
      const gate = createMockGate()
      render(
        <ApprovalDialog
          gate={gate}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onClose={mockOnClose}
        />
      )

      expect(screen.queryByText('Task Details')).not.toBeInTheDocument()
    })

    it('should display correct icon and color for gate type', () => {
      const gateTypes: { type: GateType; label: string; color: string }[] = [
        { type: 'manual', label: 'Manual Approval', color: 'text-orange-400' },
        { type: 'quality', label: 'Quality Review', color: 'text-green-400' },
        { type: 'security', label: 'Security Check', color: 'text-red-400' },
        { type: 'tech_decision', label: 'Technology Decision', color: 'text-amber-400' },
        { type: 'review', label: 'Output Review', color: 'text-cyan-400' }
      ]

      gateTypes.forEach(({ type, label }) => {
        const gate = createMockGate({ gateType: type })
        const { unmount } = render(
          <ApprovalDialog
            gate={gate}
            onApprove={mockOnApprove}
            onReject={mockOnReject}
            onClose={mockOnClose}
          />
        )

        expect(screen.getByText(label)).toBeInTheDocument()
        unmount()
      })
    })

    it('should display creation timestamp', () => {
      const gate = createMockGate()
      render(
        <ApprovalDialog
          gate={gate}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText(/Created/)).toBeInTheDocument()
    })

    it('should render approve and reject buttons', () => {
      const gate = createMockGate()
      render(
        <ApprovalDialog
          gate={gate}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument()
    })
  })

  describe('Review Data Display', () => {
    it('should display review data when provided', () => {
      const gate = createMockGate({ reviewData: 'Some review data to display' })
      render(
        <ApprovalDialog
          gate={gate}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText('Review Data')).toBeInTheDocument()
      expect(screen.getByText('Some review data to display')).toBeInTheDocument()
    })

    it('should format JSON review data', () => {
      const reviewDataObj = { status: 'success', results: ['item1', 'item2'] }
      const gate = createMockGate({ reviewData: JSON.stringify(reviewDataObj) })
      render(
        <ApprovalDialog
          gate={gate}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText(/JSON/)).toBeInTheDocument()
      expect(screen.getByText(/"status"/)).toBeInTheDocument()
      expect(screen.getByText(/"success"/)).toBeInTheDocument()
    })

    it('should toggle expanded review data', () => {
      const longReviewData = 'x'.repeat(400)
      const gate = createMockGate({ reviewData: longReviewData })
      render(
        <ApprovalDialog
          gate={gate}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onClose={mockOnClose}
        />
      )

      const toggleButton = screen.getByText('Review Data').closest('div')
      expect(toggleButton).toBeInTheDocument()

      if (toggleButton) {
        fireEvent.click(toggleButton)
      }

      const showMoreButton = screen.queryByText('Show more...')
      if (showMoreButton) {
        fireEvent.click(showMoreButton)
      }
    })

    it('should not display review data when not provided', () => {
      const gate = createMockGate({ reviewData: undefined })
      render(
        <ApprovalDialog
          gate={gate}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onClose={mockOnClose}
        />
      )

      expect(screen.queryByText('Review Data')).not.toBeInTheDocument()
    })
  })

  describe('Approve Functionality', () => {
    it('should call onApprove when approve button is clicked', () => {
      const gate = createMockGate()
      render(
        <ApprovalDialog
          gate={gate}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onClose={mockOnClose}
        />
      )

      const approveButton = screen.getByRole('button', { name: /approve/i })
      fireEvent.click(approveButton)

      expect(mockOnApprove).toHaveBeenCalledTimes(1)
      expect(mockOnApprove).toHaveBeenCalledWith(undefined)
    })

    it('should call onApprove with notes when provided', () => {
      const gate = createMockGate()
      render(
        <ApprovalDialog
          gate={gate}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onClose={mockOnClose}
        />
      )

      const notesTextarea = screen.getByPlaceholderText(/Add any notes about this approval/i)
      fireEvent.change(notesTextarea, { target: { value: 'Looks good to me' } })

      const approveButton = screen.getByRole('button', { name: /approve/i })
      fireEvent.click(approveButton)

      expect(mockOnApprove).toHaveBeenCalledTimes(1)
      expect(mockOnApprove).toHaveBeenCalledWith('Looks good to me')
    })

    it('should render optional approval notes textarea', () => {
      const gate = createMockGate()
      render(
        <ApprovalDialog
          gate={gate}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText(/Approval Notes \(Optional\)/i)).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/Add any notes about this approval/i)).toBeInTheDocument()
    })
  })

  describe('Reject Functionality', () => {
    it('should show reject form when reject button is clicked', () => {
      const gate = createMockGate()
      render(
        <ApprovalDialog
          gate={gate}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onClose={mockOnClose}
        />
      )

      const rejectButton = screen.getByRole('button', { name: /reject/i })
      fireEvent.click(rejectButton)

      expect(screen.getByText('Rejection Reason')).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/Please provide a reason for rejection/i)).toBeInTheDocument()
    })

    it('should hide approval notes when reject form is shown', () => {
      const gate = createMockGate()
      render(
        <ApprovalDialog
          gate={gate}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText(/Approval Notes \(Optional\)/i)).toBeInTheDocument()

      const rejectButton = screen.getByRole('button', { name: /reject/i })
      fireEvent.click(rejectButton)

      expect(screen.queryByText(/Approval Notes \(Optional\)/i)).not.toBeInTheDocument()
    })

    it('should hide footer buttons when reject form is shown', () => {
      const gate = createMockGate()
      render(
        <ApprovalDialog
          gate={gate}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onClose={mockOnClose}
        />
      )

      const rejectButton = screen.getByRole('button', { name: /reject/i })
      fireEvent.click(rejectButton)

      expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument()
    })

    it('should call onReject with reason when confirm rejection is clicked', async () => {
      const gate = createMockGate()
      render(
        <ApprovalDialog
          gate={gate}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onClose={mockOnClose}
        />
      )

      const rejectButton = screen.getByRole('button', { name: /reject/i })
      fireEvent.click(rejectButton)

      const reasonTextarea = screen.getByPlaceholderText(/Please provide a reason for rejection/i)
      fireEvent.change(reasonTextarea, { target: { value: 'Does not meet requirements' } })

      const confirmButton = screen.getByRole('button', { name: /confirm rejection/i })
      fireEvent.click(confirmButton)

      await waitFor(() => {
        expect(mockOnReject).toHaveBeenCalledTimes(1)
        expect(mockOnReject).toHaveBeenCalledWith('Does not meet requirements')
      })
    })

    it('should disable confirm rejection button when reason is empty', () => {
      const gate = createMockGate()
      render(
        <ApprovalDialog
          gate={gate}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onClose={mockOnClose}
        />
      )

      const rejectButton = screen.getByRole('button', { name: /reject/i })
      fireEvent.click(rejectButton)

      const confirmButton = screen.getByRole('button', { name: /confirm rejection/i })
      expect(confirmButton).toBeDisabled()
    })

    it('should enable confirm rejection button when reason is provided', () => {
      const gate = createMockGate()
      render(
        <ApprovalDialog
          gate={gate}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onClose={mockOnClose}
        />
      )

      const rejectButton = screen.getByRole('button', { name: /reject/i })
      fireEvent.click(rejectButton)

      const reasonTextarea = screen.getByPlaceholderText(/Please provide a reason for rejection/i)
      fireEvent.change(reasonTextarea, { target: { value: 'Invalid approach' } })

      const confirmButton = screen.getByRole('button', { name: /confirm rejection/i })
      expect(confirmButton).not.toBeDisabled()
    })

    it('should cancel reject form when cancel button is clicked', () => {
      const gate = createMockGate()
      render(
        <ApprovalDialog
          gate={gate}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onClose={mockOnClose}
        />
      )

      const rejectButton = screen.getByRole('button', { name: /reject/i })
      fireEvent.click(rejectButton)

      expect(screen.getByText('Rejection Reason')).toBeInTheDocument()

      const cancelButtons = screen.getAllByRole('button', { name: /cancel/i })
      const cancelButton = cancelButtons.find((btn) => btn.textContent === 'Cancel')
      if (cancelButton) {
        fireEvent.click(cancelButton)
      }

      expect(screen.queryByText('Rejection Reason')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument()
    })

    it('should not call onReject when reason is only whitespace', () => {
      const gate = createMockGate()
      render(
        <ApprovalDialog
          gate={gate}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onClose={mockOnClose}
        />
      )

      const rejectButton = screen.getByRole('button', { name: /reject/i })
      fireEvent.click(rejectButton)

      const reasonTextarea = screen.getByPlaceholderText(/Please provide a reason for rejection/i)
      fireEvent.change(reasonTextarea, { target: { value: '   ' } })

      const confirmButton = screen.getByRole('button', { name: /confirm rejection/i })
      expect(confirmButton).toBeDisabled()
    })
  })

  describe('Close Functionality', () => {
    it('should call onClose when close button is clicked', () => {
      const gate = createMockGate()
      render(
        <ApprovalDialog
          gate={gate}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onClose={mockOnClose}
        />
      )

      const closeButtons = screen.getAllByRole('button')
      const closeButton = closeButtons.find((btn) => btn.querySelector('.fa-times'))
      expect(closeButton).toBeInTheDocument()

      if (closeButton) {
        fireEvent.click(closeButton)
      }

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('Quality and Review Gates', () => {
    it('should display review checklist for quality gate', () => {
      const gate = createMockGate({ gateType: 'quality', title: 'Quality Gate' })
      render(
        <ApprovalDialog
          gate={gate}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText('Review Checklist')).toBeInTheDocument()
      expect(screen.getByText('Output matches expected requirements')).toBeInTheDocument()
      expect(screen.getByText('No errors or warnings in execution')).toBeInTheDocument()
      expect(screen.getByText('Code quality meets standards')).toBeInTheDocument()
      expect(screen.getByText('Ready for next step in pipeline')).toBeInTheDocument()
    })

    it('should display review checklist for review gate', () => {
      const gate = createMockGate({ gateType: 'review', title: 'Review Gate' })
      render(
        <ApprovalDialog
          gate={gate}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText('Review Checklist')).toBeInTheDocument()
    })

    it('should not display review checklist for manual gate', () => {
      const gate = createMockGate({ gateType: 'manual' })
      render(
        <ApprovalDialog
          gate={gate}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onClose={mockOnClose}
        />
      )

      expect(screen.queryByText('Review Checklist')).not.toBeInTheDocument()
    })

    it('should not display review checklist for security gate', () => {
      const gate = createMockGate({ gateType: 'security' })
      render(
        <ApprovalDialog
          gate={gate}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onClose={mockOnClose}
        />
      )

      expect(screen.queryByText('Review Checklist')).not.toBeInTheDocument()
    })

    it('should render checkboxes in review checklist', () => {
      const gate = createMockGate({ gateType: 'quality' })
      render(
        <ApprovalDialog
          gate={gate}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onClose={mockOnClose}
        />
      )

      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes).toHaveLength(4)
    })
  })

  describe('Task Type Display', () => {
    it('should format task type with spaces', () => {
      const gate = createMockGate()
      const task = createMockTask({ taskType: 'code-review' })
      render(
        <ApprovalDialog
          gate={gate}
          task={task}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText('code review')).toBeInTheDocument()
    })

    it('should display autonomy level with proper formatting', () => {
      const gate = createMockGate()
      const task = createMockTask({ autonomyLevel: 'approval_gates' })
      render(
        <ApprovalDialog
          gate={gate}
          task={task}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText('approval gates')).toBeInTheDocument()
    })

    it('should display task without description', () => {
      const gate = createMockGate()
      const task = createMockTask({ description: undefined })
      render(
        <ApprovalDialog
          gate={gate}
          task={task}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText('Test Task')).toBeInTheDocument()
      expect(screen.queryByText('Description')).not.toBeInTheDocument()
    })

    it('should display task without agent type', () => {
      const gate = createMockGate()
      const task = createMockTask({ agentType: undefined })
      render(
        <ApprovalDialog
          gate={gate}
          task={task}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onClose={mockOnClose}
        />
      )

      expect(screen.queryByText('Agent')).not.toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle gate without description', () => {
      const gate = createMockGate({ description: undefined })
      render(
        <ApprovalDialog
          gate={gate}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText('Manual Approval Required')).toBeInTheDocument()
    })

    it('should handle empty notes on approve', () => {
      const gate = createMockGate()
      render(
        <ApprovalDialog
          gate={gate}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onClose={mockOnClose}
        />
      )

      const approveButton = screen.getByRole('button', { name: /approve/i })
      fireEvent.click(approveButton)

      expect(mockOnApprove).toHaveBeenCalledWith(undefined)
    })

    it('should handle malformed JSON in review data', () => {
      const gate = createMockGate({ reviewData: '{ invalid json }' })
      render(
        <ApprovalDialog
          gate={gate}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText('Review Data')).toBeInTheDocument()
      expect(screen.getByText('{ invalid json }')).toBeInTheDocument()
      expect(screen.queryByText(/JSON/)).not.toBeInTheDocument()
    })

    it('should handle very long review data', () => {
      const longData = 'x'.repeat(500)
      const gate = createMockGate({ reviewData: longData })
      render(
        <ApprovalDialog
          gate={gate}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText('Review Data')).toBeInTheDocument()
      expect(screen.getByText('Show more...')).toBeInTheDocument()
    })

    it('should autofocus on reject reason textarea when reject form opens', async () => {
      const gate = createMockGate()
      render(
        <ApprovalDialog
          gate={gate}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onClose={mockOnClose}
        />
      )

      const rejectButton = screen.getByRole('button', { name: /reject/i })
      fireEvent.click(rejectButton)

      const reasonTextarea = screen.getByPlaceholderText(/Please provide a reason for rejection/i)
      await waitFor(() => {
        expect(document.activeElement).toBe(reasonTextarea)
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper button roles', () => {
      const gate = createMockGate()
      render(
        <ApprovalDialog
          gate={gate}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument()
    })

    it('should have proper textbox roles for textareas', () => {
      const gate = createMockGate()
      render(
        <ApprovalDialog
          gate={gate}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onClose={mockOnClose}
        />
      )

      const notesTextarea = screen.getByPlaceholderText(/Add any notes about this approval/i)
      expect(notesTextarea).toBeInTheDocument()
      expect(notesTextarea.tagName).toBe('TEXTAREA')
    })

    it('should have proper checkbox roles in review checklist', () => {
      const gate = createMockGate({ gateType: 'quality' })
      render(
        <ApprovalDialog
          gate={gate}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onClose={mockOnClose}
        />
      )

      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes.length).toBeGreaterThan(0)
    })
  })
})
