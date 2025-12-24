import { useState, useEffect, useCallback } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { useAppStore } from '../stores/appStore'
import type { Sprint, UserStory } from '@shared/types'

interface SprintPanelProps {
  projectPath: string
}

const SPRINT_STATUS_COLORS: Record<string, string> = {
  planned: 'bg-zinc-600 text-zinc-200',
  active: 'bg-blue-600 text-blue-100',
  completed: 'bg-green-600 text-green-100',
  cancelled: 'bg-red-600 text-red-100'
}

const STORY_STATUS_ORDER = ['backlog', 'todo', 'in-progress', 'review', 'done'] as const

const STORY_STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  'in-progress': 'In Progress',
  review: 'Review',
  done: 'Done'
}

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-500',
  medium: 'bg-blue-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500'
}

export function SprintPanel({ projectPath }: SprintPanelProps): JSX.Element {
  const { currentProject, sprints, currentSprint, setSprints, setCurrentSprint, addSprint, removeSprint } =
    useAppStore()

  const [stories, setStories] = useState<UserStory[]>([])
  const [allStories, setAllStories] = useState<UserStory[]>([])
  const [newSprintName, setNewSprintName] = useState('')
  const [newSprintStartDate, setNewSprintStartDate] = useState('')
  const [newSprintEndDate, setNewSprintEndDate] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)

  // Load sprints
  const loadSprints = useCallback(async () => {
    if (!currentProject) return
    try {
      const projectSprints = await window.electronAPI.sprints.list(currentProject.id)
      setSprints(projectSprints)
    } catch (error) {
      console.error('Failed to load sprints:', error)
    }
  }, [currentProject, setSprints])

  // Load all stories for the project
  const loadStories = useCallback(async () => {
    if (!currentProject) return
    try {
      const projectStories = await window.electronAPI.stories.list(currentProject.id)
      setAllStories(projectStories)
    } catch (error) {
      console.error('Failed to load stories:', error)
    }
  }, [currentProject])

  // Filter stories for current sprint
  useEffect(() => {
    if (currentSprint) {
      setStories(allStories.filter((s) => s.sprintId === currentSprint.id))
    } else {
      setStories([])
    }
  }, [currentSprint, allStories])

  useEffect(() => {
    loadSprints()
    loadStories()
  }, [loadSprints, loadStories])

  // Create sprint
  const handleCreateSprint = async (): Promise<void> => {
    if (!currentProject || !newSprintName.trim() || !newSprintStartDate || !newSprintEndDate) return

    setIsCreating(true)
    try {
      const newSprint = await window.electronAPI.sprints.create({
        projectId: currentProject.id,
        name: newSprintName,
        startDate: newSprintStartDate,
        endDate: newSprintEndDate
      })

      addSprint(newSprint)
      setCurrentSprint(newSprint)
      setNewSprintName('')
      setNewSprintStartDate('')
      setNewSprintEndDate('')
      setShowCreateForm(false)
    } catch (error) {
      console.error('Failed to create sprint:', error)
    } finally {
      setIsCreating(false)
    }
  }

  // Delete sprint
  const handleDeleteSprint = async (sprintId: string): Promise<void> => {
    if (!confirm('Are you sure you want to delete this sprint? Stories will be moved back to backlog.')) return

    try {
      await window.electronAPI.sprints.delete(sprintId)
      removeSprint(sprintId)
      loadStories() // Refresh stories
    } catch (error) {
      console.error('Failed to delete sprint:', error)
    }
  }

  // Update sprint status
  const handleSprintStatusChange = async (sprintId: string, status: Sprint['status']): Promise<void> => {
    try {
      await window.electronAPI.sprints.update(sprintId, { status })
      loadSprints()
    } catch (error) {
      console.error('Failed to update sprint status:', error)
    }
  }

  // Handle drag end for stories
  const handleDragEnd = async (result: DropResult): Promise<void> => {
    const { destination, source, draggableId } = result

    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const storyId = draggableId
    const newStatus = destination.droppableId as UserStory['status']

    // Optimistic update
    setStories((prev) =>
      prev.map((s) => (s.id === storyId ? { ...s, status: newStatus } : s))
    )
    setAllStories((prev) =>
      prev.map((s) => (s.id === storyId ? { ...s, status: newStatus } : s))
    )

    try {
      await window.electronAPI.stories.update(storyId, { status: newStatus })
    } catch (error) {
      console.error('Failed to update story status:', error)
      // Revert on error
      loadStories()
    }
  }

  // Assign story to sprint
  const handleAssignStory = async (storyId: string): Promise<void> => {
    if (!currentSprint) return

    try {
      await window.electronAPI.sprints.addStory(currentSprint.id, storyId)
      loadStories()
    } catch (error) {
      console.error('Failed to assign story:', error)
    }
  }

  // Remove story from sprint
  const handleRemoveStory = async (storyId: string): Promise<void> => {
    try {
      await window.electronAPI.sprints.removeStory(storyId)
      loadStories()
    } catch (error) {
      console.error('Failed to remove story:', error)
    }
  }

  // Get unassigned stories
  const unassignedStories = allStories.filter((s) => !s.sprintId)

  return (
    <div className="flex flex-1 h-full bg-zinc-950">
      {/* Left panel: Sprint list */}
      <div className="w-80 border-r border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Sprints</h2>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="text-sm text-purple-400 hover:text-purple-300"
            >
              {showCreateForm ? 'Cancel' : '+ New'}
            </button>
          </div>

          {showCreateForm && (
            <div className="space-y-3 mb-4 p-3 bg-zinc-900 rounded-lg">
              <input
                type="text"
                value={newSprintName}
                onChange={(e) => setNewSprintName(e.target.value)}
                placeholder="Sprint name..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  value={newSprintStartDate}
                  onChange={(e) => setNewSprintStartDate(e.target.value)}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <input
                  type="date"
                  value={newSprintEndDate}
                  onChange={(e) => setNewSprintEndDate(e.target.value)}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <button
                onClick={handleCreateSprint}
                disabled={isCreating || !newSprintName.trim() || !newSprintStartDate || !newSprintEndDate}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium py-2 px-4 rounded transition-colors"
              >
                {isCreating ? 'Creating...' : 'Create Sprint'}
              </button>
            </div>
          )}
        </div>

        {/* Sprint list */}
        <div className="flex-1 overflow-y-auto">
          {sprints.length === 0 ? (
            <div className="p-4 text-center text-zinc-500 text-sm">
              No sprints yet. Create one above!
            </div>
          ) : (
            sprints.map((sprint) => (
              <button
                key={sprint.id}
                onClick={() => setCurrentSprint(sprint)}
                className={`w-full p-4 text-left border-b border-zinc-800 hover:bg-zinc-900 transition-colors ${
                  currentSprint?.id === sprint.id ? 'bg-zinc-900 border-l-2 border-l-purple-500' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-white font-medium text-sm truncate flex-1">{sprint.name}</h3>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded ml-2 ${SPRINT_STATUS_COLORS[sprint.status]}`}
                  >
                    {sprint.status}
                  </span>
                </div>
                <p className="text-xs text-zinc-500">
                  {new Date(sprint.startDate).toLocaleDateString()} -{' '}
                  {new Date(sprint.endDate).toLocaleDateString()}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right panel: Sprint detail and Kanban board */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {currentSprint ? (
          <>
            {/* Sprint header */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">{currentSprint.name}</h3>
                <p className="text-sm text-zinc-400">
                  {new Date(currentSprint.startDate).toLocaleDateString()} -{' '}
                  {new Date(currentSprint.endDate).toLocaleDateString()} |{' '}
                  {stories.length} stories
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={currentSprint.status}
                  onChange={(e) => handleSprintStatusChange(currentSprint.id, e.target.value as Sprint['status'])}
                  className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-white"
                >
                  <option value="planned">Planned</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <button
                  onClick={() => handleDeleteSprint(currentSprint.id)}
                  className="text-red-400 hover:text-red-300 text-sm px-2 py-1"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Kanban board */}
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="flex-1 overflow-x-auto p-4">
                <div className="flex gap-4 h-full min-w-max">
                  {STORY_STATUS_ORDER.map((status) => (
                    <Droppable key={status} droppableId={status}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`w-72 flex flex-col bg-zinc-900 rounded-lg border ${
                            snapshot.isDraggingOver ? 'border-purple-500' : 'border-zinc-800'
                          }`}
                        >
                          <div className="p-3 border-b border-zinc-800">
                            <h4 className="font-semibold text-white text-sm">
                              {STORY_STATUS_LABELS[status]}
                              <span className="ml-2 text-zinc-500">
                                ({stories.filter((s) => s.status === status).length})
                              </span>
                            </h4>
                          </div>
                          <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[200px]">
                            {stories
                              .filter((s) => s.status === status)
                              .map((story, index) => (
                                <Draggable key={story.id} draggableId={story.id} index={index}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      className={`bg-zinc-800 rounded-lg p-3 border ${
                                        snapshot.isDragging
                                          ? 'border-purple-500 shadow-lg'
                                          : 'border-zinc-700'
                                      } hover:border-zinc-600 transition-colors cursor-grab active:cursor-grabbing`}
                                    >
                                      <div className="flex items-start justify-between gap-2 mb-2">
                                        <h5 className="text-sm font-medium text-white flex-1">
                                          {story.title}
                                        </h5>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleRemoveStory(story.id)
                                          }}
                                          className="text-zinc-500 hover:text-red-400 text-xs"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                      {story.description && (
                                        <p className="text-xs text-zinc-400 mb-2 line-clamp-2">
                                          {story.description}
                                        </p>
                                      )}
                                      <div className="flex items-center gap-2">
                                        <span
                                          className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[story.priority]}`}
                                          title={story.priority}
                                        />
                                        {story.storyPoints && (
                                          <span className="text-xs text-zinc-500 bg-zinc-700 px-1.5 py-0.5 rounded">
                                            {story.storyPoints} pts
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                            {provided.placeholder}
                          </div>
                        </div>
                      )}
                    </Droppable>
                  ))}
                </div>
              </div>
            </DragDropContext>

            {/* Unassigned stories drawer */}
            {unassignedStories.length > 0 && (
              <div className="border-t border-zinc-800 p-4">
                <h4 className="text-sm font-medium text-zinc-400 mb-2">
                  Unassigned Stories ({unassignedStories.length})
                </h4>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {unassignedStories.slice(0, 5).map((story) => (
                    <button
                      key={story.id}
                      onClick={() => handleAssignStory(story.id)}
                      className="flex-shrink-0 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg p-2 text-left max-w-[200px]"
                    >
                      <p className="text-sm text-white truncate">{story.title}</p>
                      <p className="text-xs text-zinc-500">Click to add to sprint</p>
                    </button>
                  ))}
                  {unassignedStories.length > 5 && (
                    <div className="flex-shrink-0 flex items-center px-2 text-sm text-zinc-500">
                      +{unassignedStories.length - 5} more
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-4">📋</div>
              <p className="text-zinc-400 mb-2">Select a sprint to view the board</p>
              <p className="text-sm text-zinc-500">or create a new sprint to get started</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
