import { EventEmitter } from 'events'
import { spawn } from 'child_process'
import { databaseService } from './database.service'
import { taskQueueService } from './task-queue.service'
import type { QueuedTask, TaskType, TaskOutputData } from '@shared/types'

type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
type ErrorType = 'transient' | 'fixable' | 'structural' | 'unknown'

interface QualityAssessment {
  qualityScore: number // 0-100
  riskLevel: RiskLevel
  canAutoApprove: boolean
  reasons: string[]
  checks: QualityCheck[]
}

interface QualityCheck {
  name: string
  passed: boolean
  score: number
  details?: string
}

interface ErrorAnalysis {
  errorType: ErrorType
  isRetryable: boolean
  suggestedAction: 'retry' | 'retry-with-context' | 'escalate' | 'fail'
  contextEnrichment?: string
  maxRetries?: number
}

interface ErrorPattern {
  id: string
  pattern: RegExp
  errorType: ErrorType
  resolution: {
    action: 'retry' | 'retry-with-context' | 'different-agent' | 'escalate'
    contextToAdd?: string
    agentType?: string
  }
  occurrences: number
  successRate: number
}

class ApprovalResolverService extends EventEmitter {
  // Known error patterns for classification
  private errorPatterns: ErrorPattern[] = [
    {
      id: 'timeout',
      pattern: /timeout|timed out|ETIMEDOUT/i,
      errorType: 'transient',
      resolution: { action: 'retry' },
      occurrences: 0,
      successRate: 0.8
    },
    {
      id: 'rate-limit',
      pattern: /rate limit|429|too many requests/i,
      errorType: 'transient',
      resolution: { action: 'retry' },
      occurrences: 0,
      successRate: 0.9
    },
    {
      id: 'file-not-found',
      pattern: /ENOENT|no such file|file not found|cannot find/i,
      errorType: 'fixable',
      resolution: {
        action: 'retry-with-context',
        contextToAdd: 'The file mentioned was not found. Please check the file path or create the file first.'
      },
      occurrences: 0,
      successRate: 0.6
    },
    {
      id: 'syntax-error',
      pattern: /SyntaxError|unexpected token|parse error/i,
      errorType: 'fixable',
      resolution: {
        action: 'retry-with-context',
        contextToAdd: 'The previous attempt had syntax errors. Please ensure valid syntax in your output.'
      },
      occurrences: 0,
      successRate: 0.7
    },
    {
      id: 'type-error',
      pattern: /TypeError|is not a function|undefined is not/i,
      errorType: 'fixable',
      resolution: {
        action: 'retry-with-context',
        contextToAdd: 'The previous attempt had type errors. Please check types and ensure proper null/undefined handling.'
      },
      occurrences: 0,
      successRate: 0.65
    },
    {
      id: 'permission-denied',
      pattern: /EACCES|permission denied|access denied/i,
      errorType: 'structural',
      resolution: { action: 'escalate' },
      occurrences: 0,
      successRate: 0.1
    },
    {
      id: 'network-error',
      pattern: /ECONNREFUSED|ENOTFOUND|network|connection refused/i,
      errorType: 'transient',
      resolution: { action: 'retry' },
      occurrences: 0,
      successRate: 0.75
    },
    {
      id: 'memory-error',
      pattern: /out of memory|heap|memory limit/i,
      errorType: 'structural',
      resolution: { action: 'escalate' },
      occurrences: 0,
      successRate: 0.1
    },
    {
      id: 'missing-dependency',
      pattern: /cannot find module|module not found|import.*failed/i,
      errorType: 'fixable',
      resolution: {
        action: 'retry-with-context',
        contextToAdd: 'A required module/dependency is missing. Please install dependencies or check import paths.'
      },
      occurrences: 0,
      successRate: 0.5
    }
  ]

  /**
   * Assess a task output for auto-approval
   */
  async assessForAutoApproval(
    taskId: string,
    outputData: TaskOutputData | null
  ): Promise<QualityAssessment> {
    const task = taskQueueService.getTask(taskId)
    if (!task) {
      return {
        qualityScore: 0,
        riskLevel: 'critical',
        canAutoApprove: false,
        reasons: ['Task not found'],
        checks: []
      }
    }

    const checks: QualityCheck[] = []
    const reasons: string[] = []

    // 1. Output completeness check
    const completenessCheck = this.checkOutputCompleteness(outputData)
    checks.push(completenessCheck)

    // 2. Task-type specific checks
    const typeChecks = await this.runTaskTypeChecks(task, outputData)
    checks.push(...typeChecks)

    // 3. Risk assessment
    const riskLevel = this.assessRiskLevel(task, outputData)

    // 4. Calculate overall quality score
    const qualityScore = this.calculateQualityScore(checks)

    // Determine if can auto-approve
    const canAutoApprove = this.determineAutoApproval(qualityScore, riskLevel, task)

    if (!canAutoApprove) {
      if (riskLevel === 'high' || riskLevel === 'critical') {
        reasons.push(`Risk level is ${riskLevel}`)
      }
      if (qualityScore < 70) {
        reasons.push(`Quality score ${qualityScore}% is below threshold`)
      }
      const failedChecks = checks.filter(c => !c.passed)
      if (failedChecks.length > 0) {
        reasons.push(`Failed checks: ${failedChecks.map(c => c.name).join(', ')}`)
      }
    }

    return {
      qualityScore,
      riskLevel,
      canAutoApprove,
      reasons,
      checks
    }
  }

  /**
   * Check output completeness
   */
  private checkOutputCompleteness(output: TaskOutputData | null): QualityCheck {
    if (!output || !output.result) {
      return {
        name: 'Output Completeness',
        passed: false,
        score: 0,
        details: 'No output produced'
      }
    }

    const result = String(output.result)
    const length = result.length

    // Minimum viable output
    if (length < 50) {
      return {
        name: 'Output Completeness',
        passed: false,
        score: 20,
        details: 'Output too short'
      }
    }

    // Check for error indicators in output
    const hasErrors = /error|failed|exception|cannot|unable/i.test(result)
    if (hasErrors) {
      return {
        name: 'Output Completeness',
        passed: false,
        score: 40,
        details: 'Output contains error indicators'
      }
    }

    return {
      name: 'Output Completeness',
      passed: true,
      score: 100,
      details: `Output length: ${length} characters`
    }
  }

  /**
   * Run task-type specific quality checks
   */
  private async runTaskTypeChecks(
    task: QueuedTask,
    output: TaskOutputData | null
  ): Promise<QualityCheck[]> {
    const checks: QualityCheck[] = []

    switch (task.taskType) {
      case 'code-generation':
      case 'refactoring':
      case 'bug-fix':
        checks.push(...await this.runCodeQualityChecks(output))
        break

      case 'testing':
        checks.push(...this.runTestingChecks(output))
        break

      case 'security-audit':
        checks.push(...this.runSecurityChecks(output))
        break

      case 'documentation':
        checks.push(...this.runDocumentationChecks(output))
        break

      default:
        checks.push({
          name: 'Generic Output Check',
          passed: true,
          score: 80,
          details: 'No specific checks for this task type'
        })
    }

    return checks
  }

  /**
   * Run code quality checks
   */
  private async runCodeQualityChecks(output: TaskOutputData | null): Promise<QualityCheck[]> {
    const checks: QualityCheck[] = []
    const result = String(output?.result || '')

    // Check for code blocks
    const hasCodeBlocks = /```[\s\S]*?```/.test(result)
    checks.push({
      name: 'Contains Code',
      passed: hasCodeBlocks,
      score: hasCodeBlocks ? 100 : 30,
      details: hasCodeBlocks ? 'Code blocks found' : 'No code blocks in output'
    })

    // Check for common code quality issues in output
    const hasTodos = /TODO|FIXME|HACK|XXX/i.test(result)
    checks.push({
      name: 'No TODOs',
      passed: !hasTodos,
      score: hasTodos ? 60 : 100,
      details: hasTodos ? 'Contains TODO/FIXME comments' : 'No incomplete markers'
    })

    // Check for hardcoded values
    const hasHardcoded = /password\s*=\s*['"][^'"]+['"]|api_key\s*=\s*['"][^'"]+['"]/i.test(result)
    checks.push({
      name: 'No Hardcoded Secrets',
      passed: !hasHardcoded,
      score: hasHardcoded ? 0 : 100,
      details: hasHardcoded ? 'Contains hardcoded secrets' : 'No hardcoded secrets detected'
    })

    return checks
  }

  /**
   * Run testing-specific checks
   */
  private runTestingChecks(output: TaskOutputData | null): QualityCheck[] {
    const checks: QualityCheck[] = []
    const result = String(output?.result || '')

    // Check for test structure
    const hasTestStructure = /describe|it\(|test\(|expect|assert/i.test(result)
    checks.push({
      name: 'Test Structure',
      passed: hasTestStructure,
      score: hasTestStructure ? 100 : 40,
      details: hasTestStructure ? 'Valid test structure found' : 'No test structure detected'
    })

    // Check for assertions
    const hasAssertions = /expect|assert|should|toBe|toEqual/i.test(result)
    checks.push({
      name: 'Has Assertions',
      passed: hasAssertions,
      score: hasAssertions ? 100 : 30,
      details: hasAssertions ? 'Assertions found' : 'No assertions detected'
    })

    return checks
  }

  /**
   * Run security-specific checks
   */
  private runSecurityChecks(output: TaskOutputData | null): QualityCheck[] {
    const checks: QualityCheck[] = []
    const result = String(output?.result || '')

    // Check for security analysis structure
    const hasVulnerabilityList = /vulnerability|CVE|security issue|risk|severity/i.test(result)
    checks.push({
      name: 'Security Analysis',
      passed: hasVulnerabilityList,
      score: hasVulnerabilityList ? 100 : 50,
      details: hasVulnerabilityList ? 'Security analysis present' : 'No security analysis found'
    })

    // Check for recommendations
    const hasRecommendations = /recommend|fix|remediate|patch|update/i.test(result)
    checks.push({
      name: 'Has Recommendations',
      passed: hasRecommendations,
      score: hasRecommendations ? 100 : 60,
      details: hasRecommendations ? 'Recommendations provided' : 'No recommendations found'
    })

    return checks
  }

  /**
   * Run documentation checks
   */
  private runDocumentationChecks(output: TaskOutputData | null): QualityCheck[] {
    const checks: QualityCheck[] = []
    const result = String(output?.result || '')

    // Check for markdown structure
    const hasHeaders = /^#+\s/m.test(result)
    checks.push({
      name: 'Document Structure',
      passed: hasHeaders,
      score: hasHeaders ? 100 : 50,
      details: hasHeaders ? 'Proper document structure' : 'Missing headers'
    })

    // Check for code examples
    const hasExamples = /```|example|usage/i.test(result)
    checks.push({
      name: 'Has Examples',
      passed: hasExamples,
      score: hasExamples ? 100 : 70,
      details: hasExamples ? 'Examples included' : 'No examples found'
    })

    return checks
  }

  /**
   * Assess risk level of the task
   */
  private assessRiskLevel(task: QueuedTask, output: TaskOutputData | null): RiskLevel {
    // High-risk task types
    if (task.taskType === 'deployment' || task.taskType === 'security-audit') {
      return 'high'
    }

    // Check output for risky operations
    const result = String(output?.result || '')

    // Critical risk indicators
    if (/delete\s+production|drop\s+database|rm\s+-rf/i.test(result)) {
      return 'critical'
    }

    // High risk indicators
    if (/password|secret|credential|api.?key|token/i.test(result) &&
        /change|update|modify|set/i.test(result)) {
      return 'high'
    }

    // Medium risk for code changes
    if (task.taskType === 'code-generation' || task.taskType === 'refactoring') {
      return 'medium'
    }

    return 'low'
  }

  /**
   * Calculate overall quality score
   */
  private calculateQualityScore(checks: QualityCheck[]): number {
    if (checks.length === 0) return 50

    const totalScore = checks.reduce((sum, check) => sum + check.score, 0)
    return Math.round(totalScore / checks.length)
  }

  /**
   * Determine if task can be auto-approved
   */
  private determineAutoApproval(
    qualityScore: number,
    riskLevel: RiskLevel,
    task: QueuedTask
  ): boolean {
    // Never auto-approve critical risk
    if (riskLevel === 'critical') return false

    // High risk requires high quality
    if (riskLevel === 'high' && qualityScore < 90) return false

    // Medium risk requires good quality
    if (riskLevel === 'medium' && qualityScore < 80) return false

    // Low risk can be auto-approved with decent quality
    if (riskLevel === 'low' && qualityScore < 70) return false

    return qualityScore >= 70
  }

  /**
   * Classify an error and suggest recovery action
   */
  classifyError(error: string, task: QueuedTask): ErrorAnalysis {
    // Check against known patterns
    for (const pattern of this.errorPatterns) {
      if (pattern.pattern.test(error)) {
        pattern.occurrences++

        return {
          errorType: pattern.errorType,
          isRetryable: pattern.resolution.action !== 'escalate',
          suggestedAction: pattern.resolution.action === 'different-agent'
            ? 'retry-with-context'
            : pattern.resolution.action,
          contextEnrichment: pattern.resolution.contextToAdd,
          maxRetries: pattern.errorType === 'transient' ? 5 : 3
        }
      }
    }

    // Unknown error - analyze content
    const isTransient = /temporary|retry|again/i.test(error)

    return {
      errorType: isTransient ? 'transient' : 'unknown',
      isRetryable: task.retryCount < task.maxRetries,
      suggestedAction: isTransient ? 'retry' : 'retry-with-context',
      contextEnrichment: `Previous attempt failed with: ${error.substring(0, 200)}`,
      maxRetries: 3
    }
  }

  /**
   * Enrich task context based on error
   */
  enrichContextForRetry(task: QueuedTask, errorAnalysis: ErrorAnalysis): TaskOutputData {
    const currentContext = task.inputData?.context || ''
    const previousErrors = task.inputData?.previousErrors || []

    return {
      ...task.inputData,
      context: errorAnalysis.contextEnrichment
        ? `${currentContext}\n\n${errorAnalysis.contextEnrichment}`
        : currentContext,
      previousErrors: [...previousErrors, task.errorMessage || 'Unknown error'],
      retryHint: errorAnalysis.suggestedAction === 'retry-with-context'
        ? 'Please address the issues from previous attempts and try a different approach if needed.'
        : undefined
    } as unknown as TaskOutputData
  }

  /**
   * Record error for learning
   */
  recordError(taskId: string, error: string, resolution: 'success' | 'failure'): void {
    const db = databaseService.getDb()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO error_patterns (id, task_id, error_message, resolution, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      taskId,
      error.substring(0, 1000),
      resolution,
      now
    )

    // Update pattern success rates
    for (const pattern of this.errorPatterns) {
      if (pattern.pattern.test(error)) {
        const total = pattern.occurrences + 1
        const successes = resolution === 'success'
          ? pattern.successRate * pattern.occurrences + 1
          : pattern.successRate * pattern.occurrences
        pattern.successRate = successes / total
        pattern.occurrences = total
        break
      }
    }
  }

  /**
   * Get error pattern statistics
   */
  getErrorStats(): Array<{ pattern: string; occurrences: number; successRate: number }> {
    return this.errorPatterns.map(p => ({
      pattern: p.id,
      occurrences: p.occurrences,
      successRate: Math.round(p.successRate * 100)
    }))
  }
}

export const approvalResolverService = new ApprovalResolverService()
