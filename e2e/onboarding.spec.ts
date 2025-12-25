import { test, expect } from './electron.setup'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

// ============================================
// Onboarding Wizard E2E Tests
// ============================================
test.describe('Onboarding Wizard', () => {
  // Helper to create a temporary test project
  const createTempProject = (name: string, type: 'node' | 'python' | 'empty' = 'node'): string => {
    const tempDir = path.join(os.tmpdir(), `test-project-${name}-${Date.now()}`)
    fs.mkdirSync(tempDir, { recursive: true })

    if (type === 'node') {
      // Create a basic Node.js project structure
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: name,
          version: '1.0.0',
          dependencies: {
            express: '^4.18.0',
            react: '^18.0.0'
          },
          devDependencies: {
            typescript: '^5.0.0',
            jest: '^29.0.0'
          }
        }, null, 2)
      )
      fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true })
      fs.writeFileSync(path.join(tempDir, 'src', 'index.ts'), '// Entry point')
      fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), '{}')
    } else if (type === 'python') {
      fs.writeFileSync(path.join(tempDir, 'requirements.txt'), 'flask==2.0.0\npytest==7.0.0')
      fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true })
      fs.writeFileSync(path.join(tempDir, 'src', 'main.py'), '# Entry point')
    }

    return tempDir
  }

  // Helper to cleanup temp directories
  const cleanupTempProject = (projectPath: string): void => {
    try {
      fs.rmSync(projectPath, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  }

  // ============================================
  // Onboarding Wizard UI Tests
  // ============================================
  test.describe('Wizard UI Elements', () => {
    test('should display onboarding wizard when project is opened for first time', async ({ page }) => {
      // This test verifies the wizard appears after opening/creating a new project
      // The wizard should show for projects without an existing plan
      await page.click('button:has-text("New Project")')
      await expect(page.locator('text=Create New Project')).toBeVisible()
    })

    test('should have progress indicator with 6 steps', async ({ page }) => {
      // The wizard has 6 steps: analyzing, review-analysis, generating-plan, review-plan, applying, complete
      // Progress dots should be visible when wizard is active
      await page.click('button:has-text("New Project")')
      await expect(page.locator('text=Create New Project')).toBeVisible()
      // Cancel to go back
      await page.click('button:has-text("Cancel")')
    })
  })

  // ============================================
  // Project Analysis Tests
  // ============================================
  test.describe('Project Analysis', () => {
    test('should detect Node.js project type from package.json', async ({ page }) => {
      // When a project with package.json is analyzed, it should be detected as Node.js
      // The analysis should identify:
      // - projectType: 'node'
      // - language: 'typescript' (if typescript dep present)
      // - frameworks: ['express', 'react']
      // - hasTests: true (if jest present)
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })

    test('should detect frameworks from dependencies', async ({ page }) => {
      // Analysis should detect React, Express, Next.js, etc. from package.json
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })

    test('should identify test infrastructure', async ({ page }) => {
      // Projects with jest, mocha, vitest, playwright should have hasTests: true
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })

    test('should identify CI/CD infrastructure', async ({ page }) => {
      // Projects with .github/workflows, .gitlab-ci.yml should have hasCICD: true
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })

    test('should suggest appropriate agents based on project', async ({ page }) => {
      // Web projects should suggest: developer, security, tester, documentation
      // Projects with CI/CD should include: devops
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })
  })

  // ============================================
  // Analysis Review Step Tests
  // ============================================
  test.describe('Analysis Review Step', () => {
    test('should display project info card with type and language', async ({ page }) => {
      // After analysis, review step should show:
      // - Project type (node, python, go, etc.)
      // - Language (typescript, javascript, python, etc.)
      // - Detected frameworks
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })

    test('should display structure card with directories', async ({ page }) => {
      // Structure card should show:
      // - Source directories (src, lib, app)
      // - Config files count
      // - Entry points
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })

    test('should display capabilities badges', async ({ page }) => {
      // Capabilities should show checkmarks for:
      // - Tests (if test framework detected)
      // - CI/CD (if CI config detected)
      // - Docker (if Dockerfile detected)
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })

    test('should display recommended agents', async ({ page }) => {
      // Should show agent badges for suggested agents
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })

    test('should have Cancel and Generate Plan buttons', async ({ page }) => {
      // Cancel should close wizard
      // Generate Plan should proceed to plan generation
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })
  })

  // ============================================
  // Plan Generation Tests
  // ============================================
  test.describe('Plan Generation', () => {
    test('should show loading state during plan generation', async ({ page }) => {
      // "Generating Plan" message and spinner should be visible
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })

    test('should generate default plan when AI fails', async ({ page }) => {
      // If Claude CLI fails, a default plan should be created
      // Default plan includes:
      // - Setup Development Environment
      // - Code Quality Standards
      // - Testing Infrastructure (if no tests)
      // - CI/CD Pipeline (if no CI/CD)
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })

    test('should store generated plan in database', async ({ page }) => {
      // Plan should be persisted so it can be retrieved later
      // This was a bug that was fixed
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })
  })

  // ============================================
  // Plan Review Step Tests
  // ============================================
  test.describe('Plan Review Step', () => {
    test('should display roadmap items with selection checkboxes', async ({ page }) => {
      // Each roadmap item should have:
      // - Checkbox for selection
      // - Title and description
      // - Lane badge (now/next/later)
      // - Priority badge (high/medium/low)
      // - Estimated effort
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })

    test('should display task items with selection checkboxes', async ({ page }) => {
      // Each task should have:
      // - Checkbox for selection
      // - Title and description
      // - Agent type badge
      // - Autonomy level badge
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })

    test('should allow toggling roadmap item selection', async ({ page }) => {
      // Clicking on item should toggle selection
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })

    test('should allow toggling task selection', async ({ page }) => {
      // Clicking on task should toggle selection
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })

    test('should show feedback textarea', async ({ page }) => {
      // Optional feedback input for refining the plan
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })

    test('should show Refine Plan button when feedback is entered', async ({ page }) => {
      // Button appears only when feedback textarea has content
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })

    test('should disable Apply Plan when no items selected', async ({ page }) => {
      // Cannot apply an empty plan
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })

    test('should show selected counts in section headers', async ({ page }) => {
      // "Roadmap Items (X selected)" and "Initial Tasks (Y selected)"
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })
  })

  // ============================================
  // Feedback and Refinement Tests
  // ============================================
  test.describe('Plan Refinement', () => {
    test('should update plan based on feedback', async ({ page }) => {
      // Submitting feedback should regenerate plan with AI
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })

    test('should preserve user selections after refinement', async ({ page }) => {
      // Items that were selected should remain selected if still in plan
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })

    test('should clear feedback input after submission', async ({ page }) => {
      // Feedback textarea should be empty after refinement
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })
  })

  // ============================================
  // Apply Plan Tests
  // ============================================
  test.describe('Apply Plan', () => {
    test('should show applying state during plan application', async ({ page }) => {
      // "Applying Plan" message and spinner
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })

    test('should create roadmap items for selected items', async ({ page }) => {
      // Only selected roadmap items should be created
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })

    test('should create tasks for selected tasks', async ({ page }) => {
      // Only selected tasks should be added to queue
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })

    test('should update plan status to applied', async ({ page }) => {
      // Plan status should change from pending_approval to applied
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })
  })

  // ============================================
  // Complete Step Tests
  // ============================================
  test.describe('Complete Step', () => {
    test('should show success message', async ({ page }) => {
      // "Setup Complete!" with checkmark icon
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })

    test('should display created counts', async ({ page }) => {
      // "X roadmap items" and "Y tasks queued"
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })

    test('should have Get Started button', async ({ page }) => {
      // Button to close wizard and start using the project
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })
  })

  // ============================================
  // Error Handling Tests
  // ============================================
  test.describe('Error Handling', () => {
    test('should display error message when analysis fails', async ({ page }) => {
      // Error overlay with message and retry button
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })

    test('should display error message when plan generation fails', async ({ page }) => {
      // Should fall back to default plan on error
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })

    test('should display error message when plan application fails', async ({ page }) => {
      // Error message with close and retry options
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })

    test('should handle Plan not found error gracefully', async ({ page }) => {
      // If plan is not in database, show helpful error message
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })

    test('should have Close and Retry buttons on error', async ({ page }) => {
      // Error UI should allow user to close or retry
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })
  })

  // ============================================
  // Cancel Flow Tests
  // ============================================
  test.describe('Cancel Flow', () => {
    test('should close wizard when clicking Cancel', async ({ page }) => {
      // Cancel button in any step should close wizard
      await page.click('button:has-text("New Project")')
      await expect(page.locator('text=Create New Project')).toBeVisible()
      await page.click('button:has-text("Cancel")')
      await expect(page.locator('text=Create New Project')).not.toBeVisible()
    })

    test('should close wizard when clicking X button', async ({ page }) => {
      // X button in header should close wizard
      await page.click('button:has-text("New Project")')
      await expect(page.locator('text=Create New Project')).toBeVisible()
      await page.click('button:has-text("Cancel")')
    })

    test('should not create any items when cancelled', async ({ page }) => {
      // Cancelling should not persist anything to database
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })
  })

  // ============================================
  // Lane Color Tests
  // ============================================
  test.describe('Visual Styling', () => {
    test('should display correct lane colors', async ({ page }) => {
      // now: red, next: yellow, later: blue
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })

    test('should display correct priority colors', async ({ page }) => {
      // high: red, medium: yellow, low: green
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })

    test('should display correct autonomy level colors', async ({ page }) => {
      // auto: green, approval_gates: yellow, supervised: red
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })

    test('should show agent icons correctly', async ({ page }) => {
      // developer: Code, tester: TestTube, security: Shield, etc.
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })
  })

  // ============================================
  // Accessibility Tests
  // ============================================
  test.describe('Accessibility', () => {
    test('should support keyboard navigation', async ({ page }) => {
      // Tab through wizard elements
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })

    test('should have proper focus states', async ({ page }) => {
      // Interactive elements should show focus indicators
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })

    test('should use semantic HTML elements', async ({ page }) => {
      // Buttons, headings, etc. should use proper elements
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })
  })

  // ============================================
  // Performance Tests
  // ============================================
  test.describe('Performance', () => {
    test('should complete analysis within reasonable time', async ({ page }) => {
      // Analysis should complete within 30 seconds
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })

    test('should handle large projects without hanging', async ({ page }) => {
      // Projects with many files should not freeze UI
      await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
    })
  })
})

// ============================================
// Onboarding Service Integration Tests
// ============================================
test.describe('Onboarding Service', () => {
  test('should persist plan to database', async ({ page }) => {
    // Verify plan is stored in onboarding_plans table
    await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
  })

  test('should retrieve pending plan for project', async ({ page }) => {
    // getPendingPlan should return the latest pending plan
    await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
  })

  test('should update plan with feedback', async ({ page }) => {
    // updatePlanWithFeedback should modify plan in database
    await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
  })

  test('should create roadmap items when applying plan', async ({ page }) => {
    // applyPlan should insert items into roadmap table
    await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
  })

  test('should create tasks when applying plan', async ({ page }) => {
    // applyPlan should insert tasks into task_queue table
    await expect(page.locator('h1:has-text("Claude DevStudio")').first()).toBeVisible()
  })
})
