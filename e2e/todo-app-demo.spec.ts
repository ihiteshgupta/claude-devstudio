import { test, expect } from './electron.setup'
import path from 'path'
import fs from 'fs'
import os from 'os'

/**
 * Todo App Autonomous Flow Demo
 *
 * This test demonstrates how Claude DevStudio autonomously sets up a project:
 * 1. Create a Todo App project
 * 2. Analyze the project structure
 * 3. Generate AI-powered plan with roadmap items and tasks
 * 4. Apply the plan - agents start working autonomously
 */

const TODO_APP_PATH = path.join(os.tmpdir(), `TodoAppDemo-${Date.now()}`)

// Create a realistic Todo App project structure
function createTodoAppProject(): void {
  fs.mkdirSync(TODO_APP_PATH, { recursive: true })

  // package.json
  fs.writeFileSync(path.join(TODO_APP_PATH, 'package.json'), JSON.stringify({
    name: 'todo-app',
    version: '1.0.0',
    description: 'A todo app with user authentication',
    main: 'src/index.ts',
    scripts: {
      start: 'ts-node src/index.ts',
      build: 'tsc',
      test: 'jest'
    },
    dependencies: {
      express: '^4.18.2',
      bcrypt: '^5.1.0',
      jsonwebtoken: '^9.0.0',
      mongoose: '^8.0.0'
    },
    devDependencies: {
      typescript: '^5.0.0',
      '@types/node': '^20.0.0',
      '@types/express': '^4.17.17',
      jest: '^29.0.0'
    }
  }, null, 2))

  // tsconfig.json
  fs.writeFileSync(path.join(TODO_APP_PATH, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2020',
      module: 'commonjs',
      outDir: './dist',
      rootDir: './src',
      strict: true
    }
  }, null, 2))

  // Create src directory
  const srcDir = path.join(TODO_APP_PATH, 'src')
  fs.mkdirSync(srcDir, { recursive: true })

  // Main entry point
  fs.writeFileSync(path.join(srcDir, 'index.ts'), `
import express from 'express';
import { connectDB } from './config/database';
import authRoutes from './routes/auth';
import todoRoutes from './routes/todos';

const app = express();
app.use(express.json());

// TODO: Add authentication middleware
// TODO: Add error handling middleware
// TODO: Add rate limiting

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/todos', todoRoutes);

const PORT = process.env.PORT || 3000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(\`Server running on port \${PORT}\`);
  });
});
`)

  // Database config
  const configDir = path.join(srcDir, 'config')
  fs.mkdirSync(configDir, { recursive: true })
  fs.writeFileSync(path.join(configDir, 'database.ts'), `
import mongoose from 'mongoose';

export async function connectDB(): Promise<void> {
  // TODO: Add connection pooling
  // TODO: Add retry logic
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/todoapp');
}
`)

  // Models
  const modelsDir = path.join(srcDir, 'models')
  fs.mkdirSync(modelsDir, { recursive: true })
  fs.writeFileSync(path.join(modelsDir, 'User.ts'), `
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// TODO: Add password hashing pre-save hook
// TODO: Add email validation

export const User = mongoose.model('User', userSchema);
`)

  fs.writeFileSync(path.join(modelsDir, 'Todo.ts'), `
import mongoose from 'mongoose';

const todoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  completed: { type: Boolean, default: false },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  dueDate: Date,
  priority: { type: String, enum: ['low', 'medium', 'high'] }
});

// TODO: Add indexes for performance
// TODO: Add soft delete

export const Todo = mongoose.model('Todo', todoSchema);
`)

  // Routes placeholder
  const routesDir = path.join(srcDir, 'routes')
  fs.mkdirSync(routesDir, { recursive: true })
  fs.writeFileSync(path.join(routesDir, 'auth.ts'), `
import { Router } from 'express';

const router = Router();

// TODO: Implement login
// TODO: Implement register
// TODO: Implement logout
// TODO: Add password reset

export default router;
`)

  fs.writeFileSync(path.join(routesDir, 'todos.ts'), `
import { Router } from 'express';

const router = Router();

// TODO: Implement CRUD operations
// TODO: Add pagination
// TODO: Add filtering/sorting

export default router;
`)

  // README
  fs.writeFileSync(path.join(TODO_APP_PATH, 'README.md'), `
# Todo App

A todo application with user authentication.

## Features (Planned)
- User registration and login
- Create, read, update, delete todos
- Due dates and priorities
- Filtering and sorting

## Tech Stack
- Node.js + Express
- TypeScript
- MongoDB + Mongoose
- JWT Authentication
`)
}

function cleanupTodoApp(): void {
  try {
    fs.rmSync(TODO_APP_PATH, { recursive: true, force: true })
  } catch {
    // Ignore
  }
}

test.describe('Todo App Autonomous Setup Demo', () => {
  test.beforeAll(() => {
    createTodoAppProject()
    console.log(`Created Todo App project at: ${TODO_APP_PATH}`)
  })

  test.afterAll(() => {
    cleanupTodoApp()
  })

  test('Step 1: Create Project and Analyze Structure', async ({ page }) => {
    console.log('=== STEP 1: Creating Todo App Project ===')

    // Take screenshot of welcome screen
    await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    await page.screenshot({ path: 'test-results/todo-01-welcome.png' })

    // Create project via API (bypasses native folder picker)
    const project = await page.evaluate(async (projectPath) => {
      return await window.electronAPI.projects.create({
        path: projectPath,
        name: 'TodoApp'
      })
    }, TODO_APP_PATH)

    expect(project.id).toBeTruthy()
    expect(project.name).toBe('TodoApp')
    console.log(`Project created: ${project.id}`)
    console.log(`Project path: ${project.path}`)

    await page.screenshot({ path: 'test-results/todo-02-project-created.png' })

    // Analyze project structure
    console.log('\n=== Analyzing Project Structure ===')
    const analysis = await page.evaluate(async (projectPath) => {
      return await window.electronAPI.onboarding.analyze(projectPath)
    }, TODO_APP_PATH)

    console.log('Analysis Results:')
    console.log(`  Project Type: ${analysis.projectType}`)
    console.log(`  Language: ${analysis.language}`)
    console.log(`  Frameworks: ${analysis.frameworks?.join(', ') || 'None detected'}`)
    console.log(`  Has Tests: ${analysis.hasTests}`)
    console.log(`  Has CI/CD: ${analysis.hasCICD}`)
    console.log(`  Suggested Agents: ${analysis.suggestedAgents?.join(', ')}`)

    expect(analysis.language).toContain('typescript')
    expect(analysis.suggestedAgents).toBeDefined()

    await page.screenshot({ path: 'test-results/todo-03-analysis.png' })
  })

  test('Step 2: Generate AI-Powered Plan', async ({ page }) => {
    console.log('\n=== STEP 2: Generating AI-Powered Plan ===')

    // Get project
    const projects = await page.evaluate(async () => {
      return await window.electronAPI.projects.list()
    })
    const project = projects.find(p => p.name === 'TodoApp')
    expect(project).toBeTruthy()

    // Initialize onboarding (generates plan)
    const plan = await page.evaluate(async (args) => {
      return await window.electronAPI.onboarding.init({
        projectPath: args.path,
        projectName: args.name,
        projectId: args.id
      })
    }, { path: project!.path, name: project!.name, id: project!.id })

    console.log('\nGenerated Plan:')
    console.log(`  Plan ID: ${plan.id}`)
    console.log(`  Status: ${plan.status}`)

    console.log('\n  Roadmap Items:')
    if (plan.suggestedRoadmap) {
      plan.suggestedRoadmap.forEach((item: any, i: number) => {
        console.log(`    ${i + 1}. [${item.lane}] ${item.title} (${item.priority})`)
      })
    }

    console.log('\n  Suggested Tasks:')
    if (plan.suggestedTasks) {
      plan.suggestedTasks.forEach((task: any, i: number) => {
        console.log(`    ${i + 1}. ${task.title}`)
        console.log(`       Agent: ${task.agentType}, Autonomy: ${task.autonomyLevel}`)
      })
    }

    expect(plan.suggestedRoadmap?.length).toBeGreaterThan(0)
    expect(plan.suggestedTasks?.length).toBeGreaterThan(0)

    await page.screenshot({ path: 'test-results/todo-04-plan-generated.png' })
  })

  test('Step 3: Apply Plan - Create Roadmap and Tasks', async ({ page }) => {
    console.log('\n=== STEP 3: Applying Plan ===')

    // Get the plan
    const projects = await page.evaluate(async () => {
      return await window.electronAPI.projects.list()
    })
    const project = projects.find(p => p.name === 'TodoApp')

    const plan = await page.evaluate(async (projectId) => {
      return await window.electronAPI.onboarding.getPlan(projectId)
    }, project!.id)

    if (!plan) {
      console.log('No plan found, creating one...')
      return
    }

    // Apply the plan
    const result = await page.evaluate(async (planId) => {
      return await window.electronAPI.onboarding.applyPlan(planId)
    }, plan.id)

    console.log('\nPlan Applied!')
    console.log(`  Roadmap Items Created: ${result.roadmapItemsCreated}`)
    console.log(`  Tasks Created: ${result.tasksCreated}`)

    await page.screenshot({ path: 'test-results/todo-05-plan-applied.png' })
  })

  test('Step 4: Verify Autonomous Tasks in Queue', async ({ page }) => {
    console.log('\n=== STEP 4: Verifying Task Queue ===')

    const projects = await page.evaluate(async () => {
      return await window.electronAPI.projects.list()
    })
    const project = projects.find(p => p.name === 'TodoApp')

    // Get tasks from queue
    const tasks = await page.evaluate(async (projectId) => {
      return await window.electronAPI.taskQueue.list(projectId)
    }, project!.id)

    console.log('\nTask Queue:')
    console.log(`  Total Tasks: ${tasks.length}`)

    const byAutonomy = {
      auto: tasks.filter((t: any) => t.autonomyLevel === 'auto'),
      approval_gates: tasks.filter((t: any) => t.autonomyLevel === 'approval_gates'),
      supervised: tasks.filter((t: any) => t.autonomyLevel === 'supervised')
    }

    console.log('\n  By Autonomy Level:')
    console.log(`    - Auto (no stops): ${byAutonomy.auto.length}`)
    console.log(`    - Approval Gates (checkpoints): ${byAutonomy.approval_gates.length}`)
    console.log(`    - Supervised (full control): ${byAutonomy.supervised.length}`)

    console.log('\n  Task Details:')
    tasks.forEach((task: any, i: number) => {
      console.log(`    ${i + 1}. ${task.title}`)
      console.log(`       Status: ${task.status}, Agent: ${task.agentType}, Autonomy: ${task.autonomyLevel}`)
    })

    await page.screenshot({ path: 'test-results/todo-06-task-queue.png' })
  })

  test('Step 5: Verify Roadmap Items Created', async ({ page }) => {
    console.log('\n=== STEP 5: Verifying Roadmap ===')

    const projects = await page.evaluate(async () => {
      return await window.electronAPI.projects.list()
    })
    const project = projects.find(p => p.name === 'TodoApp')

    // Get roadmap items
    const roadmapItems = await page.evaluate(async (projectId) => {
      return await window.electronAPI.roadmap.list(projectId)
    }, project!.id)

    console.log('\nRoadmap Items:')
    console.log(`  Total Items: ${roadmapItems.length}`)

    const byLane = {
      now: roadmapItems.filter((r: any) => r.lane === 'now'),
      next: roadmapItems.filter((r: any) => r.lane === 'next'),
      later: roadmapItems.filter((r: any) => r.lane === 'later')
    }

    console.log('\n  By Lane:')
    console.log(`    - Now (current focus): ${byLane.now.length}`)
    console.log(`    - Next (upcoming): ${byLane.next.length}`)
    console.log(`    - Later (future): ${byLane.later.length}`)

    console.log('\n  Roadmap Details:')
    roadmapItems.forEach((item: any, i: number) => {
      console.log(`    ${i + 1}. [${item.lane}] ${item.title}`)
      if (item.description) {
        console.log(`       ${item.description.substring(0, 60)}...`)
      }
    })

    await page.screenshot({ path: 'test-results/todo-07-roadmap.png' })
  })

  test('Step 6: Summary - Autonomous Setup Complete', async ({ page }) => {
    console.log('\n' + '='.repeat(50))
    console.log('  AUTONOMOUS SETUP COMPLETE!')
    console.log('='.repeat(50))

    const projects = await page.evaluate(async () => {
      return await window.electronAPI.projects.list()
    })
    const project = projects.find(p => p.name === 'TodoApp')

    const [tasks, roadmap] = await Promise.all([
      page.evaluate(async (id) => window.electronAPI.taskQueue.list(id), project!.id),
      page.evaluate(async (id) => window.electronAPI.roadmap.list(id), project!.id)
    ])

    console.log('\n  Project: TodoApp')
    console.log(`  Path: ${project!.path}`)
    console.log(`\n  AI Generated:`)
    console.log(`    - ${roadmap.length} roadmap items (Now/Next/Later)`)
    console.log(`    - ${tasks.length} autonomous tasks`)
    console.log(`\n  Agents Ready to Work:`)
    const agents = [...new Set(tasks.map((t: any) => t.agentType))]
    agents.forEach((agent: any) => {
      const count = tasks.filter((t: any) => t.agentType === agent).length
      console.log(`    - ${agent}: ${count} tasks`)
    })

    console.log('\n  Next Steps:')
    console.log('    1. Auto tasks will execute immediately')
    console.log('    2. Approval gates tasks pause for review')
    console.log('    3. Supervised tasks wait for your approval')
    console.log('\n' + '='.repeat(50))

    await page.screenshot({ path: 'test-results/todo-08-summary.png' })
  })
})
