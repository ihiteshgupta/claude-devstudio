# Architecture Documentation

Technical architecture guide for Claude DevStudio.

## System Overview

```mermaid
graph TB
    subgraph "Electron Application"
        subgraph "Renderer Process (React)"
            UI[React Components]
            Store[Zustand Store]
            Hooks[Custom Hooks]
        end

        subgraph "Preload Script"
            Bridge[IPC Bridge]
            API[electronAPI]
        end

        subgraph "Main Process (Node.js)"
            IPC[IPC Handlers]
            Services[Service Layer]
            DB[(SQLite)]
        end
    end

    subgraph "External"
        Claude[Claude CLI]
        FS[File System]
    end

    UI --> Store
    Store --> Hooks
    Hooks --> API
    API --> Bridge
    Bridge --> IPC
    IPC --> Services
    Services --> DB
    Services --> Claude
    Services --> FS
```

## Directory Structure

```
src/
├── main/                    # Electron Main Process
│   ├── index.ts             # App entry, window management, IPC handlers
│   └── services/            # Business logic services
│       ├── claude.service.ts        # Claude CLI integration
│       ├── database.service.ts      # SQLite operations
│       ├── project.service.ts       # Project management
│       ├── task-queue.service.ts    # Task execution engine
│       ├── onboarding.service.ts    # Project analysis & setup
│       ├── workflow.service.ts      # Multi-agent workflows
│       └── ...                      # Other services
│
├── preload/                 # Preload Scripts
│   └── index.ts             # Exposes electronAPI to renderer
│
├── renderer/                # React Application
│   └── src/
│       ├── components/      # React components
│       │   ├── ChatPanel.tsx
│       │   ├── TaskQueuePanel.tsx
│       │   ├── RoadmapPanel.tsx
│       │   ├── OnboardingWizard.tsx
│       │   └── ...
│       ├── stores/          # Zustand state management
│       │   └── appStore.ts
│       ├── hooks/           # Custom React hooks
│       └── App.tsx          # Root component
│
└── shared/                  # Shared Types
    └── types/
        └── index.ts         # TypeScript interfaces, IPC channels
```

## Data Flow

### IPC Communication

```mermaid
sequenceDiagram
    participant R as Renderer
    participant P as Preload
    participant M as Main
    participant S as Service
    participant D as Database

    R->>P: window.electronAPI.taskQueue.enqueue(task)
    P->>M: ipcRenderer.invoke('TASK_QUEUE_ENQUEUE', task)
    M->>S: taskQueueService.enqueue(task)
    S->>D: INSERT INTO task_queue
    D-->>S: task record
    S-->>M: task object
    M-->>P: IPC response
    P-->>R: Promise resolved
```

### Real-time Updates

```mermaid
sequenceDiagram
    participant S as Service
    participant M as Main Process
    participant P as Preload
    participant R as Renderer
    participant Z as Zustand Store

    S->>M: Event emitted (task status change)
    M->>P: webContents.send('TASK_STATUS_UPDATE', data)
    P->>R: window.electronAPI.onTaskUpdate(callback)
    R->>Z: updateTask(data)
    Z->>R: Re-render components
```

## Core Services

### Claude Service

Manages Claude CLI process spawning and streaming:

```mermaid
flowchart TD
    subgraph "Claude Service"
        SPAWN[spawn process]
        STREAM[stream stdout]
        PARSE[parse JSON events]
        EMIT[emit to renderer]
    end

    REQ[Send Message Request] --> SPAWN
    SPAWN --> |--print --output-format stream-json| CLI[Claude CLI]
    CLI --> STREAM
    STREAM --> PARSE
    PARSE --> EMIT
    EMIT --> UI[Update UI]
```

**Key Methods:**
```typescript
class ClaudeService {
  sendMessage(message: string, agentType: string, projectPath: string): EventEmitter
  checkStatus(): Promise<{ installed: boolean, authenticated: boolean, version: string }>
}
```

### Task Queue Service

Manages autonomous task execution:

```mermaid
stateDiagram-v2
    [*] --> Pending: enqueue()

    Pending --> Running: executeNext()
    Running --> WaitingApproval: checkpoint reached
    Running --> Completed: task finished
    Running --> Failed: error occurred

    WaitingApproval --> Running: approve()
    WaitingApproval --> Cancelled: reject()

    Pending --> Cancelled: cancel()

    Completed --> [*]
    Cancelled --> [*]
    Failed --> [*]
```

**Key Methods:**
```typescript
class TaskQueueService {
  enqueue(task: TaskQueueItem): Promise<TaskQueueItem>
  list(projectId: string): TaskQueueItem[]
  executeNext(projectId: string): Promise<void>
  updateAutonomy(taskId: string, level: AutonomyLevel): void
  cancel(taskId: string): void
  approve(taskId: string): void
  reject(taskId: string, reason: string): void
}
```

### Database Service

SQLite operations with better-sqlite3:

```mermaid
erDiagram
    PROJECTS ||--o{ USER_STORIES : has
    PROJECTS ||--o{ TASK_QUEUE : has
    PROJECTS ||--o{ ROADMAP_ITEMS : has
    PROJECTS ||--o{ SPRINTS : has
    PROJECTS ||--o{ CHAT_SESSIONS : has

    USER_STORIES ||--o{ TEST_CASES : generates
    SPRINTS ||--o{ USER_STORIES : contains

    TASK_QUEUE ||--o{ APPROVAL_GATES : has
    TASK_QUEUE ||--o{ TASK_DEPENDENCIES : depends_on

    CHAT_SESSIONS ||--o{ MESSAGES : contains

    ONBOARDING_PLANS ||--o{ SUGGESTED_ROADMAP : contains
    ONBOARDING_PLANS ||--o{ SUGGESTED_TASKS : contains
```

### Onboarding Service

Project analysis and AI-powered setup:

```mermaid
flowchart TD
    subgraph "Analysis"
        A1[Scan package.json]
        A2[Detect language]
        A3[Find frameworks]
        A4[Check for tests]
        A5[Check for CI/CD]
    end

    subgraph "Plan Generation"
        P1[Build context]
        P2[Call Claude]
        P3[Parse suggestions]
        P4[Create plan]
    end

    subgraph "Application"
        AP1[Filter accepted items]
        AP2[Create roadmap items]
        AP3[Queue tasks]
    end

    A1 --> A2 --> A3 --> A4 --> A5
    A5 --> P1 --> P2 --> P3 --> P4
    P4 --> AP1 --> AP2 --> AP3
```

## State Management

### Zustand Store

```typescript
interface AppState {
  // Current state
  currentProject: Project | null
  currentView: ViewMode
  projects: Project[]

  // UI state
  showTutorial: boolean
  isLoading: boolean

  // Actions
  setCurrentProject: (project: Project) => void
  setCurrentView: (view: ViewMode) => void
  addProject: (project: Project) => void
}
```

### View Modes

```mermaid
graph LR
    subgraph "Navigation"
        D[Dashboard] --> C[Chat]
        C --> S[Stories]
        S --> SP[Sprints]
        SP --> R[Roadmap]
        R --> T[Task Queue]
        T --> G[Git]
        G --> W[Workflows]
    end
```

## Security Considerations

### Process Isolation

```mermaid
graph TB
    subgraph "Sandboxed Renderer"
        UI[React App]
        API[electronAPI only]
    end

    subgraph "Preload Bridge"
        WHITELIST[Whitelisted IPC channels]
        CONTEXT[contextBridge.exposeInMainWorld]
    end

    subgraph "Main Process"
        HANDLERS[IPC Handlers]
        VALIDATE[Input Validation]
        SERVICES[Services]
    end

    UI --> API
    API --> WHITELIST
    WHITELIST --> CONTEXT
    CONTEXT --> HANDLERS
    HANDLERS --> VALIDATE
    VALIDATE --> SERVICES
```

### Data Storage

- **User data**: `~/Library/Application Support/claude-devstudio/`
- **Database**: SQLite with prepared statements (SQL injection safe)
- **No remote storage**: All data stays local

## Performance Optimizations

### Lazy Loading

```typescript
// Services loaded on demand
const taskQueueService = await import('./task-queue.service')
```

### Database Indexing

```sql
CREATE INDEX idx_task_queue_project ON task_queue(project_id);
CREATE INDEX idx_task_queue_status ON task_queue(status);
CREATE INDEX idx_task_queue_priority ON task_queue(priority);
```

### Streaming Responses

```mermaid
sequenceDiagram
    participant UI as UI
    participant Service as Claude Service
    participant CLI as Claude CLI

    UI->>Service: sendMessage()
    Service->>CLI: spawn with --output-format stream-json

    loop Stream chunks
        CLI-->>Service: JSON event (partial)
        Service-->>UI: emit('content', chunk)
        UI->>UI: append to display
    end

    CLI-->>Service: result event
    Service-->>UI: emit('complete', result)
```

## Testing Strategy

### Unit Tests (Vitest)

```
src/main/services/*.test.ts     # Service tests
src/renderer/src/**/*.test.tsx  # Component tests
```

### E2E Tests (Playwright)

```
e2e/
├── electron.setup.ts           # Electron test setup
├── full-flow.spec.ts           # Complete user journey
└── todo-app-demo.spec.ts       # Autonomous flow demo
```

### Running Tests

```bash
# Unit tests with coverage
npm run test:coverage

# E2E tests
npm run test

# E2E with UI
npm run test:ui
```

## Extending the Application

### Adding a New Service

1. Create service file: `src/main/services/my.service.ts`
2. Add IPC channel in `src/shared/types/index.ts`
3. Register handler in `src/main/index.ts`
4. Expose in preload: `src/preload/index.ts`

### Adding a New View

1. Create component: `src/renderer/src/components/MyPanel.tsx`
2. Add to ViewMode type in `src/shared/types/index.ts`
3. Add keyboard shortcut in `useKeyboardShortcuts.ts`
4. Add sidebar button in `Sidebar.tsx`

### Adding a New Agent Type

1. Define system prompt in `src/main/services/claude.service.ts`
2. Add agent type to `AgentType` enum
3. Update UI agent selector

---

## Related Documentation

- [User Guide](USER_GUIDE.md) - End-user documentation
- [Quick Start](QUICK_START.md) - Getting started guide
- [CLAUDE.md](../CLAUDE.md) - Development guidelines
