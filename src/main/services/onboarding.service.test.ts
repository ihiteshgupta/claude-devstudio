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
  getDb: vi.fn(() => mockDb)
}))

// Mock fs
const mockFs = vi.hoisted(() => ({
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn(() => JSON.stringify({
    name: 'test-project',
    dependencies: { react: '18.0.0', express: '4.18.0' },
    devDependencies: { typescript: '5.0.0', jest: '29.0.0' }
  })),
  readdirSync: vi.fn(() => ['src', 'package.json', 'tsconfig.json']),
  statSync: vi.fn(() => ({ isDirectory: () => false, isFile: () => true }))
}))

// Mock child_process
const mockSpawn = vi.hoisted(() => vi.fn())
const mockExecSync = vi.hoisted(() => vi.fn(() => '/usr/local/bin/claude'))

// Mock services
const mockRoadmapService = vi.hoisted(() => ({
  createItem: vi.fn()
}))

const mockTaskQueueService = vi.hoisted(() => ({
  enqueueTask: vi.fn()
}))

const mockClaudeService = vi.hoisted(() => ({
  sendMessage: vi.fn()
}))

vi.mock('fs', () => mockFs)
vi.mock('child_process', () => ({
  spawn: mockSpawn,
  execSync: mockExecSync
}))

vi.mock('./database.service', () => ({
  databaseService: mockDatabaseService
}))

vi.mock('./roadmap.service', () => ({
  roadmapService: mockRoadmapService
}))

vi.mock('./task-queue.service', () => ({
  taskQueueService: mockTaskQueueService
}))

vi.mock('./claude.service', () => ({
  claudeService: mockClaudeService
}))

// Import after mocking
const { onboardingService, initOnboardingTables } = await import('./onboarding.service')

describe('OnboardingService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    onboardingService.removeAllListeners()

    // Reset fs mock defaults
    mockFs.existsSync.mockReturnValue(true)
    mockFs.readFileSync.mockReturnValue(JSON.stringify({
      name: 'test-project',
      dependencies: { react: '18.0.0' },
      devDependencies: { typescript: '5.0.0', vitest: '1.0.0' }
    }))
    mockFs.readdirSync.mockReturnValue(['src', 'package.json'])
    mockFs.statSync.mockReturnValue({ isDirectory: () => false, isFile: () => true })
  })

  afterEach(() => {
    vi.clearAllMocks()
    onboardingService.removeAllListeners()
  })

  describe('initialization', () => {
    it('should be instantiated', () => {
      expect(onboardingService).toBeDefined()
    })

    it('should have required methods', () => {
      expect(typeof onboardingService.analyzeProject).toBe('function')
      expect(typeof onboardingService.generatePlan).toBe('function')
      expect(typeof onboardingService.getPendingPlan).toBe('function')
      expect(typeof onboardingService.updatePlanWithFeedback).toBe('function')
      expect(typeof onboardingService.applyPlan).toBe('function')
      expect(typeof onboardingService.initProject).toBe('function')
    })

    it('should be an EventEmitter', () => {
      expect(typeof onboardingService.on).toBe('function')
      expect(typeof onboardingService.emit).toBe('function')
    })
  })

  describe('initOnboardingTables', () => {
    it('should create onboarding_plans table', () => {
      initOnboardingTables()

      expect(mockDb.exec).toHaveBeenCalled()
    })
  })

  describe('analyzeProject', () => {
    it('should emit analysis:start event', async () => {
      const started = vi.fn()
      onboardingService.on('analysis:start', started)

      await onboardingService.analyzeProject('/project')

      expect(started).toHaveBeenCalledWith({ projectPath: '/project' })
    })

    it('should emit analysis:complete event', async () => {
      const completed = vi.fn()
      onboardingService.on('analysis:complete', completed)

      await onboardingService.analyzeProject('/project')

      expect(completed).toHaveBeenCalled()
    })

    it('should detect Node.js/TypeScript project', async () => {
      // Only package.json exists (not requirements.txt, go.mod, Cargo.toml)
      mockFs.existsSync.mockImplementation((p: string) => {
        return p.endsWith('package.json') || p.endsWith('src')
      })
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        name: 'test',
        devDependencies: { typescript: '5.0.0' }
      }))

      const analysis = await onboardingService.analyzeProject('/project')

      expect(analysis.projectType).toBe('node')
      expect(analysis.language).toBe('typescript')
    })

    it('should detect JavaScript project without TypeScript', async () => {
      // Only package.json exists (not requirements.txt, go.mod, Cargo.toml)
      mockFs.existsSync.mockImplementation((p: string) => {
        return p.endsWith('package.json') || p.endsWith('src')
      })
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        name: 'test',
        dependencies: { express: '4.0.0' }
      }))

      const analysis = await onboardingService.analyzeProject('/project')

      expect(analysis.language).toBe('javascript')
    })

    it('should detect React framework', async () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        dependencies: { react: '18.0.0' }
      }))

      const analysis = await onboardingService.analyzeProject('/project')

      expect(analysis.frameworks).toContain('react')
    })

    it('should detect Vue framework', async () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        dependencies: { vue: '3.0.0' }
      }))

      const analysis = await onboardingService.analyzeProject('/project')

      expect(analysis.frameworks).toContain('vue')
    })

    it('should detect Express framework', async () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        dependencies: { express: '4.0.0' }
      }))

      const analysis = await onboardingService.analyzeProject('/project')

      expect(analysis.frameworks).toContain('express')
    })

    it('should detect Electron framework', async () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        dependencies: { electron: '25.0.0' }
      }))

      const analysis = await onboardingService.analyzeProject('/project')

      expect(analysis.frameworks).toContain('electron')
    })

    it('should detect test frameworks', async () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        devDependencies: { vitest: '1.0.0' }
      }))

      const analysis = await onboardingService.analyzeProject('/project')

      expect(analysis.hasTests).toBe(true)
      expect(analysis.suggestedAgents).toContain('tester')
    })

    it('should detect Python project', async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        if (path.includes('requirements.txt')) return true
        return false
      })

      const analysis = await onboardingService.analyzeProject('/project')

      expect(analysis.projectType).toBe('python')
      expect(analysis.language).toBe('python')
    })

    it('should detect Go project', async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        if (path.includes('go.mod')) return true
        return false
      })

      const analysis = await onboardingService.analyzeProject('/project')

      expect(analysis.projectType).toBe('go')
      expect(analysis.language).toBe('go')
    })

    it('should detect Rust project', async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        if (path.includes('Cargo.toml')) return true
        return false
      })

      const analysis = await onboardingService.analyzeProject('/project')

      expect(analysis.projectType).toBe('rust')
      expect(analysis.language).toBe('rust')
    })

    it('should detect CI/CD when github workflows exist', async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        if (path.includes('.github/workflows')) return true
        if (path.includes('package.json')) return true
        return false
      })
      mockFs.readFileSync.mockReturnValue(JSON.stringify({}))

      const analysis = await onboardingService.analyzeProject('/project')

      expect(analysis.hasCICD).toBe(true)
      expect(analysis.suggestedAgents).toContain('devops')
    })

    it('should detect Docker', async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        if (path.includes('Dockerfile')) return true
        if (path.includes('package.json')) return true
        return false
      })
      mockFs.readFileSync.mockReturnValue(JSON.stringify({}))

      const analysis = await onboardingService.analyzeProject('/project')

      expect(analysis.hasDocker).toBe(true)
    })

    it('should add security agent for web frameworks', async () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        dependencies: { react: '18.0.0' }
      }))

      const analysis = await onboardingService.analyzeProject('/project')

      expect(analysis.suggestedAgents).toContain('security')
    })

    it('should always include documentation agent', async () => {
      const analysis = await onboardingService.analyzeProject('/project')

      expect(analysis.suggestedAgents).toContain('documentation')
    })

    it('should remove duplicate suggested agents', async () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        dependencies: { react: '18.0.0' },
        devDependencies: { vitest: '1.0.0' }
      }))

      const analysis = await onboardingService.analyzeProject('/project')

      const uniqueAgents = new Set(analysis.suggestedAgents)
      expect(analysis.suggestedAgents.length).toBe(uniqueAgents.size)
    })

    it('should handle analysis errors', async () => {
      const errorHandler = vi.fn()
      onboardingService.on('analysis:error', errorHandler)

      mockFs.existsSync.mockImplementation(() => {
        throw new Error('File system error')
      })

      await expect(onboardingService.analyzeProject('/project')).rejects.toThrow()
      expect(errorHandler).toHaveBeenCalled()
    })
  })

  describe('generatePlan', () => {
    beforeEach(() => {
      // Mock Claude CLI spawn
      mockSpawn.mockImplementation(() => {
        const proc = {
          stdout: {
            on: vi.fn((event, cb) => {
              if (event === 'data') {
                setTimeout(() => cb(JSON.stringify({
                  roadmap: [{ type: 'feature', title: 'Setup', lane: 'now', priority: 'high' }],
                  tasks: [{ type: 'documentation', title: 'Generate docs', agentType: 'documentation' }]
                })), 5)
              }
            })
          },
          stderr: { on: vi.fn() },
          on: vi.fn((event, cb) => {
            if (event === 'close') setTimeout(() => cb(0), 10)
          }),
          kill: vi.fn()
        }
        return proc
      })
    })

    it('should emit plan:generating event', async () => {
      const generating = vi.fn()
      onboardingService.on('plan:generating', generating)

      const analysis = {
        projectType: 'node',
        language: 'typescript',
        frameworks: [],
        hasTests: false,
        hasCICD: false,
        hasDocker: false,
        structure: { srcDirs: [], testDirs: [], configFiles: [], entryPoints: [], totalFiles: 0, totalLines: 0 },
        dependencies: [],
        suggestedAgents: ['developer']
      }

      await onboardingService.generatePlan(
        { projectId: 'proj-1', projectPath: '/project', projectName: 'Test' },
        analysis
      )

      expect(generating).toHaveBeenCalled()
    })

    it('should emit plan:generated event', async () => {
      const generated = vi.fn()
      onboardingService.on('plan:generated', generated)

      const analysis = {
        projectType: 'node',
        language: 'typescript',
        frameworks: [],
        hasTests: false,
        hasCICD: false,
        hasDocker: false,
        structure: { srcDirs: [], testDirs: [], configFiles: [], entryPoints: [], totalFiles: 0, totalLines: 0 },
        dependencies: [],
        suggestedAgents: ['developer']
      }

      await onboardingService.generatePlan(
        { projectId: 'proj-1', projectPath: '/project', projectName: 'Test' },
        analysis
      )

      expect(generated).toHaveBeenCalled()
    })

    it('should store plan in database', async () => {
      const analysis = {
        projectType: 'node',
        language: 'typescript',
        frameworks: [],
        hasTests: false,
        hasCICD: false,
        hasDocker: false,
        structure: { srcDirs: [], testDirs: [], configFiles: [], entryPoints: [], totalFiles: 0, totalLines: 0 },
        dependencies: [],
        suggestedAgents: ['developer']
      }

      await onboardingService.generatePlan(
        { projectId: 'proj-1', projectPath: '/project', projectName: 'Test' },
        analysis
      )

      expect(mockDb.prepare).toHaveBeenCalled()
    })

    it('should return default plan on AI failure', async () => {
      // Mock Claude CLI failure
      mockSpawn.mockImplementation(() => {
        const proc = {
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn((event, cb) => { if (event === 'data') cb('Error') }) },
          on: vi.fn((event, cb) => {
            if (event === 'close') setTimeout(() => cb(1), 10)
          }),
          kill: vi.fn()
        }
        return proc
      })

      const errorHandler = vi.fn()
      onboardingService.on('plan:error', errorHandler)

      const analysis = {
        projectType: 'node',
        language: 'typescript',
        frameworks: [],
        hasTests: false,
        hasCICD: false,
        hasDocker: false,
        structure: { srcDirs: [], testDirs: [], configFiles: [], entryPoints: [], totalFiles: 0, totalLines: 0 },
        dependencies: [],
        suggestedAgents: ['developer']
      }

      const plan = await onboardingService.generatePlan(
        { projectId: 'proj-1', projectPath: '/project', projectName: 'Test' },
        analysis
      )

      // Should still return a default plan
      expect(plan).toBeDefined()
      expect(plan.status).toBe('pending_approval')
    })
  })

  describe('getPendingPlan', () => {
    it('should return pending plan from database', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(),
        get: vi.fn(() => ({
          id: 'plan-1',
          project_id: 'proj-1',
          analysis: JSON.stringify({ projectType: 'node' }),
          suggested_roadmap: JSON.stringify([]),
          suggested_tasks: JSON.stringify([]),
          status: 'pending_approval',
          user_feedback: null,
          created_at: '2024-01-01',
          updated_at: '2024-01-01'
        })),
        run: vi.fn()
      })

      const plan = onboardingService.getPendingPlan('proj-1')

      expect(plan).toBeDefined()
      expect(plan?.id).toBe('plan-1')
      expect(plan?.status).toBe('pending_approval')
    })

    it('should return null when no pending plan', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(),
        get: vi.fn(() => null),
        run: vi.fn()
      })

      const plan = onboardingService.getPendingPlan('proj-1')

      expect(plan).toBeNull()
    })
  })

  describe('updatePlanWithFeedback', () => {
    it('should throw error when plan not found', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(),
        get: vi.fn(() => null),
        run: vi.fn()
      })

      await expect(
        onboardingService.updatePlanWithFeedback('nonexistent', 'feedback', [], [])
      ).rejects.toThrow('Plan not found')
    })

    it('should update plan with accepted items', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(),
        get: vi.fn(() => ({
          id: 'plan-1',
          project_id: 'proj-1',
          analysis: JSON.stringify({}),
          suggested_roadmap: JSON.stringify([
            { title: 'Item 1', accepted: false },
            { title: 'Item 2', accepted: false }
          ]),
          suggested_tasks: JSON.stringify([
            { title: 'Task 1', accepted: false }
          ]),
          status: 'pending_approval',
          created_at: '2024-01-01',
          updated_at: '2024-01-01'
        })),
        run: vi.fn(() => ({ changes: 1 }))
      })

      const plan = await onboardingService.updatePlanWithFeedback(
        'plan-1',
        '',
        ['Item 1'],
        ['Task 1']
      )

      expect(plan).toBeDefined()
    })
  })

  describe('applyPlan', () => {
    it('should throw error when plan not found', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(),
        get: vi.fn(() => null),
        run: vi.fn()
      })

      await expect(onboardingService.applyPlan('nonexistent')).rejects.toThrow('Plan not found')
    })

    it('should create roadmap items and tasks', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(),
        get: vi.fn(() => ({
          id: 'plan-1',
          project_id: 'proj-1',
          analysis: JSON.stringify({}),
          suggested_roadmap: JSON.stringify([
            { title: 'Item 1', accepted: true, type: 'feature', lane: 'now', priority: 'high' }
          ]),
          suggested_tasks: JSON.stringify([
            { title: 'Task 1', accepted: true, type: 'documentation', agentType: 'documentation' }
          ]),
          status: 'pending_approval'
        })),
        run: vi.fn(() => ({ changes: 1 }))
      })

      const result = await onboardingService.applyPlan('plan-1')

      expect(result.roadmapItemsCreated).toBe(1)
      expect(result.tasksCreated).toBe(1)
      expect(mockRoadmapService.createItem).toHaveBeenCalled()
      expect(mockTaskQueueService.enqueueTask).toHaveBeenCalled()
    })

    it('should emit plan:applied event', async () => {
      const applied = vi.fn()
      onboardingService.on('plan:applied', applied)

      mockDb.prepare.mockReturnValue({
        all: vi.fn(),
        get: vi.fn(() => ({
          id: 'plan-1',
          project_id: 'proj-1',
          analysis: JSON.stringify({}),
          suggested_roadmap: JSON.stringify([]),
          suggested_tasks: JSON.stringify([]),
          status: 'pending_approval'
        })),
        run: vi.fn(() => ({ changes: 1 }))
      })

      await onboardingService.applyPlan('plan-1')

      expect(applied).toHaveBeenCalled()
    })

    it('should only create accepted items', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(),
        get: vi.fn(() => ({
          id: 'plan-1',
          project_id: 'proj-1',
          analysis: JSON.stringify({}),
          suggested_roadmap: JSON.stringify([
            { title: 'Item 1', accepted: true, type: 'feature', lane: 'now', priority: 'high' },
            { title: 'Item 2', accepted: false, type: 'feature', lane: 'next', priority: 'medium' }
          ]),
          suggested_tasks: JSON.stringify([]),
          status: 'pending_approval'
        })),
        run: vi.fn(() => ({ changes: 1 }))
      })

      const result = await onboardingService.applyPlan('plan-1')

      expect(result.roadmapItemsCreated).toBe(1)
    })

    it('should update plan status to applied', async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn(),
        get: vi.fn(() => ({
          id: 'plan-1',
          project_id: 'proj-1',
          analysis: JSON.stringify({}),
          suggested_roadmap: JSON.stringify([]),
          suggested_tasks: JSON.stringify([]),
          status: 'pending_approval'
        })),
        run: vi.fn(() => ({ changes: 1 }))
      })

      await onboardingService.applyPlan('plan-1')

      expect(mockDb.prepare).toHaveBeenCalled()
    })
  })

  describe('initProject', () => {
    it('should analyze and generate plan', async () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        dependencies: { react: '18.0.0' }
      }))

      mockSpawn.mockImplementation(() => {
        const proc = {
          stdout: {
            on: vi.fn((event, cb) => {
              if (event === 'data') {
                setTimeout(() => cb(JSON.stringify({ roadmap: [], tasks: [] })), 5)
              }
            })
          },
          stderr: { on: vi.fn() },
          on: vi.fn((event, cb) => {
            if (event === 'close') setTimeout(() => cb(0), 10)
          }),
          kill: vi.fn()
        }
        return proc
      })

      const plan = await onboardingService.initProject({
        projectId: 'proj-1',
        projectPath: '/project',
        projectName: 'Test'
      })

      expect(plan).toBeDefined()
      expect(plan.projectId).toBe('proj-1')
    })
  })
})
