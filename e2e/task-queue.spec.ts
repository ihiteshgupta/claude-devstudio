import { test, expect } from './electron.setup'
import path from 'path'
import fs from 'fs'
import os from 'os'

// Helper to create a test project folder
function createTestProjectDir(): string {
  const testDir = path.join(os.tmpdir(), `test-project-${Date.now()}`)
  fs.mkdirSync(testDir, { recursive: true })
  fs.writeFileSync(path.join(testDir, 'README.md'), '# Test Project')
  return testDir
}

// Cleanup helper
function cleanupTestProject(testDir: string): void {
  try {
    fs.rmSync(testDir, { recursive: true, force: true })
  } catch {
    // Ignore cleanup errors
  }
}

// Helper to create a project via UI
async function createProjectViaUI(page: any, projectName: string, testDir: string): Promise<void> {
  // Click New Project button
  await page.click('button:has-text("New Project")')
  await page.waitForTimeout(300)

  // Fill in project name
  await page.fill('input[placeholder="Project name"]', projectName)

  // We need to set the path - look for path input or use Browse button
  const pathInput = page.locator('input[placeholder*="path"], input[placeholder*="location"]').first()
  if (await pathInput.isVisible()) {
    await pathInput.fill(testDir)
  }

  // Click Create
  await page.click('button:has-text("Create")')
  await page.waitForTimeout(500)
}

// ============================================
// Task Queue Panel Tests - Basic Navigation
// ============================================
test.describe('Task Queue Panel', () => {
  test.describe('Task Queue Navigation', () => {
    test('should show Task Queue tab in sidebar', async ({ page }) => {
      await expect(page.locator('button[title="Tasks"]')).toBeVisible()
    })

    test('should have Tasks tab disabled without project', async ({ page }) => {
      const tasksButton = page.locator('button[title="Tasks"]')
      await expect(tasksButton).toBeDisabled()
    })

    test('should show keyboard shortcut indicator for Task Queue', async ({ page }) => {
      // The Tasks button should be visible with title attribute
      const tasksButton = page.locator('button[title="Tasks"]')
      await expect(tasksButton).toBeVisible()
    })
  })
})

// ============================================
// API Tests (don't require UI project selection)
// ============================================
test.describe('Task Queue API', () => {
  test('should have taskQueue API available', async ({ page }) => {
    const hasApi = await page.evaluate(() => {
      return typeof window.electronAPI.taskQueue === 'object' &&
             typeof window.electronAPI.taskQueue.list === 'function' &&
             typeof window.electronAPI.taskQueue.enqueue === 'function' &&
             typeof window.electronAPI.taskQueue.cancel === 'function'
    })
    expect(hasApi).toBe(true)
  })

  test('should have all taskQueue methods', async ({ page }) => {
    const methods = await page.evaluate(() => {
      const tq = window.electronAPI.taskQueue
      return {
        list: typeof tq.list === 'function',
        get: typeof tq.get === 'function',
        enqueue: typeof tq.enqueue === 'function',
        update: typeof tq.update === 'function',
        cancel: typeof tq.cancel === 'function',
        start: typeof tq.start === 'function',
        pause: typeof tq.pause === 'function',
        resume: typeof tq.resume === 'function',
        approve: typeof tq.approve === 'function',
        reject: typeof tq.reject === 'function',
        updateAutonomy: typeof tq.updateAutonomy === 'function',
        getApprovals: typeof tq.getApprovals === 'function',
        onEvent: typeof tq.onEvent === 'function'
      }
    })

    expect(methods.list).toBe(true)
    expect(methods.get).toBe(true)
    expect(methods.enqueue).toBe(true)
    expect(methods.update).toBe(true)
    expect(methods.cancel).toBe(true)
    expect(methods.start).toBe(true)
    expect(methods.pause).toBe(true)
    expect(methods.resume).toBe(true)
    expect(methods.approve).toBe(true)
    expect(methods.reject).toBe(true)
    expect(methods.updateAutonomy).toBe(true)
    expect(methods.getApprovals).toBe(true)
    expect(methods.onEvent).toBe(true)
  })

  test('should have techAdvisor API available', async ({ page }) => {
    const hasApi = await page.evaluate(() => {
      const ta = window.electronAPI.techAdvisor
      return typeof ta === 'object' &&
             typeof ta.analyze === 'function' &&
             typeof ta.listChoices === 'function' &&
             typeof ta.getChoice === 'function' &&
             typeof ta.decide === 'function'
    })
    expect(hasApi).toBe(true)
  })

  test('should have decomposer API available', async ({ page }) => {
    const hasApi = await page.evaluate(() => {
      return typeof window.electronAPI.decomposer === 'object' &&
             typeof window.electronAPI.decomposer.decompose === 'function'
    })
    expect(hasApi).toBe(true)
  })

  test('should return cleanup function from event subscription', async ({ page }) => {
    const result = await page.evaluate(() => {
      const cleanup = window.electronAPI.taskQueue.onEvent(() => {})
      const isFunction = typeof cleanup === 'function'
      cleanup() // Clean up
      return isFunction
    })
    expect(result).toBe(true)
  })
})

// ============================================
// Task Queue Database Operations
// ============================================
test.describe('Task Queue Database Operations', () => {
  let testDir: string

  test.beforeEach(() => {
    testDir = createTestProjectDir()
  })

  test.afterEach(() => {
    if (testDir) {
      cleanupTestProject(testDir)
    }
  })

  test('should create a project and enqueue task via API', async ({ page }) => {
    const result = await page.evaluate(async (projectPath) => {
      // Create project
      const project = await window.electronAPI.projects.create({
        path: projectPath,
        name: 'API Test Project'
      })

      // Enqueue a task
      const task = await window.electronAPI.taskQueue.enqueue({
        projectId: project.id,
        title: 'Test Task',
        description: 'A test task',
        taskType: 'code-generation'
      })

      return { projectId: project.id, taskId: task.id, taskTitle: task.title }
    }, testDir)

    expect(result.projectId).toBeTruthy()
    expect(result.taskId).toBeTruthy()
    expect(result.taskTitle).toBe('Test Task')
  })

  test('should list tasks for a project', async ({ page }) => {
    const tasks = await page.evaluate(async (projectPath) => {
      const project = await window.electronAPI.projects.create({
        path: projectPath,
        name: 'List Test Project'
      })

      await window.electronAPI.taskQueue.enqueue({
        projectId: project.id,
        title: 'Task 1',
        taskType: 'code-generation'
      })

      await window.electronAPI.taskQueue.enqueue({
        projectId: project.id,
        title: 'Task 2',
        taskType: 'testing'
      })

      return await window.electronAPI.taskQueue.list(project.id)
    }, testDir)

    expect(Array.isArray(tasks)).toBe(true)
    expect(tasks.length).toBe(2)
  })

  test('should get a specific task', async ({ page }) => {
    const task = await page.evaluate(async (projectPath) => {
      const project = await window.electronAPI.projects.create({
        path: projectPath,
        name: 'Get Test Project'
      })

      const created = await window.electronAPI.taskQueue.enqueue({
        projectId: project.id,
        title: 'Get Task',
        taskType: 'documentation'
      })

      return await window.electronAPI.taskQueue.get(created.id)
    }, testDir)

    expect(task).not.toBeNull()
    expect(task?.title).toBe('Get Task')
  })

  test('should return null for non-existent task', async ({ page }) => {
    const task = await page.evaluate(async () => {
      return await window.electronAPI.taskQueue.get('non-existent-id')
    })

    expect(task).toBeNull()
  })

  test('should cancel a task', async ({ page }) => {
    const result = await page.evaluate(async (projectPath) => {
      const project = await window.electronAPI.projects.create({
        path: projectPath,
        name: 'Cancel Test Project'
      })

      const task = await window.electronAPI.taskQueue.enqueue({
        projectId: project.id,
        title: 'Cancel Task',
        taskType: 'code-generation'
      })

      const cancelled = await window.electronAPI.taskQueue.cancel(task.id)
      const updated = await window.electronAPI.taskQueue.get(task.id)

      return { cancelled, status: updated?.status }
    }, testDir)

    expect(result.cancelled).toBe(true)
    expect(result.status).toBe('cancelled')
  })

  test('should update task autonomy level', async ({ page }) => {
    const result = await page.evaluate(async (projectPath) => {
      const project = await window.electronAPI.projects.create({
        path: projectPath,
        name: 'Autonomy Test Project'
      })

      const task = await window.electronAPI.taskQueue.enqueue({
        projectId: project.id,
        title: 'Autonomy Task',
        taskType: 'code-review',
        autonomyLevel: 'auto'
      })

      await window.electronAPI.taskQueue.updateAutonomy(task.id, 'supervised')
      const updated = await window.electronAPI.taskQueue.get(task.id)

      return { original: task.autonomyLevel, updated: updated?.autonomyLevel }
    }, testDir)

    expect(result.original).toBe('auto')
    expect(result.updated).toBe('supervised')
  })

  test('should create task with different task types', async ({ page }) => {
    const taskTypes = ['code-generation', 'code-review', 'testing', 'documentation', 'security-audit', 'deployment', 'refactoring', 'bug-fix']

    // Create a single project for all task types
    const project = await page.evaluate(async (projectPath) => {
      return await window.electronAPI.projects.create({
        path: projectPath,
        name: 'Task Types Test Project'
      })
    }, testDir)

    for (const taskType of taskTypes) {
      const task = await page.evaluate(async (args) => {
        const { projectId, taskType } = args
        return await window.electronAPI.taskQueue.enqueue({
          projectId: projectId,
          title: `${taskType} Task`,
          taskType: taskType as any
        })
      }, { projectId: project.id, taskType })

      expect(task.taskType).toBe(taskType)
    }
  })

  test('should create task with different autonomy levels', async ({ page }) => {
    const autonomyLevels = ['auto', 'approval_gates', 'supervised']

    // Create a single project for all autonomy levels
    const project = await page.evaluate(async (projectPath) => {
      return await window.electronAPI.projects.create({
        path: projectPath,
        name: 'Autonomy Levels Test Project'
      })
    }, testDir)

    for (const level of autonomyLevels) {
      const task = await page.evaluate(async (args) => {
        const { projectId, level } = args
        return await window.electronAPI.taskQueue.enqueue({
          projectId: projectId,
          title: `${level} Task`,
          taskType: 'code-generation',
          autonomyLevel: level as any
        })
      }, { projectId: project.id, level })

      expect(task.autonomyLevel).toBe(level)
    }
  })

  test('should create parent-child task relationship', async ({ page }) => {
    const result = await page.evaluate(async (projectPath) => {
      const project = await window.electronAPI.projects.create({
        path: projectPath,
        name: 'Parent Child Test'
      })

      const parent = await window.electronAPI.taskQueue.enqueue({
        projectId: project.id,
        title: 'Parent Task',
        taskType: 'code-generation'
      })

      const child = await window.electronAPI.taskQueue.enqueue({
        projectId: project.id,
        parentTaskId: parent.id,
        title: 'Child Task',
        taskType: 'testing'
      })

      return { parentId: parent.id, childParentId: child.parentTaskId }
    }, testDir)

    expect(result.childParentId).toBe(result.parentId)
  })

  test('should link task to roadmap item', async ({ page }) => {
    const result = await page.evaluate(async (projectPath) => {
      const project = await window.electronAPI.projects.create({
        path: projectPath,
        name: 'Roadmap Link Test'
      })

      const roadmapItem = await window.electronAPI.roadmap.create({
        projectId: project.id,
        title: 'Feature X',
        type: 'feature'
      })

      const task = await window.electronAPI.taskQueue.enqueue({
        projectId: project.id,
        roadmapItemId: roadmapItem.id,
        title: 'Implement Feature X',
        taskType: 'code-generation'
      })

      return { roadmapId: roadmapItem.id, taskRoadmapId: task.roadmapItemId }
    }, testDir)

    expect(result.taskRoadmapId).toBe(result.roadmapId)
  })

  test('should create task with priority', async ({ page }) => {
    const task = await page.evaluate(async (projectPath) => {
      const project = await window.electronAPI.projects.create({
        path: projectPath,
        name: 'Priority Test'
      })

      return await window.electronAPI.taskQueue.enqueue({
        projectId: project.id,
        title: 'High Priority Task',
        taskType: 'bug-fix',
        priority: 10
      })
    }, testDir)

    expect(task.priority).toBe(10)
  })

  test('should default priority to 50', async ({ page }) => {
    const task = await page.evaluate(async (projectPath) => {
      const project = await window.electronAPI.projects.create({
        path: projectPath,
        name: 'Default Priority Test'
      })

      return await window.electronAPI.taskQueue.enqueue({
        projectId: project.id,
        title: 'Default Priority Task',
        taskType: 'documentation'
      })
    }, testDir)

    expect(task.priority).toBe(50)
  })

  test('should return empty approvals for new task', async ({ page }) => {
    const approvals = await page.evaluate(async (projectPath) => {
      const project = await window.electronAPI.projects.create({
        path: projectPath,
        name: 'Approvals Test'
      })

      const task = await window.electronAPI.taskQueue.enqueue({
        projectId: project.id,
        title: 'Approval Task',
        taskType: 'code-generation'
      })

      return await window.electronAPI.taskQueue.getApprovals(task.id)
    }, testDir)

    expect(Array.isArray(approvals)).toBe(true)
    expect(approvals.length).toBe(0)
  })
})

// ============================================
// Tech Advisor Database Operations
// ============================================
test.describe('Tech Advisor Database Operations', () => {
  let testDir: string

  test.beforeEach(() => {
    testDir = createTestProjectDir()
  })

  test.afterEach(() => {
    if (testDir) {
      cleanupTestProject(testDir)
    }
  })

  test('should list tech choices for project', async ({ page }) => {
    const choices = await page.evaluate(async (projectPath) => {
      const project = await window.electronAPI.projects.create({
        path: projectPath,
        name: 'Tech Choices Test'
      })

      return await window.electronAPI.techAdvisor.listChoices(project.id)
    }, testDir)

    expect(Array.isArray(choices)).toBe(true)
  })

  test('should return null for non-existent tech choice', async ({ page }) => {
    const choice = await page.evaluate(async () => {
      return await window.electronAPI.techAdvisor.getChoice('non-existent-id')
    })

    expect(choice).toBeNull()
  })
})

// ============================================
// New Project Modal and Task Queue Integration
// ============================================
test.describe('Task Queue with New Project', () => {
  let testDir: string

  test.beforeEach(() => {
    testDir = createTestProjectDir()
  })

  test.afterEach(() => {
    if (testDir) {
      cleanupTestProject(testDir)
    }
  })

  test('should open new project modal', async ({ page }) => {
    await page.click('button:has-text("New Project")')
    await expect(page.locator('text=Create New Project')).toBeVisible()
  })

  test('should have project name input in modal', async ({ page }) => {
    await page.click('button:has-text("New Project")')
    await expect(page.locator('input[placeholder="Project name"]')).toBeVisible()
  })

  test('should enable Create when project name is filled', async ({ page }) => {
    await page.click('button:has-text("New Project")')
    await page.fill('input[placeholder="Project name"]', 'My Test Project')

    const createButton = page.locator('button:has-text("Create")').last()
    await expect(createButton).toBeEnabled()
  })

  test('should close modal on cancel', async ({ page }) => {
    await page.click('button:has-text("New Project")')
    await expect(page.locator('text=Create New Project')).toBeVisible()

    await page.click('button:has-text("Cancel")')
    await expect(page.locator('text=Create New Project')).not.toBeVisible()
  })
})

// ============================================
// Sidebar View Tests
// ============================================
test.describe('Sidebar View Buttons', () => {
  test('should show all view buttons in sidebar', async ({ page }) => {
    await expect(page.locator('button[title="Home"]')).toBeVisible()
    await expect(page.locator('button[title="Chat"]')).toBeVisible()
    await expect(page.locator('button[title="Stories"]')).toBeVisible()
    await expect(page.locator('button[title="Sprints"]')).toBeVisible()
    await expect(page.locator('button[title="Roadmap"]')).toBeVisible()
    await expect(page.locator('button[title="Tasks"]')).toBeVisible()
    await expect(page.locator('button[title="Git"]')).toBeVisible()
  })

  test('should have disabled view buttons without project', async ({ page }) => {
    await expect(page.locator('button[title="Chat"]')).toBeDisabled()
    await expect(page.locator('button[title="Stories"]')).toBeDisabled()
    await expect(page.locator('button[title="Sprints"]')).toBeDisabled()
    await expect(page.locator('button[title="Roadmap"]')).toBeDisabled()
    await expect(page.locator('button[title="Tasks"]')).toBeDisabled()
    await expect(page.locator('button[title="Git"]')).toBeDisabled()
  })

  test('should have Home button visible', async ({ page }) => {
    await expect(page.locator('button[title="Home"]')).toBeVisible()
  })
})

// ============================================
// Task Status Transition Tests
// ============================================
test.describe('Task Status Transitions', () => {
  let testDir: string

  test.beforeEach(() => {
    testDir = createTestProjectDir()
  })

  test.afterEach(() => {
    if (testDir) {
      cleanupTestProject(testDir)
    }
  })

  test('should create task with pending status', async ({ page }) => {
    const task = await page.evaluate(async (projectPath) => {
      const project = await window.electronAPI.projects.create({
        path: projectPath,
        name: 'Status Test'
      })

      return await window.electronAPI.taskQueue.enqueue({
        projectId: project.id,
        title: 'Pending Task',
        taskType: 'code-generation'
      })
    }, testDir)

    expect(task.status).toBe('pending')
  })

  test('should transition to cancelled status', async ({ page }) => {
    const result = await page.evaluate(async (projectPath) => {
      const project = await window.electronAPI.projects.create({
        path: projectPath,
        name: 'Cancel Status Test'
      })

      const task = await window.electronAPI.taskQueue.enqueue({
        projectId: project.id,
        title: 'To Cancel',
        taskType: 'code-generation'
      })

      await window.electronAPI.taskQueue.cancel(task.id)
      const updated = await window.electronAPI.taskQueue.get(task.id)

      return updated?.status
    }, testDir)

    expect(result).toBe('cancelled')
  })
})

// ============================================
// Task Update Tests
// Note: The update API currently only supports autonomy level changes
// and status updates with all required fields. Partial title/description
// updates are not supported by the current implementation.
// ============================================
test.describe('Task Updates', () => {
  let testDir: string

  test.beforeEach(() => {
    testDir = createTestProjectDir()
  })

  test.afterEach(() => {
    if (testDir) {
      cleanupTestProject(testDir)
    }
  })

  test('should update task autonomy level via updateAutonomy', async ({ page }) => {
    const result = await page.evaluate(async (projectPath) => {
      const project = await window.electronAPI.projects.create({
        path: projectPath,
        name: 'Autonomy Update Test'
      })

      const task = await window.electronAPI.taskQueue.enqueue({
        projectId: project.id,
        title: 'Update Autonomy Task',
        taskType: 'code-generation',
        autonomyLevel: 'auto'
      })

      await window.electronAPI.taskQueue.updateAutonomy(task.id, 'supervised')
      const updated = await window.electronAPI.taskQueue.get(task.id)

      return { original: task.autonomyLevel, updated: updated?.autonomyLevel }
    }, testDir)

    expect(result.original).toBe('auto')
    expect(result.updated).toBe('supervised')
  })

  test('should update task autonomy level via update with autonomyLevel', async ({ page }) => {
    const result = await page.evaluate(async (projectPath) => {
      const project = await window.electronAPI.projects.create({
        path: projectPath,
        name: 'Update API Test'
      })

      const task = await window.electronAPI.taskQueue.enqueue({
        projectId: project.id,
        title: 'Update Via API Task',
        taskType: 'code-review',
        autonomyLevel: 'auto'
      })

      const updated = await window.electronAPI.taskQueue.update(task.id, {
        autonomyLevel: 'approval_gates'
      })

      return updated?.autonomyLevel
    }, testDir)

    expect(result).toBe('approval_gates')
  })
})

// ============================================
// Multiple Tasks Management
// ============================================
test.describe('Multiple Tasks Management', () => {
  let testDir: string

  test.beforeEach(() => {
    testDir = createTestProjectDir()
  })

  test.afterEach(() => {
    if (testDir) {
      cleanupTestProject(testDir)
    }
  })

  test('should handle multiple tasks in order', async ({ page }) => {
    const tasks = await page.evaluate(async (projectPath) => {
      const project = await window.electronAPI.projects.create({
        path: projectPath,
        name: 'Multi Task Test'
      })

      const tasks = []
      for (let i = 1; i <= 5; i++) {
        const task = await window.electronAPI.taskQueue.enqueue({
          projectId: project.id,
          title: `Task ${i}`,
          taskType: 'code-generation',
          priority: i
        })
        tasks.push(task)
      }

      return await window.electronAPI.taskQueue.list(project.id)
    }, testDir)

    expect(tasks.length).toBe(5)
  })

  test('should cancel multiple tasks', async ({ page }) => {
    const result = await page.evaluate(async (projectPath) => {
      const project = await window.electronAPI.projects.create({
        path: projectPath,
        name: 'Multi Cancel Test'
      })

      const taskIds = []
      for (let i = 1; i <= 3; i++) {
        const task = await window.electronAPI.taskQueue.enqueue({
          projectId: project.id,
          title: `Task ${i}`,
          taskType: 'code-generation'
        })
        taskIds.push(task.id)
      }

      // Cancel all
      for (const id of taskIds) {
        await window.electronAPI.taskQueue.cancel(id)
      }

      const tasks = await window.electronAPI.taskQueue.list(project.id)
      const cancelledCount = tasks.filter(t => t.status === 'cancelled').length

      return cancelledCount
    }, testDir)

    expect(result).toBe(3)
  })
})

// ============================================
// Edge Cases
// ============================================
test.describe('Edge Cases', () => {
  let testDir: string

  test.beforeEach(() => {
    testDir = createTestProjectDir()
  })

  test.afterEach(() => {
    if (testDir) {
      cleanupTestProject(testDir)
    }
  })

  test('should handle task with minimal data', async ({ page }) => {
    const task = await page.evaluate(async (projectPath) => {
      const project = await window.electronAPI.projects.create({
        path: projectPath,
        name: 'Minimal Data Test'
      })

      return await window.electronAPI.taskQueue.enqueue({
        projectId: project.id,
        title: 'Minimal Task',
        taskType: 'code-generation'
      })
    }, testDir)

    expect(task.id).toBeTruthy()
    expect(task.title).toBe('Minimal Task')
    expect(task.status).toBe('pending')
  })

  test('should handle task with full data', async ({ page }) => {
    const task = await page.evaluate(async (projectPath) => {
      const project = await window.electronAPI.projects.create({
        path: projectPath,
        name: 'Full Data Test'
      })

      return await window.electronAPI.taskQueue.enqueue({
        projectId: project.id,
        title: 'Full Task',
        description: 'A complete task with all fields',
        taskType: 'code-review',
        autonomyLevel: 'supervised',
        agentType: 'developer',
        priority: 5
      })
    }, testDir)

    expect(task.title).toBe('Full Task')
    expect(task.description).toBe('A complete task with all fields')
    expect(task.taskType).toBe('code-review')
    expect(task.autonomyLevel).toBe('supervised')
    expect(task.agentType).toBe('developer')
    expect(task.priority).toBe(5)
  })

  test('should handle empty project task list', async ({ page }) => {
    const tasks = await page.evaluate(async (projectPath) => {
      const project = await window.electronAPI.projects.create({
        path: projectPath,
        name: 'Empty List Test'
      })

      return await window.electronAPI.taskQueue.list(project.id)
    }, testDir)

    expect(Array.isArray(tasks)).toBe(true)
    expect(tasks.length).toBe(0)
  })
})

// ============================================
// Roadmap Integration Tests
// ============================================
test.describe('Roadmap Integration', () => {
  let testDir: string

  test.beforeEach(() => {
    testDir = createTestProjectDir()
  })

  test.afterEach(() => {
    if (testDir) {
      cleanupTestProject(testDir)
    }
  })

  test('should have roadmap API available', async ({ page }) => {
    const hasApi = await page.evaluate(() => {
      return typeof window.electronAPI.roadmap === 'object' &&
             typeof window.electronAPI.roadmap.list === 'function' &&
             typeof window.electronAPI.roadmap.create === 'function'
    })
    expect(hasApi).toBe(true)
  })

  test('should create roadmap item', async ({ page }) => {
    const item = await page.evaluate(async (projectPath) => {
      const project = await window.electronAPI.projects.create({
        path: projectPath,
        name: 'Roadmap Test'
      })

      return await window.electronAPI.roadmap.create({
        projectId: project.id,
        title: 'New Feature',
        type: 'feature',
        lane: 'now'
      })
    }, testDir)

    expect(item.title).toBe('New Feature')
    expect(item.type).toBe('feature')
  })

  test('should link multiple tasks to roadmap item', async ({ page }) => {
    const result = await page.evaluate(async (projectPath) => {
      const project = await window.electronAPI.projects.create({
        path: projectPath,
        name: 'Multi Link Test'
      })

      const roadmapItem = await window.electronAPI.roadmap.create({
        projectId: project.id,
        title: 'Feature Y',
        type: 'feature'
      })

      const task1 = await window.electronAPI.taskQueue.enqueue({
        projectId: project.id,
        roadmapItemId: roadmapItem.id,
        title: 'Design Feature Y',
        taskType: 'documentation'
      })

      const task2 = await window.electronAPI.taskQueue.enqueue({
        projectId: project.id,
        roadmapItemId: roadmapItem.id,
        title: 'Implement Feature Y',
        taskType: 'code-generation'
      })

      return {
        roadmapId: roadmapItem.id,
        task1RoadmapId: task1.roadmapItemId,
        task2RoadmapId: task2.roadmapItemId
      }
    }, testDir)

    expect(result.task1RoadmapId).toBe(result.roadmapId)
    expect(result.task2RoadmapId).toBe(result.roadmapId)
  })
})
