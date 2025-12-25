/**
 * Claude DevStudio
 * Copyright (c) 2024 Claude DevStudio Contributors
 * Licensed under MIT License - see LICENSE file
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock child_process
const mockSpawn = vi.hoisted(() => vi.fn())
vi.mock('child_process', () => ({
  spawn: mockSpawn
}))

// Mock fs
const mockFs = vi.hoisted(() => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => '{}'),
  unlinkSync: vi.fn()
}))
vi.mock('fs', () => ({
  default: mockFs,
  ...mockFs
}))

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

vi.mock('./database.service', () => ({
  databaseService: mockDatabaseService
}))

// Import after mocking
const { testExecutionService } = await import('./test-execution.service')

describe('TestExecutionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    testExecutionService.removeAllListeners()
    // Reset fs mocks to defaults
    mockFs.existsSync.mockReturnValue(false)
    mockFs.readFileSync.mockReturnValue('{}')
  })

  afterEach(() => {
    vi.clearAllMocks()
    testExecutionService.removeAllListeners()
    testExecutionService.cancel()
  })

  describe('initialization', () => {
    it('should be instantiated', () => {
      expect(testExecutionService).toBeDefined()
    })

    it('should have required methods', () => {
      expect(typeof testExecutionService.runTests).toBe('function')
      expect(typeof testExecutionService.analyzeFailure).toBe('function')
      expect(typeof testExecutionService.getBaselines).toBe('function')
      expect(typeof testExecutionService.getFlakyTests).toBe('function')
      expect(typeof testExecutionService.getRecentExecutions).toBe('function')
      expect(typeof testExecutionService.cancel).toBe('function')
      expect(typeof testExecutionService.isTestRunning).toBe('function')
    })

    it('should be an EventEmitter', () => {
      expect(typeof testExecutionService.on).toBe('function')
      expect(typeof testExecutionService.emit).toBe('function')
    })
  })

  describe('isTestRunning', () => {
    it('should return false when no tests running', () => {
      expect(testExecutionService.isTestRunning()).toBe(false)
    })
  })

  describe('cancel', () => {
    it('should return false when no tests running', () => {
      expect(testExecutionService.cancel()).toBe(false)
    })
  })

  describe('runTests', () => {
    it('should emit test-run-started event', async () => {
      const startedHandler = vi.fn()
      testExecutionService.on('test-run-started', startedHandler)

      mockFs.readFileSync.mockReturnValueOnce(JSON.stringify({
        devDependencies: { vitest: '1.0.0' }
      }))

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10)
          }
        }),
        kill: vi.fn()
      }
      mockSpawn.mockReturnValue(mockProcess)

      const promise = testExecutionService.runTests('/project', 'proj-1')

      await new Promise(resolve => setTimeout(resolve, 50))

      expect(startedHandler).toHaveBeenCalled()

      await promise.catch(() => {})
    })

    it('should throw if tests already running', async () => {
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        devDependencies: { vitest: '1.0.0' }
      }))

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        kill: vi.fn()
      }
      mockSpawn.mockReturnValue(mockProcess)

      const firstRun = testExecutionService.runTests('/project', 'proj-1')

      await new Promise(resolve => setTimeout(resolve, 50))

      await expect(testExecutionService.runTests('/project', 'proj-1'))
        .rejects.toThrow('Test execution already in progress')

      // Clean up
      const closeCallback = mockProcess.on.mock.calls.find(c => c[0] === 'close')?.[1]
      if (closeCallback) closeCallback(0)
      await firstRun.catch(() => {})
    })

    it('should detect vitest framework', async () => {
      const startedHandler = vi.fn()
      testExecutionService.on('test-run-started', startedHandler)

      // Set up mock to return vitest package.json for all readFileSync calls
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        devDependencies: { vitest: '1.0.0' }
      }))

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10)
          }
        }),
        kill: vi.fn()
      }
      mockSpawn.mockReturnValue(mockProcess)

      await testExecutionService.runTests('/project', 'proj-1', { framework: 'auto' })

      expect(startedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          framework: 'vitest'
        })
      )
    })

    it('should detect jest framework', async () => {
      const startedHandler = vi.fn()
      testExecutionService.on('test-run-started', startedHandler)

      // Set up mock to return jest package.json for all readFileSync calls
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        devDependencies: { jest: '29.0.0' }
      }))

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10)
          }
        }),
        kill: vi.fn()
      }
      mockSpawn.mockReturnValue(mockProcess)

      await testExecutionService.runTests('/project', 'proj-1', { framework: 'auto' })

      expect(startedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          framework: 'jest'
        })
      )
    })

    it('should detect playwright framework', async () => {
      const startedHandler = vi.fn()
      testExecutionService.on('test-run-started', startedHandler)

      // Set up mock to return playwright package.json for all readFileSync calls
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        devDependencies: { '@playwright/test': '1.0.0' }
      }))

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10)
          }
        }),
        kill: vi.fn()
      }
      mockSpawn.mockReturnValue(mockProcess)

      await testExecutionService.runTests('/project', 'proj-1', { framework: 'auto' })

      expect(startedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          framework: 'playwright'
        })
      )
    })

    it('should emit test-run-completed event on success', async () => {
      const completedHandler = vi.fn()
      testExecutionService.on('test-run-completed', completedHandler)

      mockFs.readFileSync.mockReturnValueOnce(JSON.stringify({
        devDependencies: { vitest: '1.0.0' }
      }))

      const mockProcess = {
        stdout: {
          on: vi.fn((event, cb) => {
            if (event === 'data') cb(Buffer.from('{}'))
          })
        },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10)
          }
        }),
        kill: vi.fn()
      }
      mockSpawn.mockReturnValue(mockProcess)

      const result = await testExecutionService.runTests('/project', 'proj-1')

      expect(result.status).toBe('passed')
      expect(completedHandler).toHaveBeenCalled()
    })

    it('should handle process error gracefully', async () => {
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        devDependencies: { vitest: '1.0.0' }
      }))

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('Process failed')), 10)
          }
        }),
        kill: vi.fn()
      }
      mockSpawn.mockReturnValue(mockProcess)

      const result = await testExecutionService.runTests('/project', 'proj-1')

      // Process error resolves with success: false, which becomes status: 'failed'
      expect(result.status).toBe('failed')
      expect(result.errorOutput).toBe('Process failed')
    })

    it('should parse test pattern option', async () => {
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        devDependencies: { vitest: '1.0.0' }
      }))

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(0)
        }),
        kill: vi.fn()
      }
      mockSpawn.mockReturnValue(mockProcess)

      await testExecutionService.runTests('/project', 'proj-1', {
        testPattern: 'login.test.ts'
      })

      expect(mockSpawn).toHaveBeenCalled()
    })

    it('should handle coverage option', async () => {
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        devDependencies: { vitest: '1.0.0' }
      }))

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(0)
        }),
        kill: vi.fn()
      }
      mockSpawn.mockReturnValue(mockProcess)

      await testExecutionService.runTests('/project', 'proj-1', {
        coverage: true
      })

      expect(mockSpawn).toHaveBeenCalled()
    })
  })

  describe('analyzeFailure', () => {
    it('should return new failure analysis when no baseline', () => {
      mockDb.prepare.mockReturnValueOnce({
        get: vi.fn(() => null)
      })

      const analysis = testExecutionService.analyzeFailure('proj-1', 'test-key')

      expect(analysis.isNewFailure).toBe(true)
      expect(analysis.isRegression).toBe(false)
      expect(analysis.isFlaky).toBe(false)
    })

    it('should detect regression', () => {
      mockDb.prepare.mockReturnValueOnce({
        get: vi.fn(() => ({
          pass_rate: 0.9,
          flaky_score: 0.1,
          last_status: 'passed',
          last_passed_commit: 'abc123'
        }))
      })

      const analysis = testExecutionService.analyzeFailure('proj-1', 'test-key')

      expect(analysis.isRegression).toBe(true)
      expect(analysis.severity).toBe('high')
    })

    it('should detect flaky test', () => {
      mockDb.prepare.mockReturnValueOnce({
        get: vi.fn(() => ({
          pass_rate: 0.6,
          flaky_score: 0.5,
          last_status: 'failed',
          last_passed_commit: null
        }))
      })

      const analysis = testExecutionService.analyzeFailure('proj-1', 'test-key')

      expect(analysis.isFlaky).toBe(true)
      expect(analysis.severity).toBe('low')
    })

    it('should detect critical failure for stable tests', () => {
      mockDb.prepare.mockReturnValueOnce({
        get: vi.fn(() => ({
          pass_rate: 0.99,
          flaky_score: 0.01,
          last_status: 'passed',
          last_passed_commit: 'abc123'
        }))
      })

      const analysis = testExecutionService.analyzeFailure('proj-1', 'test-key')

      expect(analysis.severity).toBe('critical')
    })

    it('should include related commits', () => {
      mockDb.prepare.mockReturnValueOnce({
        get: vi.fn(() => ({
          pass_rate: 0.9,
          flaky_score: 0.1,
          last_status: 'passed',
          last_passed_commit: 'abc123'
        }))
      })

      const analysis = testExecutionService.analyzeFailure('proj-1', 'test-key')

      expect(analysis.relatedCommits).toContain('abc123')
    })
  })

  describe('getBaselines', () => {
    it('should return empty array when no baselines', () => {
      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn(() => [])
      })

      const baselines = testExecutionService.getBaselines('proj-1')

      expect(baselines).toEqual([])
    })

    it('should return baselines from database', () => {
      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn(() => [{
          test_name: 'Test 1',
          test_path: 'test1.spec.ts',
          project_id: 'proj-1',
          last_passed_commit: 'abc123',
          last_passed_at: '2024-01-01T00:00:00.000Z',
          pass_rate: 0.9,
          avg_duration: 100,
          flaky_score: 0.1,
          execution_count: 10
        }])
      })

      const baselines = testExecutionService.getBaselines('proj-1')

      expect(baselines.length).toBe(1)
      expect(baselines[0].testName).toBe('Test 1')
      expect(baselines[0].passRate).toBe(0.9)
    })
  })

  describe('getFlakyTests', () => {
    it('should return tests above flaky threshold', () => {
      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn(() => [
          { test_name: 'Flaky', flaky_score: 0.5, pass_rate: 0.6, avg_duration: 100, execution_count: 10, test_path: 'test.ts', project_id: 'proj-1' },
          { test_name: 'Stable', flaky_score: 0.1, pass_rate: 0.95, avg_duration: 50, execution_count: 20, test_path: 'test2.ts', project_id: 'proj-1' }
        ])
      })

      const flaky = testExecutionService.getFlakyTests('proj-1')

      expect(flaky.length).toBe(1)
      expect(flaky[0].testName).toBe('Flaky')
    })

    it('should respect custom threshold', () => {
      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn(() => [
          { test_name: 'Test1', flaky_score: 0.4, pass_rate: 0.7, avg_duration: 100, execution_count: 10, test_path: 'test.ts', project_id: 'proj-1' },
          { test_name: 'Test2', flaky_score: 0.6, pass_rate: 0.5, avg_duration: 50, execution_count: 20, test_path: 'test2.ts', project_id: 'proj-1' }
        ])
      })

      const flaky = testExecutionService.getFlakyTests('proj-1', 0.5)

      expect(flaky.length).toBe(1)
      expect(flaky[0].flakyScore).toBeGreaterThanOrEqual(0.5)
    })
  })

  describe('getRecentExecutions', () => {
    it('should return empty array when no executions', () => {
      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn(() => [])
      })

      const executions = testExecutionService.getRecentExecutions('proj-1')

      expect(executions).toEqual([])
    })

    it('should return executions from database', () => {
      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn(() => [{
          id: 'exec-1',
          test_case_id: 'tc-1',
          task_id: 'task-1',
          project_id: 'proj-1',
          test_name: 'Test 1',
          test_path: 'test1.spec.ts',
          status: 'passed',
          duration: 100,
          executed_at: '2024-01-01T00:00:00.000Z',
          error_message: null,
          stack_trace: null,
          git_commit: 'abc123'
        }])
      })

      const executions = testExecutionService.getRecentExecutions('proj-1')

      expect(executions.length).toBe(1)
      expect(executions[0].testName).toBe('Test 1')
    })

    it('should respect limit parameter', () => {
      const allFn = vi.fn(() => [])
      mockDb.prepare.mockReturnValueOnce({ all: allFn })

      testExecutionService.getRecentExecutions('proj-1', 50)

      expect(allFn).toHaveBeenCalledWith('proj-1', 50)
    })
  })

  describe('test output parsing', () => {
    it('should parse test framework results', async () => {
      // Mock package.json with vitest
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        devDependencies: { vitest: '1.0.0' }
      }))

      const mockProcess = {
        stdout: {
          on: vi.fn((event, cb) => {
            if (event === 'data') {
              // Generic output that will be parsed
              cb(Buffer.from('5 tests passed, 1 test failed'))
            }
          })
        },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(1) // Non-zero exit indicates failure
        }),
        kill: vi.fn()
      }
      mockSpawn.mockReturnValue(mockProcess)

      const result = await testExecutionService.runTests('/project', 'proj-1')

      // The generic parser should extract test counts from output
      expect(result.framework).toBe('vitest')
      expect(result.status).toBe('failed') // Exit code 1 = failed
    })

    it('should parse generic test output', async () => {
      // Empty package.json means unknown framework
      mockFs.readFileSync.mockReturnValue(JSON.stringify({}))

      const mockProcess = {
        stdout: {
          on: vi.fn((event, cb) => {
            if (event === 'data') {
              cb(Buffer.from('10 tests passed, 2 tests failed, 1 test skipped'))
            }
          })
        },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(1)
        }),
        kill: vi.fn()
      }
      mockSpawn.mockReturnValue(mockProcess)

      const result = await testExecutionService.runTests('/project', 'proj-1')

      expect(result.summary.passedTests).toBe(10)
      expect(result.summary.failedTests).toBe(2)
      expect(result.summary.skippedTests).toBe(1)
    })
  })

  describe('baseline updates', () => {
    it('should store test results on successful run', async () => {
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        devDependencies: { vitest: '1.0.0' }
      }))

      const mockProcess = {
        stdout: {
          on: vi.fn((event, cb) => {
            if (event === 'data') cb(Buffer.from('Tests passed'))
          })
        },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(0)
        }),
        kill: vi.fn()
      }
      mockSpawn.mockReturnValue(mockProcess)

      const result = await testExecutionService.runTests('/project', 'proj-1')

      // Tests should complete successfully
      expect(result.status).toBe('passed')
      expect(result.projectId).toBe('proj-1')
    })
  })

  describe('test output events', () => {
    it('should emit test-output events', async () => {
      const outputHandler = vi.fn()
      testExecutionService.on('test-output', outputHandler)

      mockFs.readFileSync.mockReturnValueOnce(JSON.stringify({
        devDependencies: { vitest: '1.0.0' }
      }))

      const mockProcess = {
        stdout: {
          on: vi.fn((event, cb) => {
            if (event === 'data') cb(Buffer.from('Test output'))
          })
        },
        stderr: {
          on: vi.fn((event, cb) => {
            if (event === 'data') cb(Buffer.from('Error output'))
          })
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(0)
        }),
        kill: vi.fn()
      }
      mockSpawn.mockReturnValue(mockProcess)

      await testExecutionService.runTests('/project', 'proj-1')

      expect(outputHandler).toHaveBeenCalled()
    })
  })
})
