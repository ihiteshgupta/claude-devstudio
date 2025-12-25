/**
 * Copyright (c) 2025 Claude DevStudio
 *
 * OnboardingWizard Component Tests
 *
 * Comprehensive test suite for OnboardingWizard component including:
 * - Step progression (analyzing -> review-analysis -> generating-plan -> review-plan -> applying -> complete)
 * - Project analysis rendering
 * - Plan generation and feedback submission
 * - Roadmap item and task selection
 * - Error handling and retry functionality
 * - Apply plan functionality
 * - Navigation between steps
 * - Progress indicator
 * - Cancel functionality
 */

import * as React from 'react'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import OnboardingWizard from './OnboardingWizard'

// Mock data
const mockProjectAnalysis = {
  projectType: 'web',
  language: 'typescript',
  frameworks: ['React', 'Electron'],
  hasTests: true,
  hasCICD: false,
  hasDocker: true,
  structure: {
    srcDirs: ['src/main', 'src/renderer'],
    testDirs: ['tests'],
    configFiles: ['package.json', 'tsconfig.json', 'vite.config.ts'],
    entryPoints: ['src/main/index.ts', 'src/renderer/main.tsx'],
    totalFiles: 150,
    totalLines: 5000,
  },
  dependencies: ['react', 'electron', 'vite'],
  suggestedAgents: ['developer', 'tester', 'security'],
}

const mockOnboardingPlan = {
  id: 'plan-123',
  projectId: 'project-456',
  analysis: mockProjectAnalysis,
  suggestedRoadmap: [
    {
      type: 'epic' as const,
      title: 'Setup CI/CD Pipeline',
      description: 'Implement automated testing and deployment',
      priority: 'high' as const,
      lane: 'now' as const,
      estimatedEffort: 16,
      tags: ['devops', 'automation'],
      accepted: true,
    },
    {
      type: 'feature' as const,
      title: 'Add E2E Tests',
      description: 'Implement end-to-end testing with Playwright',
      priority: 'medium' as const,
      lane: 'next' as const,
      estimatedEffort: 24,
      tags: ['testing', 'quality'],
      accepted: true,
    },
    {
      type: 'milestone' as const,
      title: 'Security Audit',
      description: 'Comprehensive security review',
      priority: 'low' as const,
      lane: 'later' as const,
      estimatedEffort: 8,
      tags: ['security'],
      accepted: true,
    },
  ],
  suggestedTasks: [
    {
      type: 'setup',
      title: 'Configure GitHub Actions',
      description: 'Setup CI/CD workflow',
      agentType: 'devops',
      autonomyLevel: 'approval_gates' as const,
      priority: 1,
      accepted: true,
    },
    {
      type: 'test',
      title: 'Write unit tests',
      description: 'Add unit test coverage',
      agentType: 'tester',
      autonomyLevel: 'supervised' as const,
      priority: 2,
      accepted: true,
    },
    {
      type: 'security',
      title: 'Security scan setup',
      description: 'Configure automated security scanning',
      agentType: 'security',
      autonomyLevel: 'auto' as const,
      priority: 3,
      accepted: true,
    },
  ],
  status: 'draft',
}

const mockApplyResult = {
  roadmapItemsCreated: 3,
  tasksCreated: 3,
}

// Mock window.electronAPI
const mockElectronAPI = {
  onboarding: {
    analyze: vi.fn(),
    init: vi.fn(),
    updatePlan: vi.fn(),
    applyPlan: vi.fn(),
  },
}

describe('OnboardingWizard Component', () => {
  const mockOnComplete = vi.fn()
  const mockOnCancel = vi.fn()

  const defaultProps = {
    projectId: 'project-456',
    projectName: 'Test Project',
    projectPath: '/path/to/project',
    onComplete: mockOnComplete,
    onCancel: mockOnCancel,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // @ts-expect-error - mocking window.electronAPI
    window.electronAPI = mockElectronAPI
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Initial Render and Analysis', () => {
    it('should render analyzing step initially', () => {
      mockElectronAPI.onboarding.analyze.mockResolvedValue(mockProjectAnalysis)

      render(<OnboardingWizard {...defaultProps} />)

      expect(screen.getByText('Analyzing Project')).toBeInTheDocument()
      expect(screen.getByText(/Scanning Test Project to understand its structure/)).toBeInTheDocument()
    })

    it('should display project name in header', () => {
      mockElectronAPI.onboarding.analyze.mockResolvedValue(mockProjectAnalysis)

      render(<OnboardingWizard {...defaultProps} />)

      expect(screen.getByText('Project Setup')).toBeInTheDocument()
      expect(screen.getByText('Test Project')).toBeInTheDocument()
    })

    it('should show progress indicator', () => {
      mockElectronAPI.onboarding.analyze.mockResolvedValue(mockProjectAnalysis)

      const { container } = render(<OnboardingWizard {...defaultProps} />)

      // Progress dots should be present
      const progressDots = container.querySelectorAll('.w-2.h-2.rounded-full')
      expect(progressDots.length).toBe(6) // 6 steps total
    })

    it('should call analyze API on mount', async () => {
      mockElectronAPI.onboarding.analyze.mockResolvedValue(mockProjectAnalysis)

      render(<OnboardingWizard {...defaultProps} />)

      await waitFor(() => {
        expect(mockElectronAPI.onboarding.analyze).toHaveBeenCalledWith('/path/to/project')
      })
    })

    it('should transition to review-analysis after successful analysis', async () => {
      mockElectronAPI.onboarding.analyze.mockResolvedValue(mockProjectAnalysis)

      render(<OnboardingWizard {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Analysis Complete')).toBeInTheDocument()
      })

      expect(screen.getByText("We've analyzed your project. Review the findings below.")).toBeInTheDocument()
    })

    it('should handle analysis error', async () => {
      mockElectronAPI.onboarding.analyze.mockRejectedValue(new Error('Analysis failed'))

      render(<OnboardingWizard {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument()
        expect(screen.getByText(/Analysis failed/)).toBeInTheDocument()
      })
    })
  })

  describe('Review Analysis Step', () => {
    beforeEach(async () => {
      mockElectronAPI.onboarding.analyze.mockResolvedValue(mockProjectAnalysis)
    })

    it('should display project analysis details', async () => {
      render(<OnboardingWizard {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Analysis Complete')).toBeInTheDocument()
      })

      // Project info
      expect(screen.getByText('web')).toBeInTheDocument()
      expect(screen.getByText('typescript')).toBeInTheDocument()
      expect(screen.getByText('React, Electron')).toBeInTheDocument()

      // Structure
      expect(screen.getByText('src/main, src/renderer')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument() // config files count

      // Capabilities
      expect(screen.getByText('✓ Tests')).toBeInTheDocument()
      expect(screen.getByText('✗ CI/CD')).toBeInTheDocument()
      expect(screen.getByText('✓ Docker')).toBeInTheDocument()

      // Suggested agents
      expect(screen.getByText('developer')).toBeInTheDocument()
      expect(screen.getByText('tester')).toBeInTheDocument()
      expect(screen.getByText('security')).toBeInTheDocument()
    })

    it('should have Generate Plan button', async () => {
      render(<OnboardingWizard {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Analysis Complete')).toBeInTheDocument()
      })

      expect(screen.getByRole('button', { name: /Generate Plan/i })).toBeInTheDocument()
    })

    it('should have Cancel button', async () => {
      render(<OnboardingWizard {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Analysis Complete')).toBeInTheDocument()
      })

      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument()
    })

    it('should call onCancel when Cancel button is clicked', async () => {
      const user = userEvent.setup()
      render(<OnboardingWizard {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Analysis Complete')).toBeInTheDocument()
      })

      const cancelButton = screen.getByRole('button', { name: /Cancel/i })
      await user.click(cancelButton)

      expect(mockOnCancel).toHaveBeenCalledTimes(1)
    })

    it('should transition to generating-plan when Generate Plan is clicked', async () => {
      const user = userEvent.setup()
      // Add a delay to the mock so the intermediate state can be rendered
      mockElectronAPI.onboarding.init.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockOnboardingPlan), 100))
      )

      render(<OnboardingWizard {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Analysis Complete')).toBeInTheDocument()
      })

      const generateButton = screen.getByRole('button', { name: /Generate Plan/i })
      await user.click(generateButton)

      await waitFor(() => {
        expect(screen.getByText('Generating Plan')).toBeInTheDocument()
      })
      expect(screen.getByText(/AI is creating a customized roadmap/)).toBeInTheDocument()
    })
  })

  describe('Generating Plan Step', () => {
    beforeEach(async () => {
      mockElectronAPI.onboarding.analyze.mockResolvedValue(mockProjectAnalysis)
    })

    it('should call init API with correct parameters', async () => {
      const user = userEvent.setup()
      mockElectronAPI.onboarding.init.mockResolvedValue(mockOnboardingPlan)

      render(<OnboardingWizard {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Analysis Complete')).toBeInTheDocument()
      })

      const generateButton = screen.getByRole('button', { name: /Generate Plan/i })
      await user.click(generateButton)

      await waitFor(() => {
        expect(mockElectronAPI.onboarding.init).toHaveBeenCalledWith({
          projectPath: '/path/to/project',
          projectName: 'Test Project',
          projectId: 'project-456',
        })
      })
    })

    it('should transition to review-plan after successful generation', async () => {
      const user = userEvent.setup()
      mockElectronAPI.onboarding.init.mockResolvedValue(mockOnboardingPlan)

      render(<OnboardingWizard {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Analysis Complete')).toBeInTheDocument()
      })

      const generateButton = screen.getByRole('button', { name: /Generate Plan/i })
      await user.click(generateButton)

      await waitFor(() => {
        expect(screen.getByText('Review Your Plan')).toBeInTheDocument()
      })
    })

    it('should handle plan generation error', async () => {
      const user = userEvent.setup()
      mockElectronAPI.onboarding.init.mockRejectedValue(new Error('Generation failed'))

      render(<OnboardingWizard {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Analysis Complete')).toBeInTheDocument()
      })

      const generateButton = screen.getByRole('button', { name: /Generate Plan/i })
      await user.click(generateButton)

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument()
        expect(screen.getByText(/Plan generation failed/)).toBeInTheDocument()
      })
    })
  })

  describe('Review Plan Step', () => {
    beforeEach(async () => {
      mockElectronAPI.onboarding.analyze.mockResolvedValue(mockProjectAnalysis)
      mockElectronAPI.onboarding.init.mockResolvedValue(mockOnboardingPlan)
    })

    const navigateToReviewPlan = async () => {
      const user = userEvent.setup()
      render(<OnboardingWizard {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Analysis Complete')).toBeInTheDocument()
      })

      const generateButton = screen.getByRole('button', { name: /Generate Plan/i })
      await user.click(generateButton)

      await waitFor(() => {
        expect(screen.getByText('Review Your Plan')).toBeInTheDocument()
      })

      return user
    }

    it('should display roadmap items', async () => {
      await navigateToReviewPlan()

      expect(screen.getByText('Setup CI/CD Pipeline')).toBeInTheDocument()
      expect(screen.getByText('Add E2E Tests')).toBeInTheDocument()
      expect(screen.getByText('Security Audit')).toBeInTheDocument()
    })

    it('should display roadmap item details', async () => {
      await navigateToReviewPlan()

      expect(screen.getByText('Implement automated testing and deployment')).toBeInTheDocument()
      expect(screen.getByText('now')).toBeInTheDocument()
      expect(screen.getByText('high')).toBeInTheDocument()
      expect(screen.getByText('~16h')).toBeInTheDocument()
      expect(screen.getByText('epic')).toBeInTheDocument()
    })

    it('should display tasks', async () => {
      await navigateToReviewPlan()

      expect(screen.getByText('Configure GitHub Actions')).toBeInTheDocument()
      expect(screen.getByText('Write unit tests')).toBeInTheDocument()
      expect(screen.getByText('Security scan setup')).toBeInTheDocument()
    })

    it('should display task details', async () => {
      await navigateToReviewPlan()

      expect(screen.getByText('Setup CI/CD workflow')).toBeInTheDocument()
      expect(screen.getByText('devops')).toBeInTheDocument()
      expect(screen.getByText('approval gates')).toBeInTheDocument()
    })

    it('should display selected count for roadmap items', async () => {
      await navigateToReviewPlan()

      expect(screen.getByText('Roadmap Items (3 selected)')).toBeInTheDocument()
    })

    it('should display selected count for tasks', async () => {
      await navigateToReviewPlan()

      expect(screen.getByText('Initial Tasks (3 selected)')).toBeInTheDocument()
    })

    it('should toggle roadmap item selection', async () => {
      const user = await navigateToReviewPlan()

      const roadmapItem = screen.getByText('Setup CI/CD Pipeline').closest('.cursor-pointer')
      expect(roadmapItem).toHaveClass('bg-violet-500/10', 'border-violet-500/30')

      await user.click(roadmapItem!)

      await waitFor(() => {
        expect(screen.getByText('Roadmap Items (2 selected)')).toBeInTheDocument()
      })

      expect(roadmapItem).toHaveClass('bg-zinc-800/50', 'border-zinc-700', 'opacity-50')
    })

    it('should toggle task selection', async () => {
      const user = await navigateToReviewPlan()

      const task = screen.getByText('Configure GitHub Actions').closest('.cursor-pointer')
      expect(task).toHaveClass('bg-violet-500/10', 'border-violet-500/30')

      await user.click(task!)

      await waitFor(() => {
        expect(screen.getByText('Initial Tasks (2 selected)')).toBeInTheDocument()
      })

      expect(task).toHaveClass('bg-zinc-800/50', 'border-zinc-700', 'opacity-50')
    })

    it('should have feedback textarea', async () => {
      await navigateToReviewPlan()

      const textarea = screen.getByPlaceholderText(/Suggest changes/)
      expect(textarea).toBeInTheDocument()
    })

    it('should show Refine Plan button when feedback is provided', async () => {
      const user = await navigateToReviewPlan()

      const textarea = screen.getByPlaceholderText(/Suggest changes/)
      await user.type(textarea, 'Add more security tasks')

      expect(screen.getByRole('button', { name: /Refine Plan/i })).toBeInTheDocument()
    })

    it('should not show Refine Plan button when feedback is empty', async () => {
      await navigateToReviewPlan()

      expect(screen.queryByRole('button', { name: /Refine Plan/i })).not.toBeInTheDocument()
    })

    it('should call updatePlan API when Refine Plan is clicked', async () => {
      const user = await navigateToReviewPlan()
      mockElectronAPI.onboarding.updatePlan.mockResolvedValue(mockOnboardingPlan)

      const textarea = screen.getByPlaceholderText(/Suggest changes/)
      await user.type(textarea, 'Add more testing tasks')

      const refineButton = screen.getByRole('button', { name: /Refine Plan/i })
      await user.click(refineButton)

      await waitFor(() => {
        expect(mockElectronAPI.onboarding.updatePlan).toHaveBeenCalledWith(
          'plan-123',
          'Add more testing tasks',
          expect.arrayContaining(['Setup CI/CD Pipeline', 'Add E2E Tests', 'Security Audit']),
          expect.arrayContaining(['Configure GitHub Actions', 'Write unit tests', 'Security scan setup'])
        )
      })
    })

    it('should have Apply Plan button', async () => {
      await navigateToReviewPlan()

      expect(screen.getByRole('button', { name: /Apply Plan/i })).toBeInTheDocument()
    })

    it('should disable Apply Plan button when no items selected', async () => {
      const user = await navigateToReviewPlan()

      // Deselect all roadmap items
      const roadmapItems = screen.getAllByText(/Setup CI\/CD Pipeline|Add E2E Tests|Security Audit/)
      for (const item of roadmapItems) {
        const container = item.closest('.cursor-pointer')
        if (container) await user.click(container)
      }

      // Deselect all tasks
      const tasks = screen.getAllByText(/Configure GitHub Actions|Write unit tests|Security scan setup/)
      for (const task of tasks) {
        const container = task.closest('.cursor-pointer')
        if (container) await user.click(container)
      }

      await waitFor(() => {
        const applyButton = screen.getByRole('button', { name: /Apply Plan/i })
        expect(applyButton).toBeDisabled()
      })
    })
  })

  describe('Apply Plan and Complete Steps', () => {
    beforeEach(async () => {
      mockElectronAPI.onboarding.analyze.mockResolvedValue(mockProjectAnalysis)
      mockElectronAPI.onboarding.init.mockResolvedValue(mockOnboardingPlan)
      mockElectronAPI.onboarding.updatePlan.mockResolvedValue(mockOnboardingPlan)
      mockElectronAPI.onboarding.applyPlan.mockResolvedValue(mockApplyResult)
    })

    const navigateToReviewPlan = async () => {
      const user = userEvent.setup()
      render(<OnboardingWizard {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Analysis Complete')).toBeInTheDocument()
      })

      const generateButton = screen.getByRole('button', { name: /Generate Plan/i })
      await user.click(generateButton)

      await waitFor(() => {
        expect(screen.getByText('Review Your Plan')).toBeInTheDocument()
      })

      return user
    }

    it('should transition to applying step when Apply Plan is clicked', async () => {
      // Add a delay to the mock so the intermediate state can be rendered
      mockElectronAPI.onboarding.applyPlan.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockApplyResult), 100))
      )

      const user = await navigateToReviewPlan()

      const applyButton = screen.getByRole('button', { name: /Apply Plan/i })
      await user.click(applyButton)

      await waitFor(() => {
        expect(screen.getByText('Applying Plan')).toBeInTheDocument()
      })
      expect(screen.getByText('Creating roadmap items and tasks...')).toBeInTheDocument()
    })

    it('should call updatePlan and applyPlan APIs', async () => {
      const user = await navigateToReviewPlan()

      const applyButton = screen.getByRole('button', { name: /Apply Plan/i })
      await user.click(applyButton)

      await waitFor(() => {
        expect(mockElectronAPI.onboarding.updatePlan).toHaveBeenCalledWith(
          'plan-123',
          '',
          expect.any(Array),
          expect.any(Array)
        )
        expect(mockElectronAPI.onboarding.applyPlan).toHaveBeenCalledWith('plan-123')
      })
    })

    it('should transition to complete step after successful apply', async () => {
      const user = await navigateToReviewPlan()

      const applyButton = screen.getByRole('button', { name: /Apply Plan/i })
      await user.click(applyButton)

      await waitFor(() => {
        expect(screen.getByText('Setup Complete!')).toBeInTheDocument()
      })

      expect(screen.getByText('Your project is ready to go.')).toBeInTheDocument()
    })

    it('should display apply results', async () => {
      const user = await navigateToReviewPlan()

      const applyButton = screen.getByRole('button', { name: /Apply Plan/i })
      await user.click(applyButton)

      await waitFor(() => {
        expect(screen.getByText('Setup Complete!')).toBeInTheDocument()
      })

      expect(screen.getByText('roadmap items')).toBeInTheDocument()
      expect(screen.getByText('tasks queued')).toBeInTheDocument()
      const roadmapCount = screen.getAllByText('3')
      expect(roadmapCount.length).toBeGreaterThan(0)
    })

    it('should have Get Started button on complete step', async () => {
      const user = await navigateToReviewPlan()

      const applyButton = screen.getByRole('button', { name: /Apply Plan/i })
      await user.click(applyButton)

      await waitFor(() => {
        expect(screen.getByText('Setup Complete!')).toBeInTheDocument()
      })

      expect(screen.getByRole('button', { name: /Get Started/i })).toBeInTheDocument()
    })

    it('should call onComplete when Get Started is clicked', async () => {
      const user = await navigateToReviewPlan()

      const applyButton = screen.getByRole('button', { name: /Apply Plan/i })
      await user.click(applyButton)

      await waitFor(() => {
        expect(screen.getByText('Setup Complete!')).toBeInTheDocument()
      })

      const getStartedButton = screen.getByRole('button', { name: /Get Started/i })
      await user.click(getStartedButton)

      expect(mockOnComplete).toHaveBeenCalledTimes(1)
    })

    it('should handle apply plan error', async () => {
      mockElectronAPI.onboarding.applyPlan.mockRejectedValue(new Error('Apply failed'))
      const user = await navigateToReviewPlan()

      const applyButton = screen.getByRole('button', { name: /Apply Plan/i })
      await user.click(applyButton)

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument()
        expect(screen.getByText(/Failed to apply plan/)).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('should display error modal on analysis failure', async () => {
      mockElectronAPI.onboarding.analyze.mockRejectedValue(new Error('Network error'))

      render(<OnboardingWizard {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument()
        expect(screen.getByText(/Analysis failed: Network error/)).toBeInTheDocument()
      })
    })

    it('should have Close button in error modal', async () => {
      mockElectronAPI.onboarding.analyze.mockRejectedValue(new Error('Test error'))

      render(<OnboardingWizard {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument()
      })

      expect(screen.getByRole('button', { name: /Close/i })).toBeInTheDocument()
    })

    it('should have Retry button in error modal', async () => {
      mockElectronAPI.onboarding.analyze.mockRejectedValue(new Error('Test error'))

      render(<OnboardingWizard {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument()
      })

      expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument()
    })

    it('should call onCancel when Close button is clicked in error modal', async () => {
      const user = userEvent.setup()
      mockElectronAPI.onboarding.analyze.mockRejectedValue(new Error('Test error'))

      render(<OnboardingWizard {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument()
      })

      const closeButton = screen.getByRole('button', { name: /Close/i })
      await user.click(closeButton)

      expect(mockOnCancel).toHaveBeenCalledTimes(1)
    })

    it('should retry from last successful step on Retry button click', async () => {
      const user = userEvent.setup()
      mockElectronAPI.onboarding.analyze.mockResolvedValueOnce(mockProjectAnalysis)
      mockElectronAPI.onboarding.init.mockRejectedValueOnce(new Error('Init failed'))
      mockElectronAPI.onboarding.init.mockResolvedValueOnce(mockOnboardingPlan)

      render(<OnboardingWizard {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Analysis Complete')).toBeInTheDocument()
      })

      const generateButton = screen.getByRole('button', { name: /Generate Plan/i })
      await user.click(generateButton)

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument()
        expect(screen.getByText(/Plan generation failed/)).toBeInTheDocument()
      })

      const retryButton = screen.getByRole('button', { name: /Retry/i })
      await user.click(retryButton)

      await waitFor(() => {
        expect(screen.getByText('Analysis Complete')).toBeInTheDocument()
      })
    })
  })

  describe('Close Functionality', () => {
    beforeEach(async () => {
      mockElectronAPI.onboarding.analyze.mockResolvedValue(mockProjectAnalysis)
    })

    it('should have close button in header', async () => {
      render(<OnboardingWizard {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Analysis Complete')).toBeInTheDocument()
      })

      const closeButton = screen.getByRole('button', { name: '' })
      expect(closeButton).toBeInTheDocument()
    })

    it('should call onCancel when close button is clicked', async () => {
      const user = userEvent.setup()
      render(<OnboardingWizard {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Analysis Complete')).toBeInTheDocument()
      })

      // Find the X button in the header
      const closeButtons = screen.getAllByRole('button')
      const headerCloseButton = closeButtons.find(btn =>
        btn.querySelector('.lucide-x') !== null
      )

      if (headerCloseButton) {
        await user.click(headerCloseButton)
        expect(mockOnCancel).toHaveBeenCalledTimes(1)
      }
    })
  })

  describe('Progress Indicator', () => {
    beforeEach(async () => {
      mockElectronAPI.onboarding.analyze.mockResolvedValue(mockProjectAnalysis)
      mockElectronAPI.onboarding.init.mockResolvedValue(mockOnboardingPlan)
      mockElectronAPI.onboarding.updatePlan.mockResolvedValue(mockOnboardingPlan)
      mockElectronAPI.onboarding.applyPlan.mockResolvedValue(mockApplyResult)
    })

    it('should show active step in progress indicator', async () => {
      const { container } = render(<OnboardingWizard {...defaultProps} />)

      // Initially should be on analyzing step
      let progressDots = container.querySelectorAll('.w-2.h-2.rounded-full')
      let activeDot = Array.from(progressDots).find(dot =>
        dot.classList.contains('bg-violet-500')
      )
      expect(activeDot).toBeInTheDocument()

      // Move to review-analysis
      await waitFor(() => {
        expect(screen.getByText('Analysis Complete')).toBeInTheDocument()
      })

      progressDots = container.querySelectorAll('.w-2.h-2.rounded-full')
      activeDot = Array.from(progressDots).find(dot =>
        dot.classList.contains('bg-violet-500')
      )
      expect(activeDot).toBeInTheDocument()
    })

    it('should mark completed steps in progress indicator', async () => {
      const user = userEvent.setup()
      const { container } = render(<OnboardingWizard {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Analysis Complete')).toBeInTheDocument()
      })

      const generateButton = screen.getByRole('button', { name: /Generate Plan/i })
      await user.click(generateButton)

      await waitFor(() => {
        expect(screen.getByText('Review Your Plan')).toBeInTheDocument()
      })

      // Previous steps should be marked as complete (green)
      const progressDots = container.querySelectorAll('.w-2.h-2.rounded-full')
      const completedDots = Array.from(progressDots).filter(dot =>
        dot.classList.contains('bg-green-500')
      )
      expect(completedDots.length).toBeGreaterThan(0)
    })
  })

  describe('Feedback Workflow', () => {
    beforeEach(async () => {
      mockElectronAPI.onboarding.analyze.mockResolvedValue(mockProjectAnalysis)
      mockElectronAPI.onboarding.init.mockResolvedValue(mockOnboardingPlan)
    })

    it('should clear feedback after successful refinement', async () => {
      const user = userEvent.setup()
      mockElectronAPI.onboarding.updatePlan.mockResolvedValue(mockOnboardingPlan)

      render(<OnboardingWizard {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Analysis Complete')).toBeInTheDocument()
      })

      const generateButton = screen.getByRole('button', { name: /Generate Plan/i })
      await user.click(generateButton)

      await waitFor(() => {
        expect(screen.getByText('Review Your Plan')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText(/Suggest changes/)
      await user.type(textarea, 'Add more tasks')

      const refineButton = screen.getByRole('button', { name: /Refine Plan/i })
      await user.click(refineButton)

      // Wait for updatePlan to be called and the feedback to be cleared
      await waitFor(() => {
        expect(mockElectronAPI.onboarding.updatePlan).toHaveBeenCalled()
      })

      // Query the textarea again and check it's cleared
      await waitFor(() => {
        const updatedTextarea = screen.getByPlaceholderText(/Suggest changes/)
        expect(updatedTextarea).toHaveValue('')
      })
    })

    it('should handle feedback submission error', async () => {
      const user = userEvent.setup()
      mockElectronAPI.onboarding.updatePlan.mockRejectedValue(new Error('Update failed'))

      render(<OnboardingWizard {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Analysis Complete')).toBeInTheDocument()
      })

      const generateButton = screen.getByRole('button', { name: /Generate Plan/i })
      await user.click(generateButton)

      await waitFor(() => {
        expect(screen.getByText('Review Your Plan')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText(/Suggest changes/)
      await user.type(textarea, 'Add more tasks')

      const refineButton = screen.getByRole('button', { name: /Refine Plan/i })
      await user.click(refineButton)

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument()
        expect(screen.getByText(/Feedback update failed/)).toBeInTheDocument()
      })
    })
  })
})
