/**
 * Copyright (c) 2025 Claude DevStudio
 * Tests for Skeleton component and its variants
 */

import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Skeleton, SkeletonCard, SkeletonList, SkeletonChat, SkeletonTable } from './Skeleton'

describe('Skeleton', () => {
  describe('Basic Skeleton Component', () => {
    it('should render with default props', () => {
      const { container } = render(<Skeleton />)
      const skeleton = container.firstChild as HTMLElement

      expect(skeleton).toBeInTheDocument()
      expect(skeleton.tagName).toBe('DIV')
    })

    it('should apply animation class', () => {
      const { container } = render(<Skeleton />)
      const skeleton = container.firstChild as HTMLElement

      expect(skeleton).toHaveClass('animate-pulse')
    })

    it('should apply default styling classes', () => {
      const { container } = render(<Skeleton />)
      const skeleton = container.firstChild as HTMLElement

      expect(skeleton).toHaveClass('rounded-md')
      expect(skeleton).toHaveClass('bg-muted/50')
    })

    it('should accept custom className', () => {
      const { container } = render(<Skeleton className="custom-class" />)
      const skeleton = container.firstChild as HTMLElement

      expect(skeleton).toHaveClass('custom-class')
      expect(skeleton).toHaveClass('animate-pulse')
      expect(skeleton).toHaveClass('rounded-md')
    })

    it('should render with custom width and height', () => {
      const { container } = render(<Skeleton className="w-32 h-8" />)
      const skeleton = container.firstChild as HTMLElement

      expect(skeleton).toHaveClass('w-32')
      expect(skeleton).toHaveClass('h-8')
    })

    it('should merge multiple custom classes', () => {
      const { container } = render(
        <Skeleton className="w-full h-12 bg-gray-200 rounded-lg" />
      )
      const skeleton = container.firstChild as HTMLElement

      expect(skeleton).toHaveClass('w-full')
      expect(skeleton).toHaveClass('h-12')
      expect(skeleton).toHaveClass('bg-gray-200')
      expect(skeleton).toHaveClass('rounded-lg')
    })
  })

  describe('SkeletonCard', () => {
    it('should render card with wrapper and skeletons', () => {
      const { container } = render(<SkeletonCard />)
      const card = container.firstChild as HTMLElement

      expect(card).toBeInTheDocument()
      expect(card).toHaveClass('rounded-lg')
      expect(card).toHaveClass('border')
      expect(card).toHaveClass('bg-card')
      expect(card).toHaveClass('p-4')
    })

    it('should render three skeleton elements', () => {
      const { container } = render(<SkeletonCard />)
      const skeletons = container.querySelectorAll('.animate-pulse')

      expect(skeletons).toHaveLength(4) // 1 title + 1 subtitle + 2 badges
    })

    it('should render title skeleton with correct sizing', () => {
      const { container } = render(<SkeletonCard />)
      const titleSkeleton = container.querySelector('.h-4.w-3\\/4')

      expect(titleSkeleton).toBeInTheDocument()
      expect(titleSkeleton).toHaveClass('h-4')
      expect(titleSkeleton).toHaveClass('w-3/4')
    })

    it('should render subtitle skeleton with correct sizing', () => {
      const { container } = render(<SkeletonCard />)
      const subtitleSkeleton = container.querySelector('.h-3.w-1\\/2')

      expect(subtitleSkeleton).toBeInTheDocument()
      expect(subtitleSkeleton).toHaveClass('h-3')
      expect(subtitleSkeleton).toHaveClass('w-1/2')
    })

    it('should render badge skeletons with rounded-full class', () => {
      const { container } = render(<SkeletonCard />)
      const badges = container.querySelectorAll('.rounded-full')

      expect(badges).toHaveLength(2)
      expect(badges[0]).toHaveClass('h-6')
      expect(badges[0]).toHaveClass('w-16')
      expect(badges[1]).toHaveClass('h-6')
      expect(badges[1]).toHaveClass('w-20')
    })
  })

  describe('SkeletonList', () => {
    it('should render default 3 skeleton cards', () => {
      const { container } = render(<SkeletonList />)
      const cards = container.querySelectorAll('.rounded-lg.border.bg-card')

      expect(cards).toHaveLength(3)
    })

    it('should render custom count of skeleton cards', () => {
      const { container } = render(<SkeletonList count={5} />)
      const cards = container.querySelectorAll('.rounded-lg.border.bg-card')

      expect(cards).toHaveLength(5)
    })

    it('should render single skeleton card when count is 1', () => {
      const { container } = render(<SkeletonList count={1} />)
      const cards = container.querySelectorAll('.rounded-lg.border.bg-card')

      expect(cards).toHaveLength(1)
    })

    it('should render no skeleton cards when count is 0', () => {
      const { container } = render(<SkeletonList count={0} />)
      const cards = container.querySelectorAll('.rounded-lg.border.bg-card')

      expect(cards).toHaveLength(0)
    })

    it('should apply space-y-3 to wrapper', () => {
      const { container } = render(<SkeletonList />)
      const wrapper = container.firstChild as HTMLElement

      expect(wrapper).toHaveClass('space-y-3')
    })
  })

  describe('SkeletonChat', () => {
    it('should render chat container with padding', () => {
      const { container } = render(<SkeletonChat />)
      const chatContainer = container.firstChild as HTMLElement

      expect(chatContainer).toHaveClass('space-y-4')
      expect(chatContainer).toHaveClass('p-4')
    })

    it('should render user message skeleton on right', () => {
      const { container } = render(<SkeletonChat />)
      const userMessage = container.querySelector('.justify-end')

      expect(userMessage).toBeInTheDocument()
      expect(userMessage).toHaveClass('flex')
    })

    it('should render assistant message skeleton on left', () => {
      const { container } = render(<SkeletonChat />)
      const assistantMessage = container.querySelector('.justify-start')

      expect(assistantMessage).toBeInTheDocument()
      expect(assistantMessage).toHaveClass('flex')
    })

    it('should render user message with 2 skeleton lines', () => {
      const { container } = render(<SkeletonChat />)
      const userMessage = container.querySelector('.justify-end .bg-primary\\/10')
      const skeletons = userMessage?.querySelectorAll('.animate-pulse')

      expect(skeletons).toHaveLength(2)
    })

    it('should render assistant message with 4 skeleton lines', () => {
      const { container } = render(<SkeletonChat />)
      const assistantMessage = container.querySelector('.justify-start .bg-muted')
      const skeletons = assistantMessage?.querySelectorAll('.animate-pulse')

      expect(skeletons).toHaveLength(4)
    })

    it('should apply max-width constraint to messages', () => {
      const { container } = render(<SkeletonChat />)
      const userBubble = container.querySelector('.justify-end > div')
      const assistantBubble = container.querySelector('.justify-start > div')

      expect(userBubble).toHaveClass('max-w-[70%]')
      expect(assistantBubble).toHaveClass('max-w-[70%]')
    })
  })

  describe('SkeletonTable', () => {
    it('should render table with header and rows', () => {
      const { container } = render(<SkeletonTable />)
      const wrapper = container.firstChild as HTMLElement

      expect(wrapper).toHaveClass('space-y-2')
    })

    it('should render header row with border-b', () => {
      const { container } = render(<SkeletonTable />)
      const header = container.querySelector('.border-b')

      expect(header).toBeInTheDocument()
      expect(header).toHaveClass('flex')
      expect(header).toHaveClass('gap-4')
      expect(header).toHaveClass('p-3')
    })

    it('should render 4 skeleton columns in header', () => {
      const { container } = render(<SkeletonTable />)
      const header = container.querySelector('.border-b')
      const columns = header?.querySelectorAll('.animate-pulse')

      expect(columns).toHaveLength(4)
    })

    it('should render 5 data rows', () => {
      const { container } = render(<SkeletonTable />)
      const allRows = container.querySelectorAll('.flex.gap-4.p-3')
      // Total rows = 1 header + 5 data rows
      expect(allRows).toHaveLength(6)
    })

    it('should render 4 columns per data row', () => {
      const { container } = render(<SkeletonTable />)
      const rows = container.querySelectorAll('.flex.gap-4.p-3')

      rows.forEach(row => {
        const columns = row.querySelectorAll('.animate-pulse')
        expect(columns).toHaveLength(4)
      })
    })

    it('should apply w-1/4 to all column skeletons', () => {
      const { container } = render(<SkeletonTable />)
      const columns = container.querySelectorAll('.w-1\\/4')

      // 4 columns in header + (4 columns * 5 rows) = 24 total
      expect(columns).toHaveLength(24)
    })

    it('should apply h-4 height to all skeletons', () => {
      const { container } = render(<SkeletonTable />)
      const skeletons = container.querySelectorAll('.h-4')

      expect(skeletons).toHaveLength(24)
    })
  })

  describe('Accessibility', () => {
    it('should render semantic div elements', () => {
      const { container } = render(<Skeleton />)
      const skeleton = container.firstChild

      expect(skeleton?.nodeName).toBe('DIV')
    })

    it('should allow aria-label to be added via className', () => {
      const { container } = render(<Skeleton className="aria-label-loading" />)
      const skeleton = container.firstChild as HTMLElement

      expect(skeleton).toHaveClass('aria-label-loading')
    })
  })

  describe('Integration', () => {
    it('should work with multiple Skeleton components together', () => {
      const { container } = render(
        <div>
          <Skeleton className="h-8 w-full mb-2" />
          <Skeleton className="h-4 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      )

      const skeletons = container.querySelectorAll('.animate-pulse')
      expect(skeletons).toHaveLength(3)
    })

    it('should nest properly within other components', () => {
      const { container } = render(
        <div className="card">
          <SkeletonCard />
        </div>
      )

      expect(container.querySelector('.card')).toBeInTheDocument()
      expect(container.querySelector('.rounded-lg.border')).toBeInTheDocument()
    })
  })
})
