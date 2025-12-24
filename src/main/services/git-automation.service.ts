import simpleGit, { SimpleGit } from 'simple-git'
import { EventEmitter } from 'events'
import { gitService } from './git.service'

export interface BranchInfo {
  name: string
  commit: string
  isRemote: boolean
  upstream?: string
}

export interface MergeResult {
  success: boolean
  mergedCommit?: string
  conflicts?: string[]
  message: string
}

export interface TagInfo {
  name: string
  commit: string
  message?: string
  createdAt?: string
}

export interface PullRequestInfo {
  title: string
  body: string
  sourceBranch: string
  targetBranch: string
  files: string[]
  commits: number
}

class GitAutomationService extends EventEmitter {
  private instances: Map<string, SimpleGit> = new Map()

  private getGit(projectPath: string): SimpleGit {
    if (!this.instances.has(projectPath)) {
      this.instances.set(projectPath, simpleGit(projectPath))
    }
    return this.instances.get(projectPath)!
  }

  // ============ Branch Operations ============

  /**
   * Create a new branch from current HEAD or specified base
   */
  async createBranch(
    projectPath: string,
    branchName: string,
    baseBranch?: string
  ): Promise<{ success: boolean; message: string }> {
    const git = this.getGit(projectPath)

    try {
      if (baseBranch) {
        // Create from specified base
        await git.checkoutBranch(branchName, baseBranch)
      } else {
        // Create from current HEAD
        await git.checkoutLocalBranch(branchName)
      }

      this.emit('branch-created', { projectPath, branchName, baseBranch })
      return { success: true, message: `Created and switched to branch '${branchName}'` }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { success: false, message }
    }
  }

  /**
   * Create a feature branch with naming convention
   */
  async createFeatureBranch(
    projectPath: string,
    featureName: string,
    baseBranch: string = 'main'
  ): Promise<{ success: boolean; branchName: string; message: string }> {
    const sanitized = featureName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    const branchName = `feature/${sanitized}`
    const result = await this.createBranch(projectPath, branchName, baseBranch)

    return { ...result, branchName }
  }

  /**
   * Create a release branch
   */
  async createReleaseBranch(
    projectPath: string,
    version: string,
    baseBranch: string = 'main'
  ): Promise<{ success: boolean; branchName: string; message: string }> {
    const branchName = `release/${version}`
    const result = await this.createBranch(projectPath, branchName, baseBranch)

    return { ...result, branchName }
  }

  /**
   * Create a hotfix branch
   */
  async createHotfixBranch(
    projectPath: string,
    hotfixName: string,
    baseBranch: string = 'main'
  ): Promise<{ success: boolean; branchName: string; message: string }> {
    const sanitized = hotfixName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')

    const branchName = `hotfix/${sanitized}`
    const result = await this.createBranch(projectPath, branchName, baseBranch)

    return { ...result, branchName }
  }

  /**
   * Delete a branch (local and optionally remote)
   */
  async deleteBranch(
    projectPath: string,
    branchName: string,
    deleteRemote: boolean = false
  ): Promise<{ success: boolean; message: string }> {
    const git = this.getGit(projectPath)

    try {
      // Delete local branch
      await git.deleteLocalBranch(branchName, true)

      // Delete remote if requested
      if (deleteRemote) {
        try {
          await git.push('origin', `:${branchName}`)
        } catch {
          // Remote might not exist, that's okay
        }
      }

      this.emit('branch-deleted', { projectPath, branchName, deleteRemote })
      return { success: true, message: `Deleted branch '${branchName}'` }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { success: false, message }
    }
  }

  /**
   * Rename a branch
   */
  async renameBranch(
    projectPath: string,
    oldName: string,
    newName: string
  ): Promise<{ success: boolean; message: string }> {
    const git = this.getGit(projectPath)

    try {
      await git.raw(['branch', '-m', oldName, newName])
      return { success: true, message: `Renamed branch '${oldName}' to '${newName}'` }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { success: false, message }
    }
  }

  // ============ Merge Operations ============

  /**
   * Merge a branch into the current branch
   */
  async mergeBranch(
    projectPath: string,
    sourceBranch: string,
    options: {
      noFastForward?: boolean
      squash?: boolean
      message?: string
    } = {}
  ): Promise<MergeResult> {
    const git = this.getGit(projectPath)

    try {
      const args: string[] = [sourceBranch]

      if (options.noFastForward) {
        args.unshift('--no-ff')
      }
      if (options.squash) {
        args.unshift('--squash')
      }
      if (options.message) {
        args.unshift('-m', options.message)
      }

      const result = await git.merge(args)

      this.emit('branch-merged', { projectPath, sourceBranch, result })

      return {
        success: true,
        mergedCommit: result.commit || undefined,
        message: result.result || 'Merge successful'
      }
    } catch (error: any) {
      // Check for merge conflicts
      if (error.git?.conflicts) {
        return {
          success: false,
          conflicts: error.git.conflicts,
          message: 'Merge conflicts detected'
        }
      }

      return {
        success: false,
        message: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Merge a branch into another branch (checkout target, merge source, return to original)
   */
  async mergeBranchInto(
    projectPath: string,
    sourceBranch: string,
    targetBranch: string,
    options: {
      noFastForward?: boolean
      squash?: boolean
      message?: string
    } = {}
  ): Promise<MergeResult> {
    const git = this.getGit(projectPath)

    try {
      // Get current branch to return to
      const status = await gitService.getStatus(projectPath)
      const originalBranch = status.current

      // Checkout target branch
      await git.checkout(targetBranch)

      // Perform merge
      const result = await this.mergeBranch(projectPath, sourceBranch, options)

      // Return to original branch if different
      if (originalBranch && originalBranch !== targetBranch) {
        await git.checkout(originalBranch)
      }

      return result
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Abort an ongoing merge
   */
  async abortMerge(projectPath: string): Promise<{ success: boolean; message: string }> {
    const git = this.getGit(projectPath)

    try {
      await git.merge(['--abort'])
      return { success: true, message: 'Merge aborted' }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error)
      }
    }
  }

  // ============ Tag Operations ============

  /**
   * Create a tag
   */
  async createTag(
    projectPath: string,
    tagName: string,
    options: {
      message?: string
      annotated?: boolean
      commit?: string
    } = {}
  ): Promise<{ success: boolean; message: string }> {
    const git = this.getGit(projectPath)

    try {
      const args: string[] = [tagName]

      if (options.annotated || options.message) {
        args.unshift('-a')
        if (options.message) {
          args.push('-m', options.message)
        }
      }

      if (options.commit) {
        args.push(options.commit)
      }

      await git.tag(args)

      this.emit('tag-created', { projectPath, tagName, options })
      return { success: true, message: `Created tag '${tagName}'` }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Create a semantic version tag
   */
  async createVersionTag(
    projectPath: string,
    version: string,
    message?: string
  ): Promise<{ success: boolean; tagName: string; message: string }> {
    const tagName = version.startsWith('v') ? version : `v${version}`
    const result = await this.createTag(projectPath, tagName, {
      annotated: true,
      message: message || `Release ${tagName}`
    })

    return { ...result, tagName }
  }

  /**
   * Delete a tag
   */
  async deleteTag(
    projectPath: string,
    tagName: string,
    deleteRemote: boolean = false
  ): Promise<{ success: boolean; message: string }> {
    const git = this.getGit(projectPath)

    try {
      await git.tag(['-d', tagName])

      if (deleteRemote) {
        try {
          await git.push('origin', `:refs/tags/${tagName}`)
        } catch {
          // Remote might not have this tag
        }
      }

      return { success: true, message: `Deleted tag '${tagName}'` }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * List all tags
   */
  async listTags(projectPath: string): Promise<TagInfo[]> {
    const git = this.getGit(projectPath)

    try {
      const tags = await git.tags()

      const tagInfos: TagInfo[] = []
      for (const tag of tags.all) {
        try {
          const show = await git.raw(['show', tag, '--quiet', '--format=%H%n%s%n%ai'])
          const [commit, message, date] = show.split('\n')
          tagInfos.push({
            name: tag,
            commit: commit?.trim() || '',
            message: message?.trim(),
            createdAt: date?.trim()
          })
        } catch {
          tagInfos.push({ name: tag, commit: '' })
        }
      }

      return tagInfos
    } catch {
      return []
    }
  }

  /**
   * Push tags to remote
   */
  async pushTags(
    projectPath: string,
    tagName?: string
  ): Promise<{ success: boolean; message: string }> {
    const git = this.getGit(projectPath)

    try {
      if (tagName) {
        await git.push('origin', tagName)
      } else {
        await git.pushTags('origin')
      }

      return { success: true, message: tagName ? `Pushed tag '${tagName}'` : 'Pushed all tags' }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error)
      }
    }
  }

  // ============ Commit Operations ============

  /**
   * Commit changes with agent attribution
   */
  async commitAgentChanges(
    projectPath: string,
    message: string,
    options: {
      taskId?: string
      agentType?: string
      files?: string[]
    } = {}
  ): Promise<{ success: boolean; commitHash?: string; message: string }> {
    const git = this.getGit(projectPath)

    try {
      // Stage files if specified, otherwise stage all
      if (options.files && options.files.length > 0) {
        await git.add(options.files)
      } else {
        await git.add('.')
      }

      // Check if there are changes to commit
      const status = await git.status()
      if (status.staged.length === 0) {
        return { success: false, message: 'No changes to commit' }
      }

      // Build commit message with metadata
      let fullMessage = message
      if (options.taskId || options.agentType) {
        fullMessage += '\n\n'
        if (options.taskId) {
          fullMessage += `Task-ID: ${options.taskId}\n`
        }
        if (options.agentType) {
          fullMessage += `Agent: ${options.agentType}\n`
        }
        fullMessage += 'Automated-Commit: true'
      }

      const result = await git.commit(fullMessage)

      this.emit('commit-created', {
        projectPath,
        commitHash: result.commit,
        message: fullMessage,
        taskId: options.taskId,
        agentType: options.agentType
      })

      return {
        success: true,
        commitHash: result.commit,
        message: `Created commit ${result.commit}`
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Amend the last commit
   */
  async amendCommit(
    projectPath: string,
    newMessage?: string
  ): Promise<{ success: boolean; commitHash?: string; message: string }> {
    const git = this.getGit(projectPath)

    try {
      const args = ['--amend', '--no-edit']
      if (newMessage) {
        args[1] = '-m'
        args.push(newMessage)
      }

      await git.commit(newMessage || '', args)
      const log = await git.log({ maxCount: 1 })

      return {
        success: true,
        commitHash: log.latest?.hash,
        message: 'Commit amended'
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Cherry-pick a commit
   */
  async cherryPick(
    projectPath: string,
    commitHash: string
  ): Promise<{ success: boolean; message: string }> {
    const git = this.getGit(projectPath)

    try {
      await git.raw(['cherry-pick', commitHash])
      return { success: true, message: `Cherry-picked commit ${commitHash}` }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error)
      }
    }
  }

  // ============ Remote Operations ============

  /**
   * Fetch from remote
   */
  async fetch(
    projectPath: string,
    options: {
      remote?: string
      prune?: boolean
      tags?: boolean
    } = {}
  ): Promise<{ success: boolean; message: string }> {
    const git = this.getGit(projectPath)

    try {
      const args: string[] = []
      if (options.prune) args.push('--prune')
      if (options.tags) args.push('--tags')

      await git.fetch(options.remote || 'origin', undefined, args)

      return { success: true, message: 'Fetch completed' }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Push current branch to remote with upstream tracking
   */
  async pushWithUpstream(
    projectPath: string,
    branchName?: string,
    remote: string = 'origin'
  ): Promise<{ success: boolean; message: string }> {
    const git = this.getGit(projectPath)

    try {
      const status = await gitService.getStatus(projectPath)
      const branch = branchName || status.current

      if (!branch) {
        return { success: false, message: 'No branch to push' }
      }

      await git.push(remote, branch, ['--set-upstream'])

      return { success: true, message: `Pushed ${branch} to ${remote}` }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error)
      }
    }
  }

  // ============ PR Preparation ============

  /**
   * Prepare pull request information
   */
  async preparePullRequest(
    projectPath: string,
    sourceBranch: string,
    targetBranch: string = 'main'
  ): Promise<PullRequestInfo | null> {
    const git = this.getGit(projectPath)

    try {
      // Get commits between branches
      const log = await git.log({ from: targetBranch, to: sourceBranch })

      // Get changed files
      const diff = await git.diff([`${targetBranch}...${sourceBranch}`, '--name-only'])
      const files = diff.split('\n').filter(Boolean)

      // Generate title from branch name
      const branchParts = sourceBranch.split('/')
      const titleFromBranch = branchParts[branchParts.length - 1]
        .replace(/-/g, ' ')
        .replace(/^\w/, c => c.toUpperCase())

      // Generate body from commits
      const commitMessages = log.all.map(c => `- ${c.message}`).join('\n')

      return {
        title: titleFromBranch,
        body: `## Changes\n\n${commitMessages}\n\n## Files Changed\n\n${files.map(f => `- ${f}`).join('\n')}`,
        sourceBranch,
        targetBranch,
        files,
        commits: log.total
      }
    } catch {
      return null
    }
  }

  /**
   * Check if branch is up to date with another branch
   */
  async isBranchUpToDate(
    projectPath: string,
    branch: string,
    compareTo: string = 'origin/main'
  ): Promise<{ upToDate: boolean; behind: number; ahead: number }> {
    const git = this.getGit(projectPath)

    try {
      // Fetch first to ensure we have latest remote info
      await git.fetch('origin')

      const result = await git.raw(['rev-list', '--left-right', '--count', `${compareTo}...${branch}`])
      const [behind, ahead] = result.trim().split('\t').map(Number)

      return {
        upToDate: behind === 0,
        behind: behind || 0,
        ahead: ahead || 0
      }
    } catch {
      return { upToDate: false, behind: 0, ahead: 0 }
    }
  }

  /**
   * Rebase current branch onto another
   */
  async rebase(
    projectPath: string,
    ontoBranch: string
  ): Promise<{ success: boolean; message: string }> {
    const git = this.getGit(projectPath)

    try {
      await git.rebase([ontoBranch])
      return { success: true, message: `Rebased onto ${ontoBranch}` }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Abort an ongoing rebase
   */
  async abortRebase(projectPath: string): Promise<{ success: boolean; message: string }> {
    const git = this.getGit(projectPath)

    try {
      await git.rebase(['--abort'])
      return { success: true, message: 'Rebase aborted' }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Clear cached git instance
   */
  clearCache(projectPath: string): void {
    this.instances.delete(projectPath)
  }
}

export const gitAutomationService = new GitAutomationService()
