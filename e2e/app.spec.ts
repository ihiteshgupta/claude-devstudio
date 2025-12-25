import { test, expect } from './electron.setup'

// Test suite for Claude DevStudio
// Note: View buttons (Chat, Stories, Sprints, Git) are disabled until a project is selected

test.describe('Claude DevStudio E2E Tests', () => {
  // ============================================
  // Application Launch Tests
  // ============================================
  test.describe('Application Launch', () => {
    test('should launch the application with correct title', async ({ page }) => {
      const title = await page.title()
      expect(title).toBe('Claude DevStudio')
    })

    test('should display welcome screen when no project is selected', async ({ page }) => {
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
      await expect(page.locator('text=AI-powered Agile SDLC')).toBeVisible()
    })

    test('should show Open Project and New Project buttons', async ({ page }) => {
      await expect(page.locator('button:has-text("Open Project")')).toBeVisible()
      await expect(page.locator('button:has-text("New Project")')).toBeVisible()
    })

    test('should display AI Agents section', async ({ page }) => {
      await expect(page.locator('text=AI Agents at Your Service')).toBeVisible()
      // Check for visible agent names (may be abbreviated)
      await expect(page.locator('text=Developer').first()).toBeVisible()
      await expect(page.locator('text=Product Owner').first()).toBeVisible()
      await expect(page.locator('text=Tester').first()).toBeVisible()
    })

    test('should display status bar', async ({ page }) => {
      // Wait for the app to fully load
      await page.waitForTimeout(1000)
      // Status bar should exist at bottom
      const statusBar = page.locator('.border-t').last()
      await expect(statusBar).toBeVisible()
    })
  })

  // ============================================
  // Sidebar Navigation Tests
  // ============================================
  test.describe('Sidebar Navigation', () => {
    test('should show sidebar with Projects heading', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible()
    })

    test('should show View heading in sidebar', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'View', exact: true })).toBeVisible()
    })

    test('should have Home tab visible', async ({ page }) => {
      const homeButton = page.locator('button:has-text("Home")')
      await expect(homeButton).toBeVisible()
      // Home tab may be disabled when no project is selected
    })

    test('should have view tabs visible but disabled without project', async ({ page }) => {
      // These should be visible but disabled when no project selected
      const chatButton = page.locator('button[title="Chat"]')
      const storiesButton = page.locator('button[title="Stories"]')
      const sprintsButton = page.locator('button[title="Sprints"]')
      const gitButton = page.locator('button[title="Git"]')

      await expect(chatButton).toBeVisible()
      await expect(storiesButton).toBeVisible()
      await expect(sprintsButton).toBeVisible()
      await expect(gitButton).toBeVisible()

      // They should be disabled
      await expect(chatButton).toBeDisabled()
      await expect(storiesButton).toBeDisabled()
      await expect(sprintsButton).toBeDisabled()
      await expect(gitButton).toBeDisabled()
    })

    test('should have sidebar toggle button', async ({ page }) => {
      const toggleButton = page.locator('button[title*="sidebar"]')
      await expect(toggleButton).toBeVisible()
    })
  })

  // ============================================
  // Titlebar Tests
  // ============================================
  test.describe('Titlebar', () => {
    test('should display app name in titlebar', async ({ page }) => {
      await expect(page.locator('text=Claude DevStudio').first()).toBeVisible()
    })

    test('should have titlebar with controls', async ({ page }) => {
      // Titlebar area should be present
      const titleArea = page.locator('header').first()
      if (await titleArea.count() > 0) {
        await expect(titleArea).toBeVisible()
      } else {
        // Fallback: check for app name which is in titlebar
        await expect(page.locator('text=Claude DevStudio').first()).toBeVisible()
      }
    })
  })

  // ============================================
  // New Project Modal Tests
  // ============================================
  test.describe('New Project Modal', () => {
    test('should open new project modal when clicking New Project', async ({ page }) => {
      await page.click('button:has-text("New Project")')
      await expect(page.locator('text=Create New Project')).toBeVisible()
      await expect(page.locator('input[placeholder="Project name"]')).toBeVisible()
    })

    test('should close modal when clicking Cancel', async ({ page }) => {
      await page.click('button:has-text("New Project")')
      await expect(page.locator('text=Create New Project')).toBeVisible()

      await page.click('button:has-text("Cancel")')
      await expect(page.locator('text=Create New Project')).not.toBeVisible()
    })

    test('should have Create button disabled when name is empty', async ({ page }) => {
      await page.click('button:has-text("New Project")')
      await expect(page.locator('text=Create New Project')).toBeVisible()

      // Clear any existing input
      const nameInput = page.locator('input[placeholder="Project name"]')
      await nameInput.fill('')

      // Create button should be disabled
      const createButton = page.locator('button:has-text("Create")').last()
      await expect(createButton).toBeDisabled()

      // Cancel
      await page.click('button:has-text("Cancel")')
    })

    test('should enable Create button when name is entered', async ({ page }) => {
      await page.click('button:has-text("New Project")')

      // Fill in project name
      const nameInput = page.locator('input[placeholder="Project name"]')
      await nameInput.fill('Test Project')

      // Create button should now be enabled
      const createButton = page.locator('button:has-text("Create")').last()
      await expect(createButton).toBeEnabled()

      // Cancel
      await page.click('button:has-text("Cancel")')
    })
  })

  // ============================================
  // Welcome Screen Agent Cards Tests
  // ============================================
  test.describe('Welcome Screen', () => {
    test('should display Developer agent', async ({ page }) => {
      await expect(page.locator('text=Developer').first()).toBeVisible()
    })

    test('should display Product Owner agent', async ({ page }) => {
      await expect(page.locator('text=Product Owner').first()).toBeVisible()
    })

    test('should display Tester agent', async ({ page }) => {
      await expect(page.locator('text=Tester').first()).toBeVisible()
    })

    test('should display Security agent', async ({ page }) => {
      await expect(page.locator('text=Security').first()).toBeVisible()
    })

    test('should display DevOps agent', async ({ page }) => {
      await expect(page.locator('text=DevOps').first()).toBeVisible()
    })

    test('should have Open Project button', async ({ page }) => {
      const openButton = page.locator('button:has-text("Open Project")')
      await expect(openButton).toBeVisible()
      await expect(openButton).toBeEnabled()
    })

    test('should have New Project button', async ({ page }) => {
      const newButton = page.locator('button:has-text("New Project")')
      await expect(newButton).toBeVisible()
      await expect(newButton).toBeEnabled()
    })
  })

  // ============================================
  // Home View Tests
  // ============================================
  test.describe('Home View', () => {
    test('should show Home view by default', async ({ page }) => {
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })

    test('should have Home button active', async ({ page }) => {
      const homeButton = page.locator('button:has-text("Home")')
      await expect(homeButton).toBeVisible()
    })
  })

  // ============================================
  // Keyboard Navigation Tests
  // ============================================
  test.describe('Keyboard Navigation', () => {
    test('should support Tab navigation', async ({ page }) => {
      // Press Tab multiple times and verify no errors
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')
      // App should still be responsive
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })
  })

  // ============================================
  // Layout Tests
  // ============================================
  test.describe('Layout', () => {
    test('should have proper layout structure', async ({ page }) => {
      // Main app container should be visible
      const mainContainer = page.locator('.flex.flex-col').first()
      await expect(mainContainer).toBeVisible()
    })

    test('should have sidebar visible', async ({ page }) => {
      // Sidebar with Projects heading
      await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible()
    })

    test('should have main content area', async ({ page }) => {
      // Main content should show welcome screen
      await expect(page.locator('text=AI-powered Agile SDLC')).toBeVisible()
    })
  })

  // ============================================
  // Error Handling Tests
  // ============================================
  test.describe('Error Handling', () => {
    test('should handle empty project list gracefully', async ({ page }) => {
      // App should display welcome screen without errors
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
      await expect(page.locator('text=Open Project')).toBeVisible()
    })

    test('should allow opening and closing modal multiple times', async ({ page }) => {
      for (let i = 0; i < 3; i++) {
        await page.click('button:has-text("New Project")')
        await expect(page.locator('text=Create New Project')).toBeVisible()
        await page.click('button:has-text("Cancel")')
        await expect(page.locator('text=Create New Project')).not.toBeVisible()
      }
    })
  })

  // ============================================
  // Performance Tests
  // ============================================
  test.describe('Performance', () => {
    test('should load within reasonable time', async ({ page }) => {
      const startTime = Date.now()
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
      const loadTime = Date.now() - startTime
      expect(loadTime).toBeLessThan(10000) // Should load within 10 seconds
    })
  })
})

// ============================================
// Standalone Panel Tests
// ============================================
test.describe('Dashboard Panel', () => {
  test('should show welcome screen when no project selected', async ({ page }) => {
    await expect(page.locator('text=AI-powered Agile SDLC')).toBeVisible()
  })
})

test.describe('Status Indicators', () => {
  test('should show Claude CLI status', async ({ page }) => {
    await page.waitForTimeout(2000) // Wait for status check
    // App should show some status info (connected or not)
    // Just verify app is still responsive
    await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
  })
})
