import { EventEmitter } from 'events'
import { databaseService } from './database.service'
import { claudeService } from './claude.service'
import type { TestExecution } from '@shared/types'

export type BugSeverity = 'critical' | 'high' | 'medium' | 'low'
export type BugStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | 'wont_fix'
export type BugSource = 'test_failure' | 'security_scan' | 'manual' | 'ai_detected'

export interface Bug {
  id: string
  projectId: string
  title: string
  description: string
  severity: BugSeverity
  status: BugStatus
  source: BugSource
  sourceId?: string // test execution ID, security finding ID, etc.
  filePath?: string
  lineNumber?: number
  errorMessage?: string
  stackTrace?: string
  stepsToReproduce?: string
  expectedBehavior?: string
  actualBehavior?: string
  assignedTo?: string
  labels: string[]
  relatedBugs: string[]
  createdAt: Date
  updatedAt: Date
  resolvedAt?: Date
}

export interface BugCreateInput {
  projectId: string
  title: string
  description: string
  severity: BugSeverity
  source: BugSource
  sourceId?: string
  filePath?: string
  lineNumber?: number
  errorMessage?: string
  stackTrace?: string
  stepsToReproduce?: string
  expectedBehavior?: string
  actualBehavior?: string
  labels?: string[]
}

export interface BugAnalysis {
  suggestedTitle: string
  suggestedDescription: string
  suggestedSeverity: BugSeverity
  possibleCause: string
  suggestedFix: string
  affectedFiles: string[]
  relatedBugIds: string[]
}

export interface BugStats {
  total: number
  open: number
  inProgress: number
  resolved: number
  closed: number
  bySeverity: Record<BugSeverity, number>
  bySource: Record<BugSource, number>
  avgResolutionTimeHours: number
  openedLast7Days: number
  resolvedLast7Days: number
}

class BugReportService extends EventEmitter {
  /**
   * Create a bug from a test failure
   */
  async createFromTestFailure(
    projectId: string,
    execution: TestExecution,
    projectPath: string
  ): Promise<Bug> {
    this.emit('bug-analysis-started', { projectId, testName: execution.testName })

    // Use AI to analyze the failure and create a bug report
    const analysis = await this.analyzeTestFailure(execution, projectPath)

    // Check for duplicate bugs
    const duplicates = await this.findSimilarBugs(projectId, execution.errorMessage || '')

    if (duplicates.length > 0) {
      this.emit('duplicate-detected', {
        projectId,
        testName: execution.testName,
        duplicateIds: duplicates.map(b => b.id)
      })

      // Link to existing bug instead of creating new one
      const existingBug = duplicates[0]
      await this.addRelatedBug(existingBug.id, `test:${execution.id}`)
      return existingBug
    }

    const bug = await this.create({
      projectId,
      title: analysis.suggestedTitle,
      description: analysis.suggestedDescription,
      severity: analysis.suggestedSeverity,
      source: 'test_failure',
      sourceId: execution.id,
      filePath: execution.testPath,
      errorMessage: execution.errorMessage,
      stackTrace: execution.stackTrace,
      stepsToReproduce: `1. Run test: ${execution.testName}\n2. Observe failure`,
      expectedBehavior: 'Test should pass',
      actualBehavior: execution.errorMessage || 'Test failed',
      labels: ['auto-generated', 'test-failure']
    })

    this.emit('bug-created', { bug, source: 'test_failure' })
    return bug
  }

  /**
   * Analyze a test failure using AI
   */
  private async analyzeTestFailure(
    execution: TestExecution,
    projectPath: string
  ): Promise<BugAnalysis> {
    const prompt = `Analyze this test failure and provide a bug report summary:

Test Name: ${execution.testName}
Test Path: ${execution.testPath || 'unknown'}
Error Message: ${execution.errorMessage || 'No error message'}
Stack Trace:
${execution.stackTrace || 'No stack trace available'}

Provide a JSON response with:
{
  "suggestedTitle": "Brief, descriptive title for the bug",
  "suggestedDescription": "Detailed description of the issue",
  "suggestedSeverity": "critical|high|medium|low",
  "possibleCause": "Analysis of what might be causing this",
  "suggestedFix": "Suggested approach to fix the issue",
  "affectedFiles": ["list", "of", "likely", "affected", "files"]
}

Respond ONLY with valid JSON.`

    try {
      const response = await claudeService.sendMessage(
        'Analyze this test failure',
        prompt,
        projectPath,
        'tester'
      )

      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return {
          suggestedTitle: parsed.suggestedTitle || `Test failure: ${execution.testName}`,
          suggestedDescription: parsed.suggestedDescription || execution.errorMessage || '',
          suggestedSeverity: this.validateSeverity(parsed.suggestedSeverity),
          possibleCause: parsed.possibleCause || 'Unknown',
          suggestedFix: parsed.suggestedFix || 'Investigation needed',
          affectedFiles: parsed.affectedFiles || [],
          relatedBugIds: []
        }
      }
    } catch {
      // Fallback to basic analysis
    }

    // Default analysis if AI fails
    return {
      suggestedTitle: `Test failure: ${execution.testName}`,
      suggestedDescription: execution.errorMessage || 'Test failed without error message',
      suggestedSeverity: 'medium',
      possibleCause: 'Unknown - requires investigation',
      suggestedFix: 'Review the test and related code',
      affectedFiles: execution.testPath ? [execution.testPath] : [],
      relatedBugIds: []
    }
  }

  /**
   * Create a new bug
   */
  async create(input: BugCreateInput): Promise<Bug> {
    const db = databaseService.getDb()
    const id = `bug_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO bugs (
        id, project_id, title, description, severity, status, source, source_id,
        file_path, line_number, error_message, stack_trace,
        steps_to_reproduce, expected_behavior, actual_behavior,
        labels, related_bugs, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.projectId,
      input.title,
      input.description,
      input.severity,
      'open',
      input.source,
      input.sourceId || null,
      input.filePath || null,
      input.lineNumber || null,
      input.errorMessage || null,
      input.stackTrace || null,
      input.stepsToReproduce || null,
      input.expectedBehavior || null,
      input.actualBehavior || null,
      JSON.stringify(input.labels || []),
      JSON.stringify([]),
      now,
      now
    )

    return this.getById(id)!
  }

  /**
   * Get bug by ID
   */
  getById(id: string): Bug | null {
    const db = databaseService.getDb()
    const row = db.prepare('SELECT * FROM bugs WHERE id = ?').get(id) as any

    if (!row) return null
    return this.rowToBug(row)
  }

  /**
   * Get bugs for a project
   */
  getBugs(
    projectId: string,
    options: {
      status?: BugStatus[]
      severity?: BugSeverity[]
      source?: BugSource[]
      limit?: number
      offset?: number
    } = {}
  ): Bug[] {
    const db = databaseService.getDb()

    let query = 'SELECT * FROM bugs WHERE project_id = ?'
    const params: any[] = [projectId]

    if (options.status && options.status.length > 0) {
      query += ` AND status IN (${options.status.map(() => '?').join(',')})`
      params.push(...options.status)
    }

    if (options.severity && options.severity.length > 0) {
      query += ` AND severity IN (${options.severity.map(() => '?').join(',')})`
      params.push(...options.severity)
    }

    if (options.source && options.source.length > 0) {
      query += ` AND source IN (${options.source.map(() => '?').join(',')})`
      params.push(...options.source)
    }

    query += ' ORDER BY created_at DESC'

    if (options.limit) {
      query += ' LIMIT ?'
      params.push(options.limit)
    }

    if (options.offset) {
      query += ' OFFSET ?'
      params.push(options.offset)
    }

    const rows = db.prepare(query).all(...params) as any[]
    return rows.map(row => this.rowToBug(row))
  }

  /**
   * Update bug status
   */
  updateStatus(id: string, status: BugStatus): Bug | null {
    const db = databaseService.getDb()
    const now = new Date().toISOString()

    const updates: any = { status, updated_at: now }
    if (status === 'resolved' || status === 'closed') {
      updates.resolved_at = now
    }

    db.prepare(`
      UPDATE bugs SET status = ?, updated_at = ?, resolved_at = COALESCE(?, resolved_at)
      WHERE id = ?
    `).run(status, now, updates.resolved_at || null, id)

    const bug = this.getById(id)
    if (bug) {
      this.emit('bug-status-changed', { bug, oldStatus: status, newStatus: status })
    }
    return bug
  }

  /**
   * Update bug severity
   */
  updateSeverity(id: string, severity: BugSeverity): Bug | null {
    const db = databaseService.getDb()
    const now = new Date().toISOString()

    db.prepare('UPDATE bugs SET severity = ?, updated_at = ? WHERE id = ?')
      .run(severity, now, id)

    return this.getById(id)
  }

  /**
   * Add a label to a bug
   */
  addLabel(id: string, label: string): Bug | null {
    const bug = this.getById(id)
    if (!bug) return null

    if (!bug.labels.includes(label)) {
      const db = databaseService.getDb()
      const labels = [...bug.labels, label]
      const now = new Date().toISOString()

      db.prepare('UPDATE bugs SET labels = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(labels), now, id)
    }

    return this.getById(id)
  }

  /**
   * Remove a label from a bug
   */
  removeLabel(id: string, label: string): Bug | null {
    const bug = this.getById(id)
    if (!bug) return null

    const db = databaseService.getDb()
    const labels = bug.labels.filter(l => l !== label)
    const now = new Date().toISOString()

    db.prepare('UPDATE bugs SET labels = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(labels), now, id)

    return this.getById(id)
  }

  /**
   * Link related bugs
   */
  addRelatedBug(id: string, relatedId: string): Bug | null {
    const bug = this.getById(id)
    if (!bug) return null

    if (!bug.relatedBugs.includes(relatedId)) {
      const db = databaseService.getDb()
      const relatedBugs = [...bug.relatedBugs, relatedId]
      const now = new Date().toISOString()

      db.prepare('UPDATE bugs SET related_bugs = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(relatedBugs), now, id)
    }

    return this.getById(id)
  }

  /**
   * Find similar bugs based on error message
   */
  async findSimilarBugs(projectId: string, errorMessage: string): Promise<Bug[]> {
    if (!errorMessage || errorMessage.length < 10) return []

    const db = databaseService.getDb()

    // Simple similarity check - look for bugs with similar error messages
    const rows = db.prepare(`
      SELECT * FROM bugs
      WHERE project_id = ?
        AND status IN ('open', 'in_progress')
        AND error_message IS NOT NULL
    `).all(projectId) as any[]

    const bugs = rows.map(row => this.rowToBug(row))

    // Filter by error message similarity (simple substring match)
    const keywords = errorMessage.split(/\s+/).filter(w => w.length > 5).slice(0, 5)

    return bugs.filter(bug => {
      if (!bug.errorMessage) return false
      const matches = keywords.filter(kw =>
        bug.errorMessage!.toLowerCase().includes(kw.toLowerCase())
      )
      return matches.length >= Math.min(2, keywords.length)
    })
  }

  /**
   * Get bug statistics
   */
  getStats(projectId: string): BugStats {
    const db = databaseService.getDb()

    const total = db.prepare('SELECT COUNT(*) as count FROM bugs WHERE project_id = ?')
      .get(projectId) as any

    const byStatus = db.prepare(`
      SELECT status, COUNT(*) as count FROM bugs
      WHERE project_id = ? GROUP BY status
    `).all(projectId) as any[]

    const bySeverity = db.prepare(`
      SELECT severity, COUNT(*) as count FROM bugs
      WHERE project_id = ? GROUP BY severity
    `).all(projectId) as any[]

    const bySource = db.prepare(`
      SELECT source, COUNT(*) as count FROM bugs
      WHERE project_id = ? GROUP BY source
    `).all(projectId) as any[]

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const openedRecent = db.prepare(`
      SELECT COUNT(*) as count FROM bugs
      WHERE project_id = ? AND created_at >= ?
    `).get(projectId, sevenDaysAgo) as any

    const resolvedRecent = db.prepare(`
      SELECT COUNT(*) as count FROM bugs
      WHERE project_id = ? AND resolved_at >= ?
    `).get(projectId, sevenDaysAgo) as any

    // Calculate average resolution time for resolved bugs
    const resolvedBugs = db.prepare(`
      SELECT created_at, resolved_at FROM bugs
      WHERE project_id = ? AND resolved_at IS NOT NULL
    `).all(projectId) as any[]

    let avgResolutionTime = 0
    if (resolvedBugs.length > 0) {
      const totalTime = resolvedBugs.reduce((sum, bug) => {
        const created = new Date(bug.created_at).getTime()
        const resolved = new Date(bug.resolved_at).getTime()
        return sum + (resolved - created)
      }, 0)
      avgResolutionTime = (totalTime / resolvedBugs.length) / (1000 * 60 * 60)
    }

    const statusMap: Record<string, number> = {}
    byStatus.forEach(s => { statusMap[s.status] = s.count })

    const severityMap: Record<BugSeverity, number> = {
      critical: 0, high: 0, medium: 0, low: 0
    }
    bySeverity.forEach(s => { severityMap[s.severity as BugSeverity] = s.count })

    const sourceMap: Record<BugSource, number> = {
      test_failure: 0, security_scan: 0, manual: 0, ai_detected: 0
    }
    bySource.forEach(s => { sourceMap[s.source as BugSource] = s.count })

    return {
      total: total.count,
      open: statusMap['open'] || 0,
      inProgress: statusMap['in_progress'] || 0,
      resolved: statusMap['resolved'] || 0,
      closed: statusMap['closed'] || 0,
      bySeverity: severityMap,
      bySource: sourceMap,
      avgResolutionTimeHours: Math.round(avgResolutionTime * 10) / 10,
      openedLast7Days: openedRecent.count,
      resolvedLast7Days: resolvedRecent.count
    }
  }

  /**
   * Batch create bugs from multiple test failures
   */
  async createFromTestRun(
    projectId: string,
    failures: TestExecution[],
    projectPath: string
  ): Promise<Bug[]> {
    const bugs: Bug[] = []

    for (const failure of failures) {
      try {
        const bug = await this.createFromTestFailure(projectId, failure, projectPath)
        bugs.push(bug)
      } catch (error) {
        this.emit('bug-creation-error', {
          projectId,
          testName: failure.testName,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    if (bugs.length > 0) {
      this.emit('bugs-batch-created', { projectId, count: bugs.length })
    }

    return bugs
  }

  /**
   * Auto-resolve bugs when tests pass
   */
  async autoResolveFromTestSuccess(
    projectId: string,
    passedTestNames: string[]
  ): Promise<number> {
    const db = databaseService.getDb()
    let resolvedCount = 0

    for (const testName of passedTestNames) {
      // Find open bugs linked to this test
      const bugs = db.prepare(`
        SELECT b.* FROM bugs b
        INNER JOIN test_executions te ON b.source_id = te.id
        WHERE b.project_id = ?
          AND b.status = 'open'
          AND b.source = 'test_failure'
          AND te.test_name = ?
      `).all(projectId, testName) as any[]

      for (const row of bugs) {
        this.updateStatus(row.id, 'resolved')
        this.addLabel(row.id, 'auto-resolved')
        resolvedCount++
      }
    }

    if (resolvedCount > 0) {
      this.emit('bugs-auto-resolved', { projectId, count: resolvedCount })
    }

    return resolvedCount
  }

  /**
   * Delete a bug
   */
  delete(id: string): boolean {
    const db = databaseService.getDb()
    const result = db.prepare('DELETE FROM bugs WHERE id = ?').run(id)
    return result.changes > 0
  }

  private validateSeverity(severity: string): BugSeverity {
    const valid: BugSeverity[] = ['critical', 'high', 'medium', 'low']
    return valid.includes(severity as BugSeverity) ? severity as BugSeverity : 'medium'
  }

  private rowToBug(row: any): Bug {
    return {
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      description: row.description,
      severity: row.severity,
      status: row.status,
      source: row.source,
      sourceId: row.source_id,
      filePath: row.file_path,
      lineNumber: row.line_number,
      errorMessage: row.error_message,
      stackTrace: row.stack_trace,
      stepsToReproduce: row.steps_to_reproduce,
      expectedBehavior: row.expected_behavior,
      actualBehavior: row.actual_behavior,
      assignedTo: row.assigned_to,
      labels: JSON.parse(row.labels || '[]'),
      relatedBugs: JSON.parse(row.related_bugs || '[]'),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined
    }
  }
}

export const bugReportService = new BugReportService()
