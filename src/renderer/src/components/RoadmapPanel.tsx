import { useState, useEffect, useCallback } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { useAppStore } from '../stores/appStore'
import { useToast } from './Toast'
import type {
  RoadmapItem,
  RoadmapItemType,
  RoadmapItemStatus,
  RoadmapLane,
  RoadmapPriority,
  RoadmapViewMode
} from '@shared/types'

interface RoadmapPanelProps {
  projectPath: string
}

const LANES: RoadmapLane[] = ['now', 'next', 'later', 'done']

const LANE_LABELS: Record<RoadmapLane, string> = {
  now: 'Now',
  next: 'Next',
  later: 'Later',
  done: 'Done'
}

const LANE_COLORS: Record<RoadmapLane, string> = {
  now: 'border-green-500/50 bg-green-500/5',
  next: 'border-blue-500/50 bg-blue-500/5',
  later: 'border-zinc-500/50 bg-zinc-500/5',
  done: 'border-purple-500/50 bg-purple-500/5'
}

const TYPE_ICONS: Record<RoadmapItemType, string> = {
  epic: 'layer-group',
  feature: 'puzzle-piece',
  milestone: 'flag',
  task: 'check-circle'
}

const TYPE_COLORS: Record<RoadmapItemType, string> = {
  epic: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  feature: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  milestone: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  task: 'bg-green-500/20 text-green-400 border-green-500/30'
}

const PRIORITY_COLORS: Record<RoadmapPriority, string> = {
  low: 'bg-gray-500',
  medium: 'bg-blue-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500'
}

const STATUS_LABELS: Record<RoadmapItemStatus, string> = {
  planned: 'Planned',
  'in-progress': 'In Progress',
  completed: 'Completed',
  blocked: 'Blocked',
  cancelled: 'Cancelled'
}

export function RoadmapPanel({ projectPath }: RoadmapPanelProps): JSX.Element {
  const { currentProject } = useAppStore()
  const toast = useToast()

  const [items, setItems] = useState<RoadmapItem[]>([])
  const [viewMode, setViewMode] = useState<RoadmapViewMode>('kanban')
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedItem, setSelectedItem] = useState<RoadmapItem | null>(null)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  // Form state
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newType, setNewType] = useState<RoadmapItemType>('feature')
  const [newPriority, setNewPriority] = useState<RoadmapPriority>('medium')
  const [newLane, setNewLane] = useState<RoadmapLane>('next')
  const [newQuarter, setNewQuarter] = useState('')

  // Load roadmap items
  const loadItems = useCallback(async () => {
    if (!currentProject) return
    setIsLoading(true)
    try {
      const roadmapItems = await window.electronAPI.roadmap.list(currentProject.id)
      setItems(roadmapItems)
    } catch (error) {
      console.error('Failed to load roadmap items:', error)
      toast.error('Load Failed', 'Could not load roadmap items')
    } finally {
      setIsLoading(false)
    }
  }, [currentProject, toast])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  // Group items by lane
  const itemsByLane = LANES.reduce((acc, lane) => {
    acc[lane] = items.filter((item) => item.lane === lane && !item.parentId)
    return acc
  }, {} as Record<RoadmapLane, RoadmapItem[]>)

  // Group items by quarter for timeline view
  const itemsByQuarter = items
    .filter((item) => !item.parentId)
    .reduce((acc, item) => {
      const quarter = item.targetQuarter || 'Unscheduled'
      if (!acc[quarter]) acc[quarter] = []
      acc[quarter].push(item)
      return acc
    }, {} as Record<string, RoadmapItem[]>)

  // Get quarters sorted
  const quarters = Object.keys(itemsByQuarter).sort((a, b) => {
    if (a === 'Unscheduled') return 1
    if (b === 'Unscheduled') return -1
    return a.localeCompare(b)
  })

  // Handle drag end
  const handleDragEnd = async (result: DropResult): Promise<void> => {
    const { destination, draggableId } = result

    if (!destination) return

    const itemId = draggableId
    const newLane = destination.droppableId as RoadmapLane

    // Optimistic update
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, lane: newLane } : item
      )
    )

    try {
      await window.electronAPI.roadmap.update(itemId, { lane: newLane })
      toast.success('Moved', `Item moved to ${LANE_LABELS[newLane]}`)
    } catch (error) {
      console.error('Failed to move item:', error)
      loadItems() // Revert on error
      toast.error('Move Failed', 'Could not move item')
    }
  }

  // Create item
  const handleCreateItem = async (): Promise<void> => {
    if (!currentProject || !newTitle.trim()) return

    try {
      await window.electronAPI.roadmap.create({
        projectId: currentProject.id,
        title: newTitle,
        description: newDescription || undefined,
        type: newType,
        priority: newPriority,
        lane: newLane,
        targetQuarter: newQuarter || undefined
      })

      setNewTitle('')
      setNewDescription('')
      setNewType('feature')
      setNewPriority('medium')
      setNewLane('next')
      setNewQuarter('')
      setShowCreateForm(false)
      loadItems()
      toast.success('Created', 'Roadmap item created')
    } catch (error) {
      console.error('Failed to create item:', error)
      toast.error('Create Failed', 'Could not create item')
    }
  }

  // Delete item
  const handleDeleteItem = async (id: string): Promise<void> => {
    if (!confirm('Delete this item?')) return

    try {
      await window.electronAPI.roadmap.delete(id)
      setItems((prev) => prev.filter((item) => item.id !== id))
      if (selectedItem?.id === id) setSelectedItem(null)
      toast.success('Deleted', 'Item deleted')
    } catch (error) {
      console.error('Failed to delete item:', error)
      toast.error('Delete Failed', 'Could not delete item')
    }
  }

  // Update item status
  const handleStatusChange = async (id: string, status: RoadmapItemStatus): Promise<void> => {
    try {
      await window.electronAPI.roadmap.update(id, { status })
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status } : item
        )
      )
    } catch (error) {
      console.error('Failed to update status:', error)
      toast.error('Update Failed', 'Could not update status')
    }
  }

  // Toggle item expansion
  const toggleExpand = (id: string): void => {
    setExpandedItems((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Render item card
  const renderItemCard = (item: RoadmapItem, index: number): JSX.Element => {
    const children = items.filter((i) => i.parentId === item.id)
    const hasChildren = children.length > 0
    const isExpanded = expandedItems.has(item.id)

    return (
      <Draggable key={item.id} draggableId={item.id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={`mb-2 rounded-lg border p-3 transition-all ${TYPE_COLORS[item.type]} ${
              snapshot.isDragging ? 'shadow-lg ring-2 ring-primary' : ''
            } ${selectedItem?.id === item.id ? 'ring-2 ring-blue-500' : ''}`}
            onClick={() => setSelectedItem(item)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <i className={`fas fa-${TYPE_ICONS[item.type]} text-sm`} />
                <span className="font-medium text-sm text-white truncate">
                  {item.title}
                </span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <div className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[item.priority]}`} />
                {hasChildren && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleExpand(item.id)
                    }}
                    className="p-1 hover:bg-white/10 rounded"
                  >
                    <i className={`fas fa-chevron-${isExpanded ? 'down' : 'right'} text-xs text-zinc-400`} />
                  </button>
                )}
              </div>
            </div>

            {item.description && (
              <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                {item.description}
              </p>
            )}

            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                  {STATUS_LABELS[item.status]}
                </span>
                {item.storyPoints && (
                  <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                    {item.storyPoints} pts
                  </span>
                )}
              </div>
              {item.targetQuarter && (
                <span className="text-xs text-zinc-500">{item.targetQuarter}</span>
              )}
            </div>

            {/* Children */}
            {isExpanded && hasChildren && (
              <div className="mt-3 pl-4 border-l border-zinc-700 space-y-2">
                {children.map((child) => (
                  <div
                    key={child.id}
                    className="p-2 rounded bg-zinc-800/50 text-sm cursor-pointer hover:bg-zinc-800"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedItem(child)
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <i className={`fas fa-${TYPE_ICONS[child.type]} text-xs`} />
                      <span className="text-white">{child.title}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Draggable>
    )
  }

  // Render Kanban view
  const renderKanbanView = (): JSX.Element => (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {LANES.map((lane) => (
          <div
            key={lane}
            className={`flex-shrink-0 w-80 rounded-lg border ${LANE_COLORS[lane]}`}
          >
            <div className="p-3 border-b border-zinc-700/50">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">{LANE_LABELS[lane]}</h3>
                <span className="text-xs text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
                  {itemsByLane[lane].length}
                </span>
              </div>
            </div>

            <Droppable droppableId={lane}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`p-3 min-h-[200px] transition-colors ${
                    snapshot.isDraggingOver ? 'bg-white/5' : ''
                  }`}
                >
                  {itemsByLane[lane].map((item, index) => renderItemCard(item, index))}
                  {provided.placeholder}

                  {itemsByLane[lane].length === 0 && !snapshot.isDraggingOver && (
                    <div className="text-center text-zinc-500 text-sm py-8">
                      <i className="fas fa-inbox text-2xl mb-2 opacity-50" />
                      <p>Drop items here</p>
                    </div>
                  )}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
  )

  // Render Timeline view
  const renderTimelineView = (): JSX.Element => (
    <div className="space-y-6">
      {quarters.map((quarter) => (
        <div key={quarter} className="border border-zinc-800 rounded-lg overflow-hidden">
          <div className="p-3 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
            <h3 className="font-semibold text-white">{quarter}</h3>
            <span className="text-xs text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
              {itemsByQuarter[quarter].length} items
            </span>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {itemsByQuarter[quarter].map((item) => (
              <div
                key={item.id}
                className={`rounded-lg border p-3 cursor-pointer transition-all hover:ring-2 hover:ring-blue-500 ${TYPE_COLORS[item.type]}`}
                onClick={() => setSelectedItem(item)}
              >
                <div className="flex items-center gap-2 mb-2">
                  <i className={`fas fa-${TYPE_ICONS[item.type]} text-sm`} />
                  <span className="font-medium text-white truncate">{item.title}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                    {LANE_LABELS[item.lane]}
                  </span>
                  <div className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[item.priority]}`} />
                </div>
              </div>
            ))}
            {itemsByQuarter[quarter].length === 0 && (
              <div className="col-span-full text-center text-zinc-500 py-8">
                No items scheduled
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="flex flex-1 h-full bg-zinc-950">
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Roadmap</h2>
            <p className="text-sm text-zinc-500">{items.length} items</p>
          </div>
          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="flex rounded-lg border border-zinc-700 overflow-hidden">
              <button
                onClick={() => setViewMode('kanban')}
                className={`px-3 py-1.5 text-sm transition-colors ${
                  viewMode === 'kanban'
                    ? 'bg-zinc-700 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <i className="fas fa-columns mr-2" />
                Kanban
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                className={`px-3 py-1.5 text-sm transition-colors ${
                  viewMode === 'timeline'
                    ? 'bg-zinc-700 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <i className="fas fa-calendar-alt mr-2" />
                Timeline
              </button>
            </div>

            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-1.5 px-4 rounded-lg transition-colors flex items-center gap-2"
            >
              <i className="fas fa-plus text-xs" />
              Add Item
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <i className="fas fa-spinner fa-spin text-2xl text-zinc-500" />
            </div>
          ) : viewMode === 'kanban' ? (
            renderKanbanView()
          ) : (
            renderTimelineView()
          )}
        </div>
      </div>

      {/* Detail Panel */}
      {selectedItem && (
        <div className="w-96 border-l border-zinc-800 flex flex-col">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <h3 className="font-semibold text-white truncate">{selectedItem.title}</h3>
            <button
              onClick={() => setSelectedItem(null)}
              className="p-1 hover:bg-zinc-800 rounded"
            >
              <i className="fas fa-times text-zinc-400" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Type */}
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Type</label>
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded border ${TYPE_COLORS[selectedItem.type]}`}>
                <i className={`fas fa-${TYPE_ICONS[selectedItem.type]} text-sm`} />
                <span className="text-sm capitalize">{selectedItem.type}</span>
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Status</label>
              <select
                value={selectedItem.status}
                onChange={(e) => handleStatusChange(selectedItem.id, e.target.value as RoadmapItemStatus)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Priority</label>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${PRIORITY_COLORS[selectedItem.priority]}`} />
                <span className="text-sm text-white capitalize">{selectedItem.priority}</span>
              </div>
            </div>

            {/* Lane */}
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Lane</label>
              <span className="text-sm text-white">{LANE_LABELS[selectedItem.lane]}</span>
            </div>

            {/* Quarter */}
            {selectedItem.targetQuarter && (
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Target Quarter</label>
                <span className="text-sm text-white">{selectedItem.targetQuarter}</span>
              </div>
            )}

            {/* Story Points */}
            {selectedItem.storyPoints && (
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Story Points</label>
                <span className="text-sm text-white">{selectedItem.storyPoints}</span>
              </div>
            )}

            {/* Description */}
            {selectedItem.description && (
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Description</label>
                <p className="text-sm text-zinc-300 whitespace-pre-wrap">
                  {selectedItem.description}
                </p>
              </div>
            )}

            {/* Tags */}
            {selectedItem.tags && selectedItem.tags.length > 0 && (
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Tags</label>
                <div className="flex flex-wrap gap-1">
                  {selectedItem.tags.map((tag, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Dates */}
            <div className="text-xs text-zinc-500 pt-4 border-t border-zinc-800">
              <p>Created: {new Date(selectedItem.createdAt).toLocaleDateString()}</p>
              <p>Updated: {new Date(selectedItem.updatedAt).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-zinc-800">
            <button
              onClick={() => handleDeleteItem(selectedItem.id)}
              className="w-full bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm py-2 px-4 rounded-lg transition-colors"
            >
              <i className="fas fa-trash mr-2" />
              Delete Item
            </button>
          </div>
        </div>
      )}

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 w-full max-w-md mx-4">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="font-semibold text-white">Add Roadmap Item</h3>
              <button
                onClick={() => setShowCreateForm(false)}
                className="p-1 hover:bg-zinc-800 rounded"
              >
                <i className="fas fa-times text-zinc-400" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Title *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Enter title..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Description</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Enter description..."
                  rows={3}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as RoadmapItemType)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="epic">Epic</option>
                    <option value="feature">Feature</option>
                    <option value="milestone">Milestone</option>
                    <option value="task">Task</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as RoadmapPriority)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Lane</label>
                  <select
                    value={newLane}
                    onChange={(e) => setNewLane(e.target.value as RoadmapLane)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    {LANES.map((lane) => (
                      <option key={lane} value={lane}>{LANE_LABELS[lane]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Quarter</label>
                  <input
                    type="text"
                    value={newQuarter}
                    onChange={(e) => setNewQuarter(e.target.value)}
                    placeholder="e.g., Q1-2025"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-zinc-800 flex justify-end gap-2">
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateItem}
                disabled={!newTitle.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
