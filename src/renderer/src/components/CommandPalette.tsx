import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useAppStore } from '../stores/appStore'
import {
  Search,
  LayoutDashboard,
  MessageSquare,
  FileText,
  Calendar,
  Map,
  ListTodo,
  GitBranch,
  Workflow,
  Code,
  UserCircle,
  TestTube,
  Shield,
  Server,
  BookOpen,
  Plus,
  HelpCircle,
  Command,
  ArrowRight
} from 'lucide-react'

// Platform detection
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0

interface CommandItem {
  id: string
  label: string
  description?: string
  icon: JSX.Element
  shortcut?: string
  category: 'navigation' | 'agents' | 'actions' | 'help'
  action: () => void
  keywords?: string[]
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps): JSX.Element | null {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const {
    currentProject,
    setViewMode,
    setCurrentAgentType,
    toggleSidebar,
    setShowTutorial,
    clearMessages
  } = useAppStore()

  // Define all commands
  const commands = useMemo<CommandItem[]>(() => {
    const navCommands: CommandItem[] = [
      {
        id: 'nav-dashboard',
        label: 'Dashboard',
        description: 'Project overview and metrics',
        icon: <LayoutDashboard className="w-4 h-4" />,
        shortcut: isMac ? '⌘1' : 'Ctrl+1',
        category: 'navigation',
        action: () => {
          if (currentProject) setViewMode('dashboard')
          onClose()
        },
        keywords: ['home', 'overview', 'main']
      },
      {
        id: 'nav-chat',
        label: 'Chat',
        description: 'AI agent conversations',
        icon: <MessageSquare className="w-4 h-4" />,
        shortcut: isMac ? '⌘2' : 'Ctrl+2',
        category: 'navigation',
        action: () => {
          if (currentProject) setViewMode('chat')
          onClose()
        },
        keywords: ['conversation', 'message', 'talk', 'ai']
      },
      {
        id: 'nav-stories',
        label: 'User Stories',
        description: 'Manage user stories and requirements',
        icon: <FileText className="w-4 h-4" />,
        shortcut: isMac ? '⌘3' : 'Ctrl+3',
        category: 'navigation',
        action: () => {
          if (currentProject) setViewMode('stories')
          onClose()
        },
        keywords: ['requirements', 'backlog', 'features']
      },
      {
        id: 'nav-sprints',
        label: 'Sprints',
        description: 'Sprint planning and kanban board',
        icon: <Calendar className="w-4 h-4" />,
        shortcut: isMac ? '⌘4' : 'Ctrl+4',
        category: 'navigation',
        action: () => {
          if (currentProject) setViewMode('sprints')
          onClose()
        },
        keywords: ['kanban', 'board', 'planning', 'iteration']
      },
      {
        id: 'nav-roadmap',
        label: 'Roadmap',
        description: 'Project timeline and milestones',
        icon: <Map className="w-4 h-4" />,
        shortcut: isMac ? '⌘5' : 'Ctrl+5',
        category: 'navigation',
        action: () => {
          if (currentProject) setViewMode('roadmap')
          onClose()
        },
        keywords: ['timeline', 'milestones', 'plan', 'future']
      },
      {
        id: 'nav-tasks',
        label: 'Task Queue',
        description: 'Autonomous task execution',
        icon: <ListTodo className="w-4 h-4" />,
        shortcut: isMac ? '⌘6' : 'Ctrl+6',
        category: 'navigation',
        action: () => {
          if (currentProject) setViewMode('task-queue')
          onClose()
        },
        keywords: ['queue', 'automation', 'jobs']
      },
      {
        id: 'nav-git',
        label: 'Git',
        description: 'Version control and commits',
        icon: <GitBranch className="w-4 h-4" />,
        shortcut: isMac ? '⌘7' : 'Ctrl+7',
        category: 'navigation',
        action: () => {
          if (currentProject) setViewMode('git')
          onClose()
        },
        keywords: ['version', 'commit', 'branch', 'source']
      },
      {
        id: 'nav-workflows',
        label: 'Workflows',
        description: 'Multi-agent pipelines',
        icon: <Workflow className="w-4 h-4" />,
        shortcut: isMac ? '⌘8' : 'Ctrl+8',
        category: 'navigation',
        action: () => {
          if (currentProject) setViewMode('workflows')
          onClose()
        },
        keywords: ['pipeline', 'automation', 'agents']
      }
    ]

    const agentCommands: CommandItem[] = [
      {
        id: 'agent-developer',
        label: 'Developer Agent',
        description: 'Code development and architecture',
        icon: <Code className="w-4 h-4" />,
        category: 'agents',
        action: () => {
          setCurrentAgentType('developer')
          if (currentProject) setViewMode('chat')
          onClose()
        },
        keywords: ['code', 'programming', 'development']
      },
      {
        id: 'agent-po',
        label: 'Product Owner Agent',
        description: 'Requirements and user stories',
        icon: <UserCircle className="w-4 h-4" />,
        category: 'agents',
        action: () => {
          setCurrentAgentType('product-owner')
          if (currentProject) setViewMode('chat')
          onClose()
        },
        keywords: ['product', 'requirements', 'stories', 'backlog']
      },
      {
        id: 'agent-tester',
        label: 'Test Agent',
        description: 'Test cases and QA',
        icon: <TestTube className="w-4 h-4" />,
        category: 'agents',
        action: () => {
          setCurrentAgentType('tester')
          if (currentProject) setViewMode('chat')
          onClose()
        },
        keywords: ['test', 'qa', 'quality', 'testing']
      },
      {
        id: 'agent-security',
        label: 'Security Agent',
        description: 'Security audits and vulnerabilities',
        icon: <Shield className="w-4 h-4" />,
        category: 'agents',
        action: () => {
          setCurrentAgentType('security')
          if (currentProject) setViewMode('chat')
          onClose()
        },
        keywords: ['security', 'audit', 'vulnerability', 'owasp']
      },
      {
        id: 'agent-devops',
        label: 'DevOps Agent',
        description: 'CI/CD and infrastructure',
        icon: <Server className="w-4 h-4" />,
        category: 'agents',
        action: () => {
          setCurrentAgentType('devops')
          if (currentProject) setViewMode('chat')
          onClose()
        },
        keywords: ['devops', 'ci', 'cd', 'deploy', 'infrastructure']
      },
      {
        id: 'agent-docs',
        label: 'Documentation Agent',
        description: 'Documentation and README',
        icon: <BookOpen className="w-4 h-4" />,
        category: 'agents',
        action: () => {
          setCurrentAgentType('documentation')
          if (currentProject) setViewMode('chat')
          onClose()
        },
        keywords: ['docs', 'documentation', 'readme', 'api']
      }
    ]

    const actionCommands: CommandItem[] = [
      {
        id: 'action-new-chat',
        label: 'New Chat',
        description: 'Start a fresh conversation',
        icon: <Plus className="w-4 h-4" />,
        shortcut: isMac ? '⌘N' : 'Ctrl+N',
        category: 'actions',
        action: () => {
          clearMessages()
          if (currentProject) setViewMode('chat')
          onClose()
        },
        keywords: ['new', 'fresh', 'clear']
      },
      {
        id: 'action-toggle-sidebar',
        label: 'Toggle Sidebar',
        description: 'Show or hide the sidebar',
        icon: <LayoutDashboard className="w-4 h-4" />,
        shortcut: isMac ? '⌘B' : 'Ctrl+B',
        category: 'actions',
        action: () => {
          toggleSidebar()
          onClose()
        },
        keywords: ['sidebar', 'panel', 'hide', 'show']
      }
    ]

    const helpCommands: CommandItem[] = [
      {
        id: 'help-tutorial',
        label: 'Open Tutorial',
        description: 'Learn how to use Claude DevStudio',
        icon: <HelpCircle className="w-4 h-4" />,
        shortcut: '?',
        category: 'help',
        action: () => {
          setShowTutorial(true)
          onClose()
        },
        keywords: ['help', 'tutorial', 'guide', 'learn']
      },
      {
        id: 'help-shortcuts',
        label: 'Keyboard Shortcuts',
        description: 'View all keyboard shortcuts',
        icon: <Command className="w-4 h-4" />,
        category: 'help',
        action: () => {
          setShowTutorial(true)
          onClose()
        },
        keywords: ['keyboard', 'shortcuts', 'hotkeys']
      }
    ]

    return [...navCommands, ...agentCommands, ...actionCommands, ...helpCommands]
  }, [currentProject, setViewMode, setCurrentAgentType, toggleSidebar, setShowTutorial, clearMessages, onClose])

  // Fuzzy search filter
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands

    const lowerQuery = query.toLowerCase()
    return commands.filter((cmd) => {
      const searchText = [
        cmd.label,
        cmd.description,
        ...(cmd.keywords || [])
      ].join(' ').toLowerCase()

      // Simple fuzzy match - check if all query chars exist in order
      let queryIndex = 0
      for (const char of searchText) {
        if (char === lowerQuery[queryIndex]) {
          queryIndex++
          if (queryIndex === lowerQuery.length) return true
        }
      }

      // Also check direct includes
      return searchText.includes(lowerQuery)
    })
  }, [commands, query])

  // Group by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {
      navigation: [],
      agents: [],
      actions: [],
      help: []
    }

    filteredCommands.forEach((cmd) => {
      groups[cmd.category].push(cmd)
    })

    return groups
  }, [filteredCommands])

  // Category labels
  const categoryLabels: Record<string, string> = {
    navigation: 'Navigation',
    agents: 'Switch Agent',
    actions: 'Actions',
    help: 'Help'
  }

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [isOpen])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev < filteredCommands.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action()
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }, [filteredCommands, selectedIndex, onClose])

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`)
    selectedElement?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (!isOpen) return null

  let flatIndex = -1

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-fade-in"
        onClick={onClose}
      />

      {/* Palette */}
      <div className="fixed left-1/2 top-[20%] -translate-x-1/2 w-full max-w-xl z-50 animate-scale-in">
        <div className="bg-card border border-border/50 rounded-2xl shadow-2xl overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
            <Search className="w-5 h-5 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a command or search..."
              className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground/50 focus:outline-none text-base"
            />
            <kbd className="hidden sm:inline-flex px-2 py-1 text-xs bg-secondary rounded-md text-muted-foreground">
              esc
            </kbd>
          </div>

          {/* Command list */}
          <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2">
            {filteredCommands.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <p>No commands found</p>
                <p className="text-sm mt-1">Try a different search term</p>
              </div>
            ) : (
              Object.entries(groupedCommands).map(([category, items]) => {
                if (items.length === 0) return null

                return (
                  <div key={category} className="mb-2 last:mb-0">
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {categoryLabels[category]}
                    </div>
                    {items.map((cmd) => {
                      flatIndex++
                      const isSelected = flatIndex === selectedIndex

                      return (
                        <button
                          key={cmd.id}
                          data-index={flatIndex}
                          onClick={cmd.action}
                          onMouseEnter={() => setSelectedIndex(flatIndex)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                            isSelected
                              ? 'bg-primary/10 text-foreground'
                              : 'text-foreground/80 hover:bg-secondary/50'
                          }`}
                        >
                          <span className={`flex-shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
                            {cmd.icon}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{cmd.label}</div>
                            {cmd.description && (
                              <div className="text-xs text-muted-foreground truncate">
                                {cmd.description}
                              </div>
                            )}
                          </div>
                          {cmd.shortcut && (
                            <kbd className="flex-shrink-0 px-2 py-1 text-xs bg-secondary/80 rounded-md text-muted-foreground">
                              {cmd.shortcut}
                            </kbd>
                          )}
                          {isSelected && (
                            <ArrowRight className="w-4 h-4 text-primary flex-shrink-0" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                )
              })
            )}
          </div>

          {/* Footer hint */}
          <div className="px-4 py-2 border-t border-border/50 bg-secondary/30">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-secondary rounded">↑</kbd>
                  <kbd className="px-1.5 py-0.5 bg-secondary rounded">↓</kbd>
                  <span>navigate</span>
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-secondary rounded">↵</kbd>
                  <span>select</span>
                </span>
              </div>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-secondary rounded">{isMac ? '⌘' : 'Ctrl'}</kbd>
                <kbd className="px-1.5 py-0.5 bg-secondary rounded">K</kbd>
                <span>to open</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
