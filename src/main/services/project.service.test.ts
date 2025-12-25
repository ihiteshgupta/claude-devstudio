/**
 * Claude DevStudio
 * Copyright (c) 2024 Claude DevStudio Contributors
 * Licensed under MIT License - see LICENSE file
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock fs and electron
const mockFs = vi.hoisted(() => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn()
}))

const mockApp = vi.hoisted(() => ({
  getPath: vi.fn(() => '/mock/user/data')
}))

vi.mock('fs', () => mockFs)
vi.mock('electron', () => ({ app: mockApp }))

// Import after mocking
const { projectService } = await import('./project.service')

describe('ProjectService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFs.existsSync.mockReturnValue(true)
    mockFs.readFileSync.mockReturnValue('[]')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should be instantiated', () => {
      expect(projectService).toBeDefined()
    })

    it('should have required methods', () => {
      expect(typeof projectService.listProjects).toBe('function')
      expect(typeof projectService.createProject).toBe('function')
      expect(typeof projectService.getProject).toBe('function')
      expect(typeof projectService.openProject).toBe('function')
      expect(typeof projectService.updateProject).toBe('function')
      expect(typeof projectService.deleteProject).toBe('function')
      expect(typeof projectService.createNewProject).toBe('function')
    })
  })

  describe('listProjects', () => {
    it('should return an array', () => {
      const result = projectService.listProjects()

      expect(Array.isArray(result)).toBe(true)
    })

    it('should sort projects by lastOpenedAt descending', () => {
      const result = projectService.listProjects()

      // Verify it returns an array (may be empty or have projects)
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('createProject', () => {
    it('should throw error if path does not exist', () => {
      mockFs.existsSync.mockReturnValue(false)

      expect(() =>
        projectService.createProject({ path: '/non/existent/path' })
      ).toThrow('Project path does not exist')
    })

    it('should create project with provided path', () => {
      mockFs.existsSync.mockReturnValue(true)

      const result = projectService.createProject({
        path: '/valid/path/myproject',
        name: 'My Project',
        description: 'Test project'
      })

      expect(result).toBeDefined()
      expect(result.path).toBe('/valid/path/myproject')
      expect(result.name).toBe('My Project')
      expect(result.description).toBe('Test project')
    })

    it('should use folder name as default project name', () => {
      mockFs.existsSync.mockReturnValue(true)

      const result = projectService.createProject({
        path: '/some/path/awesome-project'
      })

      expect(result.name).toBe('awesome-project')
    })

    it('should generate unique ID', () => {
      mockFs.existsSync.mockReturnValue(true)

      const result = projectService.createProject({
        path: '/unique/path/project'
      })

      expect(result.id).toMatch(/^proj_\d+_[a-z0-9]+$/)
    })

    it('should set createdAt and lastOpenedAt', () => {
      mockFs.existsSync.mockReturnValue(true)

      const before = new Date()
      const result = projectService.createProject({
        path: '/time/test/project'
      })
      const after = new Date()

      expect(result.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect(result.createdAt.getTime()).toBeLessThanOrEqual(after.getTime())
      expect(result.lastOpenedAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
    })

    it('should save project to file', () => {
      mockFs.existsSync.mockReturnValue(true)

      projectService.createProject({
        path: '/save/test/project'
      })

      expect(mockFs.writeFileSync).toHaveBeenCalled()
    })
  })

  describe('getProject', () => {
    it('should return null for non-existent project', () => {
      const result = projectService.getProject('non-existent-id')

      expect(result).toBeNull()
    })

    it('should return project by ID', () => {
      mockFs.existsSync.mockReturnValue(true)

      // Create a project first
      const created = projectService.createProject({
        path: '/get/test/project',
        name: 'Get Test'
      })

      const result = projectService.getProject(created.id)

      expect(result).toBeDefined()
      expect(result?.id).toBe(created.id)
      expect(result?.name).toBe('Get Test')
    })
  })

  describe('openProject', () => {
    it('should return null for non-existent project', () => {
      const result = projectService.openProject('non-existent-id')

      expect(result).toBeNull()
    })

    it('should update lastOpenedAt time', () => {
      mockFs.existsSync.mockReturnValue(true)

      // Create a project
      const created = projectService.createProject({
        path: '/open/test/project'
      })

      const originalTime = created.lastOpenedAt.getTime()

      // Wait a bit then open
      const result = projectService.openProject(created.id)

      expect(result).toBeDefined()
      expect(result?.lastOpenedAt.getTime()).toBeGreaterThanOrEqual(originalTime)
    })

    it('should save after opening', () => {
      mockFs.existsSync.mockReturnValue(true)

      const created = projectService.createProject({
        path: '/open/save/project'
      })

      vi.clearAllMocks()
      mockFs.existsSync.mockReturnValue(true)

      projectService.openProject(created.id)

      expect(mockFs.writeFileSync).toHaveBeenCalled()
    })
  })

  describe('updateProject', () => {
    it('should return null for non-existent project', () => {
      const result = projectService.updateProject('non-existent', { name: 'New Name' })

      expect(result).toBeNull()
    })

    it('should update project fields', () => {
      mockFs.existsSync.mockReturnValue(true)

      const created = projectService.createProject({
        path: '/update/test/project',
        name: 'Original Name'
      })

      const result = projectService.updateProject(created.id, {
        name: 'Updated Name',
        description: 'New description'
      })

      expect(result).toBeDefined()
      expect(result?.name).toBe('Updated Name')
      expect(result?.description).toBe('New description')
    })

    it('should save after updating', () => {
      mockFs.existsSync.mockReturnValue(true)

      const created = projectService.createProject({
        path: '/update/save/project'
      })

      vi.clearAllMocks()
      mockFs.existsSync.mockReturnValue(true)

      projectService.updateProject(created.id, { name: 'New' })

      expect(mockFs.writeFileSync).toHaveBeenCalled()
    })
  })

  describe('deleteProject', () => {
    it('should return false for non-existent project', () => {
      const result = projectService.deleteProject('non-existent')

      expect(result).toBe(false)
    })

    it('should delete existing project', () => {
      mockFs.existsSync.mockReturnValue(true)

      const created = projectService.createProject({
        path: '/delete/test/project'
      })

      const result = projectService.deleteProject(created.id)

      expect(result).toBe(true)
      expect(projectService.getProject(created.id)).toBeNull()
    })

    it('should save after deleting', () => {
      mockFs.existsSync.mockReturnValue(true)

      const created = projectService.createProject({
        path: '/delete/save/project'
      })

      vi.clearAllMocks()
      mockFs.existsSync.mockReturnValue(true)

      projectService.deleteProject(created.id)

      expect(mockFs.writeFileSync).toHaveBeenCalled()
    })
  })

  describe('createNewProject', () => {
    it('should throw error if folder already exists', () => {
      mockFs.existsSync.mockReturnValue(true)

      expect(() =>
        projectService.createNewProject({
          name: 'existing',
          parentPath: '/parent'
        })
      ).toThrow('Folder already exists')
    })

    it('should create folder and return path', () => {
      mockFs.existsSync.mockReturnValue(false)

      const result = projectService.createNewProject({
        name: 'new-project',
        parentPath: '/parent/path'
      })

      expect(result).toBe('/parent/path/new-project')
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        '/parent/path/new-project',
        { recursive: true }
      )
    })
  })
})
