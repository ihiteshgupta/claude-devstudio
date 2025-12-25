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

// Mock fs
const mockFs = vi.hoisted(() => ({
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn(() => JSON.stringify({
    scripts: {
      typecheck: 'tsc --noEmit',
      lint: 'eslint .',
      build: 'vite build',
      test: 'vitest'
    }
  }))
}))

// Mock child_process
const mockSpawn = vi.hoisted(() => vi.fn())

vi.mock('fs', () => mockFs)
vi.mock('child_process', () => ({
  spawn: mockSpawn
}))

vi.mock('./database.service', () => ({
  databaseService: mockDatabaseService
}))

// Import after mocking
const { validationService } = await import('./validation.service')

describe('ValidationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validationService.removeAllListeners()

    // Default spawn mock
    mockSpawn.mockImplementation(() => {
      const proc = {
        stdout: {
          on: vi.fn((event, cb) => {
            if (event === 'data') setTimeout(() => cb('Output'), 5)
          })
        },
        stderr: {
          on: vi.fn((event, cb) => {
            if (event === 'data') setTimeout(() => cb(''), 5)
          })
        },
        on: vi.fn((event, cb) => {
          if (event === 'close') setTimeout(() => cb(0), 10)
        }),
        kill: vi.fn()
      }
      return proc
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    validationService.removeAllListeners()
  })

  describe('initialization', () => {
    it('should be instantiated', () => {
      expect(validationService).toBeDefined()
    })

    it('should have required methods', () => {
      expect(typeof validationService.validate).toBe('function')
      expect(typeof validationService.detectChecks).toBe('function')
      expect(typeof validationService.getProfiles).toBe('function')
      expect(typeof validationService.getProfile).toBe('function')
      expect(typeof validationService.validateWithProfile).toBe('function')
      expect(typeof validationService.cancel).toBe('function')
      expect(typeof validationService.getRecentRuns).toBe('function')
      expect(typeof validationService.getRun).toBe('function')
      expect(typeof validationService.getTaskRuns).toBe('function')
      expect(typeof validationService.shouldValidate).toBe('function')
      expect(typeof validationService.getRecommendedProfile).toBe('function')
      expect(typeof validationService.quickValidate).toBe('function')
    })

    it('should be an EventEmitter', () => {
      expect(typeof validationService.on).toBe('function')
      expect(typeof validationService.emit).toBe('function')
    })
  })

  describe('getProfiles', () => {
    it('should return predefined profiles', () => {
      const profiles = validationService.getProfiles()

      expect(profiles.length).toBeGreaterThan(0)
      expect(profiles.some(p => p.id === 'quick')).toBe(true)
      expect(profiles.some(p => p.id === 'standard')).toBe(true)
      expect(profiles.some(p => p.id === 'full')).toBe(true)
    })

    it('should include profile metadata', () => {
      const profiles = validationService.getProfiles()

      profiles.forEach(profile => {
        expect(profile.id).toBeDefined()
        expect(profile.name).toBeDefined()
        expect(profile.description).toBeDefined()
        expect(profile.checks).toBeDefined()
        expect(Array.isArray(profile.checks)).toBe(true)
      })
    })
  })

  describe('getProfile', () => {
    it('should return a specific profile', () => {
      const profile = validationService.getProfile('quick')

      expect(profile).toBeDefined()
      expect(profile?.id).toBe('quick')
      expect(profile?.name).toBe('Quick Validation')
    })

    it('should return undefined for unknown profile', () => {
      const profile = validationService.getProfile('nonexistent')

      expect(profile).toBeUndefined()
    })
  })

  describe('detectChecks', () => {
    it('should detect checks from package.json', () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        scripts: {
          typecheck: 'tsc --noEmit',
          lint: 'eslint .',
          build: 'vite build',
          test: 'vitest'
        }
      }))

      const checks = validationService.detectChecks('/project')

      expect(checks.some(c => c.type === 'typecheck')).toBe(true)
      expect(checks.some(c => c.type === 'lint')).toBe(true)
      expect(checks.some(c => c.type === 'build')).toBe(true)
      expect(checks.some(c => c.type === 'test')).toBe(true)
    })

    it('should return standard profile when no package.json', () => {
      mockFs.existsSync.mockReturnValue(false)

      const checks = validationService.detectChecks('/project')

      expect(checks.length).toBeGreaterThan(0)
    })

    it('should detect format check scripts', () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        scripts: {
          'format:check': 'prettier --check .'
        }
      }))

      const checks = validationService.detectChecks('/project')

      expect(checks.some(c => c.type === 'format')).toBe(true)
    })
  })

  describe('shouldValidate', () => {
    it('should return true for code_generation tasks', () => {
      expect(validationService.shouldValidate('code_generation')).toBe(true)
    })

    it('should return true for bug_fix tasks', () => {
      expect(validationService.shouldValidate('bug_fix')).toBe(true)
    })

    it('should return true for refactoring tasks', () => {
      expect(validationService.shouldValidate('refactoring')).toBe(true)
    })

    it('should return false for non-validatable tasks', () => {
      expect(validationService.shouldValidate('documentation')).toBe(false)
      expect(validationService.shouldValidate('planning')).toBe(false)
    })
  })

  describe('getRecommendedProfile', () => {
    it('should recommend standard for code_generation', () => {
      expect(validationService.getRecommendedProfile('code_generation')).toBe('standard')
    })

    it('should recommend full for bug_fix', () => {
      expect(validationService.getRecommendedProfile('bug_fix')).toBe('full')
    })

    it('should recommend full for refactoring', () => {
      expect(validationService.getRecommendedProfile('refactoring')).toBe('full')
    })

    it('should recommend quick for test_generation', () => {
      expect(validationService.getRecommendedProfile('test_generation')).toBe('quick')
    })

    it('should default to quick for unknown types', () => {
      expect(validationService.getRecommendedProfile('unknown')).toBe('quick')
    })
  })

  describe('validate', () => {
    it('should emit validation-started event', async () => {
      const started = vi.fn()
      validationService.on('validation-started', started)

      await validationService.validate({
        projectId: 'proj-1',
        projectPath: '/project',
        checks: []
      })

      expect(started).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'proj-1'
        })
      )
    })

    it('should emit validation-completed event', async () => {
      const completed = vi.fn()
      validationService.on('validation-completed', completed)

      await validationService.validate({
        projectId: 'proj-1',
        projectPath: '/project',
        checks: []
      })

      expect(completed).toHaveBeenCalled()
    })

    it('should return validation run result', async () => {
      const run = await validationService.validate({
        projectId: 'proj-1',
        projectPath: '/project',
        checks: []
      })

      expect(run.id).toBeDefined()
      expect(run.projectId).toBe('proj-1')
      expect(run.overallStatus).toBeDefined()
      expect(run.passedCount).toBeDefined()
      expect(run.failedCount).toBeDefined()
    })

    it('should run provided checks', async () => {
      const checkStarted = vi.fn()
      validationService.on('check-started', checkStarted)

      await validationService.validate({
        projectId: 'proj-1',
        projectPath: '/project',
        checks: [
          { type: 'typecheck', name: 'Type Check', command: 'npm run typecheck', required: true }
        ]
      })

      expect(checkStarted).toHaveBeenCalledWith(
        expect.objectContaining({
          check: 'Type Check'
        })
      )
    })

    it('should emit check-completed for each check', async () => {
      const checkCompleted = vi.fn()
      validationService.on('check-completed', checkCompleted)

      await validationService.validate({
        projectId: 'proj-1',
        projectPath: '/project',
        checks: [
          { type: 'typecheck', name: 'Type Check', command: 'npm run typecheck', required: true }
        ]
      })

      expect(checkCompleted).toHaveBeenCalled()
    })

    it('should stop on first failure when configured', async () => {
      mockSpawn.mockImplementation(() => {
        const proc = {
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
          on: vi.fn((event, cb) => {
            if (event === 'close') setTimeout(() => cb(1), 10) // Exit code 1 = failure
          }),
          kill: vi.fn()
        }
        return proc
      })

      const run = await validationService.validate({
        projectId: 'proj-1',
        projectPath: '/project',
        checks: [
          { type: 'typecheck', name: 'Type Check', command: 'npm run typecheck', required: true },
          { type: 'lint', name: 'Lint', command: 'npm run lint', required: true }
        ],
        stopOnFirstFailure: true
      })

      // Second check should be skipped
      expect(run.checks.some(c => c.status === 'skipped')).toBe(true)
    })

    it('should store validation run in database', async () => {
      await validationService.validate({
        projectId: 'proj-1',
        projectPath: '/project',
        checks: []
      })

      expect(mockDb.prepare).toHaveBeenCalled()
    })
  })

  describe('validateWithProfile', () => {
    it('should use profile checks', async () => {
      const run = await validationService.validateWithProfile(
        'proj-1',
        '/project',
        'quick'
      )

      expect(run.projectId).toBe('proj-1')
    })

    it('should throw for unknown profile', async () => {
      await expect(
        validationService.validateWithProfile('proj-1', '/project', 'unknown')
      ).rejects.toThrow('Unknown validation profile')
    })
  })

  describe('cancel', () => {
    it('should return false when no running validation', () => {
      const result = validationService.cancel('nonexistent')

      expect(result).toBe(false)
    })
  })

  describe('getRecentRuns', () => {
    it('should return recent validation runs', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [
          {
            id: 'val-1',
            project_id: 'proj-1',
            overall_status: 'passed',
            passed_count: 3,
            failed_count: 0,
            skipped_count: 0,
            total_duration: 5000,
            checks_json: '[]',
            started_at: '2024-01-01T00:00:00Z',
            completed_at: '2024-01-01T00:00:05Z'
          }
        ]),
        get: vi.fn(),
        run: vi.fn()
      })

      const runs = validationService.getRecentRuns('proj-1')

      expect(runs.length).toBe(1)
      expect(runs[0].id).toBe('val-1')
    })

    it('should accept custom limit', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn()
      })

      validationService.getRecentRuns('proj-1', 5)

      expect(mockDb.prepare).toHaveBeenCalled()
    })
  })

  describe('getRun', () => {
    it('should return a specific run', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(),
        get: vi.fn(() => ({
          id: 'val-1',
          project_id: 'proj-1',
          overall_status: 'passed',
          passed_count: 2,
          failed_count: 0,
          skipped_count: 0,
          total_duration: 3000,
          checks_json: '[]',
          started_at: '2024-01-01T00:00:00Z',
          completed_at: '2024-01-01T00:00:03Z'
        })),
        run: vi.fn()
      })

      const run = validationService.getRun('val-1')

      expect(run).toBeDefined()
      expect(run?.id).toBe('val-1')
    })

    it('should return null for nonexistent run', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(),
        get: vi.fn(() => null),
        run: vi.fn()
      })

      const run = validationService.getRun('nonexistent')

      expect(run).toBeNull()
    })
  })

  describe('getTaskRuns', () => {
    it('should return runs for a task', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => [
          {
            id: 'val-1',
            project_id: 'proj-1',
            task_id: 'task-1',
            overall_status: 'passed',
            passed_count: 2,
            failed_count: 0,
            skipped_count: 0,
            total_duration: 3000,
            checks_json: '[]',
            started_at: '2024-01-01T00:00:00Z',
            completed_at: '2024-01-01T00:00:03Z'
          }
        ]),
        get: vi.fn(),
        run: vi.fn()
      })

      const runs = validationService.getTaskRuns('task-1')

      expect(runs.length).toBe(1)
    })
  })

  describe('quickValidate', () => {
    it('should return pass/fail summary', async () => {
      const result = await validationService.quickValidate('/project', 'proj-1')

      expect(result).toHaveProperty('passed')
      expect(result).toHaveProperty('summary')
      expect(typeof result.passed).toBe('boolean')
      expect(typeof result.summary).toBe('string')
    })
  })

  describe('profile checks', () => {
    it('should have quick profile with minimal checks', () => {
      const profile = validationService.getProfile('quick')

      expect(profile?.checks.length).toBeLessThanOrEqual(3)
    })

    it('should have full profile with comprehensive checks', () => {
      const profile = validationService.getProfile('full')

      expect(profile?.checks.length).toBeGreaterThan(3)
      expect(profile?.checks.some(c => c.type === 'test')).toBe(true)
    })

    it('should have pre-commit profile for commit hooks', () => {
      const profile = validationService.getProfile('pre-commit')

      expect(profile).toBeDefined()
      expect(profile?.checks.some(c => c.type === 'typecheck')).toBe(true)
    })

    it('should have pre-merge profile for PR validation', () => {
      const profile = validationService.getProfile('pre-merge')

      expect(profile).toBeDefined()
      expect(profile?.checks.some(c => c.type === 'security')).toBe(true)
    })
  })
})
