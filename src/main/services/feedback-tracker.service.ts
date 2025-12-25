import { EventEmitter } from 'events'
import { databaseService } from './database.service'
import type Database from 'better-sqlite3'

interface FeedbackEntry {
  id: string
  projectId: string
  itemId: string
  itemType: 'story' | 'task' | 'test' | 'code'
  feedbackType:
    | 'code_success'
    | 'test_pass'
    | 'test_fail'
    | 'sprint_accepted'
    | 'sprint_rejected'
    | 'user_rating'
  feedbackData?: {
    rating?: number // 1-5 for user ratings
    reason?: string
    testOutput?: string
    errorMessage?: string
  }
  source: 'auto' | 'user'
  createdAt: string
}

interface FeedbackSummary {
  totalFeedback: number
  successRate: number
  testPassRate: number
  sprintAcceptanceRate: number
  averageRating?: number
  recentTrend: 'improving' | 'declining' | 'stable'
}

interface ItemFeedback {
  itemId: string
  feedbackEntries: FeedbackEntry[]
  overallSuccess: boolean
  successScore: number // 0-1
}

interface ProblematicPattern {
  pattern: string
  failureRate: number
}

interface TrendAnalysis {
  trend: 'improving' | 'declining' | 'stable'
  details: string
}

class FeedbackTrackerService extends EventEmitter {
  private db: Database.Database

  constructor() {
    super()
    this.db = databaseService.getDb()
    this.initTables()
  }

  private initTables(): void {
    // Create feedback tracking table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS feedback_tracking (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        item_type TEXT NOT NULL,
        feedback_type TEXT NOT NULL,
        feedback_data TEXT,
        source TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `)

    // Create indexes for efficient queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_feedback_project ON feedback_tracking(project_id);
      CREATE INDEX IF NOT EXISTS idx_feedback_item ON feedback_tracking(item_id);
      CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback_tracking(feedback_type);
      CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback_tracking(created_at);
    `)
  }

  /**
   * Record a feedback entry
   */
  recordFeedback(entry: Omit<FeedbackEntry, 'id' | 'createdAt'>): FeedbackEntry {
    return databaseService.withWriteLockRetry(() => {
      const id = `feedback_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      const createdAt = new Date().toISOString()

      const feedbackEntry: FeedbackEntry = {
        id,
        ...entry,
        createdAt
      }

      this.db
        .prepare(
          `INSERT INTO feedback_tracking
           (id, project_id, item_id, item_type, feedback_type, feedback_data, source, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          entry.projectId,
          entry.itemId,
          entry.itemType,
          entry.feedbackType,
          entry.feedbackData ? JSON.stringify(entry.feedbackData) : null,
          entry.source,
          createdAt
        )

      // Emit event
      this.emit('feedback-recorded', feedbackEntry)

      // Calculate and emit success rate change
      const successRate = this.calculateSuccessRate(entry.projectId, entry.itemType)
      this.emit('success-rate-changed', {
        projectId: entry.projectId,
        itemType: entry.itemType,
        successRate
      })

      return feedbackEntry
    })
  }

  /**
   * Record code execution success/failure
   */
  recordCodeSuccess(projectId: string, taskId: string, success: boolean, details?: string): void {
    this.recordFeedback({
      projectId,
      itemId: taskId,
      itemType: 'code',
      feedbackType: success ? 'code_success' : 'test_fail',
      feedbackData: details ? { reason: details } : undefined,
      source: 'auto'
    })
  }

  /**
   * Record test execution result
   */
  recordTestResult(projectId: string, testId: string, passed: boolean, output?: string): void {
    this.recordFeedback({
      projectId,
      itemId: testId,
      itemType: 'test',
      feedbackType: passed ? 'test_pass' : 'test_fail',
      feedbackData: output ? { testOutput: output } : undefined,
      source: 'auto'
    })
  }

  /**
   * Record sprint story acceptance/rejection
   */
  recordSprintOutcome(
    projectId: string,
    storyId: string,
    accepted: boolean,
    reason?: string
  ): void {
    this.recordFeedback({
      projectId,
      itemId: storyId,
      itemType: 'story',
      feedbackType: accepted ? 'sprint_accepted' : 'sprint_rejected',
      feedbackData: reason ? { reason } : undefined,
      source: 'user'
    })
  }

  /**
   * Record user rating for an item
   */
  recordUserRating(
    projectId: string,
    itemId: string,
    itemType: 'story' | 'task' | 'test' | 'code',
    rating: number,
    comment?: string
  ): void {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5')
    }

    this.recordFeedback({
      projectId,
      itemId,
      itemType,
      feedbackType: 'user_rating',
      feedbackData: {
        rating,
        reason: comment
      },
      source: 'user'
    })
  }

  /**
   * Get all feedback for a specific item
   */
  getItemFeedback(itemId: string): ItemFeedback {
    const rows = this.db
      .prepare('SELECT * FROM feedback_tracking WHERE item_id = ? ORDER BY created_at DESC')
      .all(itemId) as Array<{
      id: string
      project_id: string
      item_id: string
      item_type: string
      feedback_type: string
      feedback_data: string | null
      source: string
      created_at: string
    }>

    const feedbackEntries: FeedbackEntry[] = rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      itemId: row.item_id,
      itemType: row.item_type as FeedbackEntry['itemType'],
      feedbackType: row.feedback_type as FeedbackEntry['feedbackType'],
      feedbackData: row.feedback_data ? JSON.parse(row.feedback_data) : undefined,
      source: row.source as 'auto' | 'user',
      createdAt: row.created_at
    }))

    // Calculate success score
    const successCount = feedbackEntries.filter(
      (entry) =>
        entry.feedbackType === 'code_success' ||
        entry.feedbackType === 'test_pass' ||
        entry.feedbackType === 'sprint_accepted' ||
        (entry.feedbackType === 'user_rating' && (entry.feedbackData?.rating ?? 0) >= 4)
    ).length

    const failureCount = feedbackEntries.filter(
      (entry) =>
        entry.feedbackType === 'test_fail' ||
        entry.feedbackType === 'sprint_rejected' ||
        (entry.feedbackType === 'user_rating' && (entry.feedbackData?.rating ?? 0) < 4)
    ).length

    const totalScorable = successCount + failureCount
    const successScore = totalScorable > 0 ? successCount / totalScorable : 0

    return {
      itemId,
      feedbackEntries,
      overallSuccess: successScore >= 0.5,
      successScore
    }
  }

  /**
   * Get project-wide feedback summary
   */
  getProjectSummary(projectId: string): FeedbackSummary {
    const rows = this.db
      .prepare('SELECT * FROM feedback_tracking WHERE project_id = ?')
      .all(projectId) as Array<{
      feedback_type: string
      feedback_data: string | null
      created_at: string
    }>

    const totalFeedback = rows.length
    if (totalFeedback === 0) {
      return {
        totalFeedback: 0,
        successRate: 0,
        testPassRate: 0,
        sprintAcceptanceRate: 0,
        recentTrend: 'stable'
      }
    }

    // Calculate success rate (code + tests + sprints)
    const successfulItems = rows.filter(
      (row) =>
        row.feedback_type === 'code_success' ||
        row.feedback_type === 'test_pass' ||
        row.feedback_type === 'sprint_accepted'
    ).length
    const failedItems = rows.filter(
      (row) =>
        row.feedback_type === 'test_fail' || row.feedback_type === 'sprint_rejected'
    ).length
    const successRate =
      successfulItems + failedItems > 0 ? successfulItems / (successfulItems + failedItems) : 0

    // Calculate test pass rate
    const testPasses = rows.filter((row) => row.feedback_type === 'test_pass').length
    const testFails = rows.filter((row) => row.feedback_type === 'test_fail').length
    const testPassRate = testPasses + testFails > 0 ? testPasses / (testPasses + testFails) : 0

    // Calculate sprint acceptance rate
    const sprintAccepted = rows.filter((row) => row.feedback_type === 'sprint_accepted').length
    const sprintRejected = rows.filter((row) => row.feedback_type === 'sprint_rejected').length
    const sprintAcceptanceRate =
      sprintAccepted + sprintRejected > 0 ? sprintAccepted / (sprintAccepted + sprintRejected) : 0

    // Calculate average rating
    const ratings = rows
      .filter((row) => row.feedback_type === 'user_rating')
      .map((row) => {
        const data = row.feedback_data ? JSON.parse(row.feedback_data) : null
        return data?.rating
      })
      .filter((rating): rating is number => rating !== undefined && rating !== null)

    const averageRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : undefined

    // Calculate trend
    const recentTrend = this.getTrendAnalysis(projectId, 30).trend

    return {
      totalFeedback,
      successRate,
      testPassRate,
      sprintAcceptanceRate,
      averageRating,
      recentTrend
    }
  }

  /**
   * Get recent feedback entries
   */
  getRecentFeedback(projectId: string, limit: number = 50): FeedbackEntry[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM feedback_tracking WHERE project_id = ? ORDER BY created_at DESC LIMIT ?'
      )
      .all(projectId, limit) as Array<{
      id: string
      project_id: string
      item_id: string
      item_type: string
      feedback_type: string
      feedback_data: string | null
      source: string
      created_at: string
    }>

    return rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      itemId: row.item_id,
      itemType: row.item_type as FeedbackEntry['itemType'],
      feedbackType: row.feedback_type as FeedbackEntry['feedbackType'],
      feedbackData: row.feedback_data ? JSON.parse(row.feedback_data) : undefined,
      source: row.source as 'auto' | 'user',
      createdAt: row.created_at
    }))
  }

  /**
   * Calculate success rate for a project (optionally filtered by item type)
   */
  calculateSuccessRate(projectId: string, itemType?: string): number {
    let query = 'SELECT feedback_type FROM feedback_tracking WHERE project_id = ?'
    const params: (string | undefined)[] = [projectId]

    if (itemType) {
      query += ' AND item_type = ?'
      params.push(itemType)
    }

    const rows = this.db.prepare(query).all(...params.filter((p): p is string => p !== undefined)) as Array<{
      feedback_type: string
    }>

    const successfulItems = rows.filter(
      (row) =>
        row.feedback_type === 'code_success' ||
        row.feedback_type === 'test_pass' ||
        row.feedback_type === 'sprint_accepted'
    ).length

    const failedItems = rows.filter(
      (row) =>
        row.feedback_type === 'test_fail' || row.feedback_type === 'sprint_rejected'
    ).length

    const total = successfulItems + failedItems
    return total > 0 ? successfulItems / total : 0
  }

  /**
   * Identify patterns that consistently fail
   */
  identifyProblematicPatterns(projectId: string): ProblematicPattern[] {
    // Get all failed items with their IDs
    const rows = this.db
      .prepare(
        `SELECT item_id, item_type, feedback_type, feedback_data
         FROM feedback_tracking
         WHERE project_id = ?
         AND (feedback_type = 'test_fail' OR feedback_type = 'sprint_rejected')`
      )
      .all(projectId) as Array<{
      item_id: string
      item_type: string
      feedback_type: string
      feedback_data: string | null
    }>

    // Group by item_type and analyze failure patterns
    const patternMap = new Map<string, { total: number; failures: number }>()

    rows.forEach((row) => {
      const pattern = `${row.item_type} failures`
      const current = patternMap.get(pattern) || { total: 0, failures: 0 }
      current.failures++
      patternMap.set(pattern, current)
    })

    // Also count total items per type
    const totalRows = this.db
      .prepare(
        'SELECT item_type FROM feedback_tracking WHERE project_id = ?'
      )
      .all(projectId) as Array<{ item_type: string }>

    totalRows.forEach((row) => {
      const pattern = `${row.item_type} failures`
      const current = patternMap.get(pattern) || { total: 0, failures: 0 }
      current.total++
      patternMap.set(pattern, current)
    })

    // Convert to array and calculate failure rates
    const patterns: ProblematicPattern[] = Array.from(patternMap.entries())
      .map(([pattern, stats]) => ({
        pattern,
        failureRate: stats.total > 0 ? stats.failures / stats.total : 0
      }))
      .filter((p) => p.failureRate > 0.3) // Only include patterns with >30% failure rate
      .sort((a, b) => b.failureRate - a.failureRate)

    // Emit event for high failure patterns
    patterns.forEach((pattern) => {
      if (pattern.failureRate > 0.5) {
        this.emit('pattern-flagged', { projectId, pattern })
      }
    })

    return patterns
  }

  /**
   * Analyze trends over time period
   */
  getTrendAnalysis(projectId: string, days: number = 30): TrendAnalysis {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    const cutoffISO = cutoffDate.toISOString()

    const midpointDate = new Date()
    midpointDate.setDate(midpointDate.getDate() - Math.floor(days / 2))
    const midpointISO = midpointDate.toISOString()

    // Get recent half
    const recentRows = this.db
      .prepare(
        `SELECT feedback_type FROM feedback_tracking
         WHERE project_id = ? AND created_at >= ?`
      )
      .all(projectId, midpointISO) as Array<{ feedback_type: string }>

    const recentSuccess = recentRows.filter(
      (row) =>
        row.feedback_type === 'code_success' ||
        row.feedback_type === 'test_pass' ||
        row.feedback_type === 'sprint_accepted'
    ).length
    const recentFailed = recentRows.filter(
      (row) =>
        row.feedback_type === 'test_fail' || row.feedback_type === 'sprint_rejected'
    ).length
    const recentTotal = recentSuccess + recentFailed
    const recentRate = recentTotal > 0 ? recentSuccess / recentTotal : 0

    // Get older half
    const olderRows = this.db
      .prepare(
        `SELECT feedback_type FROM feedback_tracking
         WHERE project_id = ? AND created_at >= ? AND created_at < ?`
      )
      .all(projectId, cutoffISO, midpointISO) as Array<{ feedback_type: string }>

    const olderSuccess = olderRows.filter(
      (row) =>
        row.feedback_type === 'code_success' ||
        row.feedback_type === 'test_pass' ||
        row.feedback_type === 'sprint_accepted'
    ).length
    const olderFailed = olderRows.filter(
      (row) =>
        row.feedback_type === 'test_fail' || row.feedback_type === 'sprint_rejected'
    ).length
    const olderTotal = olderSuccess + olderFailed
    const olderRate = olderTotal > 0 ? olderSuccess / olderTotal : 0

    // Determine trend
    const threshold = 0.05 // 5% change threshold
    let trend: 'improving' | 'declining' | 'stable'
    let details: string

    if (recentTotal === 0 && olderTotal === 0) {
      trend = 'stable'
      details = 'No feedback data available for analysis'
    } else if (recentTotal === 0) {
      trend = 'stable'
      details = `No recent feedback in the last ${Math.floor(days / 2)} days`
    } else if (olderTotal === 0) {
      trend = 'stable'
      details = `Only recent feedback available (${recentTotal} items)`
    } else {
      const delta = recentRate - olderRate

      if (delta > threshold) {
        trend = 'improving'
        details = `Success rate improved from ${(olderRate * 100).toFixed(1)}% to ${(recentRate * 100).toFixed(1)}% over the last ${days} days`
      } else if (delta < -threshold) {
        trend = 'declining'
        details = `Success rate declined from ${(olderRate * 100).toFixed(1)}% to ${(recentRate * 100).toFixed(1)}% over the last ${days} days`
      } else {
        trend = 'stable'
        details = `Success rate remained stable at around ${(recentRate * 100).toFixed(1)}% over the last ${days} days`
      }
    }

    return { trend, details }
  }
}

export const feedbackTrackerService = new FeedbackTrackerService()
