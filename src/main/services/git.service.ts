import simpleGit, { SimpleGit, StatusResult, LogResult, BranchSummary } from 'simple-git'
import type { GitStatus, GitCommit, GitBranch, GitFileChange, GitFileStatus } from '@shared/types'

class GitService {
  private instances: Map<string, SimpleGit> = new Map()

  private getGit(projectPath: string): SimpleGit {
    if (!this.instances.has(projectPath)) {
      this.instances.set(projectPath, simpleGit(projectPath))
    }
    return this.instances.get(projectPath)!
  }

  /**
   * Check if directory is a git repository and get status
   */
  async getStatus(projectPath: string): Promise<GitStatus> {
    const git = this.getGit(projectPath)

    try {
      const status: StatusResult = await git.status()

      // Parse staged files
      const staged: GitFileChange[] = [
        ...status.staged.map((path) => ({ path, status: 'added' as GitFileStatus })),
        ...status.renamed
          .filter((r) => status.staged.includes(r.to))
          .map((r) => ({ path: `${r.from} → ${r.to}`, status: 'renamed' as GitFileStatus }))
      ]

      // Handle modified files in staging
      status.files.forEach((file) => {
        if (file.index === 'M' && !staged.find((s) => s.path === file.path)) {
          staged.push({ path: file.path, status: 'modified' })
        } else if (file.index === 'D' && !staged.find((s) => s.path === file.path)) {
          staged.push({ path: file.path, status: 'deleted' })
        } else if (file.index === 'A' && !staged.find((s) => s.path === file.path)) {
          staged.push({ path: file.path, status: 'added' })
        }
      })

      // Parse unstaged files (modified in working directory)
      const unstaged: GitFileChange[] = status.modified
        .filter((path) => !status.staged.includes(path))
        .map((path) => ({ path, status: 'modified' as GitFileStatus }))

      // Add deleted files to unstaged
      status.deleted.forEach((path) => {
        if (!staged.find((s) => s.path === path)) {
          unstaged.push({ path, status: 'deleted' })
        }
      })

      return {
        isRepo: true,
        current: status.current,
        tracking: status.tracking,
        ahead: status.ahead,
        behind: status.behind,
        staged,
        unstaged,
        untracked: status.not_added
      }
    } catch (error) {
      // Not a git repository
      return {
        isRepo: false,
        current: null,
        tracking: null,
        ahead: 0,
        behind: 0,
        staged: [],
        unstaged: [],
        untracked: []
      }
    }
  }

  /**
   * Get commit history
   */
  async getLog(projectPath: string, limit: number = 50): Promise<GitCommit[]> {
    const git = this.getGit(projectPath)

    try {
      const log: LogResult = await git.log({ maxCount: limit })

      return log.all.map((commit) => ({
        hash: commit.hash,
        hashShort: commit.hash.substring(0, 7),
        date: commit.date,
        message: commit.message,
        authorName: commit.author_name,
        authorEmail: commit.author_email,
        body: commit.body || undefined
      }))
    } catch {
      return []
    }
  }

  /**
   * Get all branches
   */
  async getBranches(projectPath: string): Promise<GitBranch[]> {
    const git = this.getGit(projectPath)

    try {
      const branches: BranchSummary = await git.branch(['-a', '-v'])

      return Object.entries(branches.branches).map(([name, info]) => ({
        name: name.replace(/^remotes\//, ''),
        current: info.current,
        commit: info.commit,
        tracking: info.linkedWorkTree || undefined
      }))
    } catch {
      return []
    }
  }

  /**
   * Checkout a branch
   */
  async checkout(projectPath: string, branch: string): Promise<boolean> {
    const git = this.getGit(projectPath)

    try {
      await git.checkout(branch)
      return true
    } catch (error) {
      console.error('Git checkout failed:', error)
      return false
    }
  }

  /**
   * Stage files
   */
  async stage(projectPath: string, files: string[]): Promise<boolean> {
    const git = this.getGit(projectPath)

    try {
      await git.add(files)
      return true
    } catch (error) {
      console.error('Git stage failed:', error)
      return false
    }
  }

  /**
   * Unstage files
   */
  async unstage(projectPath: string, files: string[]): Promise<boolean> {
    const git = this.getGit(projectPath)

    try {
      await git.reset(['HEAD', '--', ...files])
      return true
    } catch (error) {
      console.error('Git unstage failed:', error)
      return false
    }
  }

  /**
   * Create a commit
   */
  async commit(projectPath: string, message: string): Promise<boolean> {
    const git = this.getGit(projectPath)

    try {
      await git.commit(message)
      return true
    } catch (error) {
      console.error('Git commit failed:', error)
      return false
    }
  }

  /**
   * Get diff for a file or all changes
   */
  async getDiff(projectPath: string, file?: string): Promise<string> {
    const git = this.getGit(projectPath)

    try {
      if (file) {
        return await git.diff([file])
      }
      return await git.diff()
    } catch {
      return ''
    }
  }

  /**
   * Pull from remote
   */
  async pull(projectPath: string): Promise<{ success: boolean; summary: string }> {
    const git = this.getGit(projectPath)

    try {
      const result = await git.pull()
      const summary = result.summary
        ? `${result.summary.changes} changes, ${result.summary.insertions} insertions, ${result.summary.deletions} deletions`
        : 'Already up to date'
      return { success: true, summary }
    } catch (error) {
      return { success: false, summary: String(error) }
    }
  }

  /**
   * Push to remote
   */
  async push(projectPath: string): Promise<{ success: boolean; summary: string }> {
    const git = this.getGit(projectPath)

    try {
      await git.push()
      return { success: true, summary: 'Pushed successfully' }
    } catch (error) {
      return { success: false, summary: String(error) }
    }
  }

  /**
   * Clear cached git instance for a project
   */
  clearCache(projectPath: string): void {
    this.instances.delete(projectPath)
  }
}

export const gitService = new GitService()
