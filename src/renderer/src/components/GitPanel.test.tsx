/**
 * Claude DevStudio
 * Copyright (c) 2024 Claude DevStudio Contributors
 * Licensed under MIT License - see LICENSE file
 *
 * GitPanel component tests
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GitPanel } from './GitPanel'
import { useAppStore } from '../stores/appStore'
import type { GitStatus, GitCommit, GitBranch, GitFileChange } from '@shared/types'

// Mock the appStore
vi.mock('../stores/appStore', () => ({
  useAppStore: vi.fn()
}))

describe('GitPanel', () => {
  const mockProjectPath = '/path/to/project'

  const createMockGitStatus = (overrides?: Partial<GitStatus>): GitStatus => ({
    isRepo: true,
    current: 'main',
    tracking: 'origin/main',
    ahead: 0,
    behind: 0,
    staged: [],
    unstaged: [],
    untracked: [],
    ...overrides
  })

  const createMockCommit = (overrides?: Partial<GitCommit>): GitCommit => ({
    hash: 'abc123def456',
    hashShort: 'abc123d',
    date: new Date('2024-01-15T10:30:00Z').toISOString(),
    message: 'Initial commit',
    authorName: 'John Doe',
    authorEmail: 'john@example.com',
    ...overrides
  })

  const createMockBranch = (overrides?: Partial<GitBranch>): GitBranch => ({
    name: 'main',
    current: true,
    commit: 'abc123def456',
    ...overrides
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAppStore).mockReturnValue({
      currentProject: {
        id: 'project-1',
        name: 'Test Project',
        path: mockProjectPath,
        createdAt: new Date(),
        lastOpenedAt: new Date()
      }
    } as any)

    // Default mock implementations - use window.electronAPI.git from setup.ts
    vi.mocked(window.electronAPI.git.status).mockResolvedValue(createMockGitStatus())
    vi.mocked(window.electronAPI.git.log).mockResolvedValue([])
    vi.mocked(window.electronAPI.git.branches).mockResolvedValue([createMockBranch()])
    vi.mocked(window.electronAPI.git.diff).mockResolvedValue('')
  })

  describe('Empty State - Not a Git Repository', () => {
    it('should display empty state when not a git repository', async () => {
      vi.mocked(window.electronAPI.git).status.mockResolvedValue(createMockGitStatus({ isRepo: false }))

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText('Not a Git Repository')).toBeInTheDocument()
      })

      expect(screen.getByText('Initialize git in this project to use version control')).toBeInTheDocument()
    })

    it('should display FolderX icon in empty state', async () => {
      vi.mocked(window.electronAPI.git).status.mockResolvedValue(createMockGitStatus({ isRepo: false }))

      const { container } = render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        const icon = container.querySelector('svg')
        expect(icon).toBeInTheDocument()
      })
    })
  })

  describe('Branch Display', () => {
    it('should display current branch name', async () => {
      vi.mocked(window.electronAPI.git).status.mockResolvedValue(createMockGitStatus({ current: 'feature-branch' }))

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText('feature-branch')).toBeInTheDocument()
      })
    })

    it('should display HEAD when no branch name', async () => {
      vi.mocked(window.electronAPI.git).status.mockResolvedValue(createMockGitStatus({ current: null }))

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText('HEAD')).toBeInTheDocument()
      })
    })

    it('should display tracking information', async () => {
      vi.mocked(window.electronAPI.git).status.mockResolvedValue(
        createMockGitStatus({ tracking: 'origin/feature-branch' })
      )

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText('origin/feature-branch')).toBeInTheDocument()
      })
    })

    it('should display ahead count', async () => {
      vi.mocked(window.electronAPI.git).status.mockResolvedValue(
        createMockGitStatus({ ahead: 3, behind: 0 })
      )

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText(/↑3/)).toBeInTheDocument()
      })
    })

    it('should display behind count', async () => {
      vi.mocked(window.electronAPI.git).status.mockResolvedValue(
        createMockGitStatus({ ahead: 0, behind: 2 })
      )

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText(/↓2/)).toBeInTheDocument()
      })
    })

    it('should display both ahead and behind counts', async () => {
      vi.mocked(window.electronAPI.git).status.mockResolvedValue(
        createMockGitStatus({ ahead: 3, behind: 2 })
      )

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText(/↑3/)).toBeInTheDocument()
        expect(screen.getByText(/↓2/)).toBeInTheDocument()
      })
    })
  })

  describe('Branch List', () => {
    it('should display list of branches', async () => {
      vi.mocked(window.electronAPI.git).branches.mockResolvedValue([
        createMockBranch({ name: 'main', current: true }),
        createMockBranch({ name: 'feature-1', current: false }),
        createMockBranch({ name: 'bugfix-2', current: false })
      ])

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText('● main')).toBeInTheDocument()
        expect(screen.getByText('○ feature-1')).toBeInTheDocument()
        expect(screen.getByText('○ bugfix-2')).toBeInTheDocument()
      })
    })

    it('should toggle branch list visibility', async () => {
      vi.mocked(window.electronAPI.git).branches.mockResolvedValue([createMockBranch()])

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText('● main')).toBeInTheDocument()
      })

      const toggleButton = screen.getByText('BRANCHES')
      fireEvent.click(toggleButton)

      expect(screen.queryByText('● main')).not.toBeInTheDocument()
    })

    it('should filter out remote branches', async () => {
      vi.mocked(window.electronAPI.git).branches.mockResolvedValue([
        createMockBranch({ name: 'main', current: true }),
        createMockBranch({ name: 'remotes/origin/main', current: false })
      ])

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText('● main')).toBeInTheDocument()
        expect(screen.queryByText(/remotes\/origin\/main/)).not.toBeInTheDocument()
      })
    })

    it('should checkout branch when clicked', async () => {
      vi.mocked(window.electronAPI.git).branches.mockResolvedValue([
        createMockBranch({ name: 'main', current: true }),
        createMockBranch({ name: 'feature-1', current: false })
      ])
      vi.mocked(window.electronAPI.git).checkout.mockResolvedValue(undefined)

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText('○ feature-1')).toBeInTheDocument()
      })

      const featureBranch = screen.getByText('○ feature-1')
      fireEvent.click(featureBranch)

      await waitFor(() => {
        expect(vi.mocked(window.electronAPI.git).checkout).toHaveBeenCalledWith(mockProjectPath, 'feature-1')
      })
    })

    it('should not checkout current branch when clicked', async () => {
      vi.mocked(window.electronAPI.git).branches.mockResolvedValue([
        createMockBranch({ name: 'main', current: true })
      ])

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText('● main')).toBeInTheDocument()
      })

      const mainBranch = screen.getByText('● main')
      fireEvent.click(mainBranch)

      expect(vi.mocked(window.electronAPI.git).checkout).not.toHaveBeenCalled()
    })
  })

  describe('File Changes Display', () => {
    it('should display staged files', async () => {
      const stagedFile: GitFileChange = { path: 'src/index.ts', status: 'modified' }
      vi.mocked(window.electronAPI.git).status.mockResolvedValue(
        createMockGitStatus({ staged: [stagedFile] })
      )

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText('STAGED (1)')).toBeInTheDocument()
        expect(screen.getByText('src/index.ts')).toBeInTheDocument()
      })
    })

    it('should display unstaged files', async () => {
      const unstagedFile: GitFileChange = { path: 'src/app.ts', status: 'modified' }
      vi.mocked(window.electronAPI.git).status.mockResolvedValue(
        createMockGitStatus({ unstaged: [unstagedFile] })
      )

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText('CHANGES (1)')).toBeInTheDocument()
        expect(screen.getByText('src/app.ts')).toBeInTheDocument()
      })
    })

    it('should display untracked files', async () => {
      vi.mocked(window.electronAPI.git).status.mockResolvedValue(
        createMockGitStatus({ untracked: ['new-file.ts'] })
      )

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText('UNTRACKED (1)')).toBeInTheDocument()
        expect(screen.getByText('new-file.ts')).toBeInTheDocument()
      })
    })

    it('should display status icon for modified files', async () => {
      const modifiedFile: GitFileChange = { path: 'file.ts', status: 'modified' }
      vi.mocked(window.electronAPI.git).status.mockResolvedValue(
        createMockGitStatus({ staged: [modifiedFile] })
      )

      const { container } = render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        const statusIcon = container.querySelector('.text-yellow-400')
        expect(statusIcon).toBeInTheDocument()
        expect(statusIcon?.textContent).toBe('M')
      })
    })

    it('should display status icon for added files', async () => {
      const addedFile: GitFileChange = { path: 'file.ts', status: 'added' }
      vi.mocked(window.electronAPI.git).status.mockResolvedValue(
        createMockGitStatus({ staged: [addedFile] })
      )

      const { container } = render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        const statusIcon = container.querySelector('.text-green-400')
        expect(statusIcon).toBeInTheDocument()
        expect(statusIcon?.textContent).toBe('A')
      })
    })

    it('should display status icon for deleted files', async () => {
      const deletedFile: GitFileChange = { path: 'file.ts', status: 'deleted' }
      vi.mocked(window.electronAPI.git).status.mockResolvedValue(
        createMockGitStatus({ staged: [deletedFile] })
      )

      const { container } = render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        const statusIcon = container.querySelector('.text-red-400')
        expect(statusIcon).toBeInTheDocument()
        expect(statusIcon?.textContent).toBe('D')
      })
    })

    it('should display working tree clean message when no changes', async () => {
      vi.mocked(window.electronAPI.git).status.mockResolvedValue(
        createMockGitStatus({ staged: [], unstaged: [], untracked: [] })
      )

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText('Working tree clean')).toBeInTheDocument()
      })
    })
  })

  describe('File Staging/Unstaging', () => {
    it('should stage a file when stage button is clicked', async () => {
      const unstagedFile: GitFileChange = { path: 'file.ts', status: 'modified' }
      vi.mocked(window.electronAPI.git).status.mockResolvedValue(
        createMockGitStatus({ unstaged: [unstagedFile] })
      )
      vi.mocked(window.electronAPI.git).stage.mockResolvedValue(undefined)

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText('file.ts')).toBeInTheDocument()
      })

      const fileElement = screen.getByText('file.ts').closest('.group')
      const stageButton = fileElement?.querySelector('button')
      expect(stageButton).toBeTruthy()
      fireEvent.click(stageButton!)

      await waitFor(() => {
        expect(vi.mocked(window.electronAPI.git).stage).toHaveBeenCalledWith(mockProjectPath, ['file.ts'])
      })
    })

    it('should unstage a file when unstage button is clicked', async () => {
      const stagedFile: GitFileChange = { path: 'file.ts', status: 'modified' }
      vi.mocked(window.electronAPI.git).status.mockResolvedValue(
        createMockGitStatus({ staged: [stagedFile] })
      )
      vi.mocked(window.electronAPI.git).unstage.mockResolvedValue(undefined)

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText('file.ts')).toBeInTheDocument()
      })

      const fileElement = screen.getByText('file.ts').closest('.group')
      const unstageButton = fileElement?.querySelector('button')
      expect(unstageButton).toBeTruthy()
      fireEvent.click(unstageButton!)

      await waitFor(() => {
        expect(vi.mocked(window.electronAPI.git).unstage).toHaveBeenCalledWith(mockProjectPath, ['file.ts'])
      })
    })

    it('should stage all files when "Stage All Changes" is clicked', async () => {
      const unstagedFile: GitFileChange = { path: 'file1.ts', status: 'modified' }
      vi.mocked(window.electronAPI.git).status.mockResolvedValue(
        createMockGitStatus({ unstaged: [unstagedFile], untracked: ['file2.ts'] })
      )
      vi.mocked(window.electronAPI.git).stage.mockResolvedValue(undefined)

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText('Stage All Changes')).toBeInTheDocument()
      })

      const stageAllButton = screen.getByText('Stage All Changes')
      fireEvent.click(stageAllButton)

      await waitFor(() => {
        expect(vi.mocked(window.electronAPI.git).stage).toHaveBeenCalledWith(mockProjectPath, ['file1.ts', 'file2.ts'])
      })
    })

    it('should unstage all files when "Unstage All" is clicked', async () => {
      const stagedFile1: GitFileChange = { path: 'file1.ts', status: 'modified' }
      const stagedFile2: GitFileChange = { path: 'file2.ts', status: 'added' }
      vi.mocked(window.electronAPI.git).status.mockResolvedValue(
        createMockGitStatus({ staged: [stagedFile1, stagedFile2] })
      )
      vi.mocked(window.electronAPI.git).unstage.mockResolvedValue(undefined)

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText('Unstage All')).toBeInTheDocument()
      })

      const unstageAllButton = screen.getByText('Unstage All')
      fireEvent.click(unstageAllButton)

      await waitFor(() => {
        expect(vi.mocked(window.electronAPI.git).unstage).toHaveBeenCalledWith(mockProjectPath, ['file1.ts', 'file2.ts'])
      })
    })

    it('should reload git data after staging', async () => {
      const unstagedFile: GitFileChange = { path: 'file.ts', status: 'modified' }
      vi.mocked(window.electronAPI.git).status.mockResolvedValue(
        createMockGitStatus({ unstaged: [unstagedFile] })
      )
      vi.mocked(window.electronAPI.git).stage.mockResolvedValue(undefined)

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText('file.ts')).toBeInTheDocument()
      })

      const callCountBefore = vi.mocked(window.electronAPI.git).status.mock.calls.length

      const fileElement = screen.getByText('file.ts').closest('.group')
      const stageButton = fileElement?.querySelector('button')
      expect(stageButton).toBeTruthy()
      fireEvent.click(stageButton!)

      await waitFor(() => {
        expect(vi.mocked(window.electronAPI.git).status.mock.calls.length).toBeGreaterThan(callCountBefore)
      })
    })
  })

  describe('Commit Functionality', () => {
    it('should enable commit button when message is entered and files are staged', async () => {
      const stagedFile: GitFileChange = { path: 'file.ts', status: 'modified' }
      vi.mocked(window.electronAPI.git).status.mockResolvedValue(
        createMockGitStatus({ staged: [stagedFile] })
      )

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText('file.ts')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText('Commit message...')
      fireEvent.change(textarea, { target: { value: 'Fix bug' } })

      const commitButton = screen.getByRole('button', { name: /^Commit$/i })
      expect(commitButton).not.toBeDisabled()
    })

    it('should disable commit button when message is empty', async () => {
      const stagedFile: GitFileChange = { path: 'file.ts', status: 'modified' }
      vi.mocked(window.electronAPI.git).status.mockResolvedValue(
        createMockGitStatus({ staged: [stagedFile] })
      )

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText('file.ts')).toBeInTheDocument()
      })

      const commitButton = screen.getByRole('button', { name: /^Commit$/i })
      expect(commitButton).toBeDisabled()
    })

    it('should disable commit button when no files are staged', async () => {
      vi.mocked(window.electronAPI.git).status.mockResolvedValue(
        createMockGitStatus({ staged: [] })
      )

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText('Working tree clean')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText('Commit message...')
      fireEvent.change(textarea, { target: { value: 'Fix bug' } })

      const commitButton = screen.getByRole('button', { name: /^Commit$/i })
      expect(commitButton).toBeDisabled()
    })

    it('should commit with message when commit button is clicked', async () => {
      const stagedFile: GitFileChange = { path: 'file.ts', status: 'modified' }
      vi.mocked(window.electronAPI.git).status.mockResolvedValue(
        createMockGitStatus({ staged: [stagedFile] })
      )
      vi.mocked(window.electronAPI.git).commit.mockResolvedValue(true)

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText('file.ts')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText('Commit message...')
      fireEvent.change(textarea, { target: { value: 'Fix bug' } })

      const commitButton = screen.getByRole('button', { name: /^Commit$/i })
      fireEvent.click(commitButton)

      await waitFor(() => {
        expect(vi.mocked(window.electronAPI.git).commit).toHaveBeenCalledWith(mockProjectPath, 'Fix bug')
      })
    })

    it('should clear commit message after successful commit', async () => {
      const stagedFile: GitFileChange = { path: 'file.ts', status: 'modified' }
      vi.mocked(window.electronAPI.git).status.mockResolvedValue(
        createMockGitStatus({ staged: [stagedFile] })
      )
      vi.mocked(window.electronAPI.git).commit.mockResolvedValue(true)

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText('file.ts')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText('Commit message...') as HTMLTextAreaElement
      fireEvent.change(textarea, { target: { value: 'Fix bug' } })

      const commitButton = screen.getByRole('button', { name: /^Commit$/i })
      fireEvent.click(commitButton)

      await waitFor(() => {
        expect(textarea.value).toBe('')
      })
    })

    it('should show committing state during commit', async () => {
      const stagedFile: GitFileChange = { path: 'file.ts', status: 'modified' }
      vi.mocked(window.electronAPI.git).status.mockResolvedValue(
        createMockGitStatus({ staged: [stagedFile] })
      )
      vi.mocked(window.electronAPI.git).commit.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(true), 100)))

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText('file.ts')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText('Commit message...')
      fireEvent.change(textarea, { target: { value: 'Fix bug' } })

      const commitButton = screen.getByRole('button', { name: /^Commit$/i })
      fireEvent.click(commitButton)

      expect(screen.getByText('Committing...')).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.getByText(/^Commit$/i)).toBeInTheDocument()
      })
    })

    it('should display error when commit fails', async () => {
      const stagedFile: GitFileChange = { path: 'file.ts', status: 'modified' }
      vi.mocked(window.electronAPI.git).status.mockResolvedValue(
        createMockGitStatus({ staged: [stagedFile] })
      )
      vi.mocked(window.electronAPI.git).commit.mockResolvedValue(false)

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText('file.ts')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText('Commit message...')
      fireEvent.change(textarea, { target: { value: 'Fix bug' } })

      const commitButton = screen.getByRole('button', { name: /^Commit$/i })
      fireEvent.click(commitButton)

      await waitFor(() => {
        expect(screen.getByText('Commit failed')).toBeInTheDocument()
      })
    })
  })

  describe('Pull/Push Operations', () => {
    it('should call pull when pull button is clicked', async () => {
      vi.mocked(window.electronAPI.git).pull.mockResolvedValue({ success: true, summary: '' })

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByTitle('Pull')).toBeInTheDocument()
      })

      const pullButton = screen.getByTitle('Pull')
      fireEvent.click(pullButton)

      await waitFor(() => {
        expect(vi.mocked(window.electronAPI.git).pull).toHaveBeenCalledWith(mockProjectPath)
      })
    })

    it('should call push when push button is clicked', async () => {
      vi.mocked(window.electronAPI.git).push.mockResolvedValue({ success: true, summary: '' })

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByTitle('Push')).toBeInTheDocument()
      })

      const pushButton = screen.getByTitle('Push')
      fireEvent.click(pushButton)

      await waitFor(() => {
        expect(vi.mocked(window.electronAPI.git).push).toHaveBeenCalledWith(mockProjectPath)
      })
    })

    it('should display error when pull fails', async () => {
      vi.mocked(window.electronAPI.git).pull.mockResolvedValue({ success: false, summary: 'Network error' })

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByTitle('Pull')).toBeInTheDocument()
      })

      const pullButton = screen.getByTitle('Pull')
      fireEvent.click(pullButton)

      await waitFor(() => {
        expect(vi.mocked(window.electronAPI.git).pull).toHaveBeenCalled()
      })

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      }, { timeout: 2000 })
    })

    it('should display error when push fails', async () => {
      vi.mocked(window.electronAPI.git).push.mockResolvedValue({ success: false, summary: 'Permission denied' })

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByTitle('Push')).toBeInTheDocument()
      })

      const pushButton = screen.getByTitle('Push')
      fireEvent.click(pushButton)

      await waitFor(() => {
        expect(vi.mocked(window.electronAPI.git).push).toHaveBeenCalled()
      })

      await waitFor(() => {
        expect(screen.getByText('Permission denied')).toBeInTheDocument()
      }, { timeout: 2000 })
    })

    it('should disable pull button while pulling', async () => {
      vi.mocked(window.electronAPI.git).pull.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ success: true, summary: '' }), 100)))

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByTitle('Pull')).toBeInTheDocument()
      })

      const pullButton = screen.getByTitle('Pull') as HTMLButtonElement
      fireEvent.click(pullButton)

      expect(pullButton).toBeDisabled()

      await waitFor(() => {
        expect(pullButton).not.toBeDisabled()
      })
    })

    it('should disable push button while pushing', async () => {
      vi.mocked(window.electronAPI.git).push.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ success: true, summary: '' }), 100)))

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByTitle('Push')).toBeInTheDocument()
      })

      const pushButton = screen.getByTitle('Push') as HTMLButtonElement
      fireEvent.click(pushButton)

      expect(pushButton).toBeDisabled()

      await waitFor(() => {
        expect(pushButton).not.toBeDisabled()
      })
    })
  })

  describe('Commit History Display', () => {
    it('should display list of commits in history tab', async () => {
      const commits = [
        createMockCommit({ message: 'First commit', hashShort: 'abc123' }),
        createMockCommit({ message: 'Second commit', hashShort: 'def456' })
      ]
      vi.mocked(window.electronAPI.git).log.mockResolvedValue(commits)

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText('First commit')).toBeInTheDocument()
        expect(screen.getByText('Second commit')).toBeInTheDocument()
      })
    })

    it('should display commit hash short version', async () => {
      const commits = [createMockCommit({ hashShort: 'abc123d' })]
      vi.mocked(window.electronAPI.git).log.mockResolvedValue(commits)

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText('abc123d')).toBeInTheDocument()
      })
    })

    it('should display commit author name', async () => {
      const commits = [createMockCommit({ authorName: 'Jane Smith' })]
      vi.mocked(window.electronAPI.git).log.mockResolvedValue(commits)

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText(/Jane Smith/)).toBeInTheDocument()
      })
    })

    it('should display relative commit date for recent commits', async () => {
      const recentDate = new Date(Date.now() - 30 * 60 * 1000).toISOString() // 30 mins ago
      const commits = [createMockCommit({ date: recentDate })]
      vi.mocked(window.electronAPI.git).log.mockResolvedValue(commits)

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText(/30 mins ago/)).toBeInTheDocument()
      })
    })

    it('should display "No commits yet" when repository is empty', async () => {
      vi.mocked(window.electronAPI.git).log.mockResolvedValue([])

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText('No commits yet')).toBeInTheDocument()
      })
    })

    it('should switch to history tab by default', async () => {
      vi.mocked(window.electronAPI.git).log.mockResolvedValue([createMockCommit()])

      const { container } = render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        const historyTab = container.querySelector('.border-purple-500')
        expect(historyTab?.textContent).toBe('History')
      })
    })
  })

  describe('Diff View', () => {
    it('should load and display diff when file is selected', async () => {
      const unstagedFile: GitFileChange = { path: 'file.ts', status: 'modified' }
      vi.mocked(window.electronAPI.git).status.mockResolvedValue(
        createMockGitStatus({ unstaged: [unstagedFile] })
      )
      vi.mocked(window.electronAPI.git).diff.mockResolvedValue('- old line\n+ new line')

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText('file.ts')).toBeInTheDocument()
      })

      const fileElement = screen.getByText('file.ts')
      fireEvent.click(fileElement)

      await waitFor(() => {
        expect(vi.mocked(window.electronAPI.git).diff).toHaveBeenCalledWith(mockProjectPath, 'file.ts')
        expect(screen.getByText(/- old line/)).toBeInTheDocument()
        expect(screen.getByText(/\+ new line/)).toBeInTheDocument()
      })
    })

    it('should switch to changes tab when file is selected', async () => {
      const unstagedFile: GitFileChange = { path: 'file.ts', status: 'modified' }
      vi.mocked(window.electronAPI.git).status.mockResolvedValue(
        createMockGitStatus({ unstaged: [unstagedFile] })
      )
      vi.mocked(window.electronAPI.git).diff.mockResolvedValue('diff content')

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText('file.ts')).toBeInTheDocument()
      })

      const fileElement = screen.getByText('file.ts')
      fireEvent.click(fileElement)

      await waitFor(() => {
        const changesTab = screen.getByText('Changes')
        expect(changesTab).toHaveClass('border-purple-500')
      }, { timeout: 2000 })
    })

    it('should display file path in diff header', async () => {
      const unstagedFile: GitFileChange = { path: 'src/components/App.tsx', status: 'modified' }
      vi.mocked(window.electronAPI.git).status.mockResolvedValue(
        createMockGitStatus({ unstaged: [unstagedFile] })
      )
      vi.mocked(window.electronAPI.git).diff.mockResolvedValue('diff content')

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText('src/components/App.tsx')).toBeInTheDocument()
      })

      const fileElement = screen.getByText('src/components/App.tsx')
      fireEvent.click(fileElement)

      await waitFor(() => {
        const diffHeaders = screen.getAllByText('src/components/App.tsx')
        expect(diffHeaders.length).toBeGreaterThan(1)
      })
    })

    it('should close diff view when X button is clicked', async () => {
      const unstagedFile: GitFileChange = { path: 'file.ts', status: 'modified' }
      vi.mocked(window.electronAPI.git).status.mockResolvedValue(
        createMockGitStatus({ unstaged: [unstagedFile] })
      )
      vi.mocked(window.electronAPI.git).diff.mockResolvedValue('diff content')

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText('file.ts')).toBeInTheDocument()
      })

      const fileElement = screen.getByText('file.ts')
      fireEvent.click(fileElement)

      await waitFor(() => {
        expect(screen.getByText('diff content')).toBeInTheDocument()
      })

      // Find the close button in the diff header
      const diffHeader = screen.getByText('file.ts', { selector: '.text-sm.text-zinc-300.font-mono' })
      const closeButton = diffHeader.parentElement?.querySelector('button')
      expect(closeButton).toBeTruthy()
      fireEvent.click(closeButton!)

      await waitFor(() => {
        expect(screen.getByText('Select a file to view changes')).toBeInTheDocument()
      }, { timeout: 2000 })
    })

    it('should show "Select a file to view changes" when no file is selected', async () => {
      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        const changesTab = screen.getByText('Changes')
        fireEvent.click(changesTab)
      })

      expect(screen.getByText('Select a file to view changes')).toBeInTheDocument()
    })

    it('should display "No changes to display" when diff is empty', async () => {
      const unstagedFile: GitFileChange = { path: 'file.ts', status: 'modified' }
      vi.mocked(window.electronAPI.git).status.mockResolvedValue(
        createMockGitStatus({ unstaged: [unstagedFile] })
      )
      vi.mocked(window.electronAPI.git).diff.mockResolvedValue('')

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText('file.ts')).toBeInTheDocument()
      })

      const fileElement = screen.getByText('file.ts')
      fireEvent.click(fileElement)

      await waitFor(() => {
        expect(screen.getByText('No changes to display')).toBeInTheDocument()
      })
    })
  })

  describe('Tab Navigation', () => {
    it('should switch between history and changes tabs', async () => {
      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText('History')).toBeInTheDocument()
      })

      const changesTab = screen.getByText('Changes')
      fireEvent.click(changesTab)

      expect(screen.getByText('Select a file to view changes')).toBeInTheDocument()

      const historyTab = screen.getByText('History')
      fireEvent.click(historyTab)

      expect(screen.getByText('No commits yet')).toBeInTheDocument()
    })

    it('should highlight active tab', async () => {
      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        const historyTab = screen.getByText('History')
        expect(historyTab).toHaveClass('border-purple-500')
      })

      const changesTab = screen.getByText('Changes')
      fireEvent.click(changesTab)

      await waitFor(() => {
        expect(changesTab).toHaveClass('border-purple-500')
        expect(screen.getByText('History')).not.toHaveClass('border-purple-500')
      }, { timeout: 2000 })
    })
  })

  describe('Refresh Functionality', () => {
    it('should reload git data when refresh button is clicked', async () => {
      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByTitle('Refresh')).toBeInTheDocument()
      })

      const callCountBefore = vi.mocked(window.electronAPI.git).status.mock.calls.length

      const refreshButton = screen.getByTitle('Refresh')
      fireEvent.click(refreshButton)

      await waitFor(() => {
        expect(vi.mocked(window.electronAPI.git).status.mock.calls.length).toBeGreaterThan(callCountBefore)
      })
    })

    it('should reload git data when currentProject changes', async () => {
      const { rerender } = render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(vi.mocked(window.electronAPI.git).status).toHaveBeenCalled()
      })

      const callCountBefore = vi.mocked(window.electronAPI.git).status.mock.calls.length

      vi.mocked(useAppStore).mockReturnValue({
        currentProject: {
          id: 'project-2',
          name: 'Different Project',
          path: '/different/path',
          createdAt: new Date(),
          lastOpenedAt: new Date()
        }
      } as any)

      rerender(<GitPanel projectPath="/different/path" />)

      await waitFor(() => {
        expect(vi.mocked(window.electronAPI.git).status.mock.calls.length).toBeGreaterThan(callCountBefore)
      })
    })
  })

  describe('Error Handling', () => {
    it('should display error when git operations fail', async () => {
      vi.mocked(window.electronAPI.git).status.mockRejectedValue(new Error('Git error'))

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText('Failed to load git data')).toBeInTheDocument()
      }, { timeout: 2000 })
    })

    it('should display error when staging fails', async () => {
      const unstagedFile: GitFileChange = { path: 'file.ts', status: 'modified' }
      vi.mocked(window.electronAPI.git).status.mockResolvedValue(
        createMockGitStatus({ unstaged: [unstagedFile] })
      )
      vi.mocked(window.electronAPI.git).stage.mockRejectedValue(new Error('Stage failed'))

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText('file.ts')).toBeInTheDocument()
      })

      const fileElement = screen.getByText('file.ts').closest('.group')
      const stageButton = fileElement?.querySelector('button')
      expect(stageButton).toBeTruthy()
      fireEvent.click(stageButton!)

      await waitFor(() => {
        expect(screen.getByText('Failed to stage files')).toBeInTheDocument()
      })
    })

    it('should display error when unstaging fails', async () => {
      const stagedFile: GitFileChange = { path: 'file.ts', status: 'modified' }
      vi.mocked(window.electronAPI.git).status.mockResolvedValue(
        createMockGitStatus({ staged: [stagedFile] })
      )
      vi.mocked(window.electronAPI.git).unstage.mockRejectedValue(new Error('Unstage failed'))

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText('file.ts')).toBeInTheDocument()
      })

      const fileElement = screen.getByText('file.ts').closest('.group')
      const unstageButton = fileElement?.querySelector('button')
      expect(unstageButton).toBeTruthy()
      fireEvent.click(unstageButton!)

      await waitFor(() => {
        expect(screen.getByText('Failed to unstage files')).toBeInTheDocument()
      })
    })

    it('should display error when checkout fails', async () => {
      vi.mocked(window.electronAPI.git).branches.mockResolvedValue([
        createMockBranch({ name: 'main', current: true }),
        createMockBranch({ name: 'feature-1', current: false })
      ])
      vi.mocked(window.electronAPI.git).checkout.mockRejectedValue(new Error('Checkout failed'))

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText('○ feature-1')).toBeInTheDocument()
      })

      const featureBranch = screen.getByText('○ feature-1')
      fireEvent.click(featureBranch)

      await waitFor(() => {
        expect(screen.getByText('Failed to checkout branch')).toBeInTheDocument()
      })
    })
  })

  describe('Loading State', () => {
    it('should show loading state initially', async () => {
      vi.mocked(window.electronAPI.git).status.mockImplementation(() => new Promise(() => {})) // Never resolves
      vi.mocked(window.electronAPI.git).log.mockImplementation(() => new Promise(() => {})) // Never resolves
      vi.mocked(window.electronAPI.git).branches.mockImplementation(() => new Promise(() => {})) // Never resolves

      render(<GitPanel projectPath={mockProjectPath} />)

      await waitFor(() => {
        expect(screen.getByText('Loading commits...')).toBeInTheDocument()
      }, { timeout: 2000 })
    })
  })

  describe('Project Context', () => {
    it('should not render when currentProject is null', () => {
      vi.mocked(useAppStore).mockReturnValue({
        currentProject: null
      } as any)

      const { container } = render(<GitPanel projectPath={mockProjectPath} />)

      // Component should not load git data without a project
      expect(vi.mocked(window.electronAPI.git).status).not.toHaveBeenCalled()
    })
  })
})
