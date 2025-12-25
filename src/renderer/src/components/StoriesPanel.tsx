import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '../stores/appStore'
import type { UserStory, TestCase } from '@shared/types'
import { TestTube, FileText } from 'lucide-react'

interface StoriesPanelProps {
  projectPath: string
}

const STATUS_COLORS: Record<string, string> = {
  backlog: 'bg-zinc-600 text-zinc-300',
  todo: 'bg-blue-600 text-blue-100',
  'in-progress': 'bg-yellow-600 text-yellow-100',
  review: 'bg-purple-600 text-purple-100',
  done: 'bg-green-600 text-green-100'
}

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-zinc-400',
  medium: 'text-blue-400',
  high: 'text-orange-400',
  critical: 'text-red-400'
}

export function StoriesPanel({ projectPath }: StoriesPanelProps): JSX.Element {
  const { currentProject } = useAppStore()
  const [stories, setStories] = useState<UserStory[]>([])
  const [selectedStory, setSelectedStory] = useState<UserStory | null>(null)
  const [testCases, setTestCases] = useState<TestCase[]>([])
  const [newPrompt, setNewPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGeneratingTests, setIsGeneratingTests] = useState(false)

  // Load stories
  const loadStories = useCallback(async () => {
    if (!currentProject) return
    try {
      const projectStories = await window.electronAPI.stories.list(currentProject.id)
      setStories(projectStories)
    } catch (error) {
      console.error('Failed to load stories:', error)
    }
  }, [currentProject])

  // Load test cases
  const loadTestCases = useCallback(async () => {
    if (!currentProject) return
    try {
      const projectTestCases = await window.electronAPI.testCases.list(currentProject.id)
      setTestCases(projectTestCases)
    } catch (error) {
      console.error('Failed to load test cases:', error)
    }
  }, [currentProject])

  useEffect(() => {
    loadStories()
    loadTestCases()
  }, [loadStories, loadTestCases])

  const handleGenerateStory = async (): Promise<void> => {
    if (!currentProject || !newPrompt.trim()) return

    setIsGenerating(true)
    try {
      // Generate story from prompt using AI
      const generated = await window.electronAPI.stories.generateFromPrompt({
        projectId: currentProject.id,
        projectPath,
        prompt: newPrompt
      })

      // Create the story
      const story = await window.electronAPI.stories.create({
        projectId: currentProject.id,
        title: generated.title,
        description: generated.description,
        acceptanceCriteria: generated.acceptanceCriteria,
        priority: 'medium'
      })

      setStories((prev) => [story, ...prev])
      setSelectedStory(story)
      setNewPrompt('')
    } catch (error) {
      console.error('Failed to generate story:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleGenerateTestCases = async (): Promise<void> => {
    if (!selectedStory || !currentProject) return

    setIsGeneratingTests(true)
    try {
      const generatedTests = await window.electronAPI.testCases.generateFromStory({
        projectPath,
        userStory: {
          title: selectedStory.title,
          description: selectedStory.description || '',
          acceptanceCriteria: selectedStory.acceptanceCriteria || ''
        }
      })

      // Create test cases
      for (const test of generatedTests) {
        const testCase = await window.electronAPI.testCases.create({
          projectId: currentProject.id,
          userStoryId: selectedStory.id,
          title: test.title,
          description: test.description,
          preconditions: test.preconditions,
          steps: test.steps,
          expectedResult: test.expectedResult
        })
        setTestCases((prev) => [...prev, testCase])
      }
    } catch (error) {
      console.error('Failed to generate test cases:', error)
    } finally {
      setIsGeneratingTests(false)
    }
  }

  const handleStatusChange = async (storyId: string, status: UserStory['status']): Promise<void> => {
    try {
      const updated = await window.electronAPI.stories.update(storyId, { status })
      if (updated) {
        setStories((prev) => prev.map((s) => (s.id === storyId ? updated : s)))
        if (selectedStory?.id === storyId) {
          setSelectedStory(updated)
        }
      }
    } catch (error) {
      console.error('Failed to update story status:', error)
    }
  }

  const storyTestCases = selectedStory
    ? testCases.filter((tc) => tc.userStoryId === selectedStory.id)
    : []

  return (
    <div className="flex flex-1 h-full bg-zinc-950">
      {/* Story List */}
      <div className="w-96 border-r border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-white mb-4">User Stories</h2>

          {/* Generate from prompt */}
          <textarea
            value={newPrompt}
            onChange={(e) => setNewPrompt(e.target.value)}
            placeholder="Describe a feature or requirement in natural language..."
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white mb-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
            rows={3}
          />

          <button
            onClick={handleGenerateStory}
            disabled={isGenerating || !newPrompt.trim()}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {isGenerating ? 'Generating...' : 'Generate User Story'}
          </button>
        </div>

        {/* Story List */}
        <div className="flex-1 overflow-y-auto">
          {stories.length === 0 ? (
            <div className="p-4 text-center text-zinc-500 text-sm">
              No user stories yet. Generate one above!
            </div>
          ) : (
            stories.map((story) => (
              <button
                key={story.id}
                onClick={() => setSelectedStory(story)}
                className={`w-full p-4 text-left border-b border-zinc-800 hover:bg-zinc-900 transition-colors ${
                  selectedStory?.id === story.id ? 'bg-zinc-900' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${STATUS_COLORS[story.status]}`}>
                    {story.status.replace('-', ' ')}
                  </span>
                  <span className={`text-xs ${PRIORITY_COLORS[story.priority]}`}>
                    {story.priority}
                  </span>
                </div>
                <h3 className="text-white font-medium text-sm truncate">{story.title}</h3>
                {story.description && (
                  <p className="text-xs text-zinc-500 mt-1 truncate">{story.description}</p>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Story Detail */}
      <div className="flex-1 flex flex-col">
        {selectedStory ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-zinc-800">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-white">{selectedStory.title}</h3>
                <select
                  value={selectedStory.status}
                  onChange={(e) =>
                    handleStatusChange(selectedStory.id, e.target.value as UserStory['status'])
                  }
                  className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-white"
                >
                  <option value="backlog">Backlog</option>
                  <option value="todo">To Do</option>
                  <option value="in-progress">In Progress</option>
                  <option value="review">Review</option>
                  <option value="done">Done</option>
                </select>
              </div>

              {selectedStory.description && (
                <p className="text-sm text-zinc-400 mb-4">{selectedStory.description}</p>
              )}

              {selectedStory.acceptanceCriteria && (
                <div className="bg-zinc-900 rounded-lg p-3">
                  <h4 className="text-xs font-semibold text-zinc-500 uppercase mb-2">
                    Acceptance Criteria
                  </h4>
                  <pre className="text-sm text-zinc-300 whitespace-pre-wrap">
                    {selectedStory.acceptanceCriteria}
                  </pre>
                </div>
              )}
            </div>

            {/* Test Cases Section */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold text-white">Test Cases</h4>
                <button
                  onClick={handleGenerateTestCases}
                  disabled={isGeneratingTests}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 text-white text-xs font-medium py-1.5 px-3 rounded-lg transition-colors flex items-center gap-2"
                >
                  {isGeneratingTests ? (
                    'Generating...'
                  ) : (
                    <>
                      <TestTube className="w-4 h-4" />
                      Generate Test Cases
                    </>
                  )}
                </button>
              </div>

              {storyTestCases.length === 0 ? (
                <div className="text-center text-zinc-500 text-sm py-8">
                  No test cases yet. Generate them using the button above!
                </div>
              ) : (
                <div className="space-y-3">
                  {storyTestCases.map((tc) => (
                    <div key={tc.id} className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-white font-medium text-sm">{tc.title}</h5>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          tc.status === 'passed'
                            ? 'bg-green-600 text-green-100'
                            : tc.status === 'failed'
                            ? 'bg-red-600 text-red-100'
                            : 'bg-zinc-600 text-zinc-300'
                        }`}>
                          {tc.status}
                        </span>
                      </div>

                      {tc.description && (
                        <p className="text-xs text-zinc-400 mb-3">{tc.description}</p>
                      )}

                      {tc.preconditions && (
                        <div className="mb-2">
                          <span className="text-xs text-zinc-500 font-medium">Preconditions:</span>
                          <p className="text-xs text-zinc-400">{tc.preconditions}</p>
                        </div>
                      )}

                      {tc.steps && (
                        <div className="mb-2">
                          <span className="text-xs text-zinc-500 font-medium">Steps:</span>
                          <pre className="text-xs text-zinc-400 whitespace-pre-wrap">{tc.steps}</pre>
                        </div>
                      )}

                      {tc.expectedResult && (
                        <div>
                          <span className="text-xs text-zinc-500 font-medium">Expected Result:</span>
                          <p className="text-xs text-zinc-400">{tc.expectedResult}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FileText className="w-12 h-12 mx-auto mb-4 text-zinc-600" />
              <p className="text-zinc-500">Select a user story to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
