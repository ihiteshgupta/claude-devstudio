# Claude DevStudio Test Plan

## 1. Overview

This test plan covers all testing activities for Claude DevStudio, an Electron-based AI-powered Agile SDLC application.

## 2. Test Scope

### 2.1 In Scope
- Application launch and initialization
- UI components and navigation
- Claude CLI integration
- Project management (CRUD)
- Chat functionality with AI agents
- User stories management
- Workflow execution
- Data persistence (SQLite)

### 2.2 Out of Scope
- Claude CLI internal functionality
- Third-party library internals

## 3. Test Types

### 3.1 Unit Tests
| Component | Test Cases | Priority |
|-----------|------------|----------|
| responseParser.ts | Parse JSON events, handle malformed data | High |
| contextBudget.ts | Token estimation, file prioritization | High |
| claude.service.ts | Path finding, status check, message sending | High |
| database.service.ts | CRUD operations, SQL injection prevention | High |
| project.service.ts | Project CRUD, validation | Medium |

### 3.2 Integration Tests
| Integration | Test Cases | Priority |
|-------------|------------|----------|
| Main ↔ Renderer IPC | All IPC channels communication | High |
| Claude CLI spawning | Process lifecycle, streaming | High |
| SQLite persistence | Data integrity across restarts | High |
| File system access | Project directory reading | Medium |

### 3.3 E2E Tests (Playwright)
**Status: 34 tests implemented and passing**

| Suite | Tests | Status |
|-------|-------|--------|
| Application Launch | 5 | ✅ Passing |
| Sidebar Navigation | 5 | ✅ Passing |
| Titlebar | 2 | ✅ Passing |
| New Project Modal | 4 | ✅ Passing |
| Welcome Screen | 7 | ✅ Passing |
| Home View | 2 | ✅ Passing |
| Keyboard Navigation | 1 | ✅ Passing |
| Layout | 3 | ✅ Passing |
| Error Handling | 2 | ✅ Passing |
| Performance | 1 | ✅ Passing |
| Dashboard Panel | 1 | ✅ Passing |
| Status Indicators | 1 | ✅ Passing |

### 3.4 Manual Test Cases

#### TC-001: Project Creation Flow
1. Click "New Project" button
2. Enter project name
3. Select project directory
4. Click "Create"
5. **Expected**: Project appears in sidebar, view tabs enabled

#### TC-002: Chat with Developer Agent
1. Select a project
2. Navigate to Chat view
3. Select "Developer" agent
4. Send message: "Explain the project structure"
5. **Expected**: Streaming response with code context

#### TC-003: Chat with Product Owner Agent
1. Select a project
2. Navigate to Chat view
3. Select "Product Owner" agent
4. Send message: "Create a user story for login"
5. **Expected**: Formatted user story with acceptance criteria

#### TC-004: User Story Creation
1. Navigate to Stories view
2. Click "New Story"
3. Enter story details
4. Click "Generate with AI"
5. **Expected**: AI-generated acceptance criteria

#### TC-005: Workflow Execution
1. Select a project
2. Navigate to Workflows
3. Select "Story to Tests" workflow
4. Provide user story input
5. Execute workflow
6. **Expected**: Multi-step execution with test cases output

#### TC-006: Session Persistence
1. Create a project and send messages
2. Close application
3. Reopen application
4. Select same project
5. **Expected**: Previous messages visible in chat

#### TC-007: Claude CLI Status
1. Launch application
2. Check status bar
3. **Expected**: Shows "Claude Connected" with version

#### TC-008: Error Handling - No Claude CLI
1. Rename/hide Claude CLI executable
2. Launch application
3. **Expected**: Shows "Claude Not Found" status, chat disabled

## 4. Test Environment

### 4.1 Requirements
- macOS 12+ / Windows 10+ / Linux
- Node.js 18+
- Claude Code CLI installed and authenticated
- 8GB RAM minimum

### 4.2 Test Data
- Sample projects in various languages
- Pre-created user stories
- Mock responses for offline testing

## 5. Test Commands

```bash
# Run all E2E tests
npm run test

# Run tests with UI
npm run test:ui

# View test report
npm run test:report

# Run specific test file
npx playwright test e2e/app.spec.ts

# Run tests in debug mode
npx playwright test --debug
```

## 6. Acceptance Criteria

### 6.1 Release Criteria
- [ ] All E2E tests passing (34/34)
- [ ] No critical bugs open
- [ ] Performance: App loads < 5 seconds
- [ ] Memory: < 500MB after 1 hour usage
- [ ] All manual test cases pass

### 6.2 Quality Gates
| Metric | Target |
|--------|--------|
| E2E Test Pass Rate | 100% |
| Code Coverage | > 70% |
| P0 Bugs | 0 |
| P1 Bugs | < 3 |

## 7. Known Issues

| Issue | Severity | Status |
|-------|----------|--------|
| workflow:list error (getWorkflowsByProject) | Medium | Open |
| View tabs disabled without project | Low | By Design |

## 8. Test Schedule

| Phase | Duration | Activities |
|-------|----------|------------|
| Unit Tests | Ongoing | Add tests with new features |
| Integration | Per PR | CI pipeline validation |
| E2E | Pre-release | Full regression |
| Manual | Pre-release | Exploratory testing |

## 9. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Claude CLI unavailable | High | Graceful degradation, clear error messages |
| Large project directories | Medium | Context budget limits, file prioritization |
| SQLite corruption | High | Backup on startup, recovery mode |
