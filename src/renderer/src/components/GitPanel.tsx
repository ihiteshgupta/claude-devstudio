import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '../stores/appStore'
import type { GitStatus, GitCommit, GitBranch, GitFileChange } from '@shared/types'
import {
  FolderX,
  GitBranch as GitBranchIcon,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  X,
  ArrowDown,
  ArrowUp
} from 'lucide-react'

interface GitPanelProps {
  projectPath: string
}

const STATUS_COLORS: Record<string, string> = {
  added: 'text-green-400',
  modified: 'text-yellow-400',
  deleted: 'text-red-400',
  renamed: 'text-blue-400',
  untracked: 'text-zinc-400'
}

const STATUS_ICONS: Record<string, string> = {
  added: 'A',
  modified: 'M',
  deleted: 'D',
  renamed: 'R',
  untracked: '?'
}

type TabType = 'history' | 'changes'

export function GitPanel({ projectPath }: GitPanelProps): JSX.Element {
  const { currentProject } = useAppStore()

  const [status, setStatus] = useState<GitStatus | null>(null)
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [branches, setBranches] = useState<GitBranch[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('history')
  const [commitMessage, setCommitMessage] = useState('')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [diff, setDiff] = useState<string>('')
  const [isCommitting, setIsCommitting] = useState(false)
  const [isPulling, setIsPulling] = useState(false)
  const [isPushing, setIsPushing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showBranches, setShowBranches] = useState(true)

  // Load git data
  const loadGitData = useCallback(async () => {
    if (!currentProject) return
    setIsLoading(true)
    setError(null)

    try {
      const [gitStatus, gitCommits, gitBranches] = await Promise.all([
        window.electronAPI.git.status(projectPath),
        window.electronAPI.git.log(projectPath, 50),
        window.electronAPI.git.branches(projectPath)
      ])

      setStatus(gitStatus)
      setCommits(gitCommits)
      setBranches(gitBranches)
    } catch (err) {
      setError('Failed to load git data')
      console.error('Failed to load git data:', err)
    } finally {
      setIsLoading(false)
    }
  }, [currentProject, projectPath])

  useEffect(() => {
    loadGitData()
  }, [loadGitData])

  // Load diff when file is selected
  useEffect(() => {
    const loadDiff = async (): Promise<void> => {
      if (!selectedFile) {
        setDiff('')
        return
      }
      try {
        const fileDiff = await window.electronAPI.git.diff(projectPath, selectedFile)
        setDiff(fileDiff)
        setActiveTab('changes')
      } catch {
        setDiff('')
      }
    }
    loadDiff()
  }, [selectedFile, projectPath])

  // Stage files
  const handleStage = async (files: string[]): Promise<void> => {
    try {
      await window.electronAPI.git.stage(projectPath, files)
      loadGitData()
    } catch {
      setError('Failed to stage files')
    }
  }

  // Unstage files
  const handleUnstage = async (files: string[]): Promise<void> => {
    try {
      await window.electronAPI.git.unstage(projectPath, files)
      loadGitData()
    } catch {
      setError('Failed to unstage files')
    }
  }

  // Commit
  const handleCommit = async (): Promise<void> => {
    if (!commitMessage.trim()) return
    setIsCommitting(true)
    setError(null)

    try {
      const success = await window.electronAPI.git.commit(projectPath, commitMessage)
      if (success) {
        setCommitMessage('')
        loadGitData()
      } else {
        setError('Commit failed')
      }
    } catch {
      setError('Failed to commit')
    } finally {
      setIsCommitting(false)
    }
  }

  // Pull
  const handlePull = async (): Promise<void> => {
    setIsPulling(true)
    setError(null)

    try {
      const result = await window.electronAPI.git.pull(projectPath)
      if (!result.success) {
        setError(result.summary)
      } else {
        loadGitData()
      }
    } catch {
      setError('Failed to pull')
    } finally {
      setIsPulling(false)
    }
  }

  // Push
  const handlePush = async (): Promise<void> => {
    setIsPushing(true)
    setError(null)

    try {
      const result = await window.electronAPI.git.push(projectPath)
      if (!result.success) {
        setError(result.summary)
      } else {
        loadGitData()
      }
    } catch {
      setError('Failed to push')
    } finally {
      setIsPushing(false)
    }
  }

  // Checkout branch
  const handleCheckout = async (branch: string): Promise<void> => {
    try {
      await window.electronAPI.git.checkout(projectPath, branch)
      loadGitData()
    } catch {
      setError('Failed to checkout branch')
    }
  }

  // Stage all
  const handleStageAll = async (): Promise<void> => {
    if (!status) return
    const allFiles = [
      ...status.unstaged.map((f) => f.path),
      ...status.untracked
    ]
    if (allFiles.length > 0) {
      await handleStage(allFiles)
    }
  }

  // File change item component
  const FileChangeItem = ({
    file,
    isStaged,
    isUntracked
  }: {
    file: GitFileChange | string
    isStaged: boolean
    isUntracked?: boolean
  }): JSX.Element => {
    const path = typeof file === 'string' ? file : file.path
    const fileStatus = isUntracked ? 'untracked' : typeof file === 'string' ? 'untracked' : file.status

    return (
      <div
        className="flex items-center justify-between px-2 py-1 hover:bg-zinc-800 rounded cursor-pointer group"
        onClick={() => setSelectedFile(path)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-xs font-mono w-4 ${STATUS_COLORS[fileStatus]}`}>
            {STATUS_ICONS[fileStatus]}
          </span>
          <span
            className={`text-sm truncate ${selectedFile === path ? 'text-purple-400' : 'text-zinc-300'}`}
            title={path}
          >
            {path}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            isStaged ? handleUnstage([path]) : handleStage([path])
          }}
          className="opacity-0 group-hover:opacity-100 text-xs text-zinc-400 hover:text-white px-1.5 py-0.5 bg-zinc-700 rounded transition-opacity"
        >
          {isStaged ? '−' : '+'}
        </button>
      </div>
    )
  }

  if (!status?.isRepo) {
    return (
      <div className="flex flex-1 h-full bg-zinc-950 items-center justify-center">
        <div className="text-center">
          <FolderX className="w-12 h-12 mx-auto mb-4 text-zinc-600" />
          {isLoading ? (
            <p className="text-zinc-500">Loading commits...</p>
          ) : error ? (
            <p className="text-red-400 mb-2">{error}</p>
          ) : (
            <>
              <p className="text-zinc-400 mb-2">Not a Git Repository</p>
              <p className="text-sm text-zinc-500">Initialize git in this project to use version control</p>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 h-full bg-zinc-950">
      {/* Left panel: Status and staging */}
      <div className="w-80 border-r border-zinc-800 flex flex-col">
        {/* Branch header */}
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <GitBranchIcon className="w-5 h-5 text-cyan-400" />
              <span className="text-white font-medium">{status.current || 'HEAD'}</span>
            </div>
            <button
              onClick={loadGitData}
              className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          {status.tracking && (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <span>{status.tracking}</span>
              {(status.ahead > 0 || status.behind > 0) && (
                <span className="text-xs">
                  {status.ahead > 0 && <span className="text-green-400">↑{status.ahead}</span>}
                  {status.ahead > 0 && status.behind > 0 && ' '}
                  {status.behind > 0 && <span className="text-red-400">↓{status.behind}</span>}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Branches */}
        <div className="border-b border-zinc-800">
          <button
            onClick={() => setShowBranches(!showBranches)}
            className="w-full px-4 py-2 flex items-center justify-between hover:bg-zinc-900"
          >
            <span className="text-sm font-medium text-zinc-300">BRANCHES</span>
            {showBranches ? (
              <ChevronDown className="w-4 h-4 text-zinc-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-zinc-500" />
            )}
          </button>
          {showBranches && (
            <div className="px-2 pb-2 max-h-32 overflow-y-auto">
              {branches
                .filter((b) => !b.name.startsWith('remotes/'))
                .map((branch) => (
                  <button
                    key={branch.name}
                    onClick={() => !branch.current && handleCheckout(branch.name)}
                    disabled={branch.current}
                    className={`w-full text-left px-2 py-1 text-sm rounded ${
                      branch.current
                        ? 'text-purple-400 bg-purple-500/10'
                        : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                    }`}
                  >
                    {branch.current ? '● ' : '○ '}
                    {branch.name}
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* File changes */}
        <div className="flex-1 overflow-y-auto">
          {/* Staged */}
          {status.staged.length > 0 && (
            <div className="p-2 border-b border-zinc-800">
              <div className="flex items-center justify-between px-2 mb-1">
                <span className="text-xs font-medium text-zinc-400">
                  STAGED ({status.staged.length})
                </span>
                <button
                  onClick={() => handleUnstage(status.staged.map((f) => f.path))}
                  className="text-xs text-zinc-500 hover:text-white"
                >
                  Unstage All
                </button>
              </div>
              {status.staged.map((file) => (
                <FileChangeItem key={file.path} file={file} isStaged={true} />
              ))}
            </div>
          )}

          {/* Unstaged */}
          {status.unstaged.length > 0 && (
            <div className="p-2 border-b border-zinc-800">
              <div className="flex items-center justify-between px-2 mb-1">
                <span className="text-xs font-medium text-zinc-400">
                  CHANGES ({status.unstaged.length})
                </span>
              </div>
              {status.unstaged.map((file) => (
                <FileChangeItem key={file.path} file={file} isStaged={false} />
              ))}
            </div>
          )}

          {/* Untracked */}
          {status.untracked.length > 0 && (
            <div className="p-2">
              <div className="flex items-center justify-between px-2 mb-1">
                <span className="text-xs font-medium text-zinc-400">
                  UNTRACKED ({status.untracked.length})
                </span>
              </div>
              {status.untracked.map((path) => (
                <FileChangeItem key={path} file={path} isStaged={false} isUntracked />
              ))}
            </div>
          )}

          {status.staged.length === 0 &&
            status.unstaged.length === 0 &&
            status.untracked.length === 0 && (
              <div className="p-4 text-center text-zinc-500 text-sm">
                Working tree clean
              </div>
            )}
        </div>

        {/* Commit area */}
        <div className="p-4 border-t border-zinc-800 space-y-2">
          {error && (
            <div className="text-red-400 text-xs bg-red-900/20 px-2 py-1 rounded">{error}</div>
          )}

          {(status.unstaged.length > 0 || status.untracked.length > 0) && (
            <button
              onClick={handleStageAll}
              className="w-full text-sm text-purple-400 hover:text-purple-300 py-1"
            >
              Stage All Changes
            </button>
          )}

          <textarea
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="Commit message..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white resize-none h-20 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />

          <div className="flex gap-2">
            <button
              onClick={handleCommit}
              disabled={isCommitting || !commitMessage.trim() || status.staged.length === 0}
              className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium py-2 px-3 rounded transition-colors"
            >
              {isCommitting ? 'Committing...' : 'Commit'}
            </button>
            <button
              onClick={handlePull}
              disabled={isPulling}
              className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white text-sm py-2 px-3 rounded transition-colors flex items-center justify-center"
              title="Pull"
            >
              {isPulling ? '...' : <ArrowDown className="w-4 h-4" />}
            </button>
            <button
              onClick={handlePush}
              disabled={isPushing}
              className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white text-sm py-2 px-3 rounded transition-colors flex items-center justify-center"
              title="Push"
            >
              {isPushing ? '...' : <ArrowUp className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Right panel: History/Changes */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-zinc-800">
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'history'
                ? 'text-white border-b-2 border-purple-500'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            History
          </button>
          <button
            onClick={() => setActiveTab('changes')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'changes'
                ? 'text-white border-b-2 border-purple-500'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Changes
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'history' ? (
            <div className="p-4 space-y-2">
              {isLoading ? (
                <div className="text-center text-zinc-500 py-8">Loading commits...</div>
              ) : commits.length === 0 ? (
                <div className="text-center text-zinc-500 py-8">No commits yet</div>
              ) : (
                commits.map((commit) => (
                  <div
                    key={commit.hash}
                    className="p-3 bg-zinc-900 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white font-medium truncate">{commit.message}</p>
                        <p className="text-xs text-zinc-500 mt-1">
                          {commit.authorName} • {formatDate(commit.date)}
                        </p>
                      </div>
                      <span className="text-xs font-mono text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded flex-shrink-0">
                        {commit.hashShort}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="h-full">
              {selectedFile ? (
                <div className="h-full flex flex-col">
                  <div className="px-4 py-2 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
                    <span className="text-sm text-zinc-300 font-mono">{selectedFile}</span>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="text-zinc-500 hover:text-white p-1 rounded hover:bg-zinc-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <pre className="flex-1 p-4 overflow-auto text-xs font-mono text-zinc-300 whitespace-pre">
                    {diff || 'No changes to display'}
                  </pre>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
                  Select a file to view changes
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 60) {
    return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
  } else {
    return date.toLocaleDateString()
  }
}
