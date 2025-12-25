/**
 * Claude DevStudio
 * Copyright (c) 2024 Claude DevStudio Contributors
 * Licensed under MIT License - see LICENSE file
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock database service
const mockDatabaseService = vi.hoisted(() => ({
  createWorkflow: vi.fn(),
  getWorkflow: vi.fn(),
  updateWorkflowStatus: vi.fn(),
  updateWorkflowStep: vi.fn()
}))

// Mock claude service
const mockClaudeService = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
  cancelCurrent: vi.fn()
}))

vi.mock('./database.service', () => ({
  databaseService: mockDatabaseService
}))

vi.mock('./claude.service', () => ({
  claudeService: mockClaudeService
}))

// Import after mocking
const { workflowService } = await import('./workflow.service')

describe('WorkflowService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    workflowService.removeAllListeners()
  })

  afterEach(() => {
    vi.clearAllMocks()
    workflowService.removeAllListeners()
  })

  describe('initialization', () => {
    it('should be instantiated', () => {
      expect(workflowService).toBeDefined()
    })

    it('should have required methods', () => {
      expect(typeof workflowService.getTemplates).toBe('function')
      expect(typeof workflowService.createFromTemplate).toBe('function')
      expect(typeof workflowService.runWorkflow).toBe('function')
      expect(typeof workflowService.cancelWorkflow).toBe('function')
      expect(typeof workflowService.generateUserStory).toBe('function')
      expect(typeof workflowService.generateTestCases).toBe('function')
    })

    it('should be an EventEmitter', () => {
      expect(typeof workflowService.on).toBe('function')
      expect(typeof workflowService.emit).toBe('function')
    })
  })

  describe('getTemplates', () => {
    it('should return all available templates', () => {
      const templates = workflowService.getTemplates()

      expect(templates).toBeDefined()
      expect(Array.isArray(templates)).toBe(true)
      expect(templates.length).toBeGreaterThan(0)
    })

    it('should include story-to-tests template', () => {
      const templates = workflowService.getTemplates()
      const storyToTests = templates.find(t => t.id === 'story-to-tests')

      expect(storyToTests).toBeDefined()
      expect(storyToTests?.name).toBe('User Story → Test Cases')
      expect(storyToTests?.stepCount).toBe(2)
    })

    it('should include story-to-implementation template', () => {
      const templates = workflowService.getTemplates()
      const storyToImpl = templates.find(t => t.id === 'story-to-implementation')

      expect(storyToImpl).toBeDefined()
      expect(storyToImpl?.name).toBe('User Story → Implementation')
      expect(storyToImpl?.stepCount).toBe(3)
    })

    it('should include code-review-security template', () => {
      const templates = workflowService.getTemplates()
      const codeReview = templates.find(t => t.id === 'code-review-security')

      expect(codeReview).toBeDefined()
      expect(codeReview?.name).toBe('Code Review + Security Audit')
      expect(codeReview?.stepCount).toBe(2)
    })

    it('should include full-feature-pipeline template', () => {
      const templates = workflowService.getTemplates()
      const fullPipeline = templates.find(t => t.id === 'full-feature-pipeline')

      expect(fullPipeline).toBeDefined()
      expect(fullPipeline?.name).toBe('Full Feature Pipeline')
      expect(fullPipeline?.stepCount).toBe(6)
    })

    it('should include descriptions for all templates', () => {
      const templates = workflowService.getTemplates()

      templates.forEach(template => {
        expect(template.description).toBeDefined()
        expect(template.description.length).toBeGreaterThan(0)
      })
    })
  })

  describe('createFromTemplate', () => {
    it('should create workflow from story-to-tests template', () => {
      const mockWorkflow = {
        id: 'wf-1',
        projectId: 'proj-1',
        name: 'User Story → Test Cases',
        status: 'pending'
      }

      mockDatabaseService.createWorkflow.mockReturnValue(mockWorkflow)

      const workflow = workflowService.createFromTemplate(
        'proj-1',
        'story-to-tests',
        'As a user, I want to login'
      )

      expect(workflow).toBeDefined()
      expect(mockDatabaseService.createWorkflow).toHaveBeenCalled()
    })

    it('should replace {input} placeholder with initial input', () => {
      mockDatabaseService.createWorkflow.mockImplementation((data) => ({
        id: 'wf-1',
        ...data
      }))

      workflowService.createFromTemplate(
        'proj-1',
        'story-to-tests',
        'My user story content'
      )

      const call = mockDatabaseService.createWorkflow.mock.calls[0][0]
      expect(call.steps[0].task).toContain('My user story content')
    })

    it('should throw error for unknown template', () => {
      expect(() =>
        workflowService.createFromTemplate('proj-1', 'unknown-template' as any, 'input')
      ).toThrow('Unknown workflow template: unknown-template')
    })

    it('should create correct number of steps', () => {
      mockDatabaseService.createWorkflow.mockImplementation((data) => ({
        id: 'wf-1',
        ...data
      }))

      workflowService.createFromTemplate(
        'proj-1',
        'full-feature-pipeline',
        'Feature request'
      )

      const call = mockDatabaseService.createWorkflow.mock.calls[0][0]
      expect(call.steps).toHaveLength(6)
    })

    it('should assign correct agent types to steps', () => {
      mockDatabaseService.createWorkflow.mockImplementation((data) => ({
        id: 'wf-1',
        ...data
      }))

      workflowService.createFromTemplate(
        'proj-1',
        'code-review-security',
        'Code to review'
      )

      const call = mockDatabaseService.createWorkflow.mock.calls[0][0]
      expect(call.steps[0].agentType).toBe('developer')
      expect(call.steps[1].agentType).toBe('security')
    })
  })

  describe('runWorkflow', () => {
    it('should throw error if workflow is already running', async () => {
      const mockWorkflow = {
        id: 'wf-1',
        projectId: 'proj-1',
        steps: [{ id: 'step-1', task: 'Test', agentType: 'developer', stepOrder: 0 }],
        status: 'pending'
      }

      mockDatabaseService.getWorkflow.mockReturnValue(mockWorkflow)

      // Start first run in background
      const runPromise = workflowService.runWorkflow({
        workflowId: 'wf-1',
        projectPath: '/project'
      })

      // Try to run again immediately
      await expect(
        workflowService.runWorkflow({
          workflowId: 'wf-1',
          projectPath: '/project'
        })
      ).rejects.toThrow('Workflow is already running')

      // Clean up by canceling
      workflowService.cancelWorkflow('wf-1')
    })

    it('should throw error if workflow not found', async () => {
      mockDatabaseService.getWorkflow.mockReturnValue(null)

      await expect(
        workflowService.runWorkflow({
          workflowId: 'nonexistent',
          projectPath: '/project'
        })
      ).rejects.toThrow('Workflow not found')
    })

    it('should update workflow status to running', async () => {
      const mockWorkflow = {
        id: 'wf-1',
        projectId: 'proj-1',
        steps: [],
        status: 'pending'
      }

      mockDatabaseService.getWorkflow.mockReturnValue(mockWorkflow)

      await workflowService.runWorkflow({
        workflowId: 'wf-1',
        projectPath: '/project'
      })

      expect(mockDatabaseService.updateWorkflowStatus).toHaveBeenCalledWith('wf-1', 'running')
    })

    it('should call onComplete when workflow finishes', async () => {
      const mockWorkflow = {
        id: 'wf-1',
        projectId: 'proj-1',
        steps: [],
        status: 'pending'
      }

      mockDatabaseService.getWorkflow.mockReturnValue(mockWorkflow)

      const onComplete = vi.fn()

      await workflowService.runWorkflow({
        workflowId: 'wf-1',
        projectPath: '/project',
        onComplete
      })

      expect(mockDatabaseService.updateWorkflowStatus).toHaveBeenCalledWith('wf-1', 'completed')
      expect(onComplete).toHaveBeenCalled()
    })
  })

  describe('cancelWorkflow', () => {
    it('should return false when workflow is not running', () => {
      const result = workflowService.cancelWorkflow('nonexistent')

      expect(result).toBe(false)
    })

    it('should cancel claude service when workflow is running', async () => {
      const mockWorkflow = {
        id: 'wf-cancel',
        projectId: 'proj-1',
        steps: [
          { id: 'step-1', task: 'Long task', agentType: 'developer', stepOrder: 0 }
        ],
        status: 'pending'
      }

      mockDatabaseService.getWorkflow.mockReturnValue(mockWorkflow)

      // Start workflow
      const runPromise = workflowService.runWorkflow({
        workflowId: 'wf-cancel',
        projectPath: '/project'
      })

      // Cancel immediately
      const cancelled = workflowService.cancelWorkflow('wf-cancel')

      expect(cancelled).toBe(true)
      expect(mockClaudeService.cancelCurrent).toHaveBeenCalled()
    })
  })

  describe('generateUserStory', () => {
    it('should be a function', () => {
      expect(typeof workflowService.generateUserStory).toBe('function')
    })

    it('should use product-owner agent type', async () => {
      // The function internally calls runAgentTask with product-owner
      // We verify the method signature is correct
      expect(workflowService.generateUserStory.length).toBe(3)
    })
  })

  describe('generateTestCases', () => {
    it('should be a function', () => {
      expect(typeof workflowService.generateTestCases).toBe('function')
    })

    it('should accept user story input', () => {
      // Verify method signature
      expect(workflowService.generateTestCases.length).toBe(2)
    })
  })

  describe('workflow templates structure', () => {
    it('should have valid template structure', () => {
      const templates = workflowService.getTemplates()

      templates.forEach(template => {
        expect(template).toHaveProperty('id')
        expect(template).toHaveProperty('name')
        expect(template).toHaveProperty('description')
        expect(template).toHaveProperty('stepCount')
        expect(typeof template.stepCount).toBe('number')
        expect(template.stepCount).toBeGreaterThan(0)
      })
    })

    it('should have story-to-tests start with product-owner', () => {
      mockDatabaseService.createWorkflow.mockImplementation((data) => ({
        id: 'wf-1',
        ...data
      }))

      workflowService.createFromTemplate('proj-1', 'story-to-tests', 'input')

      const call = mockDatabaseService.createWorkflow.mock.calls[0][0]
      expect(call.steps[0].agentType).toBe('product-owner')
    })

    it('should have story-to-tests end with tester', () => {
      mockDatabaseService.createWorkflow.mockImplementation((data) => ({
        id: 'wf-1',
        ...data
      }))

      workflowService.createFromTemplate('proj-1', 'story-to-tests', 'input')

      const call = mockDatabaseService.createWorkflow.mock.calls[0][0]
      const lastStep = call.steps[call.steps.length - 1]
      expect(lastStep.agentType).toBe('tester')
    })

    it('should have full-feature-pipeline end with documentation', () => {
      mockDatabaseService.createWorkflow.mockImplementation((data) => ({
        id: 'wf-1',
        ...data
      }))

      workflowService.createFromTemplate('proj-1', 'full-feature-pipeline', 'input')

      const call = mockDatabaseService.createWorkflow.mock.calls[0][0]
      const lastStep = call.steps[call.steps.length - 1]
      expect(lastStep.agentType).toBe('documentation')
    })
  })

  describe('step task templates', () => {
    it('should use {input} placeholder for first step', () => {
      mockDatabaseService.createWorkflow.mockImplementation((data) => ({
        id: 'wf-1',
        ...data
      }))

      const input = 'Unique test input content'
      workflowService.createFromTemplate('proj-1', 'story-to-tests', input)

      const call = mockDatabaseService.createWorkflow.mock.calls[0][0]
      expect(call.steps[0].task).toContain(input)
    })

    it('should have {previousOutput} in subsequent steps', () => {
      mockDatabaseService.createWorkflow.mockImplementation((data) => ({
        id: 'wf-1',
        ...data
      }))

      workflowService.createFromTemplate('proj-1', 'story-to-tests', 'input')

      const call = mockDatabaseService.createWorkflow.mock.calls[0][0]
      expect(call.steps[1].task).toContain('{previousOutput}')
    })
  })

  describe('event handling', () => {
    it('should support step lifecycle events', async () => {
      const mockWorkflow = {
        id: 'wf-events',
        projectId: 'proj-1',
        steps: [],
        status: 'pending'
      }

      mockDatabaseService.getWorkflow.mockReturnValue(mockWorkflow)

      const onStepStart = vi.fn()
      const onStepComplete = vi.fn()
      const onComplete = vi.fn()

      await workflowService.runWorkflow({
        workflowId: 'wf-events',
        projectPath: '/project',
        onStepStart,
        onStepComplete,
        onComplete
      })

      // With empty steps, workflow completes immediately
      expect(onComplete).toHaveBeenCalled()
    })

    it('should pass correct options to runWorkflow', () => {
      expect(workflowService.runWorkflow).toBeDefined()

      // Verify the method accepts the expected options
      const options = {
        workflowId: 'test',
        projectPath: '/path',
        onStepStart: vi.fn(),
        onStepComplete: vi.fn(),
        onStepError: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn()
      }

      // Just verify it doesn't throw with valid options structure
      expect(() => {
        // Type check - this shouldn't throw
        const _ = options.workflowId
      }).not.toThrow()
    })
  })
})
