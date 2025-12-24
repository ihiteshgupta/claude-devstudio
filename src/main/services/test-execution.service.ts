import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import path from 'path'
import fs from 'fs'
import { databaseService } from './database.service'

// Test result types
export interface TestResult {
  name: string
  fullName: string
  status: 'passed' | 'failed' | 'skipped' | 'pending'
  duration: number
  errorMessage?: string
  stackTrace?: string
  ancestorTitles: string[]
}

export interface TestSuiteResult {
  name: string
  filePath: string
  status: 'passed' | 'failed'
  duration: number
  tests: TestResult[]
  numPassedTests: number
  numFailedTests: number
  numSkippedTests: number
}

export interface TestRunResult {
  id: string
  projectId: string
  taskId?: string
  framework: 'jest' | 'vitest' | 'playwright' | 'unknown'
  status: 'passed' | 'failed' | 'error'
  startTime: Date
  endTime: Date
  duration: number
  suites: TestSuiteResult[]
  summary: {
    totalSuites: number
    passedSuites: number
    failedSuites: number
    totalTests: number
    passedTests: number
    failedTests: number
    skippedTests: number
  }
  gitCommit?: string
  errorOutput?: string
}

export interface TestExecution {
  id: string
  testCaseId?: string
  taskId?: string
  projectId: string
  testName: string
  testPath: string
  status: 'passed' | 'failed' | 'skipped' | 'error'
  duration: number
  executedAt: string
  errorMessage?: string
  stackTrace?: string
  gitCommit?: string
}

export interface TestBaseline {
  testName: string
  testPath: string
  projectId: string
  lastPassedCommit?: string
  lastPassedAt?: string
  passRate: number
  avgDuration: number
  flakyScore: number
  executionCount: number
}

export interface TestAnalysis {
  isRegression: boolean
  isFlaky: boolean
  isNewFailure: boolean
  severity: 'critical' | 'high' | 'medium' | 'low'
  relatedCommits: string[]
  suggestedAction: string
}

class TestExecutionService extends EventEmitter {
  private runningProcess: ChildProcess | null = null
  private isRunning = false

  /**
   * Run tests using the appropriate test framework
   */
  async runTests(
    projectPath: string,
    projectId: string,
    options: {
      taskId?: string
      testPattern?: string
      framework?: 'jest' | 'vitest' | 'playwright' | 'auto'
      timeout?: number
      coverage?: boolean
    } = {}
  ): Promise<TestRunResult> {
    if (this.isRunning) {
      throw new Error('Test execution already in progress')
    }

    const framework = options.framework === 'auto' || !options.framework
      ? await this.detectFramework(projectPath)
      : options.framework

    const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    const startTime = new Date()

    this.isRunning = true
    this.emit('test-run-started', { runId, projectId, framework })

    try {
      const result = await this.executeTests(projectPath, framework, options)
      const endTime = new Date()

      const testRunResult: TestRunResult = {
        id: runId,
        projectId,
        taskId: options.taskId,
        framework,
        status: result.success ? 'passed' : 'failed',
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        suites: result.suites,
        summary: result.summary,
        gitCommit: await this.getCurrentCommit(projectPath),
        errorOutput: result.errorOutput
      }

      // Store test executions in database
      await this.storeTestExecutions(testRunResult)

      // Update baselines
      await this.updateBaselines(projectId, testRunResult)

      this.emit('test-run-completed', testRunResult)
      return testRunResult
    } catch (error) {
      const endTime = new Date()
      const errorResult: TestRunResult = {
        id: runId,
        projectId,
        taskId: options.taskId,
        framework,
        status: 'error',
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        suites: [],
        summary: {
          totalSuites: 0,
          passedSuites: 0,
          failedSuites: 0,
          totalTests: 0,
          passedTests: 0,
          failedTests: 0,
          skippedTests: 0
        },
        errorOutput: error instanceof Error ? error.message : String(error)
      }
      this.emit('test-run-error', errorResult)
      return errorResult
    } finally {
      this.isRunning = false
      this.runningProcess = null
    }
  }

  /**
   * Detect which test framework is being used
   */
  private async detectFramework(projectPath: string): Promise<'jest' | 'vitest' | 'playwright' | 'unknown'> {
    const packageJsonPath = path.join(projectPath, 'package.json')

    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies }

      if (deps['@playwright/test'] || deps['playwright']) {
        return 'playwright'
      }
      if (deps['vitest']) {
        return 'vitest'
      }
      if (deps['jest']) {
        return 'jest'
      }
    } catch {
      // Package.json not found or invalid
    }

    return 'unknown'
  }

  /**
   * Execute tests and parse results
   */
  private async executeTests(
    projectPath: string,
    framework: string,
    options: {
      testPattern?: string
      timeout?: number
      coverage?: boolean
    }
  ): Promise<{
    success: boolean
    suites: TestSuiteResult[]
    summary: TestRunResult['summary']
    errorOutput?: string
  }> {
    const timeout = options.timeout || 300000 // 5 minutes default

    // Build command based on framework
    let command: string
    let args: string[]

    switch (framework) {
      case 'jest':
        command = 'npx'
        args = ['jest', '--json', '--outputFile=.jest-results.json']
        if (options.testPattern) args.push(options.testPattern)
        if (options.coverage) args.push('--coverage')
        break

      case 'vitest':
        command = 'npx'
        args = ['vitest', 'run', '--reporter=json', '--outputFile=.vitest-results.json']
        if (options.testPattern) args.push(options.testPattern)
        if (options.coverage) args.push('--coverage')
        break

      case 'playwright':
        command = 'npx'
        args = ['playwright', 'test', '--reporter=json']
        if (options.testPattern) args.push(options.testPattern)
        break

      default:
        // Try npm test as fallback
        command = 'npm'
        args = ['test', '--', '--json']
    }

    return new Promise((resolve) => {
      let stdout = ''
      let stderr = ''

      this.runningProcess = spawn(command, args, {
        cwd: projectPath,
        shell: true,
        env: { ...process.env, CI: 'true', FORCE_COLOR: '0' }
      })

      const timeoutId = setTimeout(() => {
        if (this.runningProcess) {
          this.runningProcess.kill('SIGTERM')
          resolve({
            success: false,
            suites: [],
            summary: this.emptySummary(),
            errorOutput: `Test execution timed out after ${timeout}ms`
          })
        }
      }, timeout)

      this.runningProcess.stdout?.on('data', (data) => {
        stdout += data.toString()
        this.emit('test-output', { type: 'stdout', content: data.toString() })
      })

      this.runningProcess.stderr?.on('data', (data) => {
        stderr += data.toString()
        this.emit('test-output', { type: 'stderr', content: data.toString() })
      })

      this.runningProcess.on('close', async (code) => {
        clearTimeout(timeoutId)

        // Parse results based on framework
        const parsed = await this.parseResults(projectPath, framework, stdout, stderr)

        resolve({
          success: code === 0,
          suites: parsed.suites,
          summary: parsed.summary,
          errorOutput: code !== 0 ? stderr || stdout : undefined
        })
      })

      this.runningProcess.on('error', (error) => {
        clearTimeout(timeoutId)
        resolve({
          success: false,
          suites: [],
          summary: this.emptySummary(),
          errorOutput: error.message
        })
      })
    })
  }

  /**
   * Parse test results from output files or stdout
   */
  private async parseResults(
    projectPath: string,
    framework: string,
    stdout: string,
    _stderr: string
  ): Promise<{
    suites: TestSuiteResult[]
    summary: TestRunResult['summary']
  }> {
    try {
      switch (framework) {
        case 'jest':
          return this.parseJestResults(projectPath, stdout)
        case 'vitest':
          return this.parseVitestResults(projectPath, stdout)
        case 'playwright':
          return this.parsePlaywrightResults(stdout)
        default:
          return this.parseGenericResults(stdout)
      }
    } catch {
      return { suites: [], summary: this.emptySummary() }
    }
  }

  /**
   * Parse Jest JSON output
   */
  private parseJestResults(
    projectPath: string,
    stdout: string
  ): { suites: TestSuiteResult[]; summary: TestRunResult['summary'] } {
    // Try to read from output file first
    const resultFile = path.join(projectPath, '.jest-results.json')
    let data: any

    try {
      if (fs.existsSync(resultFile)) {
        data = JSON.parse(fs.readFileSync(resultFile, 'utf-8'))
        fs.unlinkSync(resultFile) // Cleanup
      } else {
        // Try parsing from stdout
        data = JSON.parse(stdout)
      }
    } catch {
      return { suites: [], summary: this.emptySummary() }
    }

    const suites: TestSuiteResult[] = (data.testResults || []).map((suite: any) => ({
      name: path.basename(suite.name),
      filePath: suite.name,
      status: suite.status === 'passed' ? 'passed' : 'failed',
      duration: suite.endTime - suite.startTime,
      tests: (suite.assertionResults || []).map((test: any) => ({
        name: test.title,
        fullName: test.fullName,
        status: test.status,
        duration: test.duration || 0,
        errorMessage: test.failureMessages?.[0],
        stackTrace: test.failureDetails?.[0]?.stack,
        ancestorTitles: test.ancestorTitles || []
      })),
      numPassedTests: suite.assertionResults?.filter((t: any) => t.status === 'passed').length || 0,
      numFailedTests: suite.assertionResults?.filter((t: any) => t.status === 'failed').length || 0,
      numSkippedTests: suite.assertionResults?.filter((t: any) => t.status === 'pending' || t.status === 'skipped').length || 0
    }))

    return {
      suites,
      summary: {
        totalSuites: data.numTotalTestSuites || suites.length,
        passedSuites: data.numPassedTestSuites || suites.filter(s => s.status === 'passed').length,
        failedSuites: data.numFailedTestSuites || suites.filter(s => s.status === 'failed').length,
        totalTests: data.numTotalTests || 0,
        passedTests: data.numPassedTests || 0,
        failedTests: data.numFailedTests || 0,
        skippedTests: data.numPendingTests || 0
      }
    }
  }

  /**
   * Parse Vitest JSON output
   */
  private parseVitestResults(
    projectPath: string,
    stdout: string
  ): { suites: TestSuiteResult[]; summary: TestRunResult['summary'] } {
    const resultFile = path.join(projectPath, '.vitest-results.json')
    let data: any

    try {
      if (fs.existsSync(resultFile)) {
        data = JSON.parse(fs.readFileSync(resultFile, 'utf-8'))
        fs.unlinkSync(resultFile)
      } else {
        data = JSON.parse(stdout)
      }
    } catch {
      return { suites: [], summary: this.emptySummary() }
    }

    const suites: TestSuiteResult[] = (data.testResults || []).map((suite: any) => ({
      name: path.basename(suite.name || ''),
      filePath: suite.name || '',
      status: suite.status === 'passed' ? 'passed' : 'failed',
      duration: suite.duration || 0,
      tests: (suite.assertionResults || []).map((test: any) => ({
        name: test.title,
        fullName: test.fullName || test.title,
        status: test.status,
        duration: test.duration || 0,
        errorMessage: test.failureMessages?.[0],
        stackTrace: test.failureMessages?.join('\n'),
        ancestorTitles: test.ancestorTitles || []
      })),
      numPassedTests: suite.assertionResults?.filter((t: any) => t.status === 'passed').length || 0,
      numFailedTests: suite.assertionResults?.filter((t: any) => t.status === 'failed').length || 0,
      numSkippedTests: suite.assertionResults?.filter((t: any) => t.status === 'skipped').length || 0
    }))

    return {
      suites,
      summary: this.calculateSummary(suites)
    }
  }

  /**
   * Parse Playwright JSON output
   */
  private parsePlaywrightResults(
    stdout: string
  ): { suites: TestSuiteResult[]; summary: TestRunResult['summary'] } {
    try {
      const data = JSON.parse(stdout)
      const suites: TestSuiteResult[] = (data.suites || []).map((suite: any) => ({
        name: suite.title || path.basename(suite.file || ''),
        filePath: suite.file || '',
        status: suite.specs?.some((s: any) => s.ok === false) ? 'failed' : 'passed',
        duration: suite.duration || 0,
        tests: (suite.specs || []).map((spec: any) => ({
          name: spec.title,
          fullName: `${suite.title} > ${spec.title}`,
          status: spec.ok ? 'passed' : 'failed',
          duration: spec.duration || 0,
          errorMessage: spec.tests?.[0]?.results?.[0]?.error?.message,
          stackTrace: spec.tests?.[0]?.results?.[0]?.error?.stack,
          ancestorTitles: [suite.title]
        })),
        numPassedTests: suite.specs?.filter((s: any) => s.ok).length || 0,
        numFailedTests: suite.specs?.filter((s: any) => !s.ok).length || 0,
        numSkippedTests: suite.specs?.filter((s: any) => s.skipped).length || 0
      }))

      return {
        suites,
        summary: this.calculateSummary(suites)
      }
    } catch {
      return { suites: [], summary: this.emptySummary() }
    }
  }

  /**
   * Parse generic test output (fallback)
   */
  private parseGenericResults(
    stdout: string
  ): { suites: TestSuiteResult[]; summary: TestRunResult['summary'] } {
    // Simple pattern matching for common test output formats
    const passPattern = /(\d+)\s+(?:tests?\s+)?pass(?:ed|ing)?/i
    const failPattern = /(\d+)\s+(?:tests?\s+)?fail(?:ed|ing)?/i
    const skipPattern = /(\d+)\s+(?:tests?\s+)?skip(?:ped)?/i

    const passMatch = stdout.match(passPattern)
    const failMatch = stdout.match(failPattern)
    const skipMatch = stdout.match(skipPattern)

    const passed = passMatch ? parseInt(passMatch[1]) : 0
    const failed = failMatch ? parseInt(failMatch[1]) : 0
    const skipped = skipMatch ? parseInt(skipMatch[1]) : 0

    return {
      suites: [],
      summary: {
        totalSuites: 0,
        passedSuites: 0,
        failedSuites: 0,
        totalTests: passed + failed + skipped,
        passedTests: passed,
        failedTests: failed,
        skippedTests: skipped
      }
    }
  }

  /**
   * Calculate summary from suites
   */
  private calculateSummary(suites: TestSuiteResult[]): TestRunResult['summary'] {
    return {
      totalSuites: suites.length,
      passedSuites: suites.filter(s => s.status === 'passed').length,
      failedSuites: suites.filter(s => s.status === 'failed').length,
      totalTests: suites.reduce((acc, s) => acc + s.numPassedTests + s.numFailedTests + s.numSkippedTests, 0),
      passedTests: suites.reduce((acc, s) => acc + s.numPassedTests, 0),
      failedTests: suites.reduce((acc, s) => acc + s.numFailedTests, 0),
      skippedTests: suites.reduce((acc, s) => acc + s.numSkippedTests, 0)
    }
  }

  /**
   * Empty summary helper
   */
  private emptySummary(): TestRunResult['summary'] {
    return {
      totalSuites: 0,
      passedSuites: 0,
      failedSuites: 0,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0
    }
  }

  /**
   * Get current git commit
   */
  private async getCurrentCommit(projectPath: string): Promise<string | undefined> {
    try {
      const { execSync } = await import('child_process')
      return execSync('git rev-parse HEAD', { cwd: projectPath }).toString().trim()
    } catch {
      return undefined
    }
  }

  /**
   * Store test executions in database
   */
  private async storeTestExecutions(result: TestRunResult): Promise<void> {
    const db = databaseService.getDb()

    for (const suite of result.suites) {
      for (const test of suite.tests) {
        const id = `texec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

        db.prepare(`
          INSERT INTO test_executions (
            id, project_id, task_id, test_name, test_path, status,
            duration, executed_at, error_message, stack_trace, git_commit
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          result.projectId,
          result.taskId || null,
          test.fullName,
          suite.filePath,
          test.status,
          test.duration,
          result.endTime.toISOString(),
          test.errorMessage || null,
          test.stackTrace || null,
          result.gitCommit || null
        )
      }
    }
  }

  /**
   * Update test baselines based on execution results
   */
  private async updateBaselines(projectId: string, result: TestRunResult): Promise<void> {
    const db = databaseService.getDb()

    for (const suite of result.suites) {
      for (const test of suite.tests) {
        const key = `${suite.filePath}::${test.fullName}`

        // Get existing baseline
        const existing = db.prepare(`
          SELECT * FROM test_baselines WHERE project_id = ? AND test_key = ?
        `).get(projectId, key) as any

        if (existing) {
          // Update baseline
          const newPassRate = ((existing.pass_rate * existing.execution_count) +
            (test.status === 'passed' ? 1 : 0)) / (existing.execution_count + 1)

          const newAvgDuration = ((existing.avg_duration * existing.execution_count) +
            test.duration) / (existing.execution_count + 1)

          // Flaky score: increases if result differs from last result
          const resultChanged = existing.last_status !== test.status
          const newFlakyScore = resultChanged
            ? Math.min(1, existing.flaky_score + 0.1)
            : Math.max(0, existing.flaky_score - 0.05)

          db.prepare(`
            UPDATE test_baselines SET
              pass_rate = ?,
              avg_duration = ?,
              flaky_score = ?,
              execution_count = execution_count + 1,
              last_status = ?,
              last_executed_at = ?,
              last_passed_commit = CASE WHEN ? = 'passed' THEN ? ELSE last_passed_commit END,
              last_passed_at = CASE WHEN ? = 'passed' THEN ? ELSE last_passed_at END
            WHERE project_id = ? AND test_key = ?
          `).run(
            newPassRate,
            newAvgDuration,
            newFlakyScore,
            test.status,
            result.endTime.toISOString(),
            test.status, result.gitCommit,
            test.status, result.endTime.toISOString(),
            projectId, key
          )
        } else {
          // Create new baseline
          db.prepare(`
            INSERT INTO test_baselines (
              project_id, test_key, test_name, test_path,
              pass_rate, avg_duration, flaky_score, execution_count,
              last_status, last_executed_at, last_passed_commit, last_passed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            projectId,
            key,
            test.fullName,
            suite.filePath,
            test.status === 'passed' ? 1 : 0,
            test.duration,
            0,
            1,
            test.status,
            result.endTime.toISOString(),
            test.status === 'passed' ? result.gitCommit : null,
            test.status === 'passed' ? result.endTime.toISOString() : null
          )
        }
      }
    }
  }

  /**
   * Analyze a failed test to determine if it's a regression, flaky, etc.
   */
  analyzeFailure(projectId: string, testKey: string): TestAnalysis {
    const db = databaseService.getDb()

    const baseline = db.prepare(`
      SELECT * FROM test_baselines WHERE project_id = ? AND test_key = ?
    `).get(projectId, testKey) as any

    if (!baseline) {
      return {
        isRegression: false,
        isFlaky: false,
        isNewFailure: true,
        severity: 'medium',
        relatedCommits: [],
        suggestedAction: 'Investigate new test failure'
      }
    }

    const isRegression = baseline.pass_rate > 0.8 && baseline.last_status === 'passed'
    const isFlaky = baseline.flaky_score > 0.3

    let severity: TestAnalysis['severity'] = 'medium'
    if (isRegression) severity = 'high'
    if (baseline.pass_rate > 0.95 && !isFlaky) severity = 'critical'
    if (isFlaky) severity = 'low'

    let suggestedAction = 'Investigate test failure'
    if (isFlaky) suggestedAction = 'Add retry logic or stabilize test'
    if (isRegression) suggestedAction = 'Recent code change likely caused this regression'

    return {
      isRegression,
      isFlaky,
      isNewFailure: false,
      severity,
      relatedCommits: baseline.last_passed_commit ? [baseline.last_passed_commit] : [],
      suggestedAction
    }
  }

  /**
   * Get test baselines for a project
   */
  getBaselines(projectId: string): TestBaseline[] {
    const db = databaseService.getDb()

    const rows = db.prepare(`
      SELECT * FROM test_baselines WHERE project_id = ? ORDER BY test_name
    `).all(projectId) as any[]

    return rows.map(row => ({
      testName: row.test_name,
      testPath: row.test_path,
      projectId: row.project_id,
      lastPassedCommit: row.last_passed_commit,
      lastPassedAt: row.last_passed_at,
      passRate: row.pass_rate,
      avgDuration: row.avg_duration,
      flakyScore: row.flaky_score,
      executionCount: row.execution_count
    }))
  }

  /**
   * Get flaky tests for a project
   */
  getFlakyTests(projectId: string, threshold: number = 0.3): TestBaseline[] {
    return this.getBaselines(projectId).filter(b => b.flakyScore >= threshold)
  }

  /**
   * Get recent test executions
   */
  getRecentExecutions(projectId: string, limit: number = 100): TestExecution[] {
    const db = databaseService.getDb()

    const rows = db.prepare(`
      SELECT * FROM test_executions
      WHERE project_id = ?
      ORDER BY executed_at DESC
      LIMIT ?
    `).all(projectId, limit) as any[]

    return rows.map(row => ({
      id: row.id,
      testCaseId: row.test_case_id,
      taskId: row.task_id,
      projectId: row.project_id,
      testName: row.test_name,
      testPath: row.test_path,
      status: row.status,
      duration: row.duration,
      executedAt: row.executed_at,
      errorMessage: row.error_message,
      stackTrace: row.stack_trace,
      gitCommit: row.git_commit
    }))
  }

  /**
   * Cancel running tests
   */
  cancel(): boolean {
    if (this.runningProcess) {
      this.runningProcess.kill('SIGTERM')
      this.isRunning = false
      this.emit('test-run-cancelled')
      return true
    }
    return false
  }

  /**
   * Check if tests are currently running
   */
  isTestRunning(): boolean {
    return this.isRunning
  }
}

export const testExecutionService = new TestExecutionService()
