import { useState } from 'react'

interface TutorialModalProps {
  onClose: () => void
}

const TUTORIAL_SECTIONS = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: 'rocket',
    content: [
      {
        heading: 'Create or Open a Project',
        steps: [
          'Click "Open Project" to select an existing project folder',
          'Or click "New Project" to create a fresh project',
          'Once selected, all view buttons in the sidebar become enabled'
        ]
      },
      {
        heading: 'Navigate the App',
        steps: [
          'Use the sidebar to switch between views',
          'Keyboard shortcuts: Cmd+1 (Chat), Cmd+2 (Stories), etc.',
          'Toggle sidebar with the collapse button for more space'
        ]
      }
    ]
  },
  {
    id: 'ai-chat',
    title: 'AI Chat',
    icon: 'comments',
    content: [
      {
        heading: 'Talk to AI Agents',
        steps: [
          'Click "Chat" in the sidebar (Cmd+1)',
          'Select an agent type from the dropdown:',
          '  • Developer - Code implementation & debugging',
          '  • Product Owner - Requirements & user stories',
          '  • Tester - Test cases & QA strategies',
          '  • Security - Security audits & vulnerability checks',
          '  • DevOps - CI/CD & deployment automation',
          '  • Docs - Documentation generation'
        ]
      },
      {
        heading: 'Best Practices',
        steps: [
          'Be specific about what you need',
          'AI has context from your project files',
          'Use code snippets in your questions',
          'Session history is preserved per agent'
        ]
      }
    ]
  },
  {
    id: 'stories',
    title: 'User Stories',
    icon: 'book',
    content: [
      {
        heading: 'Create Stories',
        steps: [
          'Click "Stories" in the sidebar (Cmd+2)',
          'Click "+ Add Story" to create manually',
          'Fill in title, description, acceptance criteria',
          'Set priority and story points'
        ]
      },
      {
        heading: 'AI-Powered Generation',
        steps: [
          'Click "Generate from Prompt"',
          'Describe what you want in plain English',
          'AI creates a complete user story with acceptance criteria',
          'Edit and refine as needed'
        ]
      }
    ]
  },
  {
    id: 'sprints',
    title: 'Sprint Planning',
    icon: 'running',
    content: [
      {
        heading: 'Create a Sprint',
        steps: [
          'Click "Sprints" in the sidebar (Cmd+3)',
          'Click "New Sprint"',
          'Set sprint name, start/end dates, and goal',
          'Click "Create" to save'
        ]
      },
      {
        heading: 'Manage Sprint',
        steps: [
          'Drag stories from backlog into the sprint',
          'Track progress with status updates',
          'View velocity and burndown metrics',
          'Close sprint when complete'
        ]
      }
    ]
  },
  {
    id: 'roadmap',
    title: 'Roadmap',
    icon: 'map',
    content: [
      {
        heading: 'Views',
        steps: [
          'Click "Roadmap" in the sidebar (Cmd+4)',
          'Toggle between Timeline and Kanban views',
          'Timeline shows items by quarter',
          'Kanban organizes by Now / Next / Later lanes'
        ]
      },
      {
        heading: 'Create Items',
        steps: [
          'Click "+ Add Item"',
          'Choose type: Epic, Feature, or Milestone',
          'Set priority, target date, and owner',
          'Drag items between lanes to reprioritize'
        ]
      }
    ]
  },
  {
    id: 'task-queue',
    title: 'Autonomous Tasks',
    icon: 'robot',
    content: [
      {
        heading: 'Add Tasks',
        steps: [
          'Click "Tasks" in the sidebar (Cmd+5)',
          'Click "Add Task" to create a new task',
          'Select task type: Code Gen, Review, Testing, etc.',
          'Choose autonomy level:',
          '  • Auto - Runs without stopping',
          '  • Approval Gates - Pauses at checkpoints',
          '  • Supervised - Requires approval each step'
        ]
      },
      {
        heading: 'AI Task Decomposition',
        steps: [
          'Click "Decompose" for complex tasks',
          'Describe what you want to build',
          'AI breaks it into subtasks automatically',
          'Each subtask gets agent type & duration estimate',
          'Click "Decompose & Add" to queue all'
        ]
      },
      {
        heading: 'Run the Queue',
        steps: [
          'Click "Start" to begin execution',
          'Watch live output as tasks run',
          'Approval Gates pause for your review',
          'Approve or reject with notes',
          'Tech decisions show options to choose from'
        ]
      }
    ]
  },
  {
    id: 'git',
    title: 'Git Integration',
    icon: 'code-branch',
    content: [
      {
        heading: 'Version Control',
        steps: [
          'Click "Git" in the sidebar (Cmd+6)',
          'View current branch and status',
          'See modified, staged, and untracked files',
          'Review commit history'
        ]
      },
      {
        heading: 'Commit Changes',
        steps: [
          'Click files to stage them',
          'Write a commit message',
          'Click "Commit" to save',
          'Use Pull/Push for remote sync'
        ]
      }
    ]
  },
  {
    id: 'workflow',
    title: 'Example Workflow',
    icon: 'project-diagram',
    content: [
      {
        heading: 'Building a Feature End-to-End',
        steps: [
          '1. Roadmap: Create feature in "Now" lane',
          '2. Stories: Add user stories for the feature',
          '3. Sprints: Create sprint and add stories',
          '4. Tasks: Queue tasks for implementation',
          '   • Design API (Code Gen)',
          '   • Implement endpoints (Code Gen, Approval Gates)',
          '   • Write tests (Testing)',
          '   • Security review (Security Audit, Supervised)',
          '5. Start the task queue',
          '6. Review outputs at approval gates',
          '7. Git: Commit and push changes'
        ]
      }
    ]
  }
]

export function TutorialModal({ onClose }: TutorialModalProps): JSX.Element {
  const [activeSection, setActiveSection] = useState('getting-started')

  const currentSection = TUTORIAL_SECTIONS.find(s => s.id === activeSection)

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 w-full max-w-4xl h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <i className="fas fa-graduation-cap text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Getting Started Guide</h2>
              <p className="text-sm text-zinc-400">Learn how to use Claude DevStudio</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <i className="fas fa-times text-zinc-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar Navigation */}
          <div className="w-56 border-r border-zinc-800 p-3 overflow-y-auto">
            <nav className="space-y-1">
              {TUTORIAL_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-3 transition-colors ${
                    activeSection === section.id
                      ? 'bg-blue-600 text-white'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  <i className={`fas fa-${section.icon} w-4`} />
                  {section.title}
                </button>
              ))}
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {currentSection && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${
                    activeSection === 'task-queue' ? 'from-orange-500 to-red-600' :
                    activeSection === 'ai-chat' ? 'from-green-500 to-emerald-600' :
                    activeSection === 'roadmap' ? 'from-purple-500 to-pink-600' :
                    'from-blue-500 to-cyan-600'
                  } flex items-center justify-center`}>
                    <i className={`fas fa-${currentSection.icon} text-white text-lg`} />
                  </div>
                  <h3 className="text-2xl font-bold text-white">{currentSection.title}</h3>
                </div>

                {currentSection.content.map((block, i) => (
                  <div key={i} className="bg-zinc-800/50 rounded-xl p-5">
                    <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">
                        {i + 1}
                      </span>
                      {block.heading}
                    </h4>
                    <ul className="space-y-2">
                      {block.steps.map((step, j) => (
                        <li key={j} className="flex items-start gap-3 text-zinc-300">
                          {step.startsWith('  •') ? (
                            <span className="text-zinc-300 pl-6">{step}</span>
                          ) : step.match(/^\d\./) ? (
                            <span className="text-zinc-300">{step}</span>
                          ) : (
                            <>
                              <i className="fas fa-check text-green-500 mt-1 text-sm" />
                              <span>{step}</span>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

                {/* Tips for certain sections */}
                {activeSection === 'task-queue' && (
                  <div className="bg-amber-900/20 border border-amber-800/30 rounded-xl p-5">
                    <h4 className="text-amber-400 font-semibold mb-3 flex items-center gap-2">
                      <i className="fas fa-lightbulb" />
                      Pro Tips
                    </h4>
                    <ul className="space-y-2 text-sm text-amber-200/80">
                      <li>• Use <strong>Supervised</strong> mode for critical or security-related tasks</li>
                      <li>• <strong>Decompose</strong> large features - AI handles the breakdown</li>
                      <li>• Watch the <strong>live output</strong> panel while tasks execute</li>
                      <li>• Tech decisions show pros/cons to help you choose</li>
                    </ul>
                  </div>
                )}

                {activeSection === 'getting-started' && (
                  <div className="bg-blue-900/20 border border-blue-800/30 rounded-xl p-5">
                    <h4 className="text-blue-400 font-semibold mb-3 flex items-center gap-2">
                      <i className="fas fa-keyboard" />
                      Keyboard Shortcuts
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-3 py-2">
                        <span className="text-zinc-300">Chat</span>
                        <kbd className="bg-zinc-700 px-2 py-0.5 rounded text-xs text-zinc-300">Cmd+1</kbd>
                      </div>
                      <div className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-3 py-2">
                        <span className="text-zinc-300">Stories</span>
                        <kbd className="bg-zinc-700 px-2 py-0.5 rounded text-xs text-zinc-300">Cmd+2</kbd>
                      </div>
                      <div className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-3 py-2">
                        <span className="text-zinc-300">Sprints</span>
                        <kbd className="bg-zinc-700 px-2 py-0.5 rounded text-xs text-zinc-300">Cmd+3</kbd>
                      </div>
                      <div className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-3 py-2">
                        <span className="text-zinc-300">Roadmap</span>
                        <kbd className="bg-zinc-700 px-2 py-0.5 rounded text-xs text-zinc-300">Cmd+4</kbd>
                      </div>
                      <div className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-3 py-2">
                        <span className="text-zinc-300">Tasks</span>
                        <kbd className="bg-zinc-700 px-2 py-0.5 rounded text-xs text-zinc-300">Cmd+5</kbd>
                      </div>
                      <div className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-3 py-2">
                        <span className="text-zinc-300">Git</span>
                        <kbd className="bg-zinc-700 px-2 py-0.5 rounded text-xs text-zinc-300">Cmd+6</kbd>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 flex items-center justify-between">
          <p className="text-sm text-zinc-500">
            <i className="fas fa-info-circle mr-2" />
            Press <kbd className="bg-zinc-700 px-1.5 py-0.5 rounded text-xs mx-1">?</kbd> anytime to open this guide
          </p>
          <button
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-6 rounded-lg transition-colors"
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  )
}
