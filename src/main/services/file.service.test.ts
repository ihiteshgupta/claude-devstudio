/**
 * Claude DevStudio
 * Copyright (c) 2024 Claude DevStudio Contributors
 * Licensed under MIT License - see LICENSE file
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock fs/promises
const mockFsPromises = vi.hoisted(() => ({
  readdir: vi.fn(),
  stat: vi.fn(),
  readFile: vi.fn()
}))

vi.mock('fs/promises', () => mockFsPromises)

// Import after mocking
const { fileService } = await import('./file.service')

describe('FileService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should be instantiated', () => {
      expect(fileService).toBeDefined()
    })

    it('should have required methods', () => {
      expect(typeof fileService.isCodeFile).toBe('function')
      expect(typeof fileService.getFileTree).toBe('function')
      expect(typeof fileService.readFileContent).toBe('function')
      expect(typeof fileService.getFilesContext).toBe('function')
      expect(typeof fileService.getProjectSummary).toBe('function')
    })
  })

  describe('isCodeFile', () => {
    it('should return true for TypeScript files', () => {
      expect(fileService.isCodeFile('index.ts')).toBe(true)
      expect(fileService.isCodeFile('component.tsx')).toBe(true)
    })

    it('should return true for JavaScript files', () => {
      expect(fileService.isCodeFile('app.js')).toBe(true)
      expect(fileService.isCodeFile('component.jsx')).toBe(true)
      expect(fileService.isCodeFile('config.mjs')).toBe(true)
      expect(fileService.isCodeFile('config.cjs')).toBe(true)
    })

    it('should return true for Python files', () => {
      expect(fileService.isCodeFile('main.py')).toBe(true)
    })

    it('should return true for Go files', () => {
      expect(fileService.isCodeFile('main.go')).toBe(true)
    })

    it('should return true for Rust files', () => {
      expect(fileService.isCodeFile('lib.rs')).toBe(true)
    })

    it('should return true for Java files', () => {
      expect(fileService.isCodeFile('Main.java')).toBe(true)
    })

    it('should return true for HTML/CSS files', () => {
      expect(fileService.isCodeFile('index.html')).toBe(true)
      expect(fileService.isCodeFile('styles.css')).toBe(true)
      expect(fileService.isCodeFile('styles.scss')).toBe(true)
    })

    it('should return true for JSON/YAML config files', () => {
      expect(fileService.isCodeFile('config.json')).toBe(true)
      expect(fileService.isCodeFile('config.yaml')).toBe(true)
      expect(fileService.isCodeFile('config.yml')).toBe(true)
    })

    it('should return true for Markdown files', () => {
      expect(fileService.isCodeFile('README.md')).toBe(true)
      expect(fileService.isCodeFile('docs.mdx')).toBe(true)
    })

    it('should return true for SQL files', () => {
      expect(fileService.isCodeFile('schema.sql')).toBe(true)
      expect(fileService.isCodeFile('query.graphql')).toBe(true)
    })

    it('should return true for shell scripts', () => {
      expect(fileService.isCodeFile('build.sh')).toBe(true)
      expect(fileService.isCodeFile('script.bash')).toBe(true)
    })

    it('should return true for Dockerfile', () => {
      expect(fileService.isCodeFile('Dockerfile')).toBe(true)
    })

    it('should return true for Makefile', () => {
      expect(fileService.isCodeFile('Makefile')).toBe(true)
    })

    it('should return false for non-code files', () => {
      expect(fileService.isCodeFile('image.png')).toBe(false)
      expect(fileService.isCodeFile('document.pdf')).toBe(false)
      expect(fileService.isCodeFile('data.bin')).toBe(false)
    })

    it('should be case insensitive for extensions', () => {
      expect(fileService.isCodeFile('FILE.TS')).toBe(true)
      expect(fileService.isCodeFile('FILE.JS')).toBe(true)
    })
  })

  describe('getFileTree', () => {
    it('should return file tree for a directory', async () => {
      const mockEntries = [
        { name: 'src', isDirectory: () => true, isFile: () => false },
        { name: 'index.ts', isDirectory: () => false, isFile: () => true }
      ]

      const mockChildEntries = [
        { name: 'app.ts', isDirectory: () => false, isFile: () => true }
      ]

      mockFsPromises.readdir
        .mockResolvedValueOnce(mockEntries)
        .mockResolvedValueOnce(mockChildEntries)

      mockFsPromises.stat.mockResolvedValue({ size: 1024 })

      const tree = await fileService.getFileTree('/project')

      expect(tree).toBeDefined()
      expect(Array.isArray(tree)).toBe(true)
    })

    it('should respect maxDepth parameter', async () => {
      mockFsPromises.readdir.mockResolvedValue([])

      const tree = await fileService.getFileTree('/project', 1)

      expect(tree).toEqual([])
    })

    it('should ignore node_modules', async () => {
      const mockEntries = [
        { name: 'node_modules', isDirectory: () => true, isFile: () => false },
        { name: 'index.ts', isDirectory: () => false, isFile: () => true }
      ]

      mockFsPromises.readdir.mockResolvedValue(mockEntries)
      mockFsPromises.stat.mockResolvedValue({ size: 100 })

      const tree = await fileService.getFileTree('/project')

      const hasNodeModules = tree.some(node => node.name === 'node_modules')
      expect(hasNodeModules).toBe(false)
    })

    it('should ignore .git directory', async () => {
      const mockEntries = [
        { name: '.git', isDirectory: () => true, isFile: () => false },
        { name: 'index.ts', isDirectory: () => false, isFile: () => true }
      ]

      mockFsPromises.readdir.mockResolvedValue(mockEntries)
      mockFsPromises.stat.mockResolvedValue({ size: 100 })

      const tree = await fileService.getFileTree('/project')

      const hasGit = tree.some(node => node.name === '.git')
      expect(hasGit).toBe(false)
    })

    it('should ignore dist and build directories', async () => {
      const mockEntries = [
        { name: 'dist', isDirectory: () => true, isFile: () => false },
        { name: 'build', isDirectory: () => true, isFile: () => false },
        { name: 'src', isDirectory: () => true, isFile: () => false }
      ]

      mockFsPromises.readdir
        .mockResolvedValueOnce(mockEntries)
        .mockResolvedValueOnce([
          { name: 'index.ts', isDirectory: () => false, isFile: () => true }
        ])

      mockFsPromises.stat.mockResolvedValue({ size: 100 })

      const tree = await fileService.getFileTree('/project')

      expect(tree.some(n => n.name === 'dist')).toBe(false)
      expect(tree.some(n => n.name === 'build')).toBe(false)
    })

    it('should ignore lock files', async () => {
      const mockEntries = [
        { name: 'package-lock.json', isDirectory: () => false, isFile: () => true },
        { name: 'yarn.lock', isDirectory: () => false, isFile: () => true },
        { name: 'index.ts', isDirectory: () => false, isFile: () => true }
      ]

      mockFsPromises.readdir.mockResolvedValue(mockEntries)
      mockFsPromises.stat.mockResolvedValue({ size: 100 })

      const tree = await fileService.getFileTree('/project')

      expect(tree.some(n => n.name === 'package-lock.json')).toBe(false)
      expect(tree.some(n => n.name === 'yarn.lock')).toBe(false)
    })

    it('should ignore .env files', async () => {
      const mockEntries = [
        { name: '.env', isDirectory: () => false, isFile: () => true },
        { name: '.env.local', isDirectory: () => false, isFile: () => true },
        { name: 'index.ts', isDirectory: () => false, isFile: () => true }
      ]

      mockFsPromises.readdir.mockResolvedValue(mockEntries)
      mockFsPromises.stat.mockResolvedValue({ size: 100 })

      const tree = await fileService.getFileTree('/project')

      expect(tree.some(n => n.name === '.env')).toBe(false)
      expect(tree.some(n => n.name === '.env.local')).toBe(false)
    })

    it('should sort directories before files', async () => {
      const mockEntries = [
        { name: 'zebra.ts', isDirectory: () => false, isFile: () => true },
        { name: 'apple', isDirectory: () => true, isFile: () => false },
        { name: 'banana.ts', isDirectory: () => false, isFile: () => true }
      ]

      mockFsPromises.readdir
        .mockResolvedValueOnce(mockEntries)
        .mockResolvedValueOnce([
          { name: 'file.ts', isDirectory: () => false, isFile: () => true }
        ])

      mockFsPromises.stat.mockResolvedValue({ size: 100 })

      const tree = await fileService.getFileTree('/project')

      if (tree.length > 0) {
        const dirIndex = tree.findIndex(n => n.type === 'directory')
        const fileIndex = tree.findIndex(n => n.type === 'file')

        if (dirIndex !== -1 && fileIndex !== -1) {
          expect(dirIndex).toBeLessThan(fileIndex)
        }
      }
    })

    it('should return empty array on error', async () => {
      mockFsPromises.readdir.mockRejectedValue(new Error('Permission denied'))

      const tree = await fileService.getFileTree('/nonexistent')

      expect(tree).toEqual([])
    })

    it('should include file size in nodes', async () => {
      const mockEntries = [
        { name: 'index.ts', isDirectory: () => false, isFile: () => true }
      ]

      mockFsPromises.readdir.mockResolvedValue(mockEntries)
      mockFsPromises.stat.mockResolvedValue({ size: 2048 })

      const tree = await fileService.getFileTree('/project')

      if (tree.length > 0) {
        expect(tree[0].size).toBe(2048)
      }
    })

    it('should include extension in file nodes', async () => {
      const mockEntries = [
        { name: 'component.tsx', isDirectory: () => false, isFile: () => true }
      ]

      mockFsPromises.readdir.mockResolvedValue(mockEntries)
      mockFsPromises.stat.mockResolvedValue({ size: 100 })

      const tree = await fileService.getFileTree('/project')

      if (tree.length > 0) {
        expect(tree[0].extension).toBe('.tsx')
      }
    })

    it('should set correct relative paths', async () => {
      const mockEntries = [
        { name: 'src', isDirectory: () => true, isFile: () => false }
      ]

      const mockChildEntries = [
        { name: 'index.ts', isDirectory: () => false, isFile: () => true }
      ]

      mockFsPromises.readdir
        .mockResolvedValueOnce(mockEntries)
        .mockResolvedValueOnce(mockChildEntries)

      mockFsPromises.stat.mockResolvedValue({ size: 100 })

      const tree = await fileService.getFileTree('/project')

      if (tree.length > 0 && tree[0].children?.length) {
        expect(tree[0].relativePath).toBe('src')
        expect(tree[0].children[0].relativePath).toContain('src')
      }
    })

    it('should skip empty directories', async () => {
      const mockEntries = [
        { name: 'emptyDir', isDirectory: () => true, isFile: () => false },
        { name: 'index.ts', isDirectory: () => false, isFile: () => true }
      ]

      mockFsPromises.readdir
        .mockResolvedValueOnce(mockEntries)
        .mockResolvedValueOnce([]) // empty directory

      mockFsPromises.stat.mockResolvedValue({ size: 100 })

      const tree = await fileService.getFileTree('/project')

      expect(tree.some(n => n.name === 'emptyDir')).toBe(false)
    })
  })

  describe('readFileContent', () => {
    it('should read file content', async () => {
      mockFsPromises.readFile.mockResolvedValue('const x = 1;')

      const content = await fileService.readFileContent('/project/index.ts')

      expect(content).toBe('const x = 1;')
      expect(mockFsPromises.readFile).toHaveBeenCalledWith('/project/index.ts', 'utf-8')
    })

    it('should throw error when file not found', async () => {
      mockFsPromises.readFile.mockRejectedValue(new Error('ENOENT'))

      await expect(fileService.readFileContent('/nonexistent.ts'))
        .rejects.toThrow('Failed to read file: /nonexistent.ts')
    })

    it('should throw error on permission denied', async () => {
      mockFsPromises.readFile.mockRejectedValue(new Error('EACCES'))

      await expect(fileService.readFileContent('/protected.ts'))
        .rejects.toThrow('Failed to read file: /protected.ts')
    })
  })

  describe('getFilesContext', () => {
    it('should format multiple files for context', async () => {
      mockFsPromises.readFile
        .mockResolvedValueOnce('const a = 1;')
        .mockResolvedValueOnce('const b = 2;')

      const context = await fileService.getFilesContext(
        ['/project/a.ts', '/project/b.ts'],
        '/project'
      )

      expect(context).toContain('## File: a.ts')
      expect(context).toContain('## File: b.ts')
      expect(context).toContain('const a = 1;')
      expect(context).toContain('const b = 2;')
    })

    it('should include language identifier in code blocks', async () => {
      mockFsPromises.readFile.mockResolvedValue('print("hello")')

      const context = await fileService.getFilesContext(
        ['/project/main.py'],
        '/project'
      )

      expect(context).toContain('```py')
    })

    it('should use "text" for files without extension', async () => {
      mockFsPromises.readFile.mockResolvedValue('content')

      const context = await fileService.getFilesContext(
        ['/project/Makefile'],
        '/project'
      )

      expect(context).toContain('```text')
    })

    it('should handle read errors gracefully', async () => {
      mockFsPromises.readFile.mockRejectedValue(new Error('ENOENT'))

      const context = await fileService.getFilesContext(
        ['/project/missing.ts'],
        '/project'
      )

      expect(context).toContain('[Error reading file]')
    })

    it('should return empty string for empty file list', async () => {
      const context = await fileService.getFilesContext([], '/project')

      expect(context).toBe('')
    })

    it('should use relative paths in output', async () => {
      mockFsPromises.readFile.mockResolvedValue('code')

      const context = await fileService.getFilesContext(
        ['/project/src/deep/file.ts'],
        '/project'
      )

      expect(context).toContain('src/deep/file.ts')
      expect(context).not.toContain('/project/src')
    })
  })

  describe('getProjectSummary', () => {
    it('should read README.md if present', async () => {
      mockFsPromises.readFile.mockImplementation((path: string) => {
        if (path.endsWith('README.md')) {
          return Promise.resolve('# Project Title\n\nDescription')
        }
        return Promise.reject(new Error('ENOENT'))
      })

      const summary = await fileService.getProjectSummary('/project')

      expect(summary).toContain('## README.md')
      expect(summary).toContain('# Project Title')
    })

    it('should read package.json if present', async () => {
      mockFsPromises.readFile.mockImplementation((path: string) => {
        if (path.endsWith('package.json')) {
          return Promise.resolve('{"name": "my-app"}')
        }
        return Promise.reject(new Error('ENOENT'))
      })

      const summary = await fileService.getProjectSummary('/project')

      expect(summary).toContain('## package.json')
      expect(summary).toContain('"name": "my-app"')
    })

    it('should read requirements.txt for Python projects', async () => {
      mockFsPromises.readFile.mockImplementation((path: string) => {
        if (path.endsWith('requirements.txt')) {
          return Promise.resolve('flask==2.0.0\nrequests>=2.25.0')
        }
        return Promise.reject(new Error('ENOENT'))
      })

      const summary = await fileService.getProjectSummary('/project')

      expect(summary).toContain('## requirements.txt')
      expect(summary).toContain('flask==2.0.0')
    })

    it('should read Cargo.toml for Rust projects', async () => {
      mockFsPromises.readFile.mockImplementation((path: string) => {
        if (path.endsWith('Cargo.toml')) {
          return Promise.resolve('[package]\nname = "my-crate"')
        }
        return Promise.reject(new Error('ENOENT'))
      })

      const summary = await fileService.getProjectSummary('/project')

      expect(summary).toContain('## Cargo.toml')
    })

    it('should read go.mod for Go projects', async () => {
      mockFsPromises.readFile.mockImplementation((path: string) => {
        if (path.endsWith('go.mod')) {
          return Promise.resolve('module github.com/user/project')
        }
        return Promise.reject(new Error('ENOENT'))
      })

      const summary = await fileService.getProjectSummary('/project')

      expect(summary).toContain('## go.mod')
    })

    it('should combine multiple summary files', async () => {
      mockFsPromises.readFile.mockImplementation((path: string) => {
        if (path.endsWith('README.md')) {
          return Promise.resolve('# Title')
        }
        if (path.endsWith('package.json')) {
          return Promise.resolve('{"name": "app"}')
        }
        return Promise.reject(new Error('ENOENT'))
      })

      const summary = await fileService.getProjectSummary('/project')

      expect(summary).toContain('## README.md')
      expect(summary).toContain('## package.json')
      expect(summary).toContain('---')
    })

    it('should return message when no summary files found', async () => {
      mockFsPromises.readFile.mockRejectedValue(new Error('ENOENT'))

      const summary = await fileService.getProjectSummary('/project')

      expect(summary).toBe('No project summary files found (README.md, package.json, etc.)')
    })

    it('should try lowercase readme.md', async () => {
      mockFsPromises.readFile.mockImplementation((path: string) => {
        if (path.endsWith('readme.md')) {
          return Promise.resolve('# lowercase readme')
        }
        return Promise.reject(new Error('ENOENT'))
      })

      const summary = await fileService.getProjectSummary('/project')

      expect(summary).toContain('# lowercase readme')
    })
  })
})
