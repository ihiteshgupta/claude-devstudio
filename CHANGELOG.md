# Changelog

All notable changes to Claude DevStudio will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Testing infrastructure with Vitest and Playwright
- GitHub Actions CI/CD workflows
- Legal files (LICENSE, NOTICE, CONTRIBUTING.md)

## [1.0.0] - TBD

### Added
- **AI Agent System**: 6 specialized agent personas
  - Developer: Code generation, debugging, implementation
  - Product Owner: User stories, requirements, acceptance criteria
  - Tester: Test cases, test plans, quality assurance
  - Security: Security audits, vulnerability detection
  - DevOps: CI/CD, deployment, infrastructure
  - Documentation: Technical docs, API references

- **Project Management**
  - User story creation and management
  - Sprint planning with Kanban board
  - Roadmap planning with Now/Next/Later lanes
  - Task decomposition with dependencies

- **Autonomous Task System**
  - Task queue with priority management
  - Three autonomy levels: auto, approval_gates, supervised
  - Technology advisor with pros/cons analysis
  - Approval gates at configurable checkpoints

- **Multi-Agent Workflows**
  - Predefined workflow templates
  - Agent handoff system
  - Conflict detection and resolution
  - Sprint automation

- **Chat Interface**
  - Streaming responses from Claude CLI
  - File context selection
  - Session history and persistence
  - Action detection and execution

- **Git Integration**
  - Repository status visualization
  - Commit history
  - Branch management

- **Learning System**
  - Feedback tracking
  - Style analysis
  - Pattern learning from user interactions

- **UI/UX**
  - Command palette (Cmd/Ctrl+K)
  - Keyboard shortcuts for navigation
  - Dark mode support
  - Collapsible sidebar

### Security
- Context isolation enabled for renderer process
- Sandboxed renderer
- No node integration in renderer
- Secure IPC communication

### Known Issues
- Requires Claude Code CLI to be separately installed and authenticated
- macOS: May require permissions for file system access
- Windows: Not code-signed (SmartScreen warning)

---

## Version History

### Pre-release Development

#### Phase 5: Multi-Agent Coordination
- Agent handoff system
- Conflict detection service
- Sprint automation
- Chat workflow orchestration

#### Phase 4: Learning System
- Feedback tracker
- Style analyzer
- Learning service

#### Phase 3: Memory and Context
- Agent memory service
- Decision tracking
- Sprint/roadmap awareness

#### Phase 2: Enhanced Autonomy
- Similarity detection
- Context injection
- Auto-queue system

#### Phase 1: Core Autonomy
- Action parser
- Chat-to-database bridge
- Task detection
