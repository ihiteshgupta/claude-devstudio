import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '../stores/appStore'
import type { UserStory, Sprint, ChatSession, TestCase, AgentType } from '@shared/types'
import {
  FileText,
  Star,
  TestTube,
  CalendarDays,
  MessageSquare,
  Bot,
  RefreshCw,
  Zap,
  type LucideIcon
} from 'lucide-react'
import { AgentIcon, AGENT_ICONS, AGENT_LABELS } from '../utils/icons'

interface DashboardPanelProps {
  projectPath: string
}

const STATUS_COLORS: Record<string, string> = {
  backlog: 'bg-zinc-600',
  todo: 'bg-blue-600',
  'in-progress': 'bg-yellow-600',
  review: 'bg-purple-600',
  done: 'bg-green-600'
}

const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  'in-progress': 'In Progress',
  review: 'Review',
  done: 'Done'
}

export function DashboardPanel({ projectPath }: DashboardPanelProps): JSX.Element {
  const { currentProject } = useAppStore()

  const [stories, setStories] = useState<UserStory[]>([])
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [testCases, setTestCases] = useState<TestCase[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load all dashboard data
  const loadData = useCallback(async () => {
    if (!currentProject) return
    setIsLoading(true)

    try {
      const [storiesData, sprintsData, sessionsData, testCasesData] = await Promise.all([
        window.electronAPI.stories.list(currentProject.id),
        window.electronAPI.sprints.list(currentProject.id),
        window.electronAPI.sessions.list(currentProject.id),
        window.electronAPI.testCases.list(currentProject.id)
      ])

      setStories(storiesData)
      setSprints(sprintsData)
      setSessions(sessionsData)
      setTestCases(testCasesData)
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [currentProject])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Computed metrics
  const storyCountByStatus = {
    backlog: stories.filter((s) => s.status === 'backlog').length,
    todo: stories.filter((s) => s.status === 'todo').length,
    'in-progress': stories.filter((s) => s.status === 'in-progress').length,
    review: stories.filter((s) => s.status === 'review').length,
    done: stories.filter((s) => s.status === 'done').length
  }

  const totalStoryPoints = stories.reduce((sum, s) => sum + (s.storyPoints || 0), 0)
  const completedStoryPoints = stories
    .filter((s) => s.status === 'done')
    .reduce((sum, s) => sum + (s.storyPoints || 0), 0)

  const activeSprint = sprints.find((s) => s.status === 'active')
  const activeSprintStories = activeSprint
    ? stories.filter((s) => s.sprintId === activeSprint.id)
    : []
  const activeSprintDoneCount = activeSprintStories.filter((s) => s.status === 'done').length

  const daysRemaining = activeSprint
    ? Math.max(0, Math.ceil((new Date(activeSprint.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0

  const sessionsByAgent = sessions.reduce(
    (acc, session) => {
      acc[session.agentType] = (acc[session.agentType] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const completionPercentage =
    stories.length > 0 ? Math.round((storyCountByStatus.done / stories.length) * 100) : 0

  const sprintCompletionPercentage =
    activeSprintStories.length > 0
      ? Math.round((activeSprintDoneCount / activeSprintStories.length) * 100)
      : 0

  if (isLoading) {
    return (
      <div className="flex flex-1 h-full bg-zinc-950 items-center justify-center">
        <div className="text-zinc-400">Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div className="flex-1 h-full bg-zinc-950 overflow-y-auto">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-zinc-400 text-sm">{currentProject?.name}</p>
          </div>
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={FileText}
            iconColor="text-blue-400"
            title="Total Stories"
            value={stories.length}
            subtitle={`${storyCountByStatus.done} completed`}
          />
          <StatCard
            icon={Zap}
            iconColor="text-yellow-400"
            title="Active Sprint"
            value={activeSprint?.name || 'None'}
            subtitle={activeSprint ? `${daysRemaining} days left` : 'No active sprint'}
          />
          <StatCard
            icon={Star}
            iconColor="text-amber-400"
            title="Story Points"
            value={totalStoryPoints}
            subtitle={`${completedStoryPoints} completed`}
          />
          <StatCard
            icon={TestTube}
            iconColor="text-purple-400"
            title="Test Cases"
            value={testCases.length}
            subtitle={`${testCases.filter((t) => t.status === 'passed').length} passed`}
          />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Story Status Distribution */}
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
            <h3 className="text-white font-medium mb-4">Story Status Distribution</h3>

            {/* Progress bar */}
            <div className="h-4 rounded-full overflow-hidden flex mb-4 bg-zinc-800">
              {Object.entries(storyCountByStatus).map(([status, count]) => {
                const percentage = stories.length > 0 ? (count / stories.length) * 100 : 0
                if (percentage === 0) return null
                return (
                  <div
                    key={status}
                    className={`${STATUS_COLORS[status]} transition-all`}
                    style={{ width: `${percentage}%` }}
                    title={`${STATUS_LABELS[status]}: ${count}`}
                  />
                )
              })}
            </div>

            {/* Status counts */}
            <div className="grid grid-cols-5 gap-2">
              {Object.entries(storyCountByStatus).map(([status, count]) => (
                <div key={status} className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[status]}`} />
                    <span className="text-lg font-semibold text-white">{count}</span>
                  </div>
                  <p className="text-xs text-zinc-500">{STATUS_LABELS[status]}</p>
                </div>
              ))}
            </div>

            {/* Completion */}
            <div className="mt-4 pt-4 border-t border-zinc-800">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">Overall Completion</span>
                <span className="text-white font-medium">{completionPercentage}%</span>
              </div>
            </div>
          </div>

          {/* Sprint Progress */}
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
            <h3 className="text-white font-medium mb-4">Sprint Progress</h3>

            {activeSprint ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-purple-400 font-medium">{activeSprint.name}</span>
                  <span className="text-xs text-zinc-500">
                    {new Date(activeSprint.startDate).toLocaleDateString()} -{' '}
                    {new Date(activeSprint.endDate).toLocaleDateString()}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-3 rounded-full overflow-hidden bg-zinc-800 mb-2">
                  <div
                    className="h-full bg-purple-600 transition-all"
                    style={{ width: `${sprintCompletionPercentage}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-sm mb-4">
                  <span className="text-zinc-400">
                    {activeSprintDoneCount}/{activeSprintStories.length} stories complete
                  </span>
                  <span className="text-white font-medium">{sprintCompletionPercentage}%</span>
                </div>

                {activeSprint.goal && (
                  <div className="bg-zinc-800/50 rounded p-3">
                    <p className="text-xs text-zinc-500 mb-1">Sprint Goal</p>
                    <p className="text-sm text-zinc-300">{activeSprint.goal}</p>
                  </div>
                )}

                <div className="mt-4 flex items-center gap-4">
                  <div className="flex-1 text-center">
                    <p className="text-2xl font-bold text-white">{daysRemaining}</p>
                    <p className="text-xs text-zinc-500">Days Left</p>
                  </div>
                  <div className="flex-1 text-center">
                    <p className="text-2xl font-bold text-white">{activeSprintStories.length}</p>
                    <p className="text-xs text-zinc-500">Stories</p>
                  </div>
                  <div className="flex-1 text-center">
                    <p className="text-2xl font-bold text-white">
                      {activeSprintStories.reduce((sum, s) => sum + (s.storyPoints || 0), 0)}
                    </p>
                    <p className="text-xs text-zinc-500">Points</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
                <CalendarDays className="w-8 h-8 mb-2 text-zinc-600" />
                <p>No active sprint</p>
                <p className="text-sm">Create a sprint to track progress</p>
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
            <h3 className="text-white font-medium mb-4">Recent Activity</h3>

            {sessions.length > 0 ? (
              <div className="space-y-3">
                {sessions.slice(0, 5).map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center gap-3 p-2 rounded hover:bg-zinc-800/50"
                  >
                    <AgentIcon agentType={session.agentType as AgentType} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">
                        {AGENT_LABELS[session.agentType as AgentType]} chat
                      </p>
                      <p className="text-xs text-zinc-500">{formatRelativeTime(session.updatedAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
                <MessageSquare className="w-8 h-8 mb-2 text-zinc-600" />
                <p>No recent activity</p>
                <p className="text-sm">Start a chat with an agent</p>
              </div>
            )}
          </div>

          {/* Agent Sessions */}
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
            <h3 className="text-white font-medium mb-4">Agent Sessions</h3>

            {Object.keys(sessionsByAgent).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(sessionsByAgent)
                  .sort(([, a], [, b]) => b - a)
                  .map(([agentType, count]) => (
                    <div key={agentType} className="flex items-center gap-3">
                      <div className="w-8 flex justify-center">
                        <AgentIcon agentType={agentType as AgentType} size="md" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-zinc-300">
                            {AGENT_LABELS[agentType as AgentType] || agentType}
                          </span>
                          <span className="text-sm text-white font-medium">{count}</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden bg-zinc-800">
                          <div
                            className="h-full bg-purple-600"
                            style={{
                              width: `${(count / Math.max(...Object.values(sessionsByAgent))) * 100}%`
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
                <Bot className="w-8 h-8 mb-2 text-zinc-600" />
                <p>No agent sessions yet</p>
                <p className="text-sm">Chat with agents to see activity</p>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-zinc-800">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">Total Sessions</span>
                <span className="text-white font-medium">{sessions.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats Footer */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-zinc-900/50 rounded-lg border border-zinc-800 p-3 text-center">
            <p className="text-xs text-zinc-500 mb-1">Total Sprints</p>
            <p className="text-lg font-semibold text-white">{sprints.length}</p>
          </div>
          <div className="bg-zinc-900/50 rounded-lg border border-zinc-800 p-3 text-center">
            <p className="text-xs text-zinc-500 mb-1">Completed Sprints</p>
            <p className="text-lg font-semibold text-white">
              {sprints.filter((s) => s.status === 'completed').length}
            </p>
          </div>
          <div className="bg-zinc-900/50 rounded-lg border border-zinc-800 p-3 text-center">
            <p className="text-xs text-zinc-500 mb-1">Avg Points/Story</p>
            <p className="text-lg font-semibold text-white">
              {stories.length > 0 ? (totalStoryPoints / stories.length).toFixed(1) : '0'}
            </p>
          </div>
          <div className="bg-zinc-900/50 rounded-lg border border-zinc-800 p-3 text-center">
            <p className="text-xs text-zinc-500 mb-1">Test Coverage</p>
            <p className="text-lg font-semibold text-white">
              {stories.length > 0
                ? Math.round((testCases.length / stories.length) * 100)
                : 0}%
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// StatCard Component
function StatCard({
  icon: Icon,
  iconColor,
  title,
  value,
  subtitle
}: {
  icon: LucideIcon
  iconColor?: string
  title: string
  value: string | number
  subtitle: string
}): JSX.Element {
  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
      <div className="flex items-center gap-3 mb-2">
        <Icon className={`w-6 h-6 ${iconColor || 'text-zinc-400'}`} />
        <span className="text-sm text-zinc-400">{title}</span>
      </div>
      <p className="text-2xl font-bold text-white mb-1">{value}</p>
      <p className="text-xs text-zinc-500">{subtitle}</p>
    </div>
  )
}

// Utility function
function formatRelativeTime(date: Date | string): string {
  const now = new Date()
  const then = new Date(date)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
  return then.toLocaleDateString()
}
