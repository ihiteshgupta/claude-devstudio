import { EventEmitter } from 'events'
import { spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { databaseService } from './database.service'

export type ValidationCheckType =
  | 'typecheck'
  | 'lint'
  | 'build'
  | 'test'
  | 'format'
  | 'security'
  | 'custom'

export type ValidationStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped'

export interface ValidationCheck {
  type: ValidationCheckType
  name: string
  command: string
  required: boolean
  timeout?: number
}

export interface ValidationResult {
  check: ValidationCheck
  status: ValidationStatus
  output: string
  errorOutput: string
  duration: number
  exitCode: number | null
  startedAt: Date
  completedAt: Date
}

export interface ValidationRun {
  id: string
  projectId: string
  taskId?: string
  checks: ValidationResult[]
  overallStatus: ValidationStatus
  passedCount: number
  failedCount: number
  skippedCount: number
  totalDuration: number
  startedAt: Date
  completedAt?: Date
}

export interface ValidationConfig {
  projectId: string
  projectPath: string
  taskId?: string
  checks?: ValidationCheck[]
  stopOnFirstFailure?: boolean
  timeout?: number
}

export interface ValidationProfile {
  id: string
  name: string
  description: string
  checks: ValidationCheck[]
}

// Predefined validation profiles
const DEFAULT_PROFILES: ValidationProfile[] = [
  {
    id: 'quick',
    name: 'Quick Validation',
    description: 'Fast checks for rapid feedback',
    checks: [
      { type: 'typecheck', name: 'Type Check', command: 'npm run typecheck', required: true },
      { type: 'lint', name: 'Lint', command: 'npm run lint', required: false }
    ]
  },
  {
    id: 'standard',
    name: 'Standard Validation',
    description: 'Balanced checks for most changes',
    checks: [
      { type: 'typecheck', name: 'Type Check', command: 'npm run typecheck', required: true },
      { type: 'lint', name: 'Lint', command: 'npm run lint', required: true },
      { type: 'build', name: 'Build', command: 'npm run build', required: true }
    ]
  },
  {
    id: 'full',
    name: 'Full Validation',
    description: 'Comprehensive checks including tests',
    checks: [
      { type: 'typecheck', name: 'Type Check', command: 'npm run typecheck', required: true },
      { type: 'lint', name: 'Lint', command: 'npm run lint', required: true },
      { type: 'format', name: 'Format Check', command: 'npm run format:check', required: false },
      { type: 'build', name: 'Build', command: 'npm run build', required: true },
      { type: 'test', name: 'Tests', command: 'npm run test', required: true }
    ]
  },
  {
    id: 'pre-commit',
    name: 'Pre-Commit',
    description: 'Checks before committing code',
    checks: [
      { type: 'typecheck', name: 'Type Check', command: 'npm run typecheck', required: true },
      { type: 'lint', name: 'Lint', command: 'npm run lint', required: true },
      { type: 'test', name: 'Unit Tests', command: 'npm run test:unit', required: true, timeout: 60000 }
    ]
  },
  {
    id: 'pre-merge',
    name: 'Pre-Merge',
    description: 'Full validation before merging',
    checks: [
      { type: 'typecheck', name: 'Type Check', command: 'npm run typecheck', required: true },
      { type: 'lint', name: 'Lint', command: 'npm run lint', required: true },
      { type: 'build', name: 'Build', command: 'npm run build', required: true },
      { type: 'test', name: 'All Tests', command: 'npm run test', required: true, timeout: 300000 },
      { type: 'security', name: 'Security Audit', command: 'npm audit --audit-level=high', required: false }
    ]
  }
]

class ValidationService extends EventEmitter {
  private runningValidations = new Map<string, { abort: () => void }>()

  /**
   * Run validation checks
   */
  async validate(config: ValidationConfig): Promise<ValidationRun> {
    const runId = `val_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    const startedAt = new Date()

    this.emit('validation-started', { runId, projectId: config.projectId })

    const checks = config.checks || this.detectChecks(config.projectPath)
    const results: ValidationResult[] = []

    let aborted = false
    const abortController = {
      abort: () => { aborted = true }
    }
    this.runningValidations.set(runId, abortController)

    try {
      for (const check of checks) {
        if (aborted) {
          results.push(this.createSkippedResult(check, 'Validation aborted'))
          continue
        }

        this.emit('check-started', { runId, check: check.name })

        const result = await this.runCheck(check, config.projectPath, config.timeout)
        results.push(result)

        this.emit('check-completed', {
          runId,
          check: check.name,
          status: result.status,
          duration: result.duration
        })

        if (result.status === 'failed' && check.required && config.stopOnFirstFailure) {
          // Skip remaining checks
          const remainingChecks = checks.slice(checks.indexOf(check) + 1)
          for (const remaining of remainingChecks) {
            results.push(this.createSkippedResult(remaining, 'Skipped due to required check failure'))
          }
          break
        }
      }
    } finally {
      this.runningValidations.delete(runId)
    }

    const completedAt = new Date()
    const passedCount = results.filter(r => r.status === 'passed').length
    const failedCount = results.filter(r => r.status === 'failed').length
    const skippedCount = results.filter(r => r.status === 'skipped').length

    const requiredFailed = results.some(
      r => r.status === 'failed' && r.check.required
    )

    const run: ValidationRun = {
      id: runId,
      projectId: config.projectId,
      taskId: config.taskId,
      checks: results,
      overallStatus: requiredFailed ? 'failed' : failedCount > 0 ? 'passed' : 'passed',
      passedCount,
      failedCount,
      skippedCount,
      totalDuration: completedAt.getTime() - startedAt.getTime(),
      startedAt,
      completedAt
    }

    // Store validation run in database
    this.storeValidationRun(run)

    this.emit('validation-completed', {
      runId,
      status: run.overallStatus,
      passed: passedCount,
      failed: failedCount
    })

    return run
  }

  /**
   * Run a single validation check
   */
  private async runCheck(
    check: ValidationCheck,
    projectPath: string,
    globalTimeout?: number
  ): Promise<ValidationResult> {
    const startedAt = new Date()
    const timeout = check.timeout || globalTimeout || 120000

    return new Promise<ValidationResult>(resolve => {
      let output = ''
      let errorOutput = ''
      let completed = false

      const [cmd, ...args] = check.command.split(' ')

      const proc = spawn(cmd, args, {
        cwd: projectPath,
        shell: true,
        env: { ...process.env, CI: 'true', FORCE_COLOR: '0' }
      })

      const timer = setTimeout(() => {
        if (!completed) {
          proc.kill('SIGTERM')
          errorOutput += '\n[Timeout exceeded]'
        }
      }, timeout)

      proc.stdout.on('data', data => {
        output += data.toString()
      })

      proc.stderr.on('data', data => {
        errorOutput += data.toString()
      })

      proc.on('close', code => {
        completed = true
        clearTimeout(timer)
        const completedAt = new Date()

        resolve({
          check,
          status: code === 0 ? 'passed' : 'failed',
          output,
          errorOutput,
          duration: completedAt.getTime() - startedAt.getTime(),
          exitCode: code,
          startedAt,
          completedAt
        })
      })

      proc.on('error', error => {
        completed = true
        clearTimeout(timer)
        const completedAt = new Date()

        resolve({
          check,
          status: 'failed',
          output,
          errorOutput: error.message,
          duration: completedAt.getTime() - startedAt.getTime(),
          exitCode: null,
          startedAt,
          completedAt
        })
      })
    })
  }

  /**
   * Create a skipped result
   */
  private createSkippedResult(check: ValidationCheck, reason: string): ValidationResult {
    const now = new Date()
    return {
      check,
      status: 'skipped',
      output: '',
      errorOutput: reason,
      duration: 0,
      exitCode: null,
      startedAt: now,
      completedAt: now
    }
  }

  /**
   * Auto-detect available checks from project
   */
  detectChecks(projectPath: string): ValidationCheck[] {
    const checks: ValidationCheck[] = []

    try {
      const packageJsonPath = path.join(projectPath, 'package.json')
      if (!fs.existsSync(packageJsonPath)) {
        return DEFAULT_PROFILES[1].checks // standard profile
      }

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
      const scripts = packageJson.scripts || {}

      // Detect available scripts
      if (scripts.typecheck) {
        checks.push({
          type: 'typecheck',
          name: 'Type Check',
          command: 'npm run typecheck',
          required: true
        })
      }

      if (scripts.lint) {
        checks.push({
          type: 'lint',
          name: 'Lint',
          command: 'npm run lint',
          required: true
        })
      }

      if (scripts['format:check'] || scripts['prettier:check']) {
        const script = scripts['format:check'] ? 'format:check' : 'prettier:check'
        checks.push({
          type: 'format',
          name: 'Format Check',
          command: `npm run ${script}`,
          required: false
        })
      }

      if (scripts.build) {
        checks.push({
          type: 'build',
          name: 'Build',
          command: 'npm run build',
          required: true
        })
      }

      if (scripts.test) {
        checks.push({
          type: 'test',
          name: 'Tests',
          command: 'npm run test',
          required: true,
          timeout: 300000
        })
      }
    } catch {
      // Return standard profile if detection fails
      return DEFAULT_PROFILES[1].checks
    }

    return checks.length > 0 ? checks : DEFAULT_PROFILES[1].checks
  }

  /**
   * Get validation profiles
   */
  getProfiles(): ValidationProfile[] {
    return [...DEFAULT_PROFILES]
  }

  /**
   * Get a specific profile
   */
  getProfile(profileId: string): ValidationProfile | undefined {
    return DEFAULT_PROFILES.find(p => p.id === profileId)
  }

  /**
   * Run validation with a profile
   */
  async validateWithProfile(
    projectId: string,
    projectPath: string,
    profileId: string,
    taskId?: string
  ): Promise<ValidationRun> {
    const profile = this.getProfile(profileId)
    if (!profile) {
      throw new Error(`Unknown validation profile: ${profileId}`)
    }

    return this.validate({
      projectId,
      projectPath,
      taskId,
      checks: profile.checks
    })
  }

  /**
   * Cancel a running validation
   */
  cancel(runId: string): boolean {
    const controller = this.runningValidations.get(runId)
    if (controller) {
      controller.abort()
      return true
    }
    return false
  }

  /**
   * Store validation run in database
   */
  private storeValidationRun(run: ValidationRun): void {
    const db = databaseService.getDb()

    db.prepare(`
      INSERT INTO validation_runs (
        id, project_id, task_id, overall_status,
        passed_count, failed_count, skipped_count,
        total_duration, checks_json, started_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      run.id,
      run.projectId,
      run.taskId || null,
      run.overallStatus,
      run.passedCount,
      run.failedCount,
      run.skippedCount,
      run.totalDuration,
      JSON.stringify(run.checks.map(c => ({
        type: c.check.type,
        name: c.check.name,
        status: c.status,
        duration: c.duration,
        exitCode: c.exitCode
      }))),
      run.startedAt.toISOString(),
      run.completedAt?.toISOString() || null
    )
  }

  /**
   * Get recent validation runs
   */
  getRecentRuns(projectId: string, limit = 10): ValidationRun[] {
    const db = databaseService.getDb()

    const rows = db.prepare(`
      SELECT * FROM validation_runs
      WHERE project_id = ?
      ORDER BY started_at DESC
      LIMIT ?
    `).all(projectId, limit) as any[]

    return rows.map(row => this.rowToRun(row))
  }

  /**
   * Get validation run by ID
   */
  getRun(runId: string): ValidationRun | null {
    const db = databaseService.getDb()
    const row = db.prepare('SELECT * FROM validation_runs WHERE id = ?').get(runId) as any

    if (!row) return null
    return this.rowToRun(row)
  }

  /**
   * Get validation runs for a task
   */
  getTaskRuns(taskId: string): ValidationRun[] {
    const db = databaseService.getDb()

    const rows = db.prepare(`
      SELECT * FROM validation_runs
      WHERE task_id = ?
      ORDER BY started_at DESC
    `).all(taskId) as any[]

    return rows.map(row => this.rowToRun(row))
  }

  /**
   * Check if validation is required for a task type
   */
  shouldValidate(taskType: string): boolean {
    // Tasks that should trigger validation
    const validatableTypes = [
      'code_generation',
      'refactoring',
      'bug_fix',
      'feature_implementation',
      'test_generation'
    ]
    return validatableTypes.includes(taskType)
  }

  /**
   * Get recommended profile for a task type
   */
  getRecommendedProfile(taskType: string): string {
    switch (taskType) {
      case 'code_generation':
      case 'feature_implementation':
        return 'standard'
      case 'bug_fix':
        return 'full'
      case 'refactoring':
        return 'full'
      case 'test_generation':
        return 'quick'
      default:
        return 'quick'
    }
  }

  /**
   * Validate and get pass/fail summary
   */
  async quickValidate(
    projectPath: string,
    projectId: string
  ): Promise<{ passed: boolean; summary: string }> {
    const run = await this.validateWithProfile(projectId, projectPath, 'quick')

    const summary = run.checks.map(c =>
      `${c.status === 'passed' ? '✓' : c.status === 'failed' ? '✗' : '○'} ${c.check.name}`
    ).join('\n')

    return {
      passed: run.overallStatus === 'passed',
      summary
    }
  }

  private rowToRun(row: any): ValidationRun {
    const checksJson = JSON.parse(row.checks_json || '[]')

    return {
      id: row.id,
      projectId: row.project_id,
      taskId: row.task_id,
      checks: checksJson.map((c: any) => ({
        check: { type: c.type, name: c.name, command: '', required: true },
        status: c.status,
        output: '',
        errorOutput: '',
        duration: c.duration,
        exitCode: c.exitCode,
        startedAt: new Date(),
        completedAt: new Date()
      })),
      overallStatus: row.overall_status,
      passedCount: row.passed_count,
      failedCount: row.failed_count,
      skippedCount: row.skipped_count,
      totalDuration: row.total_duration,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined
    }
  }
}

export const validationService = new ValidationService()
