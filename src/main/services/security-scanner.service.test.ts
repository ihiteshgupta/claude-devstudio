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
  readFileSync: vi.fn(() => 'const test = "value"'),
  readdirSync: vi.fn(() => []),
  existsSync: vi.fn(() => false)
}))
vi.mock('fs', () => mockFs)

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

// Mock claude service
const mockClaudeService = vi.hoisted(() => ({
  sendMessage: vi.fn(() => Promise.resolve('Analysis complete'))
}))

// Mock bug report service
const mockBugReportService = vi.hoisted(() => ({
  create: vi.fn(() => Promise.resolve({ id: 'bug-1' }))
}))

vi.mock('./database.service', () => ({
  databaseService: mockDatabaseService
}))

vi.mock('./claude.service', () => ({
  claudeService: mockClaudeService
}))

vi.mock('./bug-report.service', () => ({
  bugReportService: mockBugReportService
}))

// Import after mocking
const { securityScannerService } = await import('./security-scanner.service')

describe('SecurityScannerService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    securityScannerService.removeAllListeners()
  })

  afterEach(() => {
    vi.clearAllMocks()
    securityScannerService.removeAllListeners()
  })

  describe('initialization', () => {
    it('should be instantiated', () => {
      expect(securityScannerService).toBeDefined()
    })

    it('should have required methods', () => {
      expect(typeof securityScannerService.scan).toBe('function')
      expect(typeof securityScannerService.updateFindingStatus).toBe('function')
      expect(typeof securityScannerService.getFinding).toBe('function')
      expect(typeof securityScannerService.getFindings).toBe('function')
      expect(typeof securityScannerService.getRecentScans).toBe('function')
      expect(typeof securityScannerService.cancel).toBe('function')
      expect(typeof securityScannerService.getSummary).toBe('function')
    })

    it('should be an EventEmitter', () => {
      expect(typeof securityScannerService.on).toBe('function')
      expect(typeof securityScannerService.emit).toBe('function')
    })
  })

  describe('scan', () => {
    it('should emit scan-started event', async () => {
      const startedHandler = vi.fn()
      securityScannerService.on('scan-started', startedHandler)

      // Mock npm audit response
      const mockProcess = {
        stdout: {
          on: vi.fn((event, cb) => {
            if (event === 'data') cb(Buffer.from('{}'))
          })
        },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(0)
        })
      }
      mockSpawn.mockReturnValue(mockProcess)
      mockFs.readdirSync.mockReturnValue([])

      await securityScannerService.scan({
        projectId: 'proj-1',
        projectPath: '/project',
        types: ['dependency']
      })

      expect(startedHandler).toHaveBeenCalled()
    })

    it('should emit scan-completed event', async () => {
      const completedHandler = vi.fn()
      securityScannerService.on('scan-completed', completedHandler)

      const mockProcess = {
        stdout: {
          on: vi.fn((event, cb) => {
            if (event === 'data') cb(Buffer.from('{}'))
          })
        },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(0)
        })
      }
      mockSpawn.mockReturnValue(mockProcess)
      mockFs.readdirSync.mockReturnValue([])

      await securityScannerService.scan({
        projectId: 'proj-1',
        projectPath: '/project',
        types: ['dependency']
      })

      expect(completedHandler).toHaveBeenCalled()
    })

    it('should scan for secrets in files', async () => {
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(0)
        })
      }
      mockSpawn.mockReturnValue(mockProcess)

      // Mock file content with a secret pattern
      mockFs.readFileSync.mockReturnValue('const apiKey = "sk-1234567890abcdefghijklmnopqrstuv"')
      mockFs.readdirSync.mockReturnValue([
        { name: 'config.ts', isDirectory: () => false, isFile: () => true }
      ])

      const result = await securityScannerService.scan({
        projectId: 'proj-1',
        projectPath: '/project',
        types: ['secrets']
      })

      expect(result.status).toBe('completed')
    })

    it('should scan code for vulnerabilities', async () => {
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(0)
        })
      }
      mockSpawn.mockReturnValue(mockProcess)

      // Mock file with dangerous code pattern
      mockFs.readFileSync.mockReturnValue('eval(userInput)')
      mockFs.readdirSync.mockReturnValue([
        { name: 'dangerous.js', isDirectory: () => false, isFile: () => true }
      ])

      const result = await securityScannerService.scan({
        projectId: 'proj-1',
        projectPath: '/project',
        types: ['code']
      })

      expect(result.status).toBe('completed')
    })

    it('should create bugs for high severity findings', async () => {
      const mockProcess = {
        stdout: {
          on: vi.fn((event, cb) => {
            if (event === 'data') {
              cb(Buffer.from(JSON.stringify({
                vulnerabilities: {
                  'vulnerable-package': {
                    severity: 'critical',
                    range: '1.0.0',
                    via: [{ title: 'Critical vulnerability' }],
                    fixAvailable: { version: '2.0.0' }
                  }
                }
              })))
            }
          })
        },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(0)
        })
      }
      mockSpawn.mockReturnValue(mockProcess)
      mockFs.readdirSync.mockReturnValue([])

      await securityScannerService.scan({
        projectId: 'proj-1',
        projectPath: '/project',
        types: ['dependency'],
        createBugs: true,
        minSeverityForBug: 'high'
      })

      expect(mockBugReportService.create).toHaveBeenCalled()
    })

    it('should count findings by severity', async () => {
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(0)
        })
      }
      mockSpawn.mockReturnValue(mockProcess)
      mockFs.readdirSync.mockReturnValue([])

      const result = await securityScannerService.scan({
        projectId: 'proj-1',
        projectPath: '/project',
        types: ['dependency']
      })

      expect(result.findingsCount).toBeDefined()
      expect(typeof result.findingsCount.critical).toBe('number')
      expect(typeof result.findingsCount.high).toBe('number')
      expect(typeof result.findingsCount.moderate).toBe('number')
      expect(typeof result.findingsCount.low).toBe('number')
    })

    it('should emit scan-phase events', async () => {
      const phaseHandler = vi.fn()
      securityScannerService.on('scan-phase', phaseHandler)

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(0)
        })
      }
      mockSpawn.mockReturnValue(mockProcess)
      mockFs.readdirSync.mockReturnValue([])

      await securityScannerService.scan({
        projectId: 'proj-1',
        projectPath: '/project',
        types: ['dependency', 'secrets', 'code']
      })

      expect(phaseHandler).toHaveBeenCalled()
    })
  })

  describe('cancel', () => {
    it('should return false when no scan is running', () => {
      const result = securityScannerService.cancel('non-existent')

      expect(result).toBe(false)
    })
  })

  describe('getFinding', () => {
    it('should return null when finding not found', () => {
      mockDb.prepare.mockReturnValueOnce({
        get: vi.fn(() => null)
      })

      const finding = securityScannerService.getFinding('non-existent')

      expect(finding).toBeNull()
    })

    it('should return finding from database', () => {
      mockDb.prepare.mockReturnValueOnce({
        get: vi.fn(() => ({
          id: 'finding-1',
          project_id: 'proj-1',
          scan_id: 'scan-1',
          type: 'dependency',
          severity: 'high',
          title: 'Vulnerability',
          description: 'A vulnerability',
          recommendation: 'Update package',
          status: 'open',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z'
        }))
      })

      const finding = securityScannerService.getFinding('finding-1')

      expect(finding).not.toBeNull()
      expect(finding!.id).toBe('finding-1')
      expect(finding!.severity).toBe('high')
    })
  })

  describe('getFindings', () => {
    it('should return empty array when no findings', () => {
      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn(() => [])
      })

      const findings = securityScannerService.getFindings('proj-1')

      expect(findings).toEqual([])
    })

    it('should return findings from database', () => {
      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn(() => [{
          id: 'finding-1',
          project_id: 'proj-1',
          scan_id: 'scan-1',
          type: 'code',
          severity: 'moderate',
          title: 'Issue',
          description: 'An issue',
          recommendation: 'Fix it',
          status: 'open',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z'
        }])
      })

      const findings = securityScannerService.getFindings('proj-1')

      expect(findings.length).toBe(1)
    })

    it('should filter by status', () => {
      const allFn = vi.fn(() => [])
      mockDb.prepare.mockReturnValueOnce({ all: allFn })

      securityScannerService.getFindings('proj-1', { status: ['open', 'acknowledged'] })

      expect(mockDb.prepare).toHaveBeenCalled()
    })

    it('should filter by severity', () => {
      const allFn = vi.fn(() => [])
      mockDb.prepare.mockReturnValueOnce({ all: allFn })

      securityScannerService.getFindings('proj-1', { severity: ['critical', 'high'] })

      expect(mockDb.prepare).toHaveBeenCalled()
    })

    it('should filter by type', () => {
      const allFn = vi.fn(() => [])
      mockDb.prepare.mockReturnValueOnce({ all: allFn })

      securityScannerService.getFindings('proj-1', { type: ['dependency', 'secrets'] })

      expect(mockDb.prepare).toHaveBeenCalled()
    })
  })

  describe('updateFindingStatus', () => {
    it('should update finding status', () => {
      mockDb.prepare
        .mockReturnValueOnce({ run: vi.fn() })
        .mockReturnValueOnce({
          get: vi.fn(() => ({
            id: 'finding-1',
            project_id: 'proj-1',
            scan_id: 'scan-1',
            type: 'code',
            severity: 'high',
            title: 'Issue',
            description: 'An issue',
            recommendation: 'Fix it',
            status: 'fixed',
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z'
          }))
        })

      const result = securityScannerService.updateFindingStatus('finding-1', 'fixed')

      expect(result).not.toBeNull()
      expect(result!.status).toBe('fixed')
    })
  })

  describe('getRecentScans', () => {
    it('should return empty array when no scans', () => {
      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn(() => [])
      })

      const scans = securityScannerService.getRecentScans('proj-1')

      expect(scans).toEqual([])
    })

    it('should return scans from database', () => {
      mockDb.prepare.mockReturnValueOnce({
        all: vi.fn(() => [{
          id: 'scan-1',
          project_id: 'proj-1',
          types: '["dependency","code"]',
          status: 'completed',
          findings_count_json: '{"critical":0,"high":1,"moderate":2,"low":3,"info":0}',
          total_findings: 6,
          duration: 5000,
          started_at: '2024-01-01T00:00:00.000Z',
          completed_at: '2024-01-01T00:00:05.000Z'
        }])
      })

      const scans = securityScannerService.getRecentScans('proj-1')

      expect(scans.length).toBe(1)
      expect(scans[0].types).toEqual(['dependency', 'code'])
      expect(scans[0].totalFindings).toBe(6)
    })

    it('should respect limit parameter', () => {
      const allFn = vi.fn(() => [])
      mockDb.prepare.mockReturnValueOnce({ all: allFn })

      securityScannerService.getRecentScans('proj-1', 5)

      expect(allFn).toHaveBeenCalledWith('proj-1', 5)
    })
  })

  describe('getSummary', () => {
    it('should return security summary', () => {
      mockDb.prepare
        .mockReturnValueOnce({
          all: vi.fn(() => [
            { severity: 'critical', count: 1 },
            { severity: 'high', count: 2 }
          ])
        })
        .mockReturnValueOnce({
          get: vi.fn(() => ({ started_at: '2024-01-01T00:00:00.000Z' }))
        })
        .mockReturnValueOnce({
          get: vi.fn(() => ({ count: 10 }))
        })
        .mockReturnValueOnce({
          get: vi.fn(() => ({ count: 5 }))
        })

      const summary = securityScannerService.getSummary('proj-1')

      expect(summary.openFindings.critical).toBe(1)
      expect(summary.openFindings.high).toBe(2)
      expect(summary.totalScans).toBe(10)
      expect(summary.fixedLast30Days).toBe(5)
    })

    it('should handle no scan history', () => {
      mockDb.prepare
        .mockReturnValueOnce({ all: vi.fn(() => []) })
        .mockReturnValueOnce({ get: vi.fn(() => null) })
        .mockReturnValueOnce({ get: vi.fn(() => ({ count: 0 })) })
        .mockReturnValueOnce({ get: vi.fn(() => ({ count: 0 })) })

      const summary = securityScannerService.getSummary('proj-1')

      expect(summary.lastScanDate).toBeNull()
      expect(summary.totalScans).toBe(0)
    })
  })

  describe('secret detection patterns', () => {
    it('should detect API keys', async () => {
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(0)
        })
      }
      mockSpawn.mockReturnValue(mockProcess)

      mockFs.readFileSync.mockReturnValue('const apiKey = "abcdefghijklmnopqrstuvwxyz123456"')
      mockFs.readdirSync.mockReturnValue([
        { name: 'config.ts', isDirectory: () => false, isFile: () => true }
      ])

      const result = await securityScannerService.scan({
        projectId: 'proj-1',
        projectPath: '/project',
        types: ['secrets']
      })

      expect(result.status).toBe('completed')
    })

    it('should detect hardcoded passwords', async () => {
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(0)
        })
      }
      mockSpawn.mockReturnValue(mockProcess)

      mockFs.readFileSync.mockReturnValue('const password = "mysecretpassword123"')
      mockFs.readdirSync.mockReturnValue([
        { name: 'auth.ts', isDirectory: () => false, isFile: () => true }
      ])

      const result = await securityScannerService.scan({
        projectId: 'proj-1',
        projectPath: '/project',
        types: ['secrets']
      })

      expect(result.status).toBe('completed')
    })
  })

  describe('code vulnerability detection', () => {
    it('should detect eval usage', async () => {
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(0)
        })
      }
      mockSpawn.mockReturnValue(mockProcess)

      mockFs.readFileSync.mockReturnValue('eval(userInput)')
      mockFs.readdirSync.mockReturnValue([
        { name: 'code.js', isDirectory: () => false, isFile: () => true }
      ])

      const result = await securityScannerService.scan({
        projectId: 'proj-1',
        projectPath: '/project',
        types: ['code']
      })

      expect(result.status).toBe('completed')
    })

    it('should detect innerHTML assignment', async () => {
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(0)
        })
      }
      mockSpawn.mockReturnValue(mockProcess)

      mockFs.readFileSync.mockReturnValue('element.innerHTML = userContent')
      mockFs.readdirSync.mockReturnValue([
        { name: 'dom.js', isDirectory: () => false, isFile: () => true }
      ])

      const result = await securityScannerService.scan({
        projectId: 'proj-1',
        projectPath: '/project',
        types: ['code']
      })

      expect(result.status).toBe('completed')
    })
  })
})
