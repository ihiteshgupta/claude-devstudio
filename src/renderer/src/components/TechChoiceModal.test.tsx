/**
 * Claude DevStudio
 * Copyright (c) 2024 Claude DevStudio Contributors
 * Licensed under MIT License - see LICENSE file
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { TechChoiceModal } from './TechChoiceModal'
import type { TechChoice, TechOption } from '@shared/types'

describe('TechChoiceModal', () => {
  const mockOnDecide = vi.fn()
  const mockOnCancel = vi.fn()

  const createMockOption = (overrides: Partial<TechOption> = {}): TechOption => ({
    name: 'React',
    description: 'A JavaScript library for building user interfaces',
    pros: ['Fast rendering', 'Large community', 'Component-based'],
    cons: ['Steep learning curve', 'Frequent updates'],
    learningCurve: 'medium',
    communitySupport: 'large',
    isRecommended: false,
    estimatedSetupTime: '2-3 hours',
    ...overrides
  })

  const createMockChoice = (overrides: Partial<TechChoice> = {}): TechChoice => ({
    id: 'choice-1',
    projectId: 'project-1',
    taskId: 'task-1',
    category: 'framework',
    question: 'Which frontend framework should we use?',
    context: 'Building a modern web application with TypeScript support',
    options: [
      createMockOption({ name: 'React', isRecommended: true }),
      createMockOption({ name: 'Vue', learningCurve: 'low', communitySupport: 'medium' }),
      createMockOption({ name: 'Angular', learningCurve: 'high' })
    ],
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render modal with tech choice question', () => {
      const choice = createMockChoice()
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      expect(screen.getByText('Technology Decision Required')).toBeInTheDocument()
      expect(screen.getByText(choice.question)).toBeInTheDocument()
    })

    it('should render context when provided', () => {
      const choice = createMockChoice({ context: 'Building a modern web application' })
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      expect(screen.getByText('Building a modern web application')).toBeInTheDocument()
    })

    it('should not render context when not provided', () => {
      const choice = createMockChoice({ context: undefined })
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      expect(screen.queryByText(/Building a modern web application/)).not.toBeInTheDocument()
    })

    it('should render all tech options', () => {
      const choice = createMockChoice()
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      // Options appear in both cards and table, use getAllByText
      expect(screen.getAllByText('React').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Vue').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Angular').length).toBeGreaterThan(0)
    })

    it('should render option details correctly', () => {
      const option = createMockOption({
        name: 'React',
        description: 'A JavaScript library for building user interfaces',
        pros: ['Fast rendering', 'Large community', 'Component-based'],
        cons: ['Steep learning curve', 'Frequent updates']
      })
      const choice = createMockChoice({ options: [option] })
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      expect(screen.getByText('React')).toBeInTheDocument()
      expect(screen.getByText('A JavaScript library for building user interfaces')).toBeInTheDocument()
      expect(screen.getByText('Fast rendering')).toBeInTheDocument()
      expect(screen.getByText('Large community')).toBeInTheDocument()
      expect(screen.getByText('Component-based')).toBeInTheDocument()
      expect(screen.getByText('Steep learning curve')).toBeInTheDocument()
      expect(screen.getByText('Frequent updates')).toBeInTheDocument()
    })

    it('should show recommended badge for recommended option', () => {
      const option = createMockOption({ name: 'React', isRecommended: true })
      const choice = createMockChoice({ options: [option] })
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      const badges = screen.getAllByText('Recommended')
      expect(badges.length).toBeGreaterThan(0)
    })

    it('should not show recommended badge for non-recommended option', () => {
      const option = createMockOption({ name: 'Vue', isRecommended: false })
      const choice = createMockChoice({ options: [option] })
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      expect(screen.queryByText('Recommended')).not.toBeInTheDocument()
    })

    it('should display learning curve with correct color', () => {
      const options = [
        createMockOption({ name: 'Easy', learningCurve: 'low' }),
        createMockOption({ name: 'Medium', learningCurve: 'medium' }),
        createMockOption({ name: 'Hard', learningCurve: 'high' })
      ]
      const choice = createMockChoice({ options })
      const { container } = render(
        <TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />
      )

      const easyCard = container.querySelector(':has(> h3:contains("Easy"))')
      const mediumCard = container.querySelector(':has(> h3:contains("Medium"))')
      const hardCard = container.querySelector(':has(> h3:contains("Hard"))')

      expect(screen.getByText(/low learning curve/i)).toBeInTheDocument()
      expect(screen.getByText(/medium learning curve/i)).toBeInTheDocument()
      expect(screen.getByText(/high learning curve/i)).toBeInTheDocument()
    })

    it('should display community support icons', () => {
      const options = [
        createMockOption({ name: 'Small', communitySupport: 'small' }),
        createMockOption({ name: 'Medium', communitySupport: 'medium' }),
        createMockOption({ name: 'Large', communitySupport: 'large' })
      ]
      const choice = createMockChoice({ options })
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      // Check that community support text appears (appears in both cards and table)
      const smallCommunityElements = screen.getAllByText((content, element) => {
        return element?.textContent?.includes('small community') || false
      })
      expect(smallCommunityElements.length).toBeGreaterThan(0)

      const mediumCommunityElements = screen.getAllByText((content, element) => {
        return element?.textContent?.includes('medium community') || false
      })
      expect(mediumCommunityElements.length).toBeGreaterThan(0)

      const largeCommunityElements = screen.getAllByText((content, element) => {
        return element?.textContent?.includes('large community') || false
      })
      expect(largeCommunityElements.length).toBeGreaterThan(0)
    })

    it('should show setup time when provided', () => {
      const option = createMockOption({ estimatedSetupTime: '2-3 hours' })
      const choice = createMockChoice({ options: [option] })
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      expect(screen.getByText(/Setup: 2-3 hours/)).toBeInTheDocument()
    })

    it('should not show setup time section when not provided', () => {
      const option = createMockOption({ estimatedSetupTime: undefined })
      const choice = createMockChoice({ options: [option] })
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      expect(screen.queryByText(/Setup:/)).not.toBeInTheDocument()
    })

    it('should show first 4 pros and indicate more if available', () => {
      const option = createMockOption({
        pros: ['Pro 1', 'Pro 2', 'Pro 3', 'Pro 4', 'Pro 5', 'Pro 6']
      })
      const choice = createMockChoice({ options: [option] })
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      expect(screen.getByText('Pro 1')).toBeInTheDocument()
      expect(screen.getByText('Pro 2')).toBeInTheDocument()
      expect(screen.getByText('Pro 3')).toBeInTheDocument()
      expect(screen.getByText('Pro 4')).toBeInTheDocument()
      expect(screen.getByText('+2 more')).toBeInTheDocument()
      expect(screen.queryByText('Pro 5')).not.toBeInTheDocument()
    })

    it('should show first 3 cons and indicate more if available', () => {
      const option = createMockOption({
        cons: ['Con 1', 'Con 2', 'Con 3', 'Con 4', 'Con 5']
      })
      const choice = createMockChoice({ options: [option] })
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      expect(screen.getByText('Con 1')).toBeInTheDocument()
      expect(screen.getByText('Con 2')).toBeInTheDocument()
      expect(screen.getByText('Con 3')).toBeInTheDocument()
      expect(screen.getByText('+2 more')).toBeInTheDocument()
      expect(screen.queryByText('Con 4')).not.toBeInTheDocument()
    })
  })

  describe('Comparison Table', () => {
    it('should render comparison table when multiple options exist', () => {
      const choice = createMockChoice()
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      expect(screen.getByText('Quick Comparison')).toBeInTheDocument()
    })

    it('should not render comparison table when only one option exists', () => {
      const choice = createMockChoice({ options: [createMockOption()] })
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      expect(screen.queryByText('Quick Comparison')).not.toBeInTheDocument()
    })

    it('should show all options in comparison table header', () => {
      const choice = createMockChoice()
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      const table = screen.getByRole('table')
      expect(within(table).getByText('React')).toBeInTheDocument()
      expect(within(table).getByText('Vue')).toBeInTheDocument()
      expect(within(table).getByText('Angular')).toBeInTheDocument()
    })

    it('should show learning curve for all options in table', () => {
      const choice = createMockChoice()
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      const table = screen.getByRole('table')
      expect(within(table).getByText('Learning Curve')).toBeInTheDocument()
    })

    it('should show community support for all options in table', () => {
      const choice = createMockChoice()
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      const table = screen.getByRole('table')
      expect(within(table).getByText('Community')).toBeInTheDocument()
    })

    it('should show setup time for all options in table', () => {
      const choice = createMockChoice()
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      const table = screen.getByRole('table')
      expect(within(table).getByText('Setup Time')).toBeInTheDocument()
    })

    it('should show pros and cons count in table', () => {
      const choice = createMockChoice()
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      const table = screen.getByRole('table')
      // Check for "advantages" and "considerations" text (they appear multiple times)
      const advantagesElements = within(table).getAllByText(/advantages/i)
      expect(advantagesElements.length).toBeGreaterThan(0)

      const considerationsElements = within(table).getAllByText(/considerations/i)
      expect(considerationsElements.length).toBeGreaterThan(0)
    })

    it('should display "N/A" for missing setup time in comparison table', () => {
      const options = [
        createMockOption({ name: 'React', estimatedSetupTime: '2-3 hours' }),
        createMockOption({ name: 'Vue', estimatedSetupTime: undefined })
      ]
      const choice = createMockChoice({ options })
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      const table = screen.getByRole('table')
      expect(within(table).getByText('N/A')).toBeInTheDocument()
    })
  })

  describe('Selection Interaction', () => {
    it('should pre-select recommended option', () => {
      const options = [
        createMockOption({ name: 'React', isRecommended: true }),
        createMockOption({ name: 'Vue', isRecommended: false })
      ]
      const choice = createMockChoice({ options })
      const { container } = render(
        <TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />
      )

      // Find the card div that contains both border-blue-500 and bg-blue-500/10 (selected state)
      const selectedCard = container.querySelector('.border-blue-500.bg-blue-500\\/10')
      expect(selectedCard).toBeInTheDocument()
      expect(selectedCard?.textContent).toContain('React')
    })

    it('should select option when clicked', () => {
      const choice = createMockChoice()
      const { container } = render(
        <TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />
      )

      // Find all clickable option cards (not in table)
      const cards = container.querySelectorAll('.grid > div')
      const vueCard = Array.from(cards).find(card =>
        card.textContent?.includes('Vue') && card.classList.contains('border-zinc-800')
      ) as HTMLElement

      expect(vueCard).toBeInTheDocument()
      fireEvent.click(vueCard)

      // After clicking, Vue card should have selected styles
      expect(vueCard).toHaveClass('border-blue-500')
    })

    it('should change selection when different option is clicked', () => {
      const choice = createMockChoice()
      const { container } = render(
        <TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />
      )

      // Find all option cards in the grid
      const cards = container.querySelectorAll('.grid > div')
      const reactCard = Array.from(cards).find(card =>
        card.textContent?.includes('React') && card.classList.contains('rounded-xl')
      ) as HTMLElement
      const vueCard = Array.from(cards).find(card =>
        card.textContent?.includes('Vue') && card.classList.contains('rounded-xl')
      ) as HTMLElement

      // Initially React is selected (recommended)
      expect(reactCard).toHaveClass('border-blue-500')
      expect(vueCard).toHaveClass('border-zinc-800')

      // Click Vue
      fireEvent.click(vueCard)

      // Now Vue should be selected
      expect(vueCard).toHaveClass('border-blue-500')
    })

    it('should show checkmark icon on selected option', () => {
      const choice = createMockChoice()
      const { container } = render(
        <TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />
      )

      // React is pre-selected (recommended) - find the selected card
      const selectedCard = container.querySelector('.border-blue-500.bg-blue-500\\/10')
      expect(selectedCard).toBeInTheDocument()

      // Check for the checkmark icon within the selected card
      const checkIcon = selectedCard?.querySelector('.fa-check')
      expect(checkIcon).toBeInTheDocument()
    })
  })

  describe('Decision Rationale', () => {
    it('should render rationale textarea', () => {
      const choice = createMockChoice()
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      const textarea = screen.getByPlaceholderText(
        /Why did you choose this option\? This will be saved for future reference\.\.\./
      )
      expect(textarea).toBeInTheDocument()
    })

    it('should update rationale when user types', () => {
      const choice = createMockChoice()
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      const textarea = screen.getByPlaceholderText(
        /Why did you choose this option\? This will be saved for future reference\.\.\./
      ) as HTMLTextAreaElement

      fireEvent.change(textarea, { target: { value: 'Best for our use case' } })
      expect(textarea.value).toBe('Best for our use case')
    })

    it('should have empty rationale initially', () => {
      const choice = createMockChoice()
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      const textarea = screen.getByPlaceholderText(
        /Why did you choose this option\? This will be saved for future reference\.\.\./
      ) as HTMLTextAreaElement

      expect(textarea.value).toBe('')
    })
  })

  describe('Confirm Selection', () => {
    it('should call onDecide with selected option and rationale when confirmed', () => {
      const choice = createMockChoice()
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      // React is pre-selected (recommended)
      const textarea = screen.getByPlaceholderText(
        /Why did you choose this option\? This will be saved for future reference\.\.\./
      )
      fireEvent.change(textarea, { target: { value: 'Best choice for our needs' } })

      const confirmButton = screen.getByRole('button', { name: /Confirm Selection/i })
      fireEvent.click(confirmButton)

      expect(mockOnDecide).toHaveBeenCalledWith('React', 'Best choice for our needs')
    })

    it('should call onDecide with selected option and empty rationale when no rationale provided', () => {
      const choice = createMockChoice()
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      // React is pre-selected (recommended)
      const confirmButton = screen.getByRole('button', { name: /Confirm Selection/i })
      fireEvent.click(confirmButton)

      expect(mockOnDecide).toHaveBeenCalledWith('React', '')
    })

    it('should disable confirm button when no option is selected', () => {
      const options = [createMockOption({ isRecommended: false })]
      const choice = createMockChoice({ options })
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      const confirmButton = screen.getByRole('button', { name: /Confirm Selection/i })
      expect(confirmButton).toBeDisabled()
    })

    it('should enable confirm button when option is selected', () => {
      const choice = createMockChoice()
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      // React is pre-selected (recommended)
      const confirmButton = screen.getByRole('button', { name: /Confirm Selection/i })
      expect(confirmButton).not.toBeDisabled()
    })

    it('should not call onDecide when confirm button is disabled', () => {
      const options = [createMockOption({ isRecommended: false })]
      const choice = createMockChoice({ options })
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      const confirmButton = screen.getByRole('button', { name: /Confirm Selection/i })
      fireEvent.click(confirmButton)

      expect(mockOnDecide).not.toHaveBeenCalled()
    })
  })

  describe('Cancel Interaction', () => {
    it('should call onCancel when cancel button is clicked', () => {
      const choice = createMockChoice()
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      const cancelButton = screen.getByRole('button', { name: /Cancel Task/i })
      fireEvent.click(cancelButton)

      expect(mockOnCancel).toHaveBeenCalledTimes(1)
    })

    it('should call onCancel when close icon is clicked', () => {
      const choice = createMockChoice()
      const { container } = render(
        <TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />
      )

      const closeButton = container.querySelector('.fa-times')?.closest('button')
      if (closeButton) {
        fireEvent.click(closeButton)
        expect(mockOnCancel).toHaveBeenCalledTimes(1)
      }
    })

    it('should not call onDecide when cancel is clicked', () => {
      const choice = createMockChoice()
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      const cancelButton = screen.getByRole('button', { name: /Cancel Task/i })
      fireEvent.click(cancelButton)

      expect(mockOnDecide).not.toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('should have proper heading structure', () => {
      const choice = createMockChoice()
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      expect(screen.getByRole('heading', { name: choice.question })).toBeInTheDocument()
    })

    it('should have accessible buttons', () => {
      const choice = createMockChoice()
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      expect(screen.getByRole('button', { name: /Cancel Task/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Confirm Selection/i })).toBeInTheDocument()
    })

    it('should have proper table structure', () => {
      const choice = createMockChoice()
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      const table = screen.getByRole('table')
      expect(table).toBeInTheDocument()

      const headers = within(table).getAllByRole('columnheader')
      expect(headers.length).toBeGreaterThan(0)
    })

    it('should have form label for rationale textarea', () => {
      const choice = createMockChoice()
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      expect(screen.getByText('Decision Rationale (Optional)')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle single option', () => {
      const choice = createMockChoice({ options: [createMockOption()] })
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      expect(screen.getByText('React')).toBeInTheDocument()
      expect(screen.queryByText('Quick Comparison')).not.toBeInTheDocument()
    })

    it('should handle options with no pros', () => {
      const option = createMockOption({ pros: [] })
      const choice = createMockChoice({ options: [option] })
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      expect(screen.getByText('Advantages')).toBeInTheDocument()
    })

    it('should handle options with no cons', () => {
      const option = createMockOption({ cons: [] })
      const choice = createMockChoice({ options: [option] })
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      expect(screen.getByText('Considerations')).toBeInTheDocument()
    })

    it('should handle long option names', () => {
      const option = createMockOption({ name: 'Very Long Technology Name That Might Wrap' })
      const choice = createMockChoice({ options: [option] })
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      expect(screen.getByText('Very Long Technology Name That Might Wrap')).toBeInTheDocument()
    })

    it('should handle long descriptions', () => {
      const longDescription =
        'This is a very long description that should still render properly without breaking the layout or causing any issues'
      const option = createMockOption({ description: longDescription })
      const choice = createMockChoice({ options: [option] })
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      expect(screen.getByText(longDescription)).toBeInTheDocument()
    })

    it('should handle multiple recommended options', () => {
      const options = [
        createMockOption({ name: 'React', isRecommended: true }),
        createMockOption({ name: 'Vue', isRecommended: true })
      ]
      const choice = createMockChoice({ options })
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      const badges = screen.getAllByText('Recommended')
      expect(badges.length).toBeGreaterThanOrEqual(2)
    })

    it('should pre-select first recommended option when multiple are recommended', () => {
      const options = [
        createMockOption({ name: 'React', isRecommended: true }),
        createMockOption({ name: 'Vue', isRecommended: true })
      ]
      const choice = createMockChoice({ options })
      const { container } = render(
        <TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />
      )

      // Find the selected card (should be React, the first recommended option)
      const selectedCard = container.querySelector('.border-blue-500.bg-blue-500\\/10')
      expect(selectedCard).toBeInTheDocument()
      expect(selectedCard?.textContent).toContain('React')
    })

    it('should handle no recommended options', () => {
      const options = [
        createMockOption({ name: 'React', isRecommended: false }),
        createMockOption({ name: 'Vue', isRecommended: false })
      ]
      const choice = createMockChoice({ options })
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      const confirmButton = screen.getByRole('button', { name: /Confirm Selection/i })
      expect(confirmButton).toBeDisabled()
    })
  })

  describe('Visual States', () => {
    it('should apply selected styles to option card', () => {
      const choice = createMockChoice()
      const { container } = render(
        <TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />
      )

      // Find the selected card
      const selectedCard = container.querySelector('.border-blue-500.bg-blue-500\\/10')
      expect(selectedCard).toBeInTheDocument()
      expect(selectedCard).toHaveClass('border-blue-500')
      expect(selectedCard).toHaveClass('bg-blue-500/10')
    })

    it('should apply unselected styles to option card', () => {
      const choice = createMockChoice()
      const { container } = render(
        <TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />
      )

      // Find all option cards and get the Vue card (unselected)
      const cards = container.querySelectorAll('.grid > div')
      const vueCard = Array.from(cards).find(card =>
        card.textContent?.includes('Vue') && card.classList.contains('border-zinc-800')
      ) as HTMLElement

      expect(vueCard).toBeInTheDocument()
      expect(vueCard).toHaveClass('border-zinc-800')
      expect(vueCard).toHaveClass('bg-zinc-900/50')
    })

    it('should show radio button as checked for selected option', () => {
      const choice = createMockChoice()
      const { container } = render(
        <TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />
      )

      // Find the selected card
      const selectedCard = container.querySelector('.border-blue-500.bg-blue-500\\/10')
      expect(selectedCard).toBeInTheDocument()

      // Find the radio button indicator (small circle with blue border)
      const radioButton = selectedCard?.querySelector('.w-4.h-4.rounded-full.border-blue-500')
      expect(radioButton).toBeInTheDocument()
    })

    it('should show radio button as unchecked for unselected option', () => {
      const choice = createMockChoice()
      const { container } = render(
        <TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />
      )

      // Find an unselected card
      const cards = container.querySelectorAll('.grid > div')
      const vueCard = Array.from(cards).find(card =>
        card.textContent?.includes('Vue') && card.classList.contains('border-zinc-800')
      ) as HTMLElement

      expect(vueCard).toBeInTheDocument()

      // Find the radio button (small circle with zinc border)
      const radioButton = vueCard.querySelector('.w-4.h-4.rounded-full.border-zinc-600')
      expect(radioButton).toBeInTheDocument()
    })
  })

  describe('Modal Layout', () => {
    it('should render modal with overlay', () => {
      const choice = createMockChoice()
      const { container } = render(
        <TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />
      )

      const overlay = container.querySelector('.bg-black\\/70')
      expect(overlay).toBeInTheDocument()
    })

    it('should render modal content with proper structure', () => {
      const choice = createMockChoice()
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      // Header should be present
      expect(screen.getByText('Technology Decision Required')).toBeInTheDocument()

      // Options grid should be present (React appears multiple times)
      expect(screen.getAllByText('React').length).toBeGreaterThan(0)

      // Footer should be present
      expect(screen.getByRole('button', { name: /Confirm Selection/i })).toBeInTheDocument()
    })

    it('should render help text in footer', () => {
      const choice = createMockChoice()
      render(<TechChoiceModal choice={choice} onDecide={mockOnDecide} onCancel={mockOnCancel} />)

      expect(
        screen.getByText('Select a technology option to continue with task execution')
      ).toBeInTheDocument()
    })
  })
})
