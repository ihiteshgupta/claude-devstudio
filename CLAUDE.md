# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude DevStudio is an AI-powered Agile SDLC desktop application built with Electron. It integrates with Claude Code CLI to provide multiple AI agent personas (Developer, Product Owner, Tester, Security, DevOps, Documentation) for software development workflows.

## Build & Development Commands

```bash
# Development
npm run dev              # Start development server with hot reload

# Build
npm run build            # Build all (main, preload, renderer)
npm run build:mac        # Build for macOS
npm run build:win        # Build for Windows
npm run build:linux      # Build for Linux

# Code Quality
npm run lint             # ESLint for .ts/.tsx files
npm run typecheck        # Type check all TypeScript
npm run typecheck:main   # Type check main process only
npm run typecheck:renderer  # Type check renderer only

# Testing
npm run test             # Run E2E tests with Playwright
npm run test:ui          # Run tests with Playwright UI
npm run test:report      # Show test report
```

## Architecture

This is an Electron app using electron-vite with three distinct processes:

### Main Process (`src/main/`)
- **index.ts**: App lifecycle, window management, IPC handler registration
- **services/claude.service.ts**: Spawns Claude CLI processes, manages streaming responses via EventEmitter
- **services/database.service.ts**: SQLite persistence using better-sqlite3 (stores in userData/claude-data/)
- **services/workflow.service.ts**: Multi-agent pipeline orchestration with templates
- **services/project.service.ts**: Project CRUD via electron-store
- **services/file.service.ts**: File tree and content reading for project context
- **services/roadmap.service.ts**: Roadmap item CRUD with lane (Now/Next/Later) and quarter management
- **services/task-queue.service.ts**: Autonomous task execution with configurable autonomy levels
- **services/tech-advisor.service.ts**: AI-powered technology recommendations with pros/cons analysis
- **services/task-decomposer.service.ts**: Breaks high-level tasks into subtasks with dependencies

### Preload (`src/preload/`)
- **index.ts**: Exposes typed `window.electronAPI` bridge with namespaced methods (claude, projects, sessions, stories, testCases, workflows, files, window, app, roadmap, taskQueue, techAdvisor, decomposer)

### Renderer (`src/renderer/src/`)
- React 18 + TypeScript + Tailwind CSS + Radix UI + @hello-pangea/dnd
- **stores/appStore.ts**: Zustand store for global state (ViewMode: dashboard, chat, workflows, stories, sprints, git, roadmap, task-queue)
- **components/**: ChatPanel, WorkflowPanel, StoriesPanel, SprintPanel, GitPanel, DashboardPanel, RoadmapPanel, TaskQueuePanel, Sidebar, etc.
- **hooks/useKeyboardShortcuts.ts**: Keyboard shortcuts for view navigation (Cmd/Ctrl+1-8)

### Shared (`src/shared/types/`)
- **index.ts**: Type definitions shared between processes, including `IPC_CHANNELS` constants

## Key Patterns

**IPC Communication**: All main↔renderer communication uses typed channels defined in `IPC_CHANNELS`. Add new channels there and implement handlers in `src/main/index.ts`.

**Claude CLI Integration**: The app spawns `claude --print` with system prompts for each agent type. Responses stream via EventEmitter pattern to the renderer.

**Multi-Agent Workflows**: Predefined templates (story-to-tests, story-to-implementation, code-review-security, full-feature-pipeline) chain agent tasks with output passed as input to next step.

**Database**: SQLite tables for chat_sessions, messages, workflows, workflow_steps, user_stories, test_cases, roadmap_items, task_queue, tech_choices, task_dependencies, approval_gates. All queries use prepared statements.

**Autonomous Task System**: Task queue with three autonomy levels:
- `auto`: Execute without stops
- `approval_gates`: Pause at configured checkpoints (before_execution, after_execution, on_tech_decision, on_subtask_complete, custom)
- `supervised`: Require approval before and after each task

**Tech Advisor**: AI analyzes requirements and presents 2-3 technology options with pros/cons. Blocks task execution until decision is made.

**Task Decomposition**: High-level tasks are automatically broken into subtasks with suggested agent types, duration estimates, and dependency graphs.

## Path Aliases

Configured in `electron.vite.config.ts`:
- `@main` → `src/main`
- `@renderer` → `src/renderer/src`
- `@shared` → `src/shared`

## View Modes

The app has 8 view modes accessible via sidebar or keyboard shortcuts:

| View | Shortcut | Description |
|------|----------|-------------|
| Dashboard | Cmd/Ctrl+1 | Project metrics and sprint progress |
| Chat | Cmd/Ctrl+2 | AI agent conversations |
| Stories | Cmd/Ctrl+3 | User story management |
| Sprints | Cmd/Ctrl+4 | Kanban board for sprint tasks |
| Roadmap | Cmd/Ctrl+5 | Now/Next/Later lanes with timeline view |
| Task Queue | Cmd/Ctrl+6 | Autonomous task execution with approvals |
| Git | Cmd/Ctrl+7 | Repository status and commits |
| Workflows | Cmd/Ctrl+8 | Multi-agent pipeline templates |

## Prerequisites

Requires Claude Code CLI installed and authenticated (`claude` command available in PATH).
