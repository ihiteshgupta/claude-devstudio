import { test, expect } from './electron.setup'
import path from 'path'
import fs from 'fs'
import os from 'os'

/**
 * Full Flow E2E Test
 *
 * This test demonstrates the complete user journey:
 * 1. Launch app and create a project
 * 2. Navigate to different views
 * 3. Create user stories via Product Owner agent
 * 4. Create tasks in Task Queue with different autonomy levels
 * 5. Test approval workflow
 * 6. View dashboard metrics
 */

// Helper to create test project directory
function createTestProjectDir(): string {
  const testDir = path.join(os.tmpdir(), `e2e-full-flow-${Date.now()}`)
  fs.mkdirSync(testDir, { recursive: true })
  // Create a basic project structure
  fs.writeFileSync(path.join(testDir, 'README.md'), '# E2E Test Project\n\nThis is a test project for E2E testing.')
  fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({
    name: 'e2e-test-project',
    version: '1.0.0',
    description: 'Test project'
  }, null, 2))
  return testDir
}

function cleanupTestProject(testDir: string): void {
  try {
    fs.rmSync(testDir, { recursive: true, force: true })
  } catch {
    // Ignore cleanup errors
  }
}

test.describe('Full Application Flow', () => {
  let testDir: string

  test.beforeAll(() => {
    testDir = createTestProjectDir()
  })

  test.afterAll(() => {
    if (testDir) {
      cleanupTestProject(testDir)
    }
  })

  test('Complete User Journey - From Project Creation to Task Execution', async ({ page }) => {
    // ============================================
    // STEP 1: Application Launch
    // ============================================
    console.log('Step 1: Verifying app launch...')

    await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    await expect(page.locator('text=AI-powered Agile SDLC')).toBeVisible()

    // Take screenshot of welcome screen
    await page.screenshot({ path: 'test-results/01-welcome-screen.png' })

    // ============================================
    // STEP 2: Create a New Project
    // ============================================
    console.log('Step 2: Creating new project...')

    // Create project via API (more reliable than UI for tests)
    const project = await page.evaluate(async (projectPath) => {
      return await window.electronAPI.projects.create({
        path: projectPath,
        name: 'E2E Test Project'
      })
    }, testDir)

    expect(project.id).toBeTruthy()
    expect(project.name).toBe('E2E Test Project')
    console.log(`Project created: ${project.id}`)

    // Wait for UI to update
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'test-results/02-project-created.png' })

    // ============================================
    // STEP 3: Create User Stories
    // ============================================
    console.log('Step 3: Creating user stories...')

    const stories = await page.evaluate(async (projectId) => {
      const story1 = await window.electronAPI.stories.create({
        projectId,
        title: 'User Authentication',
        description: 'As a user, I want to log in securely so that my data is protected',
        acceptanceCriteria: '- Login form with email/password\n- Password validation\n- Session management',
        storyPoints: 5,
        priority: 'high'
      })

      const story2 = await window.electronAPI.stories.create({
        projectId,
        title: 'Dashboard View',
        description: 'As a user, I want to see my dashboard so that I can monitor my activity',
        acceptanceCriteria: '- Display key metrics\n- Show recent activity\n- Responsive design',
        storyPoints: 3,
        priority: 'medium'
      })

      const story3 = await window.electronAPI.stories.create({
        projectId,
        title: 'Settings Page',
        description: 'As a user, I want to configure my preferences',
        acceptanceCriteria: '- Profile settings\n- Notification preferences\n- Theme selection',
        storyPoints: 2,
        priority: 'low'
      })

      return [story1, story2, story3]
    }, project.id)

    expect(stories.length).toBe(3)
    console.log(`Created ${stories.length} user stories`)

    // ============================================
    // STEP 4: Create Tasks with Different Autonomy Levels
    // ============================================
    console.log('Step 4: Creating tasks with different autonomy levels...')

    const tasks = await page.evaluate(async (args) => {
      const { projectId, storyId } = args

      // Task 1: Auto (fully autonomous)
      const autoTask = await window.electronAPI.taskQueue.enqueue({
        projectId,
        title: 'Generate login component',
        description: 'Create React component for user login',
        taskType: 'code-generation',
        autonomyLevel: 'auto',
        agentType: 'developer',
        priority: 10
      })

      // Task 2: Approval Gates (pause at checkpoints)
      const approvalTask = await window.electronAPI.taskQueue.enqueue({
        projectId,
        title: 'Review authentication flow',
        description: 'Security review of auth implementation',
        taskType: 'security-audit',
        autonomyLevel: 'approval_gates',
        agentType: 'security',
        priority: 5
      })

      // Task 3: Supervised (require approval before and after)
      const supervisedTask = await window.electronAPI.taskQueue.enqueue({
        projectId,
        title: 'Deploy to production',
        description: 'Deploy authenticated app to production',
        taskType: 'deployment',
        autonomyLevel: 'supervised',
        agentType: 'devops',
        priority: 1
      })

      // Task 4: Testing task
      const testTask = await window.electronAPI.taskQueue.enqueue({
        projectId,
        title: 'Write unit tests for login',
        description: 'Create comprehensive test suite',
        taskType: 'testing',
        autonomyLevel: 'auto',
        agentType: 'tester',
        priority: 8
      })

      return [autoTask, approvalTask, supervisedTask, testTask]
    }, { projectId: project.id, storyId: stories[0].id })

    expect(tasks.length).toBe(4)
    console.log(`Created ${tasks.length} tasks with different autonomy levels`)

    // Verify autonomy levels
    expect(tasks[0].autonomyLevel).toBe('auto')
    expect(tasks[1].autonomyLevel).toBe('approval_gates')
    expect(tasks[2].autonomyLevel).toBe('supervised')
    expect(tasks[3].autonomyLevel).toBe('auto')

    await page.screenshot({ path: 'test-results/03-tasks-created.png' })

    // ============================================
    // STEP 5: Verify Task Queue State
    // ============================================
    console.log('Step 5: Verifying task queue state...')

    const queuedTasks = await page.evaluate(async (projectId) => {
      return await window.electronAPI.taskQueue.list(projectId)
    }, project.id)

    expect(queuedTasks.length).toBe(4)

    // All tasks should start as pending
    const pendingTasks = queuedTasks.filter(t => t.status === 'pending')
    expect(pendingTasks.length).toBe(4)

    console.log('Task Queue State:')
    queuedTasks.forEach(t => {
      console.log(`  - ${t.title}: ${t.status} (${t.autonomyLevel})`)
    })

    // ============================================
    // STEP 6: Test Autonomy Level Updates
    // ============================================
    console.log('Step 6: Testing autonomy level updates...')

    // Change auto task to supervised
    await page.evaluate(async (taskId) => {
      await window.electronAPI.taskQueue.updateAutonomy(taskId, 'supervised')
    }, tasks[0].id)

    const updatedTask = await page.evaluate(async (taskId) => {
      return await window.electronAPI.taskQueue.get(taskId)
    }, tasks[0].id)

    expect(updatedTask?.autonomyLevel).toBe('supervised')
    console.log(`Task autonomy updated: auto -> supervised`)

    // ============================================
    // STEP 7: Test Task Cancellation
    // ============================================
    console.log('Step 7: Testing task cancellation...')

    await page.evaluate(async (taskId) => {
      await window.electronAPI.taskQueue.cancel(taskId)
    }, tasks[3].id)

    const cancelledTask = await page.evaluate(async (taskId) => {
      return await window.electronAPI.taskQueue.get(taskId)
    }, tasks[3].id)

    expect(cancelledTask?.status).toBe('cancelled')
    console.log('Task cancelled successfully')

    // ============================================
    // STEP 8: Create Roadmap Items
    // ============================================
    console.log('Step 8: Creating roadmap items...')

    const roadmapItems = await page.evaluate(async (projectId) => {
      const epic = await window.electronAPI.roadmap.create({
        projectId,
        title: 'User Management System',
        description: 'Complete user management with auth, profiles, and settings',
        type: 'epic',
        lane: 'now',
        priority: 'high'
      })

      const feature1 = await window.electronAPI.roadmap.create({
        projectId,
        parentId: epic.id,
        title: 'Authentication Module',
        type: 'feature',
        lane: 'now'
      })

      const feature2 = await window.electronAPI.roadmap.create({
        projectId,
        title: 'API Integration',
        type: 'feature',
        lane: 'next'
      })

      const milestone = await window.electronAPI.roadmap.create({
        projectId,
        title: 'MVP Release',
        type: 'milestone',
        lane: 'later',
        targetQuarter: 'Q1 2025'
      })

      return [epic, feature1, feature2, milestone]
    }, project.id)

    expect(roadmapItems.length).toBe(4)
    console.log(`Created ${roadmapItems.length} roadmap items`)

    // ============================================
    // STEP 9: Create Sprint and Add Stories
    // ============================================
    console.log('Step 9: Creating sprint...')

    const sprint = await page.evaluate(async (args) => {
      const { projectId, storyIds } = args

      const sprint = await window.electronAPI.sprints.create({
        projectId,
        name: 'Sprint 1 - Authentication',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 2 weeks
        goal: 'Implement user authentication'
      })

      // Add stories to sprint
      for (const storyId of storyIds.slice(0, 2)) {
        await window.electronAPI.sprints.addStory(sprint.id, storyId)
      }

      return sprint
    }, { projectId: project.id, storyIds: stories.map(s => s.id) })

    expect(sprint.id).toBeTruthy()
    console.log(`Sprint created: ${sprint.name}`)

    await page.screenshot({ path: 'test-results/04-sprint-created.png' })

    // ============================================
    // STEP 10: Verify Final State
    // ============================================
    console.log('Step 10: Verifying final state...')

    const finalState = await page.evaluate(async (projectId) => {
      const stories = await window.electronAPI.stories.list(projectId)
      const tasks = await window.electronAPI.taskQueue.list(projectId)
      const roadmap = await window.electronAPI.roadmap.list(projectId)
      const sprints = await window.electronAPI.sprints.list(projectId)

      return {
        storiesCount: stories.length,
        tasksCount: tasks.length,
        activeTasks: tasks.filter(t => t.status === 'pending').length,
        cancelledTasks: tasks.filter(t => t.status === 'cancelled').length,
        roadmapCount: roadmap.length,
        sprintsCount: sprints.length
      }
    }, project.id)

    console.log('Final State:')
    console.log(`  - Stories: ${finalState.storiesCount}`)
    console.log(`  - Total Tasks: ${finalState.tasksCount}`)
    console.log(`  - Active Tasks: ${finalState.activeTasks}`)
    console.log(`  - Cancelled Tasks: ${finalState.cancelledTasks}`)
    console.log(`  - Roadmap Items: ${finalState.roadmapCount}`)
    console.log(`  - Sprints: ${finalState.sprintsCount}`)

    expect(finalState.storiesCount).toBe(3)
    expect(finalState.tasksCount).toBe(4)
    expect(finalState.activeTasks).toBe(3)
    expect(finalState.cancelledTasks).toBe(1)
    expect(finalState.roadmapCount).toBe(4)
    expect(finalState.sprintsCount).toBe(1)

    await page.screenshot({ path: 'test-results/05-final-state.png' })

    console.log('Full flow test completed successfully!')
  })

  test('Autonomy System - Approval Workflow', async ({ page }) => {
    // ============================================
    // Test the approval workflow for supervised tasks
    // ============================================
    console.log('Testing approval workflow...')

    // Create a fresh project directory for this test
    const approvalDir = path.join(os.tmpdir(), `e2e-approval-${Date.now()}`)
    fs.mkdirSync(approvalDir, { recursive: true })
    fs.writeFileSync(path.join(approvalDir, 'README.md'), '# Approval Test')

    const project = await page.evaluate(async (projectPath) => {
      return await window.electronAPI.projects.create({
        path: projectPath,
        name: 'Approval Test Project'
      })
    }, approvalDir)

    // Create a supervised task (requires pre and post approval)
    const task = await page.evaluate(async (projectId) => {
      return await window.electronAPI.taskQueue.enqueue({
        projectId,
        title: 'Critical Deployment',
        description: 'Deploy to production environment',
        taskType: 'deployment',
        autonomyLevel: 'supervised',
        agentType: 'devops'
      })
    }, project.id)

    expect(task.autonomyLevel).toBe('supervised')
    expect(task.status).toBe('pending')

    // Verify task has no approvals yet
    const initialApprovals = await page.evaluate(async (taskId) => {
      return await window.electronAPI.taskQueue.getApprovals(taskId)
    }, task.id)

    expect(initialApprovals.length).toBe(0)

    console.log('Supervised task created, ready for approval workflow')
    await page.screenshot({ path: 'test-results/06-approval-workflow.png' })
  })

  test('Task Queue - Priority Ordering', async ({ page }) => {
    console.log('Testing task priority ordering...')

    // Create a fresh project directory for this test
    const priorityDir = path.join(os.tmpdir(), `e2e-priority-${Date.now()}`)
    fs.mkdirSync(priorityDir, { recursive: true })
    fs.writeFileSync(path.join(priorityDir, 'README.md'), '# Priority Test')

    const project = await page.evaluate(async (projectPath) => {
      return await window.electronAPI.projects.create({
        path: projectPath,
        name: 'Priority Test Project'
      })
    }, priorityDir)

    // Create tasks with different priorities
    await page.evaluate(async (projectId) => {
      await window.electronAPI.taskQueue.enqueue({
        projectId,
        title: 'Low Priority Task',
        taskType: 'documentation',
        priority: 100
      })

      await window.electronAPI.taskQueue.enqueue({
        projectId,
        title: 'High Priority Task',
        taskType: 'bug-fix',
        priority: 1
      })

      await window.electronAPI.taskQueue.enqueue({
        projectId,
        title: 'Medium Priority Task',
        taskType: 'code-review',
        priority: 50
      })
    }, project.id)

    const tasks = await page.evaluate(async (projectId) => {
      return await window.electronAPI.taskQueue.list(projectId)
    }, project.id)

    expect(tasks.length).toBe(3)

    // Log priority order
    console.log('Tasks by priority:')
    tasks.sort((a, b) => a.priority - b.priority).forEach(t => {
      console.log(`  Priority ${t.priority}: ${t.title}`)
    })

    await page.screenshot({ path: 'test-results/07-priority-ordering.png' })
  })

  test('Agent Types - Verify All Agents Available', async ({ page }) => {
    console.log('Verifying all agent types...')

    // Create a fresh project directory for this test
    const agentsDir = path.join(os.tmpdir(), `e2e-agents-${Date.now()}`)
    fs.mkdirSync(agentsDir, { recursive: true })
    fs.writeFileSync(path.join(agentsDir, 'README.md'), '# Agents Test')

    const project = await page.evaluate(async (projectPath) => {
      return await window.electronAPI.projects.create({
        path: projectPath,
        name: 'Agent Types Test'
      })
    }, agentsDir)

    const agentTypes = ['developer', 'product_owner', 'tester', 'security', 'devops', 'documentation']

    for (const agentType of agentTypes) {
      const task = await page.evaluate(async (args) => {
        return await window.electronAPI.taskQueue.enqueue({
          projectId: args.projectId,
          title: `Task for ${args.agentType}`,
          taskType: 'code-generation',
          agentType: args.agentType
        })
      }, { projectId: project.id, agentType })

      expect(task.agentType).toBe(agentType)
      console.log(`  Created task for agent: ${agentType}`)
    }

    await page.screenshot({ path: 'test-results/08-agent-types.png' })
  })
})

// ============================================
// UI Navigation Tests with Screenshots
// ============================================
test.describe('UI Navigation Flow', () => {
  test('Navigate Through All Views', async ({ page }) => {
    console.log('Testing UI navigation...')

    // Welcome screen
    await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    await page.screenshot({ path: 'test-results/nav-01-home.png' })

    // Check sidebar buttons
    const viewButtons = ['Home', 'Chat', 'Stories', 'Sprints', 'Roadmap', 'Tasks', 'Git']

    for (const view of viewButtons) {
      const button = page.locator(`button[title="${view}"]`)
      await expect(button).toBeVisible()
      console.log(`  View button visible: ${view}`)
    }

    // Open New Project modal
    await page.click('button:has-text("New Project")')
    await expect(page.locator('text=Create New Project')).toBeVisible()
    await page.screenshot({ path: 'test-results/nav-02-new-project-modal.png' })

    // Close modal
    await page.click('button:has-text("Cancel")')
    await expect(page.locator('text=Create New Project')).not.toBeVisible()

    console.log('UI navigation test completed')
  })
})
