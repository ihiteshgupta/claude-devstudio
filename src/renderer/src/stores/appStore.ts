import { create } from 'zustand'
import type { Project, AgentType, AgentMessage, ClaudeStatus, ChatSession } from '@shared/types'

export type ViewMode = 'chat' | 'workflows' | 'stories'

interface AppState {
  // Claude status
  claudeStatus: ClaudeStatus | null
  setClaudeStatus: (status: ClaudeStatus) => void

  // Projects
  projects: Project[]
  currentProject: Project | null
  setProjects: (projects: Project[]) => void
  setCurrentProject: (project: Project | null) => void
  addProject: (project: Project) => void
  removeProject: (projectId: string) => void

  // Sessions
  sessions: ChatSession[]
  currentSessionId: string | null
  setSessions: (sessions: ChatSession[]) => void
  setCurrentSessionId: (id: string | null) => void
  addSession: (session: ChatSession) => void

  // Chat
  currentAgentType: AgentType
  setCurrentAgentType: (type: AgentType) => void
  messages: AgentMessage[]
  setMessages: (messages: AgentMessage[]) => void
  addMessage: (message: AgentMessage) => void
  updateMessage: (id: string, updates: Partial<AgentMessage>) => void
  appendMessageContent: (id: string, content: string) => void
  clearMessages: () => void

  // UI State
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
  isSidebarOpen: boolean
  toggleSidebar: () => void
  showSessionHistory: boolean
  setShowSessionHistory: (show: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  // Claude status
  claudeStatus: null,
  setClaudeStatus: (status) => set({ claudeStatus: status }),

  // Projects
  projects: [],
  currentProject: null,
  setProjects: (projects) => set({ projects }),
  setCurrentProject: (project) => set({ currentProject: project, sessions: [], currentSessionId: null, messages: [] }),
  addProject: (project) =>
    set((state) => ({
      projects: [project, ...state.projects.filter((p) => p.id !== project.id)]
    })),
  removeProject: (projectId) =>
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== projectId),
      currentProject: state.currentProject?.id === projectId ? null : state.currentProject
    })),

  // Sessions
  sessions: [],
  currentSessionId: null,
  setSessions: (sessions) => set({ sessions }),
  setCurrentSessionId: (id) => set({ currentSessionId: id }),
  addSession: (session) =>
    set((state) => ({
      sessions: [session, ...state.sessions.filter((s) => s.id !== session.id)]
    })),

  // Chat
  currentAgentType: 'developer',
  setCurrentAgentType: (type) => set({ currentAgentType: type, messages: [], currentSessionId: null }),
  messages: [],
  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message]
    })),
  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, ...updates } : m))
    })),
  appendMessageContent: (id, content) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + content } : m
      )
    })),
  clearMessages: () => set({ messages: [], currentSessionId: null }),

  // UI State
  viewMode: 'chat',
  setViewMode: (mode) => set({ viewMode: mode }),
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),
  isSidebarOpen: true,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  showSessionHistory: false,
  setShowSessionHistory: (show) => set({ showSessionHistory: show })
}))
