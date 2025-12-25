import { useState, useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '../stores/appStore'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import type { AgentMessage, FileNode, AgentType } from '@shared/types'
import { ThinkingBlock } from './ThinkingBlock'
import { TodoList } from './TodoList'
import { SubAgentPanel } from './SubAgentPanel'
import { useToast } from './Toast'
import {
  X,
  Plus,
  Clock,
  Trash2,
  RefreshCw,
  ChevronRight,
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FileJson,
  FileType,
  File,
  Globe,
  Settings
} from 'lucide-react'
import { AgentIcon } from '../utils/icons'

const AGENT_NAMES: Record<string, string> = {
  developer: 'Developer Agent',
  'product-owner': 'Product Owner Agent',
  tester: 'Test Agent',
  security: 'Security Agent',
  devops: 'DevOps Agent',
  documentation: 'Documentation Agent'
}

export function ChatPanel(): JSX.Element {
  const {
    currentProject,
    currentAgentType,
    messages,
    addMessage,
    updateMessage,
    appendMessageContent,
    isLoading,
    setIsLoading,
    currentSessionId,
    setCurrentSessionId,
    sessions,
    setSessions,
    addSession,
    setMessages,
    showSessionHistory,
    setShowSessionHistory
  } = useAppStore()
  const toast = useToast()

  const [input, setInput] = useState('')
  const [showFilePanel, setShowFilePanel] = useState(false)
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
  const [loadingFiles, setLoadingFiles] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const streamCleanupRef = useRef<(() => void) | null>(null)

  // Load sessions when project changes
  useEffect(() => {
    if (currentProject) {
      window.electronAPI.sessions.list(currentProject.id).then((loadedSessions) => {
        setSessions(loadedSessions)
      })
    }
  }, [currentProject, setSessions])

  // Load file tree when file panel is opened
  const loadFileTree = useCallback(async () => {
    if (!currentProject) return
    setLoadingFiles(true)
    try {
      const tree = await window.electronAPI.files.getTree(currentProject.path)
      setFileTree(tree)
    } catch (error) {
      console.error('Failed to load file tree:', error)
    }
    setLoadingFiles(false)
  }, [currentProject])

  useEffect(() => {
    if (showFilePanel && fileTree.length === 0 && currentProject) {
      loadFileTree()
    }
  }, [showFilePanel, fileTree.length, currentProject, loadFileTree])

  // Clear selected files when project changes
  useEffect(() => {
    setSelectedFiles([])
    setFileTree([])
    setExpandedDirs(new Set())
  }, [currentProject?.id])

  const toggleFileSelection = useCallback((filePath: string) => {
    setSelectedFiles(prev =>
      prev.includes(filePath)
        ? prev.filter(p => p !== filePath)
        : [...prev, filePath]
    )
  }, [])

  const toggleDirectory = useCallback((dirPath: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev)
      if (next.has(dirPath)) {
        next.delete(dirPath)
      } else {
        next.add(dirPath)
      }
      return next
    })
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [currentAgentType])

  // Cleanup stream listener on unmount
  useEffect(() => {
    return () => {
      streamCleanupRef.current?.()
    }
  }, [])

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading || !currentProject) return

    const messageContent = input.trim()
    setInput('')
    setIsLoading(true)

    // Create or get session
    let sessionId = currentSessionId
    if (!sessionId) {
      try {
        const newSession = await window.electronAPI.sessions.create({
          projectId: currentProject.id,
          agentType: currentAgentType
        })
        sessionId = newSession.id
        setCurrentSessionId(sessionId)
        addSession(newSession)
      } catch (error) {
        console.error('Failed to create session:', error)
        toast.error('Session Error', 'Failed to create chat session')
      }
    }

    // Save user message to database
    let userMessage: AgentMessage
    if (sessionId) {
      try {
        userMessage = await window.electronAPI.sessions.addMessage(sessionId, {
          role: 'user',
          content: messageContent,
          agentType: undefined
        })
      } catch (error) {
        console.error('Failed to save user message:', error)
        userMessage = {
          id: `msg-${Date.now()}`,
          role: 'user',
          content: messageContent,
          timestamp: new Date()
        }
      }
    } else {
      userMessage = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: messageContent,
        timestamp: new Date()
      }
    }

    addMessage(userMessage)

    // Create assistant message placeholder
    const assistantMessageId = `msg-${Date.now()}-assistant`
    const assistantMessage: AgentMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      agentType: currentAgentType,
      isStreaming: true
    }
    addMessage(assistantMessage)

    let fullResponseContent = ''
    let accumulatedThinking = ''
    let accumulatedTodos: Array<{ content: string; status: string; activeForm: string }> = []

    // Set up stream listener - handles structured JSON stream events
    streamCleanupRef.current = window.electronAPI.claude.onStream(async (data) => {
      if (data.type === 'chunk' && data.content) {
        fullResponseContent += data.content
        appendMessageContent(assistantMessageId, data.content)
      } else if (data.type === 'thinking' && data.thinking) {
        // Accumulate thinking content
        accumulatedThinking += data.thinking
        updateMessage(assistantMessageId, { thinking: accumulatedThinking })
      } else if (data.type === 'todos' && data.todos) {
        // Update todos list
        accumulatedTodos = data.todos
        updateMessage(assistantMessageId, { todos: accumulatedTodos })
      } else if (data.type === 'tool_call' && data.toolCall) {
        // Could track tool calls for SubAgentPanel
        console.log('[ChatPanel] Tool call:', data.toolCall)
      } else if (data.type === 'complete') {
        const finalContent = data.content || fullResponseContent
        updateMessage(assistantMessageId, {
          isStreaming: false,
          content: finalContent,
          // Include structured data from completion event
          thinking: data.thinking || accumulatedThinking || undefined,
          todos: data.todos || (accumulatedTodos.length > 0 ? accumulatedTodos : undefined)
        })

        // Save assistant message to database
        if (sessionId) {
          try {
            await window.electronAPI.sessions.addMessage(sessionId, {
              role: 'assistant',
              content: finalContent,
              agentType: currentAgentType
            })
          } catch (error) {
            console.error('Failed to save assistant message:', error)
          }
        }

        setIsLoading(false)
        streamCleanupRef.current?.()
        streamCleanupRef.current = null
      } else if (data.type === 'error') {
        updateMessage(assistantMessageId, {
          isStreaming: false,
          content: `Error: ${data.error}`
        })
        setIsLoading(false)
        streamCleanupRef.current?.()
        streamCleanupRef.current = null
      }
    })

    try {
      // Build message with file context if files are selected
      let finalMessage = messageContent
      if (selectedFiles.length > 0) {
        try {
          const fileContext = await window.electronAPI.files.getContext(selectedFiles, currentProject.path)
          finalMessage = `${messageContent}\n\n---\n\n**Context from selected files:**\n\n${fileContext}`
        } catch (error) {
          console.error('Failed to get file context:', error)
        }
      }

      await window.electronAPI.claude.sendMessage({
        message: finalMessage,
        projectPath: currentProject.path,
        agentType: currentAgentType
      })
    } catch (error) {
      updateMessage(assistantMessageId, {
        isStreaming: false,
        content: `Error: ${error instanceof Error ? error.message : 'Failed to send message'}`
      })
      setIsLoading(false)
    }
  }, [input, isLoading, currentProject, currentAgentType, currentSessionId, addMessage, updateMessage, appendMessageContent, setIsLoading, setCurrentSessionId, addSession])

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleCancel = async (): Promise<void> => {
    try {
      await window.electronAPI.claude.cancel()
      setIsLoading(false)
      toast.info('Cancelled', 'Request cancelled')
    } catch (error) {
      console.error('Failed to cancel:', error)
      toast.error('Cancel Failed', 'Could not cancel the request')
    }
  }

  const loadSession = useCallback(async (sessionId: string) => {
    try {
      const session = await window.electronAPI.sessions.get(sessionId)
      if (session) {
        setCurrentSessionId(sessionId)
        setMessages(session.messages)
        setShowSessionHistory(false)
      }
    } catch (error) {
      console.error('Failed to load session:', error)
      toast.error('Load Failed', 'Could not load chat session')
    }
  }, [setCurrentSessionId, setMessages, setShowSessionHistory, toast])

  const startNewChat = useCallback(() => {
    setCurrentSessionId(null)
    setMessages([])
    setShowSessionHistory(false)
  }, [setCurrentSessionId, setMessages, setShowSessionHistory])

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await window.electronAPI.sessions.delete(sessionId)
      setSessions(sessions.filter(s => s.id !== sessionId))
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null)
        setMessages([])
      }
      toast.success('Deleted', 'Session deleted')
    } catch (error) {
      console.error('Failed to delete session:', error)
      toast.error('Delete Failed', 'Could not delete session')
    }
  }, [sessions, currentSessionId, setSessions, setCurrentSessionId, setMessages, toast])

  // Filter sessions by current agent type
  const filteredSessions = sessions.filter(s => s.agentType === currentAgentType)

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Session History Sidebar */}
      {showSessionHistory && (
        <div className="w-64 border-r border-border bg-card/30 flex flex-col">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <h3 className="font-medium text-sm">Chat History</h3>
            <button
              onClick={() => setShowSessionHistory(false)}
              className="p-1 hover:bg-secondary rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-2">
            <button
              onClick={startNewChat}
              className="w-full p-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 flex items-center gap-2 justify-center"
            >
              <Plus className="w-4 h-4" />
              New Chat
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredSessions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No previous chats</p>
            ) : (
              filteredSessions.map((session) => (
                <div
                  key={session.id}
                  className={`group p-2 rounded-lg cursor-pointer text-sm hover:bg-secondary transition-colors ${
                    currentSessionId === session.id ? 'bg-secondary' : ''
                  }`}
                  onClick={() => loadSession(session.id)}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate flex-1">
                      {new Date(session.createdAt).toLocaleDateString()}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteSession(session.id)
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/20 rounded transition-opacity"
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {new Date(session.createdAt).toLocaleTimeString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Agent header */}
        <div className="p-4 border-b border-border bg-card/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AgentIcon agentType={currentAgentType as AgentType} size="lg" />
              <h2 className="font-semibold">{AGENT_NAMES[currentAgentType]}</h2>
              {filteredSessions.length > 0 && (
                <span className="text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">
                  {filteredSessions.length} chats
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSessionHistory(!showSessionHistory)}
                className={`p-2 rounded-lg transition-colors ${
                  showSessionHistory ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'
                }`}
                title="Chat History"
              >
                <Clock className="w-5 h-5" />
              </button>
              <button
                onClick={startNewChat}
                className="p-2 hover:bg-secondary rounded-lg transition-colors"
                title="New Chat"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <EmptyState agentType={currentAgentType} onSuggestionClick={(suggestion) => {
            setInput(suggestion)
            // Auto-send after setting input
            setTimeout(() => {
              inputRef.current?.focus()
            }, 0)
          }} />
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* File Context Panel */}
      {showFilePanel && (
        <div className="border-t border-border bg-card/30 max-h-64 flex flex-col">
          <div className="p-2 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Add Files to Context</span>
              {selectedFiles.length > 0 && (
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                  {selectedFiles.length} selected
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selectedFiles.length > 0 && (
                <button
                  onClick={() => setSelectedFiles([])}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
              <button
                onClick={loadFileTree}
                className="p-1 hover:bg-secondary rounded"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowFilePanel(false)}
                className="p-1 hover:bg-secondary rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {loadingFiles ? (
              <div className="flex items-center justify-center py-4">
                <span className="text-sm text-muted-foreground">Loading files...</span>
              </div>
            ) : fileTree.length === 0 ? (
              <div className="flex items-center justify-center py-4">
                <span className="text-sm text-muted-foreground">No code files found</span>
              </div>
            ) : (
              <FileTree
                nodes={fileTree}
                selectedFiles={selectedFiles}
                expandedDirs={expandedDirs}
                onFileToggle={toggleFileSelection}
                onDirToggle={toggleDirectory}
              />
            )}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="p-4 border-t border-border bg-card/50">
        {/* Selected files indicator */}
        {selectedFiles.length > 0 && !showFilePanel && (
          <div className="mb-2 flex flex-wrap gap-1">
            {selectedFiles.slice(0, 3).map((file) => (
              <span
                key={file}
                className="text-xs bg-primary/20 text-primary px-2 py-1 rounded flex items-center gap-1"
              >
                <FileText className="w-3 h-3" />
                {file.split('/').pop()}
                <button
                  onClick={() => toggleFileSelection(file)}
                  className="hover:text-destructive"
                >
                  ×
                </button>
              </span>
            ))}
            {selectedFiles.length > 3 && (
              <span className="text-xs text-muted-foreground px-2 py-1">
                +{selectedFiles.length - 3} more
              </span>
            )}
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilePanel(!showFilePanel)}
            className={`p-3 rounded-lg transition-colors flex-shrink-0 ${
              showFilePanel || selectedFiles.length > 0
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary hover:bg-secondary/80'
            }`}
            title="Add files to context"
          >
            <Folder className="w-5 h-5" />
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask ${AGENT_NAMES[currentAgentType]}...`}
            className="flex-1 min-h-[60px] max-h-32 p-3 bg-secondary rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            disabled={isLoading}
          />
          <div className="flex flex-col gap-2">
            {isLoading ? (
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:opacity-90 transition-opacity"
              >
                Cancel
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Press Enter to send, Shift+Enter for new line
          {selectedFiles.length > 0 && ` • ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} attached`}
        </p>
      </div>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: AgentMessage }): JSX.Element {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] p-4 rounded-lg ${
          isUser ? 'bg-primary text-primary-foreground' : 'bg-secondary/80'
        }`}
      >
        {message.isStreaming && !message.content ? (
          <div className="typing-indicator flex gap-1">
            <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        ) : isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <>
            {/* Thinking block - collapsible */}
            {message.thinking && (
              <ThinkingBlock thinking={message.thinking} isStreaming={message.isStreaming} />
            )}

            {/* Todo list - shows agent's task progress */}
            {message.todos && message.todos.length > 0 && (
              <TodoList todos={message.todos} isStreaming={message.isStreaming} />
            )}

            {/* Sub-agent actions - shows spawned agents */}
            {message.subAgentActions && message.subAgentActions.length > 0 && (
              <SubAgentPanel actions={message.subAgentActions} isStreaming={message.isStreaming} />
            )}

            {/* Main response content */}
          <div className="prose prose-sm max-w-none text-foreground">
            <ReactMarkdown
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '')
                  const isInline = !match && !className
                  return isInline ? (
                    <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                      {children}
                    </code>
                  ) : (
                    <SyntaxHighlighter
                      style={oneDark}
                      language={match ? match[1] : 'text'}
                      PreTag="div"
                      className="rounded-lg !bg-[#1a1a2e] !mt-2 !mb-2"
                      customStyle={{ fontSize: '13px', padding: '1rem' }}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  )
                },
                p({ children }) {
                  return <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>
                },
                h1({ children }) {
                  return <h1 className="text-xl font-bold mt-4 mb-2 first:mt-0">{children}</h1>
                },
                h2({ children }) {
                  return <h2 className="text-lg font-bold mt-4 mb-2 first:mt-0">{children}</h2>
                },
                h3({ children }) {
                  return <h3 className="text-base font-semibold mt-3 mb-2 first:mt-0">{children}</h3>
                },
                ul({ children }) {
                  return <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>
                },
                ol({ children }) {
                  return <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>
                },
                li({ children }) {
                  return <li className="leading-relaxed">{children}</li>
                },
                strong({ children }) {
                  return <strong className="font-semibold">{children}</strong>
                },
                blockquote({ children }) {
                  return (
                    <blockquote className="border-l-4 border-primary/50 pl-4 italic my-3 text-muted-foreground">
                      {children}
                    </blockquote>
                  )
                },
                hr() {
                  return <hr className="my-4 border-border" />
                },
                a({ href, children }) {
                  return (
                    <a href={href} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                      {children}
                    </a>
                  )
                }
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
          </>
        )}
        {message.isStreaming && message.content && (
          <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
        )}
      </div>
    </div>
  )
}

function EmptyState({ agentType, onSuggestionClick }: { agentType: string; onSuggestionClick: (suggestion: string) => void }): JSX.Element {
  const suggestions: Record<string, string[]> = {
    developer: [
      'Explain the architecture of this project',
      'Find potential bugs in the codebase',
      'Suggest refactoring opportunities',
      'Help me implement a new feature'
    ],
    'product-owner': [
      'Create a user story for login functionality',
      'Generate acceptance criteria for this feature',
      'Help prioritize the backlog',
      'Write a sprint goal'
    ],
    tester: [
      'Generate test cases for the auth module',
      'Create e2e test scenarios',
      'Identify edge cases to test',
      'Write a test plan'
    ],
    security: [
      'Scan for security vulnerabilities',
      'Review authentication implementation',
      'Check for OWASP Top 10 issues',
      'Audit npm dependencies'
    ],
    devops: [
      'Create a GitHub Actions workflow',
      'Generate a Dockerfile',
      'Set up a CI/CD pipeline',
      'Create infrastructure with Terraform'
    ],
    documentation: [
      'Generate API documentation',
      'Create a README for this project',
      'Document the deployment process',
      'Write inline code comments'
    ]
  }

  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <h3 className="text-lg font-medium mb-2">Start a conversation</h3>
      <p className="text-muted-foreground mb-6">
        Ask {AGENT_NAMES[agentType]} anything about your project
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-lg">
        {suggestions[agentType]?.map((suggestion, i) => (
          <button
            key={i}
            onClick={() => onSuggestionClick(suggestion)}
            className="p-3 text-sm text-left bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  )
}

// File tree component for selecting files
interface FileTreeProps {
  nodes: FileNode[]
  selectedFiles: string[]
  expandedDirs: Set<string>
  onFileToggle: (path: string) => void
  onDirToggle: (path: string) => void
  depth?: number
}

function FileTree({ nodes, selectedFiles, expandedDirs, onFileToggle, onDirToggle, depth = 0 }: FileTreeProps): JSX.Element {
  return (
    <div className="space-y-0.5">
      {nodes.map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          selectedFiles={selectedFiles}
          expandedDirs={expandedDirs}
          onFileToggle={onFileToggle}
          onDirToggle={onDirToggle}
          depth={depth}
        />
      ))}
    </div>
  )
}

interface FileTreeNodeProps {
  node: FileNode
  selectedFiles: string[]
  expandedDirs: Set<string>
  onFileToggle: (path: string) => void
  onDirToggle: (path: string) => void
  depth: number
}

function FileTreeNode({ node, selectedFiles, expandedDirs, onFileToggle, onDirToggle, depth }: FileTreeNodeProps): JSX.Element {
  const isDir = node.type === 'directory'
  const isExpanded = expandedDirs.has(node.path)
  const isSelected = selectedFiles.includes(node.path)

  const getFileIconComponent = (ext?: string): JSX.Element => {
    const codeExts = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.sh']
    const configExts = ['.yaml', '.yml']

    if (ext === '.json') return <FileJson className="w-3 h-3 text-yellow-400" />
    if (ext === '.md') return <FileText className="w-3 h-3 text-blue-400" />
    if (ext === '.html') return <Globe className="w-3 h-3 text-orange-400" />
    if (ext === '.css' || ext === '.scss') return <FileType className="w-3 h-3 text-pink-400" />
    if (configExts.includes(ext || '')) return <Settings className="w-3 h-3 text-zinc-400" />
    if (codeExts.includes(ext || '')) return <FileCode className="w-3 h-3 text-blue-400" />
    return <File className="w-3 h-3 text-zinc-400" />
  }

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1 px-2 rounded cursor-pointer text-sm hover:bg-secondary/50 ${
          isSelected ? 'bg-primary/20' : ''
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => isDir ? onDirToggle(node.path) : onFileToggle(node.path)}
      >
        {isDir ? (
          <>
            <ChevronRight
              className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            />
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 text-violet-400" />
            ) : (
              <Folder className="w-4 h-4 text-violet-400" />
            )}
          </>
        ) : (
          <>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onFileToggle(node.path)}
              onClick={(e) => e.stopPropagation()}
              className="w-3 h-3 accent-primary"
            />
            {getFileIconComponent(node.extension)}
          </>
        )}
        <span className="truncate">{node.name}</span>
        {node.size && (
          <span className="text-xs text-muted-foreground ml-auto">
            {node.size > 1024 ? `${(node.size / 1024).toFixed(1)}KB` : `${node.size}B`}
          </span>
        )}
      </div>
      {isDir && isExpanded && node.children && (
        <FileTree
          nodes={node.children}
          selectedFiles={selectedFiles}
          expandedDirs={expandedDirs}
          onFileToggle={onFileToggle}
          onDirToggle={onDirToggle}
          depth={depth + 1}
        />
      )}
    </div>
  )
}
