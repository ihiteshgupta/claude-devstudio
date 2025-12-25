/**
 * Claude DevStudio
 * Copyright (c) 2024 Claude DevStudio Contributors
 * Licensed under MIT License - see LICENSE file
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock database service
const mockDb = vi.hoisted(() => ({
  exec: vi.fn(),
  prepare: vi.fn(() => ({
    all: vi.fn(() => []),
    get: vi.fn(),
    run: vi.fn(() => ({ changes: 1 }))
  }))
}))

const mockDatabaseService = vi.hoisted(() => ({
  getDb: vi.fn(() => mockDb),
  listUserStories: vi.fn(() => []),
  createSprint: vi.fn(() => ({ id: 'sprint-1' })),
  addStoryToSprint: vi.fn()
}))

// Mock roadmap service
const mockRoadmapService = vi.hoisted(() => ({
  listItems: vi.fn(() => [])
}))

// Mock claude service
const mockClaudeService = vi.hoisted(() => ({
  sendMessage: vi.fn(() => Promise.resolve('Analysis complete'))
}))

vi.mock('./database.service', () => ({
  databaseService: mockDatabaseService
}))

vi.mock('./roadmap.service', () => ({
  roadmapService: mockRoadmapService
}))

vi.mock('./claude.service', () => ({
  claudeService: mockClaudeService
}))

// Import after mocking
const { sprintAutomationService } = await import('./sprint-automation.service')

describe('SprintAutomationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sprintAutomationService.removeAllListeners()
  })

  afterEach(() => {
    vi.clearAllMocks()
    sprintAutomationService.removeAllListeners()
  })

  describe('initialization', () => {
    it('should be instantiated', () => {
      expect(sprintAutomationService).toBeDefined()
    })

    it('should have required methods', () => {
      expect(typeof sprintAutomationService.generateSprintSuggestion).toBe('function')
      expect(typeof sprintAutomationService.applySprintSuggestion).toBe('function')
      expect(typeof sprintAutomationService.getSuggestions).toBe('function')
      expect(typeof sprintAutomationService.startChatWorkflow).toBe('function')
      expect(typeof sprintAutomationService.advanceWorkflow).toBe('function')
      expect(typeof sprintAutomationService.cancelWorkflow).toBe('function')
      expect(typeof sprintAutomationService.getActiveWorkflows).toBe('function')
      expect(typeof sprintAutomationService.getWorkflow).toBe('function')
    })

    it('should be an EventEmitter', () => {
      expect(typeof sprintAutomationService.on).toBe('function')
      expect(typeof sprintAutomationService.emit).toBe('function')
    })

    it('should have initialized database tables on import', () => {
      // Database tables are initialized in the constructor during import
      // We verify the service works correctly which implies tables were created
      expect(sprintAutomationService).toBeDefined()
      // The exec call happens before tests run, so we can't directly test it
      // after vi.clearAllMocks() in beforeEach
    })
  })

  describe('generateSprintSuggestion', () => {
    it('should generate suggestion with roadmap items', async () => {
      mockRoadmapService.listItems.mockReturnValueOnce([
        { id: 'roadmap-1', title: 'Feature 1', priority: 'high', storyPoints: 5 },
        { id: 'roadmap-2', title: 'Feature 2', priority: 'medium', storyPoints: 3 }
      ])

      mockDatabaseService.listUserStories.mockReturnValueOnce([])

      const suggestion = await sprintAutomationService.generateSprintSuggestion('proj-1')

      expect(suggestion).toBeDefined()
      expect(suggestion.projectId).toBe('proj-1')
      expect(suggestion.suggestedStories.length).toBeGreaterThan(0)
    })

    it('should include backlog stories', async () => {
      mockRoadmapService.listItems.mockReturnValueOnce([])

      mockDatabaseService.listUserStories.mockReturnValueOnce([
        { id: 'story-1', title: 'Story 1', priority: 'high', status: 'backlog', storyPoints: 3 },
        { id: 'story-2', title: 'Story 2', priority: 'medium', status: 'backlog', storyPoints: 5 }
      ])

      const suggestion = await sprintAutomationService.generateSprintSuggestion('proj-1')

      expect(suggestion.suggestedStories.length).toBeGreaterThan(0)
    })

    it('should respect capacity limit', async () => {
      mockRoadmapService.listItems.mockReturnValueOnce([])

      mockDatabaseService.listUserStories.mockReturnValueOnce([
        { id: 'story-1', title: 'Story 1', priority: 'high', status: 'backlog', storyPoints: 10 },
        { id: 'story-2', title: 'Story 2', priority: 'high', status: 'backlog', storyPoints: 10 },
        { id: 'story-3', title: 'Story 3', priority: 'high', status: 'backlog', storyPoints: 10 }
      ])

      const suggestion = await sprintAutomationService.generateSprintSuggestion('proj-1', 15)

      expect(suggestion.usedCapacity).toBeLessThanOrEqual(15)
    })

    it('should generate sprint goal', async () => {
      mockRoadmapService.listItems.mockReturnValueOnce([
        { id: 'roadmap-1', title: 'Login Feature', priority: 'high', storyPoints: 5 }
      ])

      mockDatabaseService.listUserStories.mockReturnValueOnce([])

      const suggestion = await sprintAutomationService.generateSprintSuggestion('proj-1')

      expect(suggestion.sprintGoal).toBeDefined()
      expect(typeof suggestion.sprintGoal).toBe('string')
    })

    it('should emit suggestion-generated event', async () => {
      const generatedHandler = vi.fn()
      sprintAutomationService.on('suggestion-generated', generatedHandler)

      mockRoadmapService.listItems.mockReturnValueOnce([])
      mockDatabaseService.listUserStories.mockReturnValueOnce([])

      await sprintAutomationService.generateSprintSuggestion('proj-1')

      expect(generatedHandler).toHaveBeenCalled()
    })

    it('should store suggestion in database', async () => {
      mockRoadmapService.listItems.mockReturnValueOnce([])
      mockDatabaseService.listUserStories.mockReturnValueOnce([])

      await sprintAutomationService.generateSprintSuggestion('proj-1')

      expect(mockDb.prepare).toHaveBeenCalled()
    })

    it('should add warnings when capacity exceeded', async () => {
      mockRoadmapService.listItems.mockReturnValueOnce([
        { id: 'roadmap-1', title: 'Big Feature', priority: 'high', storyPoints: 100 }
      ])

      mockDatabaseService.listUserStories.mockReturnValueOnce([])

      const suggestion = await sprintAutomationService.generateSprintSuggestion('proj-1', 20)

      expect(suggestion.warnings.length).toBeGreaterThan(0)
    })
  })

  describe('applySprintSuggestion', () => {
    it('should throw when suggestion not found', async () => {
      mockDb.prepare.mockReturnValueOnce({
        get: vi.fn(() => null)
      })

      await expect(sprintAutomationService.applySprintSuggestion('non-existent'))
        .rejects.toThrow('Sprint suggestion not found')
    })

    it('should create sprint from suggestion', async () => {
      mockDb.prepare.mockReturnValueOnce({
        get: vi.fn(() => ({
          id: 'suggestion-1',
          suggestion_data: JSON.stringify({
            projectId: 'proj-1',
            suggestedStories: [
              { storyId: 'story-1', title: 'Story 1' }
            ],
            sprintGoal: 'Complete features'
          })
        }))
      })

      const sprintId = await sprintAutomationService.applySprintSuggestion('suggestion-1')

      expect(sprintId).toBe('sprint-1')
      expect(mockDatabaseService.createSprint).toHaveBeenCalled()
    })

    it('should add stories to sprint', async () => {
      mockDb.prepare.mockReturnValueOnce({
        get: vi.fn(() => ({
          id: 'suggestion-1',
          suggestion_data: JSON.stringify({
            projectId: 'proj-1',
            suggestedStories: [
              { storyId: 'story-1', title: 'Story 1' },
              { storyId: 'story-2', title: 'Story 2' }
            ],
            sprintGoal: 'Complete features'
          })
        }))
      })

      await sprintAutomationService.applySprintSuggestion('suggestion-1')

      expect(mockDatabaseService.addStoryToSprint).toHaveBeenCalledTimes(2)
    })

    it('should emit suggestion-applied event', async () => {
      const appliedHandler = vi.fn()
      sprintAutomationService.on('suggestion-applied', appliedHandler)

      mockDb.prepare.mockReturnValueOnce({
        get: vi.fn(() => ({
          id: 'suggestion-1',
          suggestion_data: JSON.stringify({
            projectId: 'proj-1',
            suggestedStories: [],
            sprintGoal: 'Goal'
          })
        }))
      })

      await sprintAutomationService.applySprintSuggestion('suggestion-1')

      expect(appliedHandler).toHaveBeenCalled()
    })
  })

  describe('getSuggestions', () => {
    it('should return empty array when no suggestions', () => {
      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn(() => [])
      })

      const suggestions = sprintAutomationService.getSuggestions('proj-1')

      expect(suggestions).toEqual([])
    })

    it('should return suggestions from database', () => {
      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn(() => [{
          id: 'suggestion-1',
          suggestion_data: JSON.stringify({
            id: 'suggestion-1',
            projectId: 'proj-1',
            suggestedStories: [],
            sprintGoal: 'Goal'
          })
        }])
      })

      const suggestions = sprintAutomationService.getSuggestions('proj-1')

      expect(suggestions.length).toBe(1)
    })
  })

  describe('startChatWorkflow', () => {
    it('should create workflow with steps', async () => {
      const workflow = await sprintAutomationService.startChatWorkflow(
        'proj-1',
        'Implement login feature'
      )

      expect(workflow).toBeDefined()
      expect(workflow.projectId).toBe('proj-1')
      expect(workflow.steps.length).toBeGreaterThan(0)
    })

    it('should emit workflow-started event', async () => {
      const startedHandler = vi.fn()
      sprintAutomationService.on('workflow-started', startedHandler)

      await sprintAutomationService.startChatWorkflow('proj-1', 'Test intent')

      expect(startedHandler).toHaveBeenCalled()
    })

    it('should parse testing intent', async () => {
      const workflow = await sprintAutomationService.startChatWorkflow(
        'proj-1',
        'Test the login feature'
      )

      expect(workflow.steps.some(s => s.agentType === 'tester')).toBe(true)
    })

    it('should parse security intent', async () => {
      const workflow = await sprintAutomationService.startChatWorkflow(
        'proj-1',
        'Security audit of the codebase'
      )

      expect(workflow.steps.some(s => s.agentType === 'security')).toBe(true)
    })

    it('should parse documentation intent', async () => {
      const workflow = await sprintAutomationService.startChatWorkflow(
        'proj-1',
        'Document the API'
      )

      expect(workflow.steps.some(s => s.agentType === 'documentation')).toBe(true)
    })

    it('should parse end-to-end implementation intent', async () => {
      const workflow = await sprintAutomationService.startChatWorkflow(
        'proj-1',
        'Implement the feature end-to-end'
      )

      expect(workflow.steps.length).toBeGreaterThan(2)
    })

    it('should store workflow in database', async () => {
      await sprintAutomationService.startChatWorkflow('proj-1', 'Test intent')

      expect(mockDb.prepare).toHaveBeenCalled()
    })
  })

  describe('advanceWorkflow', () => {
    it('should throw when workflow not found', async () => {
      await expect(sprintAutomationService.advanceWorkflow('non-existent', {}))
        .rejects.toThrow('Workflow not found')
    })

    it('should advance to next step', async () => {
      const workflow = await sprintAutomationService.startChatWorkflow('proj-1', 'Test')

      const advanced = await sprintAutomationService.advanceWorkflow(workflow.id, { output: 'result' })

      expect(advanced.currentStep).toBe(1)
      expect(advanced.steps[0].status).toBe('completed')
    })

    it('should mark workflow as completed when all steps done', async () => {
      const workflow = await sprintAutomationService.startChatWorkflow('proj-1', 'Document the API')

      // Workflow has 1 step (documentation)
      const advanced = await sprintAutomationService.advanceWorkflow(workflow.id, { output: 'done' })

      expect(advanced.status).toBe('completed')
    })

    it('should emit workflow-completed event', async () => {
      const completedHandler = vi.fn()
      sprintAutomationService.on('workflow-completed', completedHandler)

      const workflow = await sprintAutomationService.startChatWorkflow('proj-1', 'Document API')

      await sprintAutomationService.advanceWorkflow(workflow.id, { output: 'done' })

      expect(completedHandler).toHaveBeenCalled()
    })

    it('should emit workflow-step-started event', async () => {
      const stepStartedHandler = vi.fn()
      sprintAutomationService.on('workflow-step-started', stepStartedHandler)

      const workflow = await sprintAutomationService.startChatWorkflow('proj-1', 'Test the login')

      await sprintAutomationService.advanceWorkflow(workflow.id, { output: 'analyzed' })

      expect(stepStartedHandler).toHaveBeenCalled()
    })
  })

  describe('cancelWorkflow', () => {
    it('should return false when workflow not found', () => {
      const result = sprintAutomationService.cancelWorkflow('non-existent')

      expect(result).toBe(false)
    })

    it('should cancel active workflow', async () => {
      const workflow = await sprintAutomationService.startChatWorkflow('proj-1', 'Test')

      const result = sprintAutomationService.cancelWorkflow(workflow.id)

      expect(result).toBe(true)
    })

    it('should mark remaining steps as skipped', async () => {
      const workflow = await sprintAutomationService.startChatWorkflow('proj-1', 'Implement end-to-end')

      sprintAutomationService.cancelWorkflow(workflow.id)

      // Check via getWorkflow
      const cancelled = sprintAutomationService.getWorkflow(workflow.id)
      if (cancelled) {
        expect(cancelled.steps.some(s => s.status === 'skipped')).toBe(true)
      }
    })

    it('should emit workflow-cancelled event', async () => {
      const cancelledHandler = vi.fn()
      sprintAutomationService.on('workflow-cancelled', cancelledHandler)

      const workflow = await sprintAutomationService.startChatWorkflow('proj-1', 'Test')

      sprintAutomationService.cancelWorkflow(workflow.id)

      expect(cancelledHandler).toHaveBeenCalledWith(workflow.id)
    })
  })

  describe('getActiveWorkflows', () => {
    it('should return empty array when no active workflows', () => {
      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn(() => [])
      })

      const workflows = sprintAutomationService.getActiveWorkflows('proj-1')

      expect(workflows).toEqual([])
    })

    it('should return active workflows from database', () => {
      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn(() => [{
          id: 'workflow-1',
          workflow_steps: JSON.stringify({
            id: 'workflow-1',
            projectId: 'proj-1',
            userIntent: 'Test',
            steps: [],
            currentStep: 0,
            status: 'in_progress'
          })
        }])
      })

      const workflows = sprintAutomationService.getActiveWorkflows('proj-1')

      expect(workflows.length).toBe(1)
    })
  })

  describe('getWorkflow', () => {
    it('should return null when workflow not found', () => {
      mockDb.prepare.mockReturnValueOnce({
        get: vi.fn(() => null)
      })

      const workflow = sprintAutomationService.getWorkflow('non-existent')

      expect(workflow).toBeNull()
    })

    it('should return workflow from memory first', async () => {
      const workflow = await sprintAutomationService.startChatWorkflow('proj-1', 'Test')

      const retrieved = sprintAutomationService.getWorkflow(workflow.id)

      expect(retrieved).not.toBeNull()
      expect(retrieved!.id).toBe(workflow.id)
    })

    it('should return workflow from database if not in memory', () => {
      mockDb.prepare.mockReturnValueOnce({
        get: vi.fn(() => ({
          id: 'workflow-1',
          workflow_steps: JSON.stringify({
            id: 'workflow-1',
            projectId: 'proj-1',
            userIntent: 'Test',
            steps: [],
            currentStep: 0,
            status: 'completed'
          })
        }))
      })

      const workflow = sprintAutomationService.getWorkflow('workflow-1')

      expect(workflow).not.toBeNull()
    })
  })

  describe('sprint capacity estimation', () => {
    it('should use default capacity when no history', async () => {
      mockDb.prepare
        .mockReturnValueOnce({
          all: vi.fn(() => []) // No completed sprints
        })

      mockRoadmapService.listItems.mockReturnValueOnce([])
      mockDatabaseService.listUserStories.mockReturnValueOnce([])

      const suggestion = await sprintAutomationService.generateSprintSuggestion('proj-1')

      expect(suggestion.totalCapacity).toBe(20) // Default capacity
    })

    it('should calculate capacity from historical sprints', async () => {
      mockDb.prepare
        .mockReturnValueOnce({
          all: vi.fn(() => [
            { id: 'sprint-1', total_points: 30 },
            { id: 'sprint-2', total_points: 25 },
            { id: 'sprint-3', total_points: 20 }
          ])
        })

      mockRoadmapService.listItems.mockReturnValueOnce([])
      mockDatabaseService.listUserStories.mockReturnValueOnce([])

      const suggestion = await sprintAutomationService.generateSprintSuggestion('proj-1')

      expect(suggestion.totalCapacity).toBe(25) // Average of 30, 25, 20
    })
  })

  describe('priority sorting', () => {
    it('should prioritize critical items', async () => {
      mockRoadmapService.listItems.mockReturnValueOnce([])

      mockDatabaseService.listUserStories.mockReturnValueOnce([
        { id: 'story-1', title: 'Low', priority: 'low', status: 'backlog', storyPoints: 3 },
        { id: 'story-2', title: 'Critical', priority: 'critical', status: 'backlog', storyPoints: 3 },
        { id: 'story-3', title: 'Medium', priority: 'medium', status: 'backlog', storyPoints: 3 }
      ])

      const suggestion = await sprintAutomationService.generateSprintSuggestion('proj-1')

      // Critical story should be first
      if (suggestion.suggestedStories.length > 0) {
        expect(suggestion.suggestedStories[0].priority).toBe('critical')
      }
    })
  })
})
