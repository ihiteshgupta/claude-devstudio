# Claude DevStudio User Guide

> AI-Powered Agile SDLC Desktop Application

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Core Concepts](#core-concepts)
4. [Views & Features](#views--features)
5. [Workflows](#workflows)
6. [Keyboard Shortcuts](#keyboard-shortcuts)
7. [Best Practices](#best-practices)

---

## Introduction

Claude DevStudio is a desktop application that integrates AI agents into your software development lifecycle. It uses Claude Code CLI to provide specialized AI personas that can help with development, testing, security, documentation, and more.

### Key Features

- **6 AI Agent Personas** - Specialized agents for different tasks
- **Autonomous Task Execution** - AI works independently with configurable oversight
- **Project Analysis** - Automatic project structure detection
- **Roadmap Planning** - Now/Next/Later prioritization
- **Sprint Management** - Kanban-style task boards
- **Multi-Agent Workflows** - Chain agents for complex tasks

### Architecture Overview

```mermaid
graph TB
    subgraph "Claude DevStudio"
        UI[React UI]
        Store[Zustand Store]
        IPC[Electron IPC Bridge]
    end

    subgraph "Main Process"
        Services[Service Layer]
        DB[(SQLite Database)]
        Claude[Claude CLI]
    end

    UI --> Store
    Store --> IPC
    IPC --> Services
    Services --> DB
    Services --> Claude

    Claude --> |Streaming Response| Services
    Services --> |Events| IPC
    IPC --> |Updates| Store
    Store --> |Re-render| UI
```

---

## Getting Started

### Prerequisites

1. **Claude Code CLI** - Must be installed and authenticated
   ```bash
   # Verify installation
   claude --version
   ```

2. **Node.js** - Version 18 or higher

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/claude-devstudio.git

# Install dependencies
npm install

# Start development mode
npm run dev

# Or build for production
npm run build:mac   # macOS
npm run build:win   # Windows
npm run build:linux # Linux
```

### First Launch

When you first launch Claude DevStudio, you'll see the Welcome Screen:

![Welcome Screen](images/todo-01-welcome.png)

From here you can:
- **Open Project** - Select an existing folder
- **New Project** - Create a new project folder

---

## Core Concepts

### AI Agents

Claude DevStudio provides 6 specialized AI agents:

```mermaid
graph LR
    subgraph "AI Agents"
        DEV[Developer]
        PO[Product Owner]
        TEST[Tester]
        SEC[Security]
        OPS[DevOps]
        DOC[Documentation]
    end

    DEV --> |Code Generation| CODE[Source Code]
    PO --> |User Stories| STORIES[Backlog]
    TEST --> |Test Cases| TESTS[Test Suite]
    SEC --> |Audits| REPORTS[Security Reports]
    OPS --> |Pipelines| CICD[CI/CD]
    DOC --> |Documentation| DOCS[Docs]
```

| Agent | Responsibilities |
|-------|-----------------|
| **Developer** | Code generation, refactoring, debugging, code review |
| **Product Owner** | User stories, acceptance criteria, backlog prioritization |
| **Tester** | Test cases, test plans, QA automation |
| **Security** | Security audits, vulnerability scanning, compliance |
| **DevOps** | CI/CD pipelines, deployment, infrastructure |
| **Documentation** | Technical docs, API docs, user guides |

### Autonomy Levels

Control how much oversight AI agents have:

```mermaid
stateDiagram-v2
    [*] --> Pending

    state "Auto Mode" as Auto {
        Pending --> Executing: Start immediately
        Executing --> Completed: Finish without stops
    }

    state "Approval Gates Mode" as Gates {
        Pending --> Executing: Start immediately
        Executing --> ReviewOutput: Checkpoint reached
        ReviewOutput --> Executing: Approved
        ReviewOutput --> Completed: Final approval
    }

    state "Supervised Mode" as Supervised {
        Pending --> WaitingApproval: Request to start
        WaitingApproval --> Executing: User approves
        Executing --> ReviewOutput: Task complete
        ReviewOutput --> Completed: User confirms
    }
```

| Level | Description | Use Case |
|-------|-------------|----------|
| **Auto** | Execute without stopping | Documentation, formatting, simple tasks |
| **Approval Gates** | Pause at checkpoints | Code generation, refactoring |
| **Supervised** | Require approval before AND after | Deployments, security changes, deletions |

### Task Queue

The task queue manages all agent tasks:

```mermaid
flowchart LR
    subgraph "Task Queue"
        direction TB
        Q1[High Priority]
        Q2[Medium Priority]
        Q3[Low Priority]
    end

    subgraph "Execution"
        E1[Agent Pool]
        E2[Approval Gates]
    end

    subgraph "Output"
        O1[Results]
        O2[Artifacts]
    end

    Q1 --> E1
    Q2 --> E1
    Q3 --> E1
    E1 --> E2
    E2 --> O1
    E2 --> O2
```

---

## Views & Features

### 1. Dashboard (Cmd/Ctrl + 1)

The dashboard provides an overview of your project:

- Project metrics and statistics
- Recent activity
- Sprint progress
- Quick actions

### 2. Chat (Cmd/Ctrl + 2)

Interactive conversation with AI agents:

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Chat Panel
    participant A as Agent
    participant C as Claude CLI

    U->>UI: Type message
    UI->>A: Select agent type
    A->>C: Spawn process with system prompt
    C-->>A: Stream response
    A-->>UI: Update messages
    UI-->>U: Display response
```

**Features:**
- Select agent type (Developer, Tester, etc.)
- View conversation history
- Context-aware responses
- Code highlighting

### 3. Stories (Cmd/Ctrl + 3)

User story management:

```
┌─────────────────────────────────────────────────────────┐
│  USER STORIES                                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ [HIGH] User Authentication                       │   │
│  │                                                  │   │
│  │ As a user, I want to log in securely            │   │
│  │ so that my data is protected.                   │   │
│  │                                                  │   │
│  │ Story Points: 5  │  Status: In Progress         │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ [MEDIUM] Dashboard View                          │   │
│  │                                                  │   │
│  │ As a user, I want to see my dashboard           │   │
│  │ so that I can monitor activity.                 │   │
│  │                                                  │   │
│  │ Story Points: 3  │  Status: Backlog             │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Features:**
- Create user stories with acceptance criteria
- Assign story points
- Priority levels (High, Medium, Low)
- Link to sprints

### 4. Sprints (Cmd/Ctrl + 4)

Kanban-style sprint board:

```mermaid
graph LR
    subgraph "Sprint Board"
        TODO[To Do]
        PROG[In Progress]
        REV[Review]
        DONE[Done]
    end

    TODO --> PROG
    PROG --> REV
    REV --> DONE
    REV --> PROG
```

**Features:**
- Drag-and-drop task management
- Sprint goals and dates
- Velocity tracking
- Burndown visualization

### 5. Roadmap (Cmd/Ctrl + 5)

Now/Next/Later prioritization:

```
┌─────────────────────────────────────────────────────────────────────┐
│  ROADMAP                                                            │
├───────────────────┬───────────────────┬───────────────────────────┤
│       NOW         │       NEXT        │         LATER             │
│   (Current Focus) │    (Upcoming)     │        (Future)           │
├───────────────────┼───────────────────┼───────────────────────────┤
│                   │                   │                           │
│ ┌───────────────┐ │ ┌───────────────┐ │ ┌───────────────────────┐ │
│ │ Setup Dev Env │ │ │ CI/CD Pipeline│ │ │ Mobile App Support    │ │
│ │ [HIGH]        │ │ │ [MEDIUM]      │ │ │ [LOW]                 │ │
│ └───────────────┘ │ └───────────────┘ │ └───────────────────────┘ │
│                   │                   │                           │
│ ┌───────────────┐ │ ┌───────────────┐ │ ┌───────────────────────┐ │
│ │ Code Quality  │ │ │ API Docs      │ │ │ Analytics Dashboard   │ │
│ │ [HIGH]        │ │ │ [MEDIUM]      │ │ │ [LOW]                 │ │
│ └───────────────┘ │ └───────────────┘ │ └───────────────────────┘ │
│                   │                   │                           │
└───────────────────┴───────────────────┴───────────────────────────┘
```

**Features:**
- Drag items between lanes
- Epic/Feature/Milestone types
- Target quarters
- Progress tracking

### 6. Task Queue (Cmd/Ctrl + 6)

Autonomous task execution:

```mermaid
flowchart TD
    subgraph "Task Queue Panel"
        LIST[Task List]
        DETAILS[Task Details]
        CONTROLS[Execution Controls]
    end

    subgraph "Task States"
        PENDING[Pending]
        RUNNING[Running]
        WAITING[Waiting Approval]
        COMPLETE[Completed]
        CANCEL[Cancelled]
    end

    LIST --> DETAILS
    DETAILS --> CONTROLS

    CONTROLS --> |Start| RUNNING
    CONTROLS --> |Cancel| CANCEL
    CONTROLS --> |Approve| COMPLETE

    PENDING --> RUNNING
    RUNNING --> WAITING
    WAITING --> COMPLETE
```

**Features:**
- View all queued tasks
- Change autonomy levels
- Approve/reject at gates
- View task output and artifacts

### 7. Git (Cmd/Ctrl + 7)

Repository management:

**Features:**
- View changed files
- Commit history
- Branch management
- Diff viewer

### 8. Workflows (Cmd/Ctrl + 8)

Multi-agent pipelines:

```mermaid
flowchart LR
    subgraph "Story to Implementation Workflow"
        PO[Product Owner] --> |User Story| DEV[Developer]
        DEV --> |Code| TEST[Tester]
        TEST --> |Results| DEV
    end

    subgraph "Code Review Workflow"
        DEV2[Developer] --> |PR| REV[Code Review]
        REV --> SEC[Security]
        SEC --> |Report| DEV2
    end
```

**Built-in Templates:**
- Story to Tests
- Story to Implementation
- Code Review + Security
- Full Feature Pipeline

---

## Workflows

### Project Onboarding Flow

When you create or open a new project, the onboarding wizard guides you through setup:

```mermaid
flowchart TD
    START[Create/Open Project] --> ANALYZE[Analyze Project]
    ANALYZE --> |Scans files| DETECT[Detect Structure]

    DETECT --> LANG[Language Detection]
    DETECT --> FRAME[Framework Detection]
    DETECT --> EXIST[Existing Setup]

    LANG --> PLAN[Generate AI Plan]
    FRAME --> PLAN
    EXIST --> PLAN

    PLAN --> REVIEW[Review Plan]
    REVIEW --> |Modify| FEEDBACK[Provide Feedback]
    FEEDBACK --> PLAN
    REVIEW --> |Accept| APPLY[Apply Plan]

    APPLY --> ROADMAP[Create Roadmap Items]
    APPLY --> TASKS[Queue Tasks]

    ROADMAP --> READY[Project Ready]
    TASKS --> READY

    READY --> AGENTS[Agents Start Working]
```

**Step 1: Project Analysis**

The system automatically detects:
- Programming language (TypeScript, Python, Go, etc.)
- Frameworks (React, Express, Django, etc.)
- Existing tests, CI/CD, Docker setup
- Project structure and entry points

**Step 2: AI Plan Generation**

Claude generates a customized plan with:
- Roadmap items in Now/Next/Later lanes
- Tasks assigned to appropriate agents
- Suggested autonomy levels

**Step 3: Review & Apply**

You can:
- Select/deselect items
- Provide feedback to refine the plan
- Apply when satisfied

### Task Execution Flow

```mermaid
sequenceDiagram
    participant Q as Task Queue
    participant E as Executor
    participant A as Agent
    participant C as Claude CLI
    participant U as User

    Q->>E: Dequeue highest priority task
    E->>E: Check autonomy level

    alt Auto Mode
        E->>A: Execute immediately
        A->>C: Run with context
        C-->>A: Stream result
        A-->>E: Complete
    else Approval Gates
        E->>A: Execute immediately
        A->>C: Run with context
        C-->>A: Stream result
        A-->>E: Checkpoint reached
        E->>U: Request approval
        U-->>E: Approve/Reject
        E->>A: Continue or stop
    else Supervised
        E->>U: Request to start
        U-->>E: Approve start
        E->>A: Execute
        A->>C: Run with context
        C-->>A: Stream result
        A-->>E: Complete
        E->>U: Request final approval
        U-->>E: Confirm completion
    end

    E->>Q: Mark complete, get next
```

### Multi-Agent Workflow

```mermaid
flowchart LR
    subgraph "Full Feature Pipeline"
        direction TB

        INPUT[Feature Request] --> PO

        subgraph "Phase 1: Planning"
            PO[Product Owner]
            PO --> |User Stories| STORIES[(Stories DB)]
        end

        subgraph "Phase 2: Development"
            STORIES --> DEV[Developer]
            DEV --> |Code| CODE[(Codebase)]
        end

        subgraph "Phase 3: Quality"
            CODE --> TEST[Tester]
            TEST --> |Test Results| RESULTS[(Test Results)]
            CODE --> SEC[Security]
            SEC --> |Audit Report| AUDIT[(Security Report)]
        end

        subgraph "Phase 4: Documentation"
            CODE --> DOC[Documentation]
            DOC --> |Docs| DOCS[(Documentation)]
        end

        subgraph "Phase 5: Deployment"
            RESULTS --> OPS[DevOps]
            AUDIT --> OPS
            OPS --> |Deploy| PROD[Production]
        end
    end
```

---

## Keyboard Shortcuts

### Navigation

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + 1` | Dashboard |
| `Cmd/Ctrl + 2` | Chat |
| `Cmd/Ctrl + 3` | Stories |
| `Cmd/Ctrl + 4` | Sprints |
| `Cmd/Ctrl + 5` | Roadmap |
| `Cmd/Ctrl + 6` | Task Queue |
| `Cmd/Ctrl + 7` | Git |
| `Cmd/Ctrl + 8` | Workflows |

### Actions

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Command Palette |
| `Cmd/Ctrl + N` | New Item (context-aware) |
| `Cmd/Ctrl + S` | Save |
| `Cmd/Ctrl + Enter` | Send message (in Chat) |
| `?` | Show Tutorial |
| `Esc` | Close modal/dialog |

### Chat

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + Enter` | Send message |
| `Shift + Enter` | New line in message |
| `Up Arrow` | Edit last message |

---

## Best Practices

### 1. Start with Analysis

Always let the onboarding wizard analyze your project first. This ensures:
- Correct agent recommendations
- Appropriate task suggestions
- Proper context for AI responses

### 2. Use Appropriate Autonomy Levels

```
┌─────────────────────────────────────────────────────────────────┐
│  AUTONOMY LEVEL GUIDE                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  AUTO (Green)                                                   │
│  ├── Documentation generation                                   │
│  ├── Code formatting                                            │
│  ├── Simple refactoring                                         │
│  └── Test scaffolding                                           │
│                                                                 │
│  APPROVAL GATES (Yellow)                                        │
│  ├── Code generation                                            │
│  ├── Complex refactoring                                        │
│  ├── Database migrations                                        │
│  └── API changes                                                │
│                                                                 │
│  SUPERVISED (Red)                                               │
│  ├── Production deployments                                     │
│  ├── Security-sensitive changes                                 │
│  ├── Data deletions                                             │
│  └── Infrastructure changes                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Provide Context in Chat

When chatting with agents, provide:
- Clear requirements
- Relevant file paths
- Expected outcomes
- Constraints or preferences

**Good:**
```
Create a user authentication module using bcrypt for password
hashing. The module should:
- Support email/password login
- Use JWT tokens with 24h expiry
- Follow the existing patterns in src/auth/
```

**Bad:**
```
Add login
```

### 4. Review AI Output

Even with auto mode:
- Review generated code before committing
- Run tests after code changes
- Check security reports for false positives

### 5. Use Workflows for Complex Tasks

Instead of running agents individually:
- Use built-in workflow templates
- Create custom workflows for repeated tasks
- Let agents pass context to each other

### 6. Keep Roadmap Updated

- Move completed items out of "Now"
- Regularly review "Next" priorities
- Archive old "Later" items

---

## Troubleshooting

### Claude CLI Not Found

```bash
# Check if Claude is installed
which claude

# If not found, install Claude Code CLI
# Follow instructions at: https://claude.ai/code
```

### Database Errors

If you see database schema errors:
1. Close the application
2. Delete `~/Library/Application Support/claude-devstudio/claude-data/`
3. Restart the application

### Task Stuck in Queue

If a task won't complete:
1. Check the task's autonomy level
2. Look for pending approval requests
3. Cancel and re-queue if necessary

### Agent Not Responding

If chat messages aren't getting responses:
1. Check Claude CLI authentication: `claude auth status`
2. Verify internet connection
3. Check for rate limiting

---

## Appendix

### Database Schema

```mermaid
erDiagram
    PROJECTS ||--o{ USER_STORIES : contains
    PROJECTS ||--o{ ROADMAP_ITEMS : contains
    PROJECTS ||--o{ TASK_QUEUE : contains
    PROJECTS ||--o{ SPRINTS : contains

    USER_STORIES ||--o{ TEST_CASES : has
    USER_STORIES }o--|| SPRINTS : assigned_to

    TASK_QUEUE ||--o{ APPROVAL_GATES : has
    TASK_QUEUE ||--o{ TASK_DEPENDENCIES : depends_on

    SPRINTS ||--o{ USER_STORIES : contains

    PROJECTS {
        string id PK
        string name
        string path
        datetime created_at
        datetime last_opened_at
    }

    USER_STORIES {
        string id PK
        string project_id FK
        string title
        string description
        string acceptance_criteria
        int story_points
        string priority
        string status
    }

    TASK_QUEUE {
        string id PK
        string project_id FK
        string title
        string description
        string agent_type
        string autonomy_level
        string status
        int priority
    }

    ROADMAP_ITEMS {
        string id PK
        string project_id FK
        string title
        string description
        string type
        string lane
        string priority
    }
```

### API Reference

All IPC channels are defined in `src/shared/types/index.ts`:

```typescript
// Project operations
window.electronAPI.projects.create({ path, name })
window.electronAPI.projects.open(projectId)
window.electronAPI.projects.list()

// Task Queue operations
window.electronAPI.taskQueue.enqueue({ ... })
window.electronAPI.taskQueue.list(projectId)
window.electronAPI.taskQueue.updateAutonomy(taskId, level)
window.electronAPI.taskQueue.cancel(taskId)

// Onboarding operations
window.electronAPI.onboarding.analyze(projectPath)
window.electronAPI.onboarding.init({ projectPath, projectName, projectId })
window.electronAPI.onboarding.applyPlan(planId)

// And more...
```

---

## Support

- **GitHub Issues**: Report bugs and request features
- **Documentation**: Check `CLAUDE.md` for developer documentation
- **Community**: Join discussions in GitHub Discussions

---

*Claude DevStudio - Empowering developers with AI-assisted Agile workflows*
