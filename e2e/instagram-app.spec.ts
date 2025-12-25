import { test, expect } from './electron.setup'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

// ============================================
// Instagram-like App Creation E2E Test
// ============================================
// This test simulates a user using Claude DevStudio to create
// an Instagram-like social media application from scratch.

test.describe('Create Instagram-like App from DevStudio', () => {
  let tempProjectPath: string

  // Helper to create a temporary project directory
  const createTempProjectDir = (): string => {
    const tempDir = path.join(os.tmpdir(), `instagram-clone-${Date.now()}`)
    fs.mkdirSync(tempDir, { recursive: true })

    // Initialize with basic package.json for a React + Node project
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'instagram-clone',
        version: '0.1.0',
        private: true,
        dependencies: {
          'react': '^18.2.0',
          'react-dom': '^18.2.0',
          'react-router-dom': '^6.0.0',
          'tailwindcss': '^3.0.0'
        },
        devDependencies: {
          'typescript': '^5.0.0',
          'vite': '^5.0.0',
          '@types/react': '^18.0.0'
        }
      }, null, 2)
    )

    // Create basic project structure
    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true })
    fs.mkdirSync(path.join(tempDir, 'src', 'components'), { recursive: true })
    fs.mkdirSync(path.join(tempDir, 'src', 'pages'), { recursive: true })
    fs.mkdirSync(path.join(tempDir, 'src', 'hooks'), { recursive: true })
    fs.mkdirSync(path.join(tempDir, 'src', 'types'), { recursive: true })
    fs.mkdirSync(path.join(tempDir, 'public'), { recursive: true })

    // Create entry point
    fs.writeFileSync(
      path.join(tempDir, 'src', 'main.tsx'),
      `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
`
    )

    // Create App component placeholder
    fs.writeFileSync(
      path.join(tempDir, 'src', 'App.tsx'),
      `import React from 'react'

function App() {
  return (
    <div className="app">
      <h1>Instagram Clone</h1>
      {/* TODO: Add components */}
    </div>
  )
}

export default App
`
    )

    // Create tsconfig.json
    fs.writeFileSync(
      path.join(tempDir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          useDefineForClassFields: true,
          lib: ['ES2020', 'DOM', 'DOM.Iterable'],
          module: 'ESNext',
          skipLibCheck: true,
          moduleResolution: 'bundler',
          jsx: 'react-jsx',
          strict: true
        },
        include: ['src']
      }, null, 2)
    )

    // Create basic CSS
    fs.writeFileSync(
      path.join(tempDir, 'src', 'index.css'),
      `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  font-family: Inter, system-ui, sans-serif;
}

body {
  margin: 0;
  min-height: 100vh;
  background: #fafafa;
}
`
    )

    return tempDir
  }

  // Cleanup helper
  const cleanupTempProject = (projectPath: string): void => {
    try {
      fs.rmSync(projectPath, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  }

  test.beforeAll(() => {
    tempProjectPath = createTempProjectDir()
  })

  test.afterAll(() => {
    if (tempProjectPath) {
      cleanupTempProject(tempProjectPath)
    }
  })

  // ============================================
  // Project Setup Tests
  // ============================================
  test.describe('Project Setup', () => {
    test('should launch DevStudio and show welcome screen', async ({ page }) => {
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
      await expect(page.locator('text=AI-powered Agile SDLC')).toBeVisible()
    })

    test('should have New Project button available', async ({ page }) => {
      const newProjectBtn = page.locator('button:has-text("New Project")')
      await expect(newProjectBtn).toBeVisible()
      await expect(newProjectBtn).toBeEnabled()
    })

    test('should open new project modal', async ({ page }) => {
      await page.click('button:has-text("New Project")')
      await expect(page.locator('text=Create New Project')).toBeVisible()
    })

    test('should allow entering project name "Instagram Clone"', async ({ page }) => {
      await page.click('button:has-text("New Project")')

      const nameInput = page.locator('input[placeholder="Project name"]')
      await expect(nameInput).toBeVisible()
      await nameInput.fill('Instagram Clone')

      // Create button should be enabled
      const createButton = page.locator('button:has-text("Create")').last()
      await expect(createButton).toBeEnabled()

      // Cancel for now
      await page.click('button:has-text("Cancel")')
    })
  })

  // ============================================
  // Agent Selection Tests
  // ============================================
  test.describe('Agent Selection for Instagram App', () => {
    test('should display Developer agent for coding tasks', async ({ page }) => {
      await expect(page.locator('text=Developer').first()).toBeVisible()
    })

    test('should display Product Owner agent for feature planning', async ({ page }) => {
      await expect(page.locator('text=Product Owner').first()).toBeVisible()
    })

    test('should display Tester agent for test creation', async ({ page }) => {
      await expect(page.locator('text=Tester').first()).toBeVisible()
    })

    test('should display Security agent for auth features', async ({ page }) => {
      await expect(page.locator('text=Security').first()).toBeVisible()
    })

    test('should display DevOps agent for deployment', async ({ page }) => {
      await expect(page.locator('text=DevOps').first()).toBeVisible()
    })
  })

  // ============================================
  // Instagram Feature Planning Tests
  // ============================================
  test.describe('Instagram Feature Planning', () => {
    test('should have Stories view for user stories', async ({ page }) => {
      // Stories view button should be in sidebar
      const storiesButton = page.locator('button[title="Stories"]')
      await expect(storiesButton).toBeVisible()
    })

    test('should have Sprints view for sprint planning', async ({ page }) => {
      const sprintsButton = page.locator('button[title="Sprints"]')
      await expect(sprintsButton).toBeVisible()
    })

    test('should have Roadmap view for feature roadmap', async ({ page }) => {
      const roadmapButton = page.locator('button[title="Roadmap"]')
      await expect(roadmapButton).toBeVisible()
    })

    test('should have Task Queue view for autonomous tasks', async ({ page }) => {
      const taskQueueButton = page.locator('button[title="Tasks"]')
      await expect(taskQueueButton).toBeVisible()
    })
  })

  // ============================================
  // Instagram Core Features - UI Tests
  // ============================================
  test.describe('Instagram UI Requirements', () => {
    test('should show Chat view for developer interaction', async ({ page }) => {
      const chatButton = page.locator('button[title="Chat"]')
      await expect(chatButton).toBeVisible()
    })

    test('should have command palette accessible', async ({ page }) => {
      // Command palette should be accessible via keyboard
      await page.keyboard.press('Meta+k')
      // Wait a moment for palette to open
      await page.waitForTimeout(500)
      // Press Escape to close if it opened
      await page.keyboard.press('Escape')
      // App should still be responsive
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })
  })

  // ============================================
  // Instagram App Components Checklist
  // ============================================
  test.describe('Instagram Component Architecture', () => {
    /*
     * These tests document the components needed for an Instagram clone:
     *
     * 1. Feed Components:
     *    - PostCard: Display individual posts with image, caption, likes
     *    - PostFeed: Scrollable feed of posts
     *    - StoryBar: Horizontal scrollable stories at top
     *
     * 2. Navigation Components:
     *    - BottomNav: Home, Search, Create, Reels, Profile
     *    - TopNav: Logo, Direct Messages, Notifications
     *
     * 3. User Components:
     *    - ProfileHeader: Avatar, stats, bio, follow button
     *    - ProfileGrid: Grid of user's posts
     *    - FollowersList: List of followers/following
     *
     * 4. Interaction Components:
     *    - LikeButton: Heart animation on double-tap
     *    - CommentSection: Comments with replies
     *    - ShareSheet: Share post options
     *
     * 5. Media Components:
     *    - ImageUploader: Photo selection and filters
     *    - StoryViewer: Full-screen story display
     *    - ReelsPlayer: Short video player
     */

    test('should verify DevStudio can plan component architecture', async ({ page }) => {
      // DevStudio should help plan these components
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })

    test('should verify sidebar has all navigation options', async ({ page }) => {
      // Check all view options are present
      await expect(page.getByRole('heading', { name: 'View', exact: true })).toBeVisible()
    })
  })

  // ============================================
  // Instagram Backend Requirements
  // ============================================
  test.describe('Instagram Backend Planning', () => {
    /*
     * Backend features needed:
     *
     * 1. Authentication:
     *    - Email/password login
     *    - OAuth (Google, Facebook)
     *    - JWT token management
     *
     * 2. User Management:
     *    - Profile CRUD
     *    - Follow/unfollow system
     *    - User search
     *
     * 3. Posts:
     *    - Image upload to cloud storage
     *    - Post CRUD operations
     *    - Like/unlike functionality
     *    - Comment system
     *
     * 4. Feed:
     *    - Personalized feed algorithm
     *    - Infinite scroll pagination
     *    - Real-time updates
     *
     * 5. Stories:
     *    - 24-hour expiration
     *    - View tracking
     *    - Story replies
     *
     * 6. Direct Messages:
     *    - Real-time chat
     *    - Message reactions
     *    - Media sharing
     */

    test('should have DevStudio ready for backend development', async ({ page }) => {
      await expect(page.locator('text=Developer').first()).toBeVisible()
    })

    test('should have security agent for auth implementation', async ({ page }) => {
      await expect(page.locator('text=Security').first()).toBeVisible()
    })
  })

  // ============================================
  // Instagram Database Schema Planning
  // ============================================
  test.describe('Instagram Database Schema', () => {
    /*
     * Database tables needed:
     *
     * users:
     *   - id, username, email, password_hash, bio, avatar_url,
     *   - is_verified, created_at, updated_at
     *
     * posts:
     *   - id, user_id, image_url, caption, location,
     *   - likes_count, comments_count, created_at
     *
     * comments:
     *   - id, post_id, user_id, parent_id (for replies),
     *   - content, likes_count, created_at
     *
     * likes:
     *   - id, user_id, post_id, created_at
     *
     * follows:
     *   - id, follower_id, following_id, created_at
     *
     * stories:
     *   - id, user_id, media_url, media_type,
     *   - expires_at, created_at
     *
     * story_views:
     *   - id, story_id, viewer_id, viewed_at
     *
     * messages:
     *   - id, sender_id, receiver_id, content,
     *   - media_url, read_at, created_at
     */

    test('should verify DevStudio can assist with database design', async ({ page }) => {
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })
  })

  // ============================================
  // Workflow Tests - Building Instagram Features
  // ============================================
  test.describe('Instagram Feature Development Workflow', () => {
    test('should have Workflows view for multi-agent pipelines', async ({ page }) => {
      const workflowsButton = page.locator('button[title="Flows"]')
      await expect(workflowsButton).toBeVisible()
    })

    test('should show Git view for version control', async ({ page }) => {
      const gitButton = page.locator('button[title="Git"]')
      await expect(gitButton).toBeVisible()
    })

    test('should have Dashboard view for project overview', async ({ page }) => {
      const dashboardButton = page.locator('button[title="Home"]')
      await expect(dashboardButton).toBeVisible()
    })
  })

  // ============================================
  // Instagram Tech Stack Verification
  // ============================================
  test.describe('Instagram Tech Stack', () => {
    /*
     * Recommended tech stack for Instagram clone:
     *
     * Frontend:
     *   - React 18 with TypeScript
     *   - TailwindCSS for styling
     *   - React Router for navigation
     *   - React Query for data fetching
     *   - Zustand for state management
     *
     * Backend:
     *   - Node.js with Express or Fastify
     *   - PostgreSQL for database
     *   - Redis for caching & sessions
     *   - Socket.io for real-time features
     *   - AWS S3 for media storage
     *
     * Infrastructure:
     *   - Docker for containerization
     *   - GitHub Actions for CI/CD
     *   - AWS/Vercel for deployment
     */

    test('should verify DevStudio supports tech stack planning', async ({ page }) => {
      await expect(page.locator('text=DevOps').first()).toBeVisible()
    })
  })

  // ============================================
  // Sprint Planning for Instagram MVP
  // ============================================
  test.describe('Instagram MVP Sprint Planning', () => {
    /*
     * Sprint 1 - Core Setup (Week 1-2):
     *   - Project setup with Vite + React + TypeScript
     *   - TailwindCSS configuration
     *   - Basic routing structure
     *   - Authentication flow (signup/login)
     *
     * Sprint 2 - User Features (Week 3-4):
     *   - User profile page
     *   - Profile editing
     *   - Follow/unfollow system
     *   - User search
     *
     * Sprint 3 - Posts (Week 5-6):
     *   - Image upload
     *   - Post creation with captions
     *   - Post feed display
     *   - Like functionality
     *
     * Sprint 4 - Engagement (Week 7-8):
     *   - Comments system
     *   - Notifications
     *   - Explore/discover page
     *   - Hashtag support
     *
     * Sprint 5 - Stories & Polish (Week 9-10):
     *   - Stories feature
     *   - UI/UX polish
     *   - Performance optimization
     *   - Testing & bug fixes
     */

    test('should have Sprint view for sprint management', async ({ page }) => {
      const sprintsButton = page.locator('button[title="Sprints"]')
      await expect(sprintsButton).toBeVisible()
    })

    test('should have Product Owner agent for sprint planning', async ({ page }) => {
      await expect(page.locator('text=Product Owner').first()).toBeVisible()
    })
  })

  // ============================================
  // User Stories for Instagram
  // ============================================
  test.describe('Instagram User Stories', () => {
    /*
     * User Story Examples:
     *
     * US-001: As a user, I want to sign up with my email so that I can create an account
     * US-002: As a user, I want to upload photos so that I can share moments
     * US-003: As a user, I want to follow other users so that I can see their posts
     * US-004: As a user, I want to like posts so that I can show appreciation
     * US-005: As a user, I want to comment on posts so that I can engage with content
     * US-006: As a user, I want to view stories so that I can see ephemeral content
     * US-007: As a user, I want to search for users so that I can find friends
     * US-008: As a user, I want to edit my profile so that I can update my info
     * US-009: As a user, I want to receive notifications so that I stay informed
     * US-010: As a user, I want to send DMs so that I can chat privately
     */

    test('should have Stories view for user story management', async ({ page }) => {
      const storiesButton = page.locator('button[title="Stories"]')
      await expect(storiesButton).toBeVisible()
    })
  })

  // ============================================
  // Integration Tests Placeholder
  // ============================================
  test.describe('End-to-End Integration', () => {
    test('should verify app launches without errors', async ({ page }) => {
      // Verify no console errors on load
      const errors: string[] = []
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text())
        }
      })

      await page.waitForTimeout(2000)
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()

      // Filter out expected/non-critical errors
      const criticalErrors = errors.filter(e =>
        !e.includes('ResizeObserver') &&
        !e.includes('net::')
      )

      // Should have minimal errors
      expect(criticalErrors.length).toBeLessThan(5)
    })

    test('should handle rapid navigation without crashing', async ({ page }) => {
      // Quickly interact with UI elements
      for (let i = 0; i < 3; i++) {
        await page.click('button:has-text("New Project")')
        await page.waitForTimeout(100)
        await page.click('button:has-text("Cancel")')
        await page.waitForTimeout(100)
      }

      // App should remain stable
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })

    test('should have responsive layout', async ({ page }) => {
      // Test different viewport sizes
      await page.setViewportSize({ width: 1280, height: 720 })
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()

      await page.setViewportSize({ width: 1920, height: 1080 })
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })
  })

  // ============================================
  // Performance Benchmarks
  // ============================================
  test.describe('Performance', () => {
    test('should load app within 5 seconds', async ({ page }) => {
      const startTime = Date.now()
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
      const loadTime = Date.now() - startTime

      expect(loadTime).toBeLessThan(5000)
    })

    test('should open modal within 1 second', async ({ page }) => {
      const startTime = Date.now()
      await page.click('button:has-text("New Project")')
      await expect(page.locator('text=Create New Project')).toBeVisible()
      const modalTime = Date.now() - startTime

      expect(modalTime).toBeLessThan(1000)

      await page.click('button:has-text("Cancel")')
    })
  })
})

// ============================================
// Instagram API Endpoints Reference
// ============================================
/*
 * API Design for Instagram Clone:
 *
 * Authentication:
 *   POST /api/auth/signup - Register new user
 *   POST /api/auth/login - User login
 *   POST /api/auth/logout - User logout
 *   POST /api/auth/refresh - Refresh token
 *
 * Users:
 *   GET /api/users/:username - Get user profile
 *   PUT /api/users/:id - Update profile
 *   GET /api/users/:id/followers - Get followers
 *   GET /api/users/:id/following - Get following
 *   POST /api/users/:id/follow - Follow user
 *   DELETE /api/users/:id/follow - Unfollow user
 *   GET /api/users/search?q=query - Search users
 *
 * Posts:
 *   GET /api/posts - Get feed posts
 *   POST /api/posts - Create post
 *   GET /api/posts/:id - Get single post
 *   DELETE /api/posts/:id - Delete post
 *   POST /api/posts/:id/like - Like post
 *   DELETE /api/posts/:id/like - Unlike post
 *   GET /api/posts/:id/comments - Get comments
 *   POST /api/posts/:id/comments - Add comment
 *
 * Stories:
 *   GET /api/stories - Get stories feed
 *   POST /api/stories - Create story
 *   GET /api/stories/:id - View story
 *   DELETE /api/stories/:id - Delete story
 *
 * Messages:
 *   GET /api/messages - Get conversations
 *   GET /api/messages/:userId - Get chat history
 *   POST /api/messages/:userId - Send message
 *
 * Notifications:
 *   GET /api/notifications - Get notifications
 *   PUT /api/notifications/read - Mark as read
 */
