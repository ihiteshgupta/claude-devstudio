/**
 * Claude DevStudio
 * Copyright (c) 2024 Claude DevStudio Contributors
 * Licensed under MIT License - see LICENSE file
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock database service
const mockDb = vi.hoisted(() => ({
  prepare: vi.fn(() => ({
    all: vi.fn(() => []),
    get: vi.fn(),
    run: vi.fn(() => ({ changes: 1 }))
  }))
}))

const mockDatabaseService = vi.hoisted(() => ({
  getDb: vi.fn(() => mockDb)
}))

// Mock task queue service
const mockTaskQueueService = vi.hoisted(() => ({
  getTask: vi.fn(() => ({
    id: 'task-1',
    taskType: 'code-generation',
    retryCount: 0,
    maxRetries: 3,
    inputData: {}
  }))
}))

vi.mock('./database.service', () => ({
  databaseService: mockDatabaseService
}))

vi.mock('./task-queue.service', () => ({
  taskQueueService: mockTaskQueueService
}))

// Import after mocking
const { approvalResolverService } = await import('./approval-resolver.service')

describe('ApprovalResolverService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock to default task
    mockTaskQueueService.getTask.mockReturnValue({
      id: 'task-1',
      taskType: 'code-generation',
      retryCount: 0,
      maxRetries: 3,
      inputData: {}
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should be instantiated', () => {
      expect(approvalResolverService).toBeDefined()
    })

    it('should have required methods', () => {
      expect(typeof approvalResolverService.assessForAutoApproval).toBe('function')
      expect(typeof approvalResolverService.classifyError).toBe('function')
      expect(typeof approvalResolverService.enrichContextForRetry).toBe('function')
      expect(typeof approvalResolverService.recordError).toBe('function')
      expect(typeof approvalResolverService.getErrorStats).toBe('function')
    })

    it('should be an EventEmitter', () => {
      expect(typeof approvalResolverService.on).toBe('function')
      expect(typeof approvalResolverService.emit).toBe('function')
    })
  })

  describe('assessForAutoApproval', () => {
    it('should return low quality when task not found', async () => {
      mockTaskQueueService.getTask.mockReturnValueOnce(null)

      const assessment = await approvalResolverService.assessForAutoApproval('task-1', null)

      expect(assessment.qualityScore).toBe(0)
      expect(assessment.riskLevel).toBe('critical')
      expect(assessment.canAutoApprove).toBe(false)
      expect(assessment.reasons).toContain('Task not found')
    })

    it('should return low quality when no output', async () => {
      const assessment = await approvalResolverService.assessForAutoApproval('task-1', null)

      expect(assessment.qualityScore).toBeLessThan(100)
      expect(assessment.checks.some(c => c.name === 'Output Completeness' && !c.passed)).toBe(true)
    })

    it('should return low quality when output too short', async () => {
      const assessment = await approvalResolverService.assessForAutoApproval('task-1', {
        result: 'short'
      })

      expect(assessment.checks.some(c => c.name === 'Output Completeness' && !c.passed)).toBe(true)
    })

    it('should detect error indicators in output', async () => {
      const assessment = await approvalResolverService.assessForAutoApproval('task-1', {
        result: 'This task failed with an error in the execution'
      })

      expect(assessment.checks.some(c => c.name === 'Output Completeness' && !c.passed)).toBe(true)
    })

    it('should pass completeness for valid output', async () => {
      const assessment = await approvalResolverService.assessForAutoApproval('task-1', {
        result: 'This is a valid output that is long enough and contains no problems or issues that would indicate failure'
      })

      expect(assessment.checks.some(c => c.name === 'Output Completeness' && c.passed)).toBe(true)
    })

    it('should run code quality checks for code-generation tasks', async () => {
      mockTaskQueueService.getTask.mockReturnValueOnce({
        id: 'task-1',
        taskType: 'code-generation',
        retryCount: 0,
        maxRetries: 3
      })

      const assessment = await approvalResolverService.assessForAutoApproval('task-1', {
        result: '```typescript\nconst foo = "bar";\n```\n\nThis code is complete and ready.'
      })

      expect(assessment.checks.some(c => c.name === 'Contains Code')).toBe(true)
    })

    it('should detect TODOs in code output', async () => {
      mockTaskQueueService.getTask.mockReturnValueOnce({
        id: 'task-1',
        taskType: 'code-generation',
        retryCount: 0,
        maxRetries: 3
      })

      const assessment = await approvalResolverService.assessForAutoApproval('task-1', {
        result: '```typescript\n// TODO: implement this function\nconst foo = "bar";\n```'
      })

      expect(assessment.checks.some(c => c.name === 'No TODOs' && !c.passed)).toBe(true)
    })

    it('should detect hardcoded secrets', async () => {
      mockTaskQueueService.getTask.mockReturnValueOnce({
        id: 'task-1',
        taskType: 'code-generation',
        retryCount: 0,
        maxRetries: 3
      })

      const assessment = await approvalResolverService.assessForAutoApproval('task-1', {
        result: '```typescript\nconst password = "supersecret123";\n```'
      })

      expect(assessment.checks.some(c => c.name === 'No Hardcoded Secrets' && !c.passed)).toBe(true)
    })

    it('should run testing checks for testing tasks', async () => {
      mockTaskQueueService.getTask.mockReturnValueOnce({
        id: 'task-1',
        taskType: 'testing',
        retryCount: 0,
        maxRetries: 3
      })

      const assessment = await approvalResolverService.assessForAutoApproval('task-1', {
        result: 'describe("tests", () => { it("should work", () => { expect(true).toBe(true) }) })'
      })

      expect(assessment.checks.some(c => c.name === 'Test Structure')).toBe(true)
      expect(assessment.checks.some(c => c.name === 'Has Assertions')).toBe(true)
    })

    it('should run security checks for security-audit tasks', async () => {
      mockTaskQueueService.getTask.mockReturnValueOnce({
        id: 'task-1',
        taskType: 'security-audit',
        retryCount: 0,
        maxRetries: 3
      })

      const assessment = await approvalResolverService.assessForAutoApproval('task-1', {
        result: 'Found 2 vulnerabilities with CVE-2024-1234. Severity: high. Recommend updating dependencies.'
      })

      expect(assessment.checks.some(c => c.name === 'Security Analysis')).toBe(true)
      expect(assessment.checks.some(c => c.name === 'Has Recommendations')).toBe(true)
    })

    it('should run documentation checks for documentation tasks', async () => {
      mockTaskQueueService.getTask.mockReturnValueOnce({
        id: 'task-1',
        taskType: 'documentation',
        retryCount: 0,
        maxRetries: 3
      })

      const assessment = await approvalResolverService.assessForAutoApproval('task-1', {
        result: '# API Documentation\n\n## Usage\n\n```javascript\nconst example = require("example");\n```'
      })

      expect(assessment.checks.some(c => c.name === 'Document Structure')).toBe(true)
      expect(assessment.checks.some(c => c.name === 'Has Examples')).toBe(true)
    })

    it('should assess critical risk for dangerous operations', async () => {
      const assessment = await approvalResolverService.assessForAutoApproval('task-1', {
        result: 'Run: rm -rf / to clean up the system completely for deployment'
      })

      expect(assessment.riskLevel).toBe('critical')
      expect(assessment.canAutoApprove).toBe(false)
    })

    it('should assess high risk for deployment tasks', async () => {
      mockTaskQueueService.getTask.mockReturnValueOnce({
        id: 'task-1',
        taskType: 'deployment',
        retryCount: 0,
        maxRetries: 3
      })

      const assessment = await approvalResolverService.assessForAutoApproval('task-1', {
        result: 'Deployment completed successfully without any issues and all services are running'
      })

      expect(assessment.riskLevel).toBe('high')
    })

    it('should allow auto-approve for low risk high quality', async () => {
      mockTaskQueueService.getTask.mockReturnValueOnce({
        id: 'task-1',
        taskType: 'documentation',
        retryCount: 0,
        maxRetries: 3
      })

      const assessment = await approvalResolverService.assessForAutoApproval('task-1', {
        result: '# Documentation\n\n## Overview\n\nThis is a complete documentation with examples.\n\n```javascript\nconst example = "test";\n```'
      })

      // Low risk documentation with good quality should be auto-approvable
      expect(assessment.riskLevel).not.toBe('critical')
    })
  })

  describe('classifyError', () => {
    it('should classify timeout errors', () => {
      const task = { retryCount: 0, maxRetries: 3 } as any
      const analysis = approvalResolverService.classifyError('Request timed out', task)

      expect(analysis.errorType).toBe('transient')
      expect(analysis.isRetryable).toBe(true)
      expect(analysis.suggestedAction).toBe('retry')
    })

    it('should classify rate limit errors', () => {
      const task = { retryCount: 0, maxRetries: 3 } as any
      const analysis = approvalResolverService.classifyError('Error 429: Too many requests', task)

      expect(analysis.errorType).toBe('transient')
      expect(analysis.isRetryable).toBe(true)
    })

    it('should classify file not found errors', () => {
      const task = { retryCount: 0, maxRetries: 3 } as any
      const analysis = approvalResolverService.classifyError('ENOENT: no such file or directory', task)

      expect(analysis.errorType).toBe('fixable')
      expect(analysis.suggestedAction).toBe('retry-with-context')
      expect(analysis.contextEnrichment).toBeDefined()
    })

    it('should classify syntax errors', () => {
      const task = { retryCount: 0, maxRetries: 3 } as any
      const analysis = approvalResolverService.classifyError('SyntaxError: Unexpected token', task)

      expect(analysis.errorType).toBe('fixable')
      expect(analysis.suggestedAction).toBe('retry-with-context')
    })

    it('should classify type errors', () => {
      const task = { retryCount: 0, maxRetries: 3 } as any
      const analysis = approvalResolverService.classifyError('TypeError: undefined is not a function', task)

      expect(analysis.errorType).toBe('fixable')
    })

    it('should classify permission errors as structural', () => {
      const task = { retryCount: 0, maxRetries: 3 } as any
      const analysis = approvalResolverService.classifyError('EACCES: permission denied', task)

      expect(analysis.errorType).toBe('structural')
      expect(analysis.isRetryable).toBe(false)
      expect(analysis.suggestedAction).toBe('escalate')
    })

    it('should classify network errors', () => {
      const task = { retryCount: 0, maxRetries: 3 } as any
      const analysis = approvalResolverService.classifyError('ECONNREFUSED: connection refused', task)

      expect(analysis.errorType).toBe('transient')
      expect(analysis.isRetryable).toBe(true)
    })

    it('should classify memory errors as structural', () => {
      const task = { retryCount: 0, maxRetries: 3 } as any
      const analysis = approvalResolverService.classifyError('JavaScript heap out of memory', task)

      expect(analysis.errorType).toBe('structural')
      expect(analysis.isRetryable).toBe(false)
    })

    it('should classify missing dependency errors', () => {
      const task = { retryCount: 0, maxRetries: 3 } as any
      const analysis = approvalResolverService.classifyError('Cannot find module lodash', task)

      expect(analysis.errorType).toBe('fixable')
      expect(analysis.suggestedAction).toBe('retry-with-context')
    })

    it('should classify unknown errors', () => {
      const task = { retryCount: 0, maxRetries: 3 } as any
      const analysis = approvalResolverService.classifyError('Some unknown error occurred', task)

      expect(analysis.errorType).toBe('unknown')
      expect(analysis.isRetryable).toBe(true)
    })

    it('should detect transient keywords in unknown errors', () => {
      const task = { retryCount: 0, maxRetries: 3 } as any
      const analysis = approvalResolverService.classifyError('Temporary failure, please try again', task)

      expect(analysis.errorType).toBe('transient')
      expect(analysis.suggestedAction).toBe('retry')
    })

    it('should not be retryable when max retries exceeded', () => {
      const task = { retryCount: 5, maxRetries: 3 } as any
      const analysis = approvalResolverService.classifyError('Unknown error', task)

      expect(analysis.isRetryable).toBe(false)
    })
  })

  describe('enrichContextForRetry', () => {
    it('should add context enrichment', () => {
      const task = {
        inputData: { context: 'Original context' }
      } as any

      const errorAnalysis = {
        contextEnrichment: 'Additional context for retry',
        suggestedAction: 'retry-with-context' as const
      } as any

      const enriched = approvalResolverService.enrichContextForRetry(task, errorAnalysis)

      expect(enriched.context).toContain('Original context')
      expect(enriched.context).toContain('Additional context for retry')
    })

    it('should track previous errors', () => {
      const task = {
        inputData: { previousErrors: ['Error 1'] },
        errorMessage: 'Error 2'
      } as any

      const errorAnalysis = {} as any

      const enriched = approvalResolverService.enrichContextForRetry(task, errorAnalysis)

      expect(enriched.previousErrors).toContain('Error 1')
      expect(enriched.previousErrors).toContain('Error 2')
    })

    it('should add retry hint for retry-with-context', () => {
      const task = { inputData: {} } as any
      const errorAnalysis = {
        suggestedAction: 'retry-with-context' as const
      } as any

      const enriched = approvalResolverService.enrichContextForRetry(task, errorAnalysis)

      expect(enriched.retryHint).toBeDefined()
    })

    it('should handle empty input data', () => {
      const task = { inputData: undefined } as any
      const errorAnalysis = {
        contextEnrichment: 'Some context'
      } as any

      const enriched = approvalResolverService.enrichContextForRetry(task, errorAnalysis)

      expect(enriched.previousErrors).toBeDefined()
    })
  })

  describe('recordError', () => {
    it('should store error in database', () => {
      approvalResolverService.recordError('task-1', 'Some error', 'success')

      expect(mockDb.prepare).toHaveBeenCalled()
    })

    it('should record success resolution', () => {
      approvalResolverService.recordError('task-1', 'Timeout error', 'success')

      expect(mockDb.prepare).toHaveBeenCalled()
    })

    it('should record failure resolution', () => {
      approvalResolverService.recordError('task-1', 'Permission denied', 'failure')

      expect(mockDb.prepare).toHaveBeenCalled()
    })

    it('should truncate long error messages', () => {
      const longError = 'x'.repeat(2000)
      approvalResolverService.recordError('task-1', longError, 'failure')

      expect(mockDb.prepare).toHaveBeenCalled()
    })
  })

  describe('getErrorStats', () => {
    it('should return error pattern statistics', () => {
      const stats = approvalResolverService.getErrorStats()

      expect(Array.isArray(stats)).toBe(true)
      expect(stats.length).toBeGreaterThan(0)
    })

    it('should include pattern names', () => {
      const stats = approvalResolverService.getErrorStats()

      expect(stats.some(s => s.pattern === 'timeout')).toBe(true)
      expect(stats.some(s => s.pattern === 'rate-limit')).toBe(true)
      expect(stats.some(s => s.pattern === 'file-not-found')).toBe(true)
    })

    it('should include occurrence counts', () => {
      const stats = approvalResolverService.getErrorStats()

      stats.forEach(s => {
        expect(typeof s.occurrences).toBe('number')
      })
    })

    it('should include success rates', () => {
      const stats = approvalResolverService.getErrorStats()

      stats.forEach(s => {
        expect(typeof s.successRate).toBe('number')
        expect(s.successRate).toBeGreaterThanOrEqual(0)
        expect(s.successRate).toBeLessThanOrEqual(100)
      })
    })
  })
})
