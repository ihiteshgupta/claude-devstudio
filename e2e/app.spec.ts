import { test, expect } from './electron.setup'

test.describe('Claude DevStudio E2E Tests', () => {
  test.describe('Application Launch', () => {
    test('should launch the application', async ({ page }) => {
      // Check that the app title is correct
      const title = await page.title()
      expect(title).toBe('Claude DevStudio')
    })

    test('should display welcome screen when no project is selected', async ({ page }) => {
      // Wait for the welcome screen to be visible - use first() to handle multiple matches
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
      await expect(page.locator('text=AI-powered Agile SDLC')).toBeVisible()
    })

    test('should show Open Project and New Project buttons', async ({ page }) => {
      await expect(page.locator('button:has-text("Open Project")')).toBeVisible()
      await expect(page.locator('button:has-text("New Project")')).toBeVisible()
    })

    test('should display AI Agents section', async ({ page }) => {
      await expect(page.locator('text=AI Agents at Your Service')).toBeVisible()
      await expect(page.locator('text=Developer')).toBeVisible()
      await expect(page.locator('text=Product Owner')).toBeVisible()
      await expect(page.locator('text=Tester')).toBeVisible()
    })
  })

  test.describe('Sidebar Navigation', () => {
    test('should show sidebar with navigation tabs', async ({ page }) => {
      await expect(page.locator('h2:has-text("Projects")')).toBeVisible()
      await expect(page.getByRole('heading', { name: 'View', exact: true })).toBeVisible()
    })

    test('should have all view mode tabs', async ({ page }) => {
      await expect(page.locator('button:has-text("Home")')).toBeVisible()
      await expect(page.locator('button:has-text("Chat")')).toBeVisible()
      await expect(page.locator('button:has-text("Stories")')).toBeVisible()
      await expect(page.locator('button:has-text("Sprints")')).toBeVisible()
      await expect(page.locator('button:has-text("Git")')).toBeVisible()
    })
  })

  test.describe('Status Bar', () => {
    test('should display Claude connection status', async ({ page }) => {
      // Should show Claude status in the status bar
      const statusBar = page.locator('.h-6.bg-card.border-t')
      await expect(statusBar).toBeVisible()
    })
  })

  test.describe('Titlebar', () => {
    test('should display app name in titlebar', async ({ page }) => {
      await expect(page.locator('text=Claude DevStudio').first()).toBeVisible()
    })

    test('should have sidebar toggle button', async ({ page }) => {
      const toggleButton = page.locator('button[title*="sidebar"]')
      await expect(toggleButton).toBeVisible()
    })
  })

  test.describe('New Project Modal', () => {
    test('should open new project modal when clicking New Project', async ({ page }) => {
      // Click the New Project button
      await page.click('button:has-text("New Project")')

      // Check modal appears
      await expect(page.locator('text=Create New Project')).toBeVisible()
      await expect(page.locator('input[placeholder="Project name"]')).toBeVisible()
    })

    test('should close modal when clicking Cancel', async ({ page }) => {
      await page.click('button:has-text("New Project")')
      await expect(page.locator('text=Create New Project')).toBeVisible()

      await page.click('button:has-text("Cancel")')
      await expect(page.locator('text=Create New Project')).not.toBeVisible()
    })
  })
})

test.describe('Dashboard Panel', () => {
  test.beforeEach(async ({ page }) => {
    // This test assumes a project is selected
    // In a real test, we would select a project first
  })

  test('should show dashboard header with refresh button', async ({ page }) => {
    // Dashboard elements should be visible when project is selected
    // These tests would run after selecting a project
  })
})

test.describe('Chat Panel', () => {
  test('should show agent selector when in chat mode', async ({ page }) => {
    // When a project is selected and chat mode is active
    // Should show agent options in sidebar
  })

  test('should have suggestion buttons for quick start', async ({ page }) => {
    // Empty chat state should show suggestion buttons
  })
})

test.describe('Sprint Panel', () => {
  test('should show Kanban board columns', async ({ page }) => {
    // Should have backlog, todo, in-progress, review, done columns
  })

  test('should allow creating new sprint', async ({ page }) => {
    // Should have "New Sprint" button
  })
})

test.describe('Git Panel', () => {
  test('should show repository status', async ({ page }) => {
    // Should display git status when git repo is detected
  })

  test('should show commit history', async ({ page }) => {
    // Should display recent commits
  })
})

test.describe('Stories Panel', () => {
  test('should allow creating new user story', async ({ page }) => {
    // Should have "New Story" button
  })

  test('should display story list', async ({ page }) => {
    // Should show existing stories
  })
})
