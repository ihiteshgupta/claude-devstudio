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
  readdirSync: vi.fn(() => [])
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

// Mock git automation service
const mockGitAutomationService = vi.hoisted(() => ({
  cherryPick: vi.fn(() => Promise.resolve({ success: true }))
}))

vi.mock('./database.service', () => ({
  databaseService: mockDatabaseService
}))

vi.mock('./git-automation.service', () => ({
  gitAutomationService: mockGitAutomationService
}))

// Import after mocking
const { deploymentService } = await import('./deployment.service')

describe('DeploymentService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    deploymentService.removeAllListeners()
  })

  afterEach(() => {
    vi.clearAllMocks()
    deploymentService.removeAllListeners()
    // Clean up any running process
    deploymentService.cancelBuild()
  })

  describe('initialization', () => {
    it('should be instantiated', () => {
      expect(deploymentService).toBeDefined()
    })

    it('should have required methods', () => {
      expect(typeof deploymentService.runBuild).toBe('function')
      expect(typeof deploymentService.deploy).toBe('function')
      expect(typeof deploymentService.rollback).toBe('function')
      expect(typeof deploymentService.getRecentBuilds).toBe('function')
      expect(typeof deploymentService.getRecentDeployments).toBe('function')
      expect(typeof deploymentService.getCurrentDeployment).toBe('function')
      expect(typeof deploymentService.cancelBuild).toBe('function')
      expect(typeof deploymentService.isBuildRunning).toBe('function')
      expect(typeof deploymentService.isDeploymentRunning).toBe('function')
    })

    it('should be an EventEmitter', () => {
      expect(typeof deploymentService.on).toBe('function')
      expect(typeof deploymentService.emit).toBe('function')
    })
  })

  describe('isBuildRunning', () => {
    it('should return false when no build is running', () => {
      expect(deploymentService.isBuildRunning()).toBe(false)
    })
  })

  describe('isDeploymentRunning', () => {
    it('should return false when no deployment is running', () => {
      expect(deploymentService.isDeploymentRunning()).toBe(false)
    })
  })

  describe('cancelBuild', () => {
    it('should return false when no build is running', () => {
      expect(deploymentService.cancelBuild()).toBe(false)
    })
  })

  describe('getRecentBuilds', () => {
    it('should return empty array when no builds', () => {
      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn(() => [])
      })

      const builds = deploymentService.getRecentBuilds('proj-1')

      expect(builds).toEqual([])
    })

    it('should return builds from database', () => {
      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn(() => [{
          id: 'build-1',
          project_id: 'proj-1',
          status: 'success',
          start_time: '2024-01-01T00:00:00.000Z',
          end_time: '2024-01-01T00:05:00.000Z',
          duration: 300000,
          output_dir: 'dist',
          artifacts: '["dist/main.js"]',
          logs: 'Build completed',
          git_commit: 'abc123',
          git_branch: 'main',
          error_message: null
        }])
      })

      const builds = deploymentService.getRecentBuilds('proj-1')

      expect(builds.length).toBe(1)
      expect(builds[0].id).toBe('build-1')
      expect(builds[0].status).toBe('success')
    })

    it('should respect limit parameter', () => {
      const allFn = vi.fn(() => [])
      mockDb.prepare.mockReturnValueOnce({ all: allFn })

      deploymentService.getRecentBuilds('proj-1', 5)

      expect(allFn).toHaveBeenCalledWith('proj-1', 5)
    })
  })

  describe('getRecentDeployments', () => {
    it('should return empty array when no deployments', () => {
      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn(() => [])
      })

      const deployments = deploymentService.getRecentDeployments('proj-1')

      expect(deployments).toEqual([])
    })

    it('should return deployments from database', () => {
      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn(() => [{
          id: 'deploy-1',
          project_id: 'proj-1',
          build_id: 'build-1',
          environment: 'production',
          status: 'success',
          start_time: '2024-01-01T00:00:00.000Z',
          end_time: '2024-01-01T00:01:00.000Z',
          duration: 60000,
          git_commit: 'abc123',
          git_tag: 'v1.0.0',
          deployed_by: 'user',
          health_check_passed: 1,
          error_message: null,
          rollback_from_id: null
        }])
      })

      const deployments = deploymentService.getRecentDeployments('proj-1')

      expect(deployments.length).toBe(1)
      expect(deployments[0].id).toBe('deploy-1')
      expect(deployments[0].environment).toBe('production')
    })

    it('should filter by environment', () => {
      const allFn = vi.fn(() => [])
      mockDb.prepare.mockReturnValueOnce({ all: allFn })

      deploymentService.getRecentDeployments('proj-1', 'staging')

      expect(allFn).toHaveBeenCalledWith('proj-1', 'staging', 20)
    })
  })

  describe('getCurrentDeployment', () => {
    it('should return null when no current deployment', () => {
      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn(() => [])
      })

      const deployment = deploymentService.getCurrentDeployment('proj-1', 'production')

      expect(deployment).toBeNull()
    })

    it('should return most recent deployment', () => {
      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn(() => [{
          id: 'deploy-1',
          project_id: 'proj-1',
          build_id: 'build-1',
          environment: 'production',
          status: 'success',
          start_time: '2024-01-01T00:00:00.000Z',
          deployed_by: 'user'
        }])
      })

      const deployment = deploymentService.getCurrentDeployment('proj-1', 'production')

      expect(deployment).not.toBeNull()
      expect(deployment!.id).toBe('deploy-1')
    })
  })

  describe('runBuild', () => {
    it('should emit build-started event', async () => {
      const startedHandler = vi.fn()
      deploymentService.on('build-started', startedHandler)

      // Mock package.json read
      mockFs.readFileSync.mockReturnValueOnce(JSON.stringify({
        scripts: { build: 'echo build' }
      }))

      // Mock spawn to return a process that completes immediately
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

      const promise = deploymentService.runBuild('/project', 'proj-1')

      // Give it time to emit
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(startedHandler).toHaveBeenCalled()

      // Clean up
      await promise.catch(() => {})
    })

    it('should throw if build already in progress', async () => {
      // Mock a build that takes time
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        kill: vi.fn()
      }
      mockSpawn.mockReturnValue(mockProcess)
      mockFs.readFileSync.mockReturnValue('{}')

      // Start first build
      const firstBuild = deploymentService.runBuild('/project', 'proj-1')

      // Give it time to start
      await new Promise(resolve => setTimeout(resolve, 50))

      // Try to start second build
      await expect(deploymentService.runBuild('/project', 'proj-1'))
        .rejects.toThrow('Build already in progress')

      // Clean up - simulate completion
      const closeCallback = mockProcess.on.mock.calls.find(c => c[0] === 'close')?.[1]
      if (closeCallback) closeCallback(0)
      await firstBuild.catch(() => {})
    })
  })

  describe('deploy', () => {
    it('should throw if deployment already in progress', async () => {
      // Mock a deployment that takes time
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        kill: vi.fn()
      }
      mockSpawn.mockReturnValue(mockProcess)
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        scripts: { 'deploy:production': 'echo deploy' }
      }))

      // Start first deployment
      const firstDeploy = deploymentService.deploy('/project', 'proj-1', {
        environment: 'production'
      })

      // Give it time to start
      await new Promise(resolve => setTimeout(resolve, 50))

      // Try to start second deployment
      await expect(deploymentService.deploy('/project', 'proj-1', {
        environment: 'staging'
      })).rejects.toThrow('Deployment already in progress')

      // Clean up - simulate completion
      const closeCallback = mockProcess.on.mock.calls.find(c => c[0] === 'close')?.[1]
      if (closeCallback) closeCallback(0)
      await firstDeploy.catch(() => {})
    })

    it('should emit deployment-started event', async () => {
      const startedHandler = vi.fn()
      deploymentService.on('deployment-started', startedHandler)

      mockFs.readFileSync.mockReturnValueOnce(JSON.stringify({
        scripts: {}
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

      const promise = deploymentService.deploy('/project', 'proj-1', {
        environment: 'staging'
      })

      await new Promise(resolve => setTimeout(resolve, 50))

      expect(startedHandler).toHaveBeenCalled()

      await promise.catch(() => {})
    })
  })

  describe('rollback', () => {
    it('should return null if no previous deployment found', async () => {
      mockDb.prepare.mockReturnValueOnce({
        get: vi.fn(() => null)
      })

      const result = await deploymentService.rollback('/project', 'proj-1', 'production')

      expect(result).toBeNull()
    })

    it('should emit rollback-failed when no previous deployment', async () => {
      const failedHandler = vi.fn()
      deploymentService.on('rollback-failed', failedHandler)

      mockDb.prepare.mockReturnValueOnce({
        get: vi.fn(() => null)
      })

      await deploymentService.rollback('/project', 'proj-1', 'production')

      expect(failedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'proj-1',
          environment: 'production',
          reason: 'No previous deployment found'
        })
      )
    })
  })

  describe('build event handling', () => {
    it('should emit build-completed on success', async () => {
      const completedHandler = vi.fn()
      deploymentService.on('build-completed', completedHandler)

      mockFs.readFileSync.mockReturnValueOnce(JSON.stringify({
        scripts: { build: 'echo build' }
      }))

      const mockProcess = {
        stdout: {
          on: vi.fn((event, cb) => {
            if (event === 'data') cb(Buffer.from('Build output'))
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

      const result = await deploymentService.runBuild('/project', 'proj-1')

      expect(result.status).toBe('success')
      expect(completedHandler).toHaveBeenCalled()
    })

    it('should emit build-failed on error', async () => {
      const failedHandler = vi.fn()
      deploymentService.on('build-failed', failedHandler)

      mockFs.readFileSync.mockReturnValueOnce(JSON.stringify({
        scripts: { build: 'echo build' }
      }))

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: {
          on: vi.fn((event, cb) => {
            if (event === 'data') cb(Buffer.from('Error output'))
          })
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(1), 10) // Non-zero exit code
          }
        }),
        kill: vi.fn()
      }
      mockSpawn.mockReturnValue(mockProcess)

      const result = await deploymentService.runBuild('/project', 'proj-1')

      expect(result.status).toBe('failed')
    })
  })
})
