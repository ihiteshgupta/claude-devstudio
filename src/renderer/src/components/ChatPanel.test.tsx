/**
 * Copyright (c) 2025 Claude DevStudio
 *
 * ChatPanel Component Tests
 *
 * Comprehensive test suite for ChatPanel AI chat interface including:
 * - Message list rendering
 * - Input field and send button functionality
 * - Agent type indicators
 * - Message streaming display
 * - User vs assistant message styling
 * - Loading/streaming states
 * - Empty state with suggestions
 * - File context indicator
 * - Session management
 * - Chat history
 * - Message formatting (markdown, code blocks)
 * - ThinkingBlock and TodoList integration
 */

import * as React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ChatPanel } from './ChatPanel'
import { useAppStore } from '../stores/appStore'
import type { AgentMessage, ChatSession, FileNode, AgentType, ClaudeTodo } from '@shared/types'

// Mock zustand store
vi.mock('../stores/appStore', () => ({
  useAppStore: vi.fn()
}))

// Mock ReactMarkdown to simplify testing
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown-content">{children}</div>
}))

// Mock SyntaxHighlighter
vi.mock('react-syntax-highlighter', () => ({
  Prism: ({ children }: { children: string }) => <pre data-testid="syntax-highlighter">{children}</pre>
}))

vi.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  oneDark: {}
}))

// Mock child components
vi.mock('./ThinkingBlock', () => ({
  ThinkingBlock: ({ thinking }: { thinking: string }) => (
    <div data-testid="thinking-block">{thinking}</div>
  )
}))

vi.mock('./TodoList', () => ({
  TodoList: ({ todos }: { todos: ClaudeTodo[] }) => (
    <div data-testid="todo-list">
      {todos.map((todo, i) => (
        <div key={i} data-testid={`todo-item-${i}`}>
          {todo.content} - {todo.status}
        </div>
      ))}
    </div>
  )
}))

vi.mock('./SubAgentPanel', () => ({
  SubAgentPanel: () => <div data-testid="sub-agent-panel">SubAgentPanel</div>
}))

vi.mock('./ActionConfirmation', () => ({
  ActionConfirmation: () => <div data-testid="action-confirmation">ActionConfirmation</div>
}))

vi.mock('./Toast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn()
  })
}))

vi.mock('../utils/icons', () => ({
  AgentIcon: ({ agentType }: { agentType: AgentType }) => (
    <div data-testid={`agent-icon-${agentType}`}>AgentIcon</div>
  )
}))

describe('ChatPanel Component', () => {
  const mockProject = {
    id: 'project-1',
    name: 'Test Project',
    path: '/test/path',
    createdAt: new Date(),
    lastOpenedAt: new Date()
  }

  const mockStoreDefaults = {
    currentProject: mockProject,
    currentAgentType: 'developer' as AgentType,
    messages: [] as AgentMessage[],
    addMessage: vi.fn(),
    updateMessage: vi.fn(),
    appendMessageContent: vi.fn(),
    isLoading: false,
    setIsLoading: vi.fn(),
    currentSessionId: null,
    setCurrentSessionId: vi.fn(),
    isCreatingSession: false,
    setIsCreatingSession: vi.fn(),
    sessions: [] as ChatSession[],
    setSessions: vi.fn(),
    addSession: vi.fn(),
    setMessages: vi.fn(),
    showSessionHistory: false,
    setShowSessionHistory: vi.fn(),
    setStreamCleanupCallback: vi.fn()
  }

  const mockElectronAPI = {
    claude: {
      sendMessage: vi.fn(),
      cancel: vi.fn(),
      onStream: vi.fn()
    },
    sessions: {
      list: vi.fn().mockResolvedValue([]),
      get: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      addMessage: vi.fn()
    },
    files: {
      getTree: vi.fn().mockResolvedValue([]),
      getContext: vi.fn().mockResolvedValue('')
    },
    memory: {
      startSession: vi.fn().mockResolvedValue('memory-session-1'),
      endSession: vi.fn().mockResolvedValue(undefined),
      recordCreated: vi.fn().mockResolvedValue(undefined),
      recordRejection: vi.fn().mockResolvedValue(undefined)
    },
    actions: {
      getSuggestions: vi.fn().mockResolvedValue([])
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockStoreDefaults)
    // @ts-expect-error - Mocking window.electronAPI
    window.electronAPI = mockElectronAPI
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Rendering', () => {
    it('should render ChatPanel component', () => {
      render(<ChatPanel />)
      expect(screen.getByPlaceholderText(/Ask Developer Agent/i)).toBeInTheDocument()
    })

    it('should display agent type indicator', () => {
      render(<ChatPanel />)
      expect(screen.getByText('Developer Agent')).toBeInTheDocument()
      expect(screen.getByTestId('agent-icon-developer')).toBeInTheDocument()
    })

    it('should show correct agent name for different agent types', () => {
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockStoreDefaults,
        currentAgentType: 'tester'
      })

      render(<ChatPanel />)
      expect(screen.getByText('Test Agent')).toBeInTheDocument()
    })

    it('should display conversation count when sessions exist', () => {
      const mockSessions: ChatSession[] = [
        {
          id: 'session-1',
          projectId: 'project-1',
          agentType: 'developer',
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'session-2',
          projectId: 'project-1',
          agentType: 'developer',
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockStoreDefaults,
        sessions: mockSessions
      })

      render(<ChatPanel />)
      expect(screen.getByText('2 conversations')).toBeInTheDocument()
    })

    it('should display singular "conversation" for one session', () => {
      const mockSessions: ChatSession[] = [
        {
          id: 'session-1',
          projectId: 'project-1',
          agentType: 'developer',
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockStoreDefaults,
        sessions: mockSessions
      })

      render(<ChatPanel />)
      expect(screen.getByText('1 conversation')).toBeInTheDocument()
    })
  })

  describe('Empty State', () => {
    it('should show empty state with suggestions when no messages', () => {
      render(<ChatPanel />)
      expect(screen.getByText('How can I help you today?')).toBeInTheDocument()
    })

    it('should display agent-specific suggestions', () => {
      render(<ChatPanel />)
      expect(screen.getByText('Explain the architecture of this project')).toBeInTheDocument()
      expect(screen.getByText('Find potential bugs in the codebase')).toBeInTheDocument()
    })

    it('should populate input when suggestion is clicked', async () => {
      const user = userEvent.setup()
      render(<ChatPanel />)

      const suggestion = screen.getByText('Explain the architecture of this project')
      await user.click(suggestion)

      const input = screen.getByPlaceholderText(/Ask Developer Agent/i) as HTMLTextAreaElement
      expect(input.value).toBe('Explain the architecture of this project')
    })

    it('should show different suggestions for different agents', () => {
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockStoreDefaults,
        currentAgentType: 'product-owner'
      })

      render(<ChatPanel />)
      expect(screen.getByText('Create a user story for login functionality')).toBeInTheDocument()
      expect(screen.getByText('Generate acceptance criteria for this feature')).toBeInTheDocument()
    })
  })

  describe('Message Display', () => {
    it('should render message list with user and assistant messages', () => {
      const mockMessages: AgentMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date()
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Hi there!',
          timestamp: new Date(),
          agentType: 'developer'
        }
      ]

      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockStoreDefaults,
        messages: mockMessages
      })

      render(<ChatPanel />)
      expect(screen.getByText('Hello')).toBeInTheDocument()
      expect(screen.getByText('Hi there!')).toBeInTheDocument()
    })

    it('should apply different styling for user vs assistant messages', () => {
      const mockMessages: AgentMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'User message',
          timestamp: new Date()
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Assistant message',
          timestamp: new Date(),
          agentType: 'developer'
        }
      ]

      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockStoreDefaults,
        messages: mockMessages
      })

      render(<ChatPanel />)

      // User message is in a <p> inside the bubble div
      const userMessage = screen.getByText('User message').parentElement

      // Assistant message is in a markdown div, need to go up more levels to get the bubble
      const assistantMessageText = screen.getByText('Assistant message')
      const assistantMessage = assistantMessageText.closest('[class*="bg-card"]')

      // User messages should have gradient background
      expect(userMessage).toHaveClass('bg-gradient-to-br', 'from-primary', 'to-primary/80')

      // Assistant messages should have border
      expect(assistantMessage).toHaveClass('bg-card', 'border', 'border-border/40')
    })

    it('should show loading indicator for streaming assistant message', () => {
      const mockMessages: AgentMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          agentType: 'developer',
          isStreaming: true
        }
      ]

      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockStoreDefaults,
        messages: mockMessages
      })

      render(<ChatPanel />)

      // Should show typing indicator (animated dots)
      const typingIndicator = document.querySelector('.typing-indicator')
      expect(typingIndicator).toBeInTheDocument()
    })

    it('should show cursor indicator when streaming with content', () => {
      const mockMessages: AgentMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: 'Streaming content...',
          timestamp: new Date(),
          agentType: 'developer',
          isStreaming: true
        }
      ]

      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockStoreDefaults,
        messages: mockMessages
      })

      render(<ChatPanel />)

      // Should show animated cursor
      const cursor = document.querySelector('.animate-pulse')
      expect(cursor).toBeInTheDocument()
    })

    it('should render ThinkingBlock when message has thinking content', () => {
      const mockMessages: AgentMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: 'Response',
          timestamp: new Date(),
          agentType: 'developer',
          thinking: 'Thinking process...'
        }
      ]

      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockStoreDefaults,
        messages: mockMessages
      })

      render(<ChatPanel />)
      expect(screen.getByTestId('thinking-block')).toBeInTheDocument()
      expect(screen.getByText('Thinking process...')).toBeInTheDocument()
    })

    it('should render TodoList when message has todos', () => {
      const mockTodos: ClaudeTodo[] = [
        { content: 'Task 1', status: 'completed', activeForm: 'Completing task 1' },
        { content: 'Task 2', status: 'in_progress', activeForm: 'Working on task 2' }
      ]

      const mockMessages: AgentMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: 'Response',
          timestamp: new Date(),
          agentType: 'developer',
          todos: mockTodos
        }
      ]

      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockStoreDefaults,
        messages: mockMessages
      })

      render(<ChatPanel />)
      expect(screen.getByTestId('todo-list')).toBeInTheDocument()
      expect(screen.getByTestId('todo-item-0')).toHaveTextContent('Task 1 - completed')
      expect(screen.getByTestId('todo-item-1')).toHaveTextContent('Task 2 - in_progress')
    })

    it('should render markdown content in assistant messages', () => {
      const mockMessages: AgentMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: '# Heading\n\nParagraph with **bold** text',
          timestamp: new Date(),
          agentType: 'developer'
        }
      ]

      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockStoreDefaults,
        messages: mockMessages
      })

      render(<ChatPanel />)
      expect(screen.getByTestId('markdown-content')).toBeInTheDocument()
    })
  })

  describe('Input and Send', () => {
    it('should render input field', () => {
      render(<ChatPanel />)
      const input = screen.getByPlaceholderText(/Ask Developer Agent/i)
      expect(input).toBeInTheDocument()
      expect(input.tagName).toBe('TEXTAREA') // verify it's a textarea
    })

    it('should update input value when typing', async () => {
      const user = userEvent.setup()
      render(<ChatPanel />)

      const input = screen.getByPlaceholderText(/Ask Developer Agent/i) as HTMLTextAreaElement
      await user.type(input, 'Test message')

      expect(input.value).toBe('Test message')
    })

    it('should render send button', () => {
      render(<ChatPanel />)
      const sendButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('svg')?.classList.contains('lucide-send')
      )
      expect(sendButton).toBeInTheDocument()
    })

    it('should disable send button when input is empty', () => {
      render(<ChatPanel />)
      const sendButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('svg')?.classList.contains('lucide-send')
      )
      expect(sendButton).toBeDisabled()
    })

    it('should enable send button when input has content', async () => {
      const user = userEvent.setup()
      render(<ChatPanel />)

      const input = screen.getByPlaceholderText(/Ask Developer Agent/i)
      await user.type(input, 'Test message')

      const sendButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('svg')?.classList.contains('lucide-send')
      )
      expect(sendButton).not.toBeDisabled()
    })

    it('should disable input when loading', () => {
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockStoreDefaults,
        isLoading: true
      })

      render(<ChatPanel />)
      const input = screen.getByPlaceholderText(/Ask Developer Agent/i)
      expect(input).toBeDisabled()
    })

    it('should send message when send button is clicked', async () => {
      const user = userEvent.setup()
      const mockOnStream = vi.fn()
      mockElectronAPI.claude.onStream.mockReturnValue(vi.fn())

      render(<ChatPanel />)

      const input = screen.getByPlaceholderText(/Ask Developer Agent/i)
      await user.type(input, 'Test message')

      const sendButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('svg')?.classList.contains('lucide-send')
      )
      await user.click(sendButton!)

      await waitFor(() => {
        expect(mockElectronAPI.claude.sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Test message',
            projectPath: '/test/path',
            agentType: 'developer'
          })
        )
      })
    })

    it('should send message when Enter is pressed', async () => {
      const user = userEvent.setup()
      mockElectronAPI.claude.onStream.mockReturnValue(vi.fn())

      render(<ChatPanel />)

      const input = screen.getByPlaceholderText(/Ask Developer Agent/i)
      await user.type(input, 'Test message{Enter}')

      await waitFor(() => {
        expect(mockElectronAPI.claude.sendMessage).toHaveBeenCalled()
      })
    })

    it('should not send message when Shift+Enter is pressed', async () => {
      const user = userEvent.setup()
      render(<ChatPanel />)

      const input = screen.getByPlaceholderText(/Ask Developer Agent/i)
      await user.type(input, 'Test message{Shift>}{Enter}{/Shift}')

      expect(mockElectronAPI.claude.sendMessage).not.toHaveBeenCalled()
    })

    it('should clear input after sending message', async () => {
      const user = userEvent.setup()
      mockElectronAPI.claude.onStream.mockReturnValue(vi.fn())

      render(<ChatPanel />)

      const input = screen.getByPlaceholderText(/Ask Developer Agent/i) as HTMLTextAreaElement
      await user.type(input, 'Test message')

      const sendButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('svg')?.classList.contains('lucide-send')
      )
      await user.click(sendButton!)

      await waitFor(() => {
        expect(input.value).toBe('')
      })
    })

    it('should not send empty messages', async () => {
      const user = userEvent.setup()
      render(<ChatPanel />)

      const input = screen.getByPlaceholderText(/Ask Developer Agent/i)
      await user.type(input, '   ')

      const sendButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('svg')?.classList.contains('lucide-send')
      )
      await user.click(sendButton!)

      expect(mockElectronAPI.claude.sendMessage).not.toHaveBeenCalled()
    })

    it('should not send message when already loading', async () => {
      const user = userEvent.setup()
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockStoreDefaults,
        isLoading: true
      })

      render(<ChatPanel />)

      const input = screen.getByPlaceholderText(/Ask Developer Agent/i)
      await user.type(input, 'Test message{Enter}')

      expect(mockElectronAPI.claude.sendMessage).not.toHaveBeenCalled()
    })

    it('should not send message when no project is selected', async () => {
      const user = userEvent.setup()
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockStoreDefaults,
        currentProject: null
      })

      render(<ChatPanel />)

      const input = screen.getByPlaceholderText(/Ask Developer Agent/i)
      await user.type(input, 'Test message{Enter}')

      expect(mockElectronAPI.claude.sendMessage).not.toHaveBeenCalled()
    })
  })

  describe('Loading State', () => {
    it('should show cancel button when loading', () => {
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockStoreDefaults,
        isLoading: true
      })

      render(<ChatPanel />)
      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })

    it('should call cancel when cancel button is clicked', async () => {
      const user = userEvent.setup()
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockStoreDefaults,
        isLoading: true
      })

      render(<ChatPanel />)

      const cancelButton = screen.getByText('Cancel')
      await user.click(cancelButton)

      await waitFor(() => {
        expect(mockElectronAPI.claude.cancel).toHaveBeenCalled()
      })
    })

    it('should set loading to false after cancel', async () => {
      const user = userEvent.setup()
      const setIsLoading = vi.fn()
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockStoreDefaults,
        isLoading: true,
        setIsLoading
      })

      render(<ChatPanel />)

      const cancelButton = screen.getByText('Cancel')
      await user.click(cancelButton)

      await waitFor(() => {
        expect(setIsLoading).toHaveBeenCalledWith(false)
      })
    })
  })

  describe('Session Management', () => {
    it('should load sessions when project changes', async () => {
      render(<ChatPanel />)

      await waitFor(() => {
        expect(mockElectronAPI.sessions.list).toHaveBeenCalledWith('project-1')
      })
    })

    it('should toggle session history sidebar', async () => {
      const user = userEvent.setup()
      const setShowSessionHistory = vi.fn()
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockStoreDefaults,
        setShowSessionHistory
      })

      render(<ChatPanel />)

      const historyButton = screen.getAllByRole('button').find(btn =>
        btn.getAttribute('title') === 'Chat History'
      )
      await user.click(historyButton!)

      expect(setShowSessionHistory).toHaveBeenCalledWith(true)
    })

    it('should display session history when showSessionHistory is true', () => {
      const mockSessions: ChatSession[] = [
        {
          id: 'session-1',
          projectId: 'project-1',
          agentType: 'developer',
          messages: [],
          createdAt: new Date('2024-01-15T10:00:00'),
          updatedAt: new Date('2024-01-15T10:00:00')
        }
      ]

      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockStoreDefaults,
        showSessionHistory: true,
        sessions: mockSessions
      })

      render(<ChatPanel />)
      expect(screen.getByText('Chat History')).toBeInTheDocument()
    })

    it('should show "New Chat" button in session history', () => {
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockStoreDefaults,
        showSessionHistory: true
      })

      render(<ChatPanel />)
      const newChatButtons = screen.getAllByText('New Chat')
      expect(newChatButtons.length).toBeGreaterThan(0)
    })

    it('should start new chat when "New Chat" button is clicked', async () => {
      const user = userEvent.setup()
      const setCurrentSessionId = vi.fn()
      const setMessages = vi.fn()
      const setShowSessionHistory = vi.fn()

      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockStoreDefaults,
        showSessionHistory: true,
        setCurrentSessionId,
        setMessages,
        setShowSessionHistory
      })

      render(<ChatPanel />)

      const newChatButton = screen.getAllByText('New Chat')[0]
      await user.click(newChatButton)

      expect(setCurrentSessionId).toHaveBeenCalledWith(null)
      expect(setMessages).toHaveBeenCalledWith([])
      expect(setShowSessionHistory).toHaveBeenCalledWith(false)
    })

    it('should load session when session item is clicked', async () => {
      const user = userEvent.setup()
      const mockSession: ChatSession = {
        id: 'session-1',
        projectId: 'project-1',
        agentType: 'developer',
        messages: [
          { id: 'msg-1', role: 'user', content: 'Hello', timestamp: new Date() }
        ],
        createdAt: new Date('2024-01-15T10:00:00'),
        updatedAt: new Date('2024-01-15T10:00:00')
      }

      mockElectronAPI.sessions.get.mockResolvedValue(mockSession)

      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockStoreDefaults,
        showSessionHistory: true,
        sessions: [mockSession]
      })

      render(<ChatPanel />)

      const sessionItem = screen.getByText('15/1/2024')
      await user.click(sessionItem)

      await waitFor(() => {
        expect(mockElectronAPI.sessions.get).toHaveBeenCalledWith('session-1')
      })
    })

    it('should delete session when delete button is clicked', async () => {
      const user = userEvent.setup()
      const mockSession: ChatSession = {
        id: 'session-1',
        projectId: 'project-1',
        agentType: 'developer',
        messages: [],
        createdAt: new Date('2024-01-15T10:00:00'),
        updatedAt: new Date('2024-01-15T10:00:00')
      }

      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockStoreDefaults,
        showSessionHistory: true,
        sessions: [mockSession]
      })

      render(<ChatPanel />)

      // Hover to make delete button visible
      const sessionItem = screen.getByText('15/1/2024').closest('div')
      if (sessionItem) {
        await user.hover(sessionItem)
      }

      // Find and click delete button (it has a Trash2 icon)
      const deleteButton = within(sessionItem!).getByRole('button')
      await user.click(deleteButton)

      await waitFor(() => {
        expect(mockElectronAPI.sessions.delete).toHaveBeenCalledWith('session-1')
      })
    })

    it('should filter sessions by current agent type', () => {
      const mockSessions: ChatSession[] = [
        {
          id: 'session-1',
          projectId: 'project-1',
          agentType: 'developer',
          messages: [],
          createdAt: new Date('2024-01-15T10:00:00'),
          updatedAt: new Date('2024-01-15T10:00:00')
        },
        {
          id: 'session-2',
          projectId: 'project-1',
          agentType: 'tester',
          messages: [],
          createdAt: new Date('2024-01-15T11:00:00'),
          updatedAt: new Date('2024-01-15T11:00:00')
        }
      ]

      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockStoreDefaults,
        showSessionHistory: true,
        sessions: mockSessions,
        currentAgentType: 'developer'
      })

      render(<ChatPanel />)

      // Should only show developer session
      const sessionDates = screen.getAllByText(/\d{1,2}\/\d{1,2}\/\d{4}/)
      expect(sessionDates).toHaveLength(1)
    })

    it('should show "No previous chats" when no sessions for current agent', () => {
      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockStoreDefaults,
        showSessionHistory: true,
        sessions: []
      })

      render(<ChatPanel />)
      expect(screen.getByText('No previous chats')).toBeInTheDocument()
    })
  })

  describe('File Context', () => {
    it('should render file panel toggle button', () => {
      render(<ChatPanel />)
      const fileButton = screen.getAllByRole('button').find(btn =>
        btn.getAttribute('title') === 'Add files to context'
      )
      expect(fileButton).toBeInTheDocument()
    })

    it('should toggle file panel when button is clicked', async () => {
      const user = userEvent.setup()
      render(<ChatPanel />)

      const fileButton = screen.getAllByRole('button').find(btn =>
        btn.getAttribute('title') === 'Add files to context'
      )

      await user.click(fileButton!)

      // Should show file panel
      await waitFor(() => {
        expect(screen.getByText('Add Files to Context')).toBeInTheDocument()
      })
    })

    it('should load file tree when file panel is opened', async () => {
      const user = userEvent.setup()
      const mockFileTree: FileNode[] = [
        {
          name: 'src',
          path: '/test/path/src',
          type: 'directory',
          children: []
        }
      ]
      mockElectronAPI.files.getTree.mockResolvedValue(mockFileTree)

      render(<ChatPanel />)

      const fileButton = screen.getAllByRole('button').find(btn =>
        btn.getAttribute('title') === 'Add files to context'
      )
      await user.click(fileButton!)

      await waitFor(() => {
        expect(mockElectronAPI.files.getTree).toHaveBeenCalledWith('/test/path')
      })
    })

    it('should show loading state while loading files', async () => {
      const user = userEvent.setup()
      mockElectronAPI.files.getTree.mockImplementation(() => new Promise(() => {}))

      render(<ChatPanel />)

      const fileButton = screen.getAllByRole('button').find(btn =>
        btn.getAttribute('title') === 'Add files to context'
      )
      await user.click(fileButton!)

      await waitFor(() => {
        expect(screen.getByText('Loading files...')).toBeInTheDocument()
      })
    })

    it('should show "No code files found" when file tree is empty', async () => {
      const user = userEvent.setup()
      mockElectronAPI.files.getTree.mockResolvedValue([])

      render(<ChatPanel />)

      const fileButton = screen.getAllByRole('button').find(btn =>
        btn.getAttribute('title') === 'Add files to context'
      )
      await user.click(fileButton!)

      await waitFor(() => {
        expect(screen.getByText('No code files found')).toBeInTheDocument()
      })
    })

    it('should display selected files indicator when files are selected', async () => {
      const user = userEvent.setup()
      const mockFileTree: FileNode[] = [
        {
          name: 'test.ts',
          path: '/test/path/test.ts',
          type: 'file',
          extension: '.ts',
          size: 1024
        }
      ]
      mockElectronAPI.files.getTree.mockResolvedValue(mockFileTree)

      render(<ChatPanel />)

      // Open file panel
      const fileButton = screen.getAllByRole('button').find(btn =>
        btn.getAttribute('title') === 'Add files to context'
      )
      await user.click(fileButton!)

      await waitFor(() => {
        expect(screen.getByText('test.ts')).toBeInTheDocument()
      })

      // Select file
      const checkbox = screen.getByRole('checkbox')
      await user.click(checkbox)

      // Close file panel - find the close button by looking for all buttons and finding the one without text content (icon-only)
      const allButtons = screen.getAllByRole('button')
      const closeButton = allButtons.find(btn => {
        const svg = btn.querySelector('svg')
        return svg?.classList.contains('lucide-x') && btn.closest('[class*="border-b"]')
      })
      await user.click(closeButton!)

      // Should show selected file indicator (file name should still be visible in the indicator badges)
      await waitFor(() => {
        const indicators = screen.getAllByText('test.ts')
        expect(indicators.length).toBeGreaterThan(0)
      })
    })

    it('should show file count in footer when files are attached', async () => {
      const user = userEvent.setup()
      const mockFileTree: FileNode[] = [
        {
          name: 'test1.ts',
          path: '/test/path/test1.ts',
          type: 'file',
          extension: '.ts',
          size: 1024
        },
        {
          name: 'test2.ts',
          path: '/test/path/test2.ts',
          type: 'file',
          extension: '.ts',
          size: 2048
        }
      ]
      mockElectronAPI.files.getTree.mockResolvedValue(mockFileTree)

      render(<ChatPanel />)

      // Open file panel
      const fileButton = screen.getAllByRole('button').find(btn =>
        btn.getAttribute('title') === 'Add files to context'
      )
      await user.click(fileButton!)

      await waitFor(() => {
        expect(screen.getAllByRole('checkbox')).toHaveLength(2)
      })

      // Select both files
      const checkboxes = screen.getAllByRole('checkbox')
      await user.click(checkboxes[0])
      await user.click(checkboxes[1])

      // Should show file count in footer
      await waitFor(() => {
        expect(screen.getByText(/2 files attached/i)).toBeInTheDocument()
      })
    })

    it('should include file context in message when sending with files', async () => {
      const user = userEvent.setup()
      mockElectronAPI.claude.onStream.mockReturnValue(vi.fn())
      mockElectronAPI.files.getContext.mockResolvedValue('File content here')

      const mockFileTree: FileNode[] = [
        {
          name: 'test.ts',
          path: '/test/path/test.ts',
          type: 'file',
          extension: '.ts',
          size: 1024
        }
      ]
      mockElectronAPI.files.getTree.mockResolvedValue(mockFileTree)

      render(<ChatPanel />)

      // Open file panel and select file
      const fileButton = screen.getAllByRole('button').find(btn =>
        btn.getAttribute('title') === 'Add files to context'
      )
      await user.click(fileButton!)

      await waitFor(() => {
        expect(screen.getByRole('checkbox')).toBeInTheDocument()
      })

      const checkbox = screen.getByRole('checkbox')
      await user.click(checkbox)

      // Close file panel
      const allButtons = screen.getAllByRole('button')
      const closeButton = allButtons.find(btn => {
        const svg = btn.querySelector('svg')
        return svg?.classList.contains('lucide-x') && btn.closest('[class*="border-b"]')
      })
      await user.click(closeButton!)

      // Send message
      const input = screen.getByPlaceholderText(/Ask Developer Agent/i)
      await user.type(input, 'Test message')

      const sendButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('svg')?.classList.contains('lucide-send')
      )
      await user.click(sendButton!)

      await waitFor(() => {
        expect(mockElectronAPI.files.getContext).toHaveBeenCalledWith(
          ['/test/path/test.ts'],
          '/test/path'
        )
        expect(mockElectronAPI.claude.sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('File content here')
          })
        )
      })
    })
  })

  describe('Stream Handling', () => {
    it('should register stream listener when sending message', async () => {
      const user = userEvent.setup()
      mockElectronAPI.claude.onStream.mockReturnValue(vi.fn())

      render(<ChatPanel />)

      const input = screen.getByPlaceholderText(/Ask Developer Agent/i)
      await user.type(input, 'Test message')

      const sendButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('svg')?.classList.contains('lucide-send')
      )
      await user.click(sendButton!)

      await waitFor(() => {
        expect(mockElectronAPI.claude.onStream).toHaveBeenCalled()
      })
    })

    it('should create session if none exists before sending', async () => {
      const user = userEvent.setup()
      const mockSession: ChatSession = {
        id: 'new-session',
        projectId: 'project-1',
        agentType: 'developer',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }
      mockElectronAPI.sessions.create.mockResolvedValue(mockSession)
      mockElectronAPI.claude.onStream.mockReturnValue(vi.fn())

      render(<ChatPanel />)

      const input = screen.getByPlaceholderText(/Ask Developer Agent/i)
      await user.type(input, 'Test message')

      const sendButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('svg')?.classList.contains('lucide-send')
      )
      await user.click(sendButton!)

      await waitFor(() => {
        expect(mockElectronAPI.sessions.create).toHaveBeenCalledWith({
          projectId: 'project-1',
          agentType: 'developer'
        })
      })
    })

    it('should add user and assistant message placeholders', async () => {
      const user = userEvent.setup()
      const addMessage = vi.fn()
      mockElectronAPI.claude.onStream.mockReturnValue(vi.fn())

      // Mock session creation to return a session with an ID
      mockElectronAPI.sessions.create.mockResolvedValue({
        id: 'test-session-id',
        projectId: 'project-1',
        agentType: 'developer',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date()
      })

      // Mock addMessage to return the message with an ID
      mockElectronAPI.sessions.addMessage.mockResolvedValue({
        id: 'user-msg-id',
        role: 'user',
        content: 'Test message',
        timestamp: new Date()
      })

      ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockStoreDefaults,
        addMessage
      })

      render(<ChatPanel />)

      const input = screen.getByPlaceholderText(/Ask Developer Agent/i)
      await user.type(input, 'Test message')

      const sendButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('svg')?.classList.contains('lucide-send')
      )
      await user.click(sendButton!)

      await waitFor(() => {
        expect(addMessage).toHaveBeenCalledTimes(2)
        expect(addMessage).toHaveBeenCalledWith(expect.objectContaining({ role: 'user' }))
        expect(addMessage).toHaveBeenCalledWith(expect.objectContaining({
          role: 'assistant',
          isStreaming: true
        }))
      })
    })
  })

  describe('Keyboard Shortcuts', () => {
    it('should show keyboard shortcut hint', () => {
      render(<ChatPanel />)
      expect(screen.getByText(/Press Enter to send, Shift\+Enter for new line/i)).toBeInTheDocument()
    })
  })

  describe('Memory System Integration', () => {
    it('should start memory session when project and agent are loaded', async () => {
      render(<ChatPanel />)

      await waitFor(() => {
        expect(mockElectronAPI.memory.startSession).toHaveBeenCalledWith(
          'project-1',
          'developer'
        )
      })
    })

    it('should end memory session on unmount', async () => {
      const { unmount } = render(<ChatPanel />)

      // Wait for memory session to be started
      await waitFor(() => {
        expect(mockElectronAPI.memory.startSession).toHaveBeenCalled()
      })

      unmount()

      // endSession is called with the session ID that was returned from startSession
      expect(mockElectronAPI.memory.endSession).toHaveBeenCalledWith('memory-session-1')
    })
  })

  describe('Accessibility', () => {
    it('should have accessible placeholder text', () => {
      render(<ChatPanel />)
      const input = screen.getByPlaceholderText(/Ask Developer Agent/i)
      expect(input).toBeInTheDocument()
    })

    it('should have button titles for icon buttons', () => {
      render(<ChatPanel />)
      expect(screen.getByTitle('Chat History')).toBeInTheDocument()
      expect(screen.getByTitle('New Chat')).toBeInTheDocument()
      expect(screen.getByTitle('Add files to context')).toBeInTheDocument()
    })
  })
})
