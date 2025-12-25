/**
 * Learning Service
 *
 * Learns from user corrections and patterns to improve future suggestions.
 * Tracks approvals, rejections, and edits to build confidence-based patterns
 * that can enable auto-approval and format suggestions.
 */

import { EventEmitter } from 'events'
import { databaseService } from './database.service'
import { randomUUID } from 'crypto'

export type PatternType =
  | 'story_format'
  | 'naming_convention'
  | 'rejection_pattern'
  | 'approval_pattern'
  | 'edit_correction'

export interface LearnedPattern {
  id: string
  projectId: string
  patternType: PatternType
  patternData: {
    original?: string
    corrected?: string
    keywords?: string[]
    context?: Record<string, unknown>
  }
  confidence: number
  usageCount: number
  successCount: number
  failureCount: number
  lastUsed?: string
  createdAt: string
  updatedAt: string
}

export interface LearningEvent {
  type: 'approval' | 'rejection' | 'edit' | 'usage'
  patternId?: string
  projectId: string
  data: Record<string, unknown>
}

class LearningService extends EventEmitter {
  private readonly AUTO_APPROVE_THRESHOLD = 0.85
  private readonly MIN_USAGE_FOR_AUTO_APPROVE = 3
  private readonly CONFIDENCE_BOOST = 0.1
  private readonly CONFIDENCE_DECAY = 0.15
  private readonly LOW_CONFIDENCE_THRESHOLD = 0.3

  constructor() {
    super()
    this.initTable()
  }

  /**
   * Initialize the learned_patterns table in the database
   */
  private initTable(): void {
    const db = databaseService.getDb()

    // Create learned_patterns table
    db.exec(`
      CREATE TABLE IF NOT EXISTS learned_patterns (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        pattern_type TEXT NOT NULL,
        pattern_data TEXT NOT NULL,
        confidence REAL DEFAULT 0.5,
        usage_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0,
        last_used TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)

    // Create indexes for better query performance
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_learned_patterns_project ON learned_patterns(project_id);
      CREATE INDEX IF NOT EXISTS idx_learned_patterns_type ON learned_patterns(pattern_type);
      CREATE INDEX IF NOT EXISTS idx_learned_patterns_confidence ON learned_patterns(confidence);
    `)
  }

  /**
   * Learn from user approval
   */
  learnFromApproval(
    projectId: string,
    itemType: string,
    title: string,
    metadata: Record<string, unknown> = {}
  ): void {
    const keywords = this.extractKeywords(title)

    // Look for existing similar patterns
    const existingPatterns = this.findSimilarPatterns(projectId, 'approval_pattern', keywords)

    if (existingPatterns.length > 0) {
      // Update existing pattern
      const pattern = existingPatterns[0]
      this.updatePatternConfidence(pattern.id, true)

      this.emit('pattern-updated', {
        patternId: pattern.id,
        type: 'approval',
        confidence: pattern.confidence + this.CONFIDENCE_BOOST
      })
    } else {
      // Create new approval pattern
      const patternId = this.createPattern({
        projectId,
        patternType: 'approval_pattern',
        patternData: {
          original: title,
          keywords,
          context: {
            itemType,
            ...metadata
          }
        }
      })

      this.emit('pattern-learned', {
        patternId,
        type: 'approval',
        projectId,
        itemType
      })
    }

    const event: LearningEvent = {
      type: 'approval',
      projectId,
      data: { itemType, title, metadata }
    }

    this.emit('learning-event', event)
  }

  /**
   * Learn from user rejection
   */
  learnFromRejection(
    projectId: string,
    itemType: string,
    title: string,
    reason?: string
  ): void {
    const keywords = this.extractKeywords(title)

    // Look for existing similar approval patterns and decrease their confidence
    const approvalPatterns = this.findSimilarPatterns(projectId, 'approval_pattern', keywords)
    for (const pattern of approvalPatterns) {
      this.updatePatternConfidence(pattern.id, false)
    }

    // Create or update rejection pattern
    const existingRejections = this.findSimilarPatterns(projectId, 'rejection_pattern', keywords)

    if (existingRejections.length > 0) {
      const pattern = existingRejections[0]
      this.updatePatternConfidence(pattern.id, true)
    } else {
      const patternId = this.createPattern({
        projectId,
        patternType: 'rejection_pattern',
        patternData: {
          original: title,
          keywords,
          context: {
            itemType,
            reason
          }
        }
      })

      this.emit('pattern-learned', {
        patternId,
        type: 'rejection',
        projectId,
        itemType
      })
    }

    const event: LearningEvent = {
      type: 'rejection',
      projectId,
      data: { itemType, title, reason }
    }

    this.emit('learning-event', event)
  }

  /**
   * Learn from user edit/correction
   */
  learnFromEdit(
    projectId: string,
    itemType: string,
    original: string,
    corrected: string
  ): void {
    const originalKeywords = this.extractKeywords(original)
    const correctedKeywords = this.extractKeywords(corrected)

    // Create edit correction pattern
    const patternId = this.createPattern({
      projectId,
      patternType: 'edit_correction',
      patternData: {
        original,
        corrected,
        keywords: correctedKeywords,
        context: {
          itemType,
          originalKeywords
        }
      }
    })

    // Look for format patterns
    const formatDifferences = this.detectFormatDifferences(original, corrected)
    if (formatDifferences) {
      this.createOrUpdateFormatPattern(projectId, itemType, formatDifferences)
    }

    this.emit('pattern-learned', {
      patternId,
      type: 'edit',
      projectId,
      itemType
    })

    const event: LearningEvent = {
      type: 'edit',
      projectId,
      data: { itemType, original, corrected }
    }

    this.emit('learning-event', event)
  }

  /**
   * Get all patterns for a project, optionally filtered by type
   */
  getPatterns(projectId: string, type?: PatternType): LearnedPattern[] {
    const db = databaseService.getDb()

    let query = 'SELECT * FROM learned_patterns WHERE project_id = ?'
    const params: (string | PatternType)[] = [projectId]

    if (type) {
      query += ' AND pattern_type = ?'
      params.push(type)
    }

    query += ' ORDER BY updated_at DESC'

    const rows = db.prepare(query).all(...params) as Array<{
      id: string
      project_id: string
      pattern_type: PatternType
      pattern_data: string
      confidence: number
      usage_count: number
      success_count: number
      failure_count: number
      last_used: string | null
      created_at: string
      updated_at: string
    }>

    return rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      patternType: row.pattern_type,
      patternData: JSON.parse(row.pattern_data),
      confidence: row.confidence,
      usageCount: row.usage_count,
      successCount: row.success_count,
      failureCount: row.failure_count,
      lastUsed: row.last_used || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
  }

  /**
   * Get top patterns by confidence
   */
  getTopPatterns(projectId: string, limit: number = 10): LearnedPattern[] {
    const db = databaseService.getDb()

    const rows = db
      .prepare(
        `SELECT * FROM learned_patterns
         WHERE project_id = ?
         ORDER BY confidence DESC, usage_count DESC
         LIMIT ?`
      )
      .all(projectId, limit) as Array<{
      id: string
      project_id: string
      pattern_type: PatternType
      pattern_data: string
      confidence: number
      usage_count: number
      success_count: number
      failure_count: number
      last_used: string | null
      created_at: string
      updated_at: string
    }>

    return rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      patternType: row.pattern_type,
      patternData: JSON.parse(row.pattern_data),
      confidence: row.confidence,
      usageCount: row.usage_count,
      successCount: row.success_count,
      failureCount: row.failure_count,
      lastUsed: row.last_used || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
  }

  /**
   * Determine if an item should be auto-approved based on learned patterns
   */
  shouldAutoApprove(
    projectId: string,
    itemType: string,
    title: string
  ): {
    autoApprove: boolean
    confidence: number
    matchedPattern?: LearnedPattern
  } {
    const keywords = this.extractKeywords(title)

    // Check for rejection patterns first
    const rejectionPatterns = this.findSimilarPatterns(projectId, 'rejection_pattern', keywords)
    if (rejectionPatterns.length > 0 && rejectionPatterns[0].confidence > 0.6) {
      return {
        autoApprove: false,
        confidence: 0,
        matchedPattern: rejectionPatterns[0]
      }
    }

    // Check for approval patterns
    const approvalPatterns = this.findSimilarPatterns(projectId, 'approval_pattern', keywords)

    if (approvalPatterns.length > 0) {
      const pattern = approvalPatterns[0]

      // Auto-approve if confidence and usage meet thresholds
      const shouldApprove =
        pattern.confidence >= this.AUTO_APPROVE_THRESHOLD &&
        pattern.usageCount >= this.MIN_USAGE_FOR_AUTO_APPROVE

      if (shouldApprove) {
        // Record usage
        this.recordPatternUsage(pattern.id)

        this.emit('auto-approve-triggered', {
          patternId: pattern.id,
          projectId,
          itemType,
          title,
          confidence: pattern.confidence
        })
      }

      return {
        autoApprove: shouldApprove,
        confidence: pattern.confidence,
        matchedPattern: pattern
      }
    }

    return {
      autoApprove: false,
      confidence: 0
    }
  }

  /**
   * Get suggested format based on learned patterns
   */
  getSuggestedFormat(projectId: string, itemType: string): string | null {
    const db = databaseService.getDb()

    // Find format patterns with high confidence
    const rows = db
      .prepare(
        `SELECT * FROM learned_patterns
         WHERE project_id = ? AND pattern_type = 'story_format'
         ORDER BY confidence DESC, usage_count DESC
         LIMIT 1`
      )
      .all(projectId) as Array<{
      pattern_data: string
      confidence: number
    }>

    if (rows.length === 0 || rows[0].confidence < 0.6) {
      return null
    }

    const patternData = JSON.parse(rows[0].pattern_data)
    return patternData.corrected || patternData.original || null
  }

  /**
   * Update pattern confidence based on success/failure
   */
  updatePatternConfidence(patternId: string, success: boolean): void {
    const db = databaseService.getDb()

    const pattern = db
      .prepare('SELECT * FROM learned_patterns WHERE id = ?')
      .get(patternId) as {
      confidence: number
      usage_count: number
      success_count: number
      failure_count: number
    } | undefined

    if (!pattern) {
      console.warn(`Pattern ${patternId} not found`)
      return
    }

    const newSuccessCount = success ? pattern.success_count + 1 : pattern.success_count
    const newFailureCount = success ? pattern.failure_count : pattern.failure_count + 1
    const newUsageCount = pattern.usage_count + 1

    // Calculate new confidence: boost on success, decay on failure
    let newConfidence = pattern.confidence
    if (success) {
      newConfidence = Math.min(1.0, newConfidence + this.CONFIDENCE_BOOST)
    } else {
      newConfidence = Math.max(0.0, newConfidence - this.CONFIDENCE_DECAY)
    }

    databaseService.withWriteLockRetry(() => {
      db.prepare(
        `UPDATE learned_patterns
         SET confidence = ?,
             usage_count = ?,
             success_count = ?,
             failure_count = ?,
             updated_at = ?
         WHERE id = ?`
      ).run(newConfidence, newUsageCount, newSuccessCount, newFailureCount, new Date().toISOString(), patternId)
    })

    this.emit('pattern-updated', {
      patternId,
      confidence: newConfidence,
      success
    })
  }

  /**
   * Remove patterns below confidence threshold
   */
  cleanupLowConfidencePatterns(projectId: string, threshold?: number): number {
    const db = databaseService.getDb()
    const cleanupThreshold = threshold ?? this.LOW_CONFIDENCE_THRESHOLD

    const result = databaseService.withWriteLock(() => {
      return db
        .prepare(
          'DELETE FROM learned_patterns WHERE project_id = ? AND confidence < ? AND usage_count > 5'
        )
        .run(projectId, cleanupThreshold)
    })

    const deletedCount = result.changes

    if (deletedCount > 0) {
      this.emit('patterns-cleaned', {
        projectId,
        deletedCount,
        threshold: cleanupThreshold
      })
    }

    return deletedCount
  }

  /**
   * Extract keywords from text for pattern matching
   */
  extractKeywords(text: string): string[] {
    // Remove common words and extract meaningful keywords
    const commonWords = new Set([
      'a', 'an', 'and', 'as', 'at', 'be', 'by', 'for', 'from', 'in', 'is',
      'it', 'of', 'on', 'or', 'that', 'the', 'to', 'with', 'user', 'can', 'should'
    ])

    return text
      .toLowerCase()
      .split(/[\s,.:;!?()[\]{}]+/)
      .filter((word) => word.length > 2 && !commonWords.has(word))
      .slice(0, 10) // Limit to 10 keywords
  }

  /**
   * Create a new pattern
   */
  private createPattern(data: {
    projectId: string
    patternType: PatternType
    patternData: LearnedPattern['patternData']
    confidence?: number
  }): string {
    const db = databaseService.getDb()
    const id = `pattern_${Date.now()}_${randomUUID().substring(0, 8)}`
    const now = new Date().toISOString()

    databaseService.withWriteLockRetry(() => {
      db.prepare(
        `INSERT INTO learned_patterns (
          id, project_id, pattern_type, pattern_data, confidence,
          usage_count, success_count, failure_count,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?, ?)`
      ).run(
        id,
        data.projectId,
        data.patternType,
        JSON.stringify(data.patternData),
        data.confidence ?? 0.5,
        now,
        now
      )
    })

    return id
  }

  /**
   * Find similar patterns based on keyword overlap
   */
  private findSimilarPatterns(
    projectId: string,
    patternType: PatternType,
    keywords: string[]
  ): LearnedPattern[] {
    const allPatterns = this.getPatterns(projectId, patternType)

    // Calculate similarity score for each pattern
    const scoredPatterns = allPatterns.map((pattern) => {
      const patternKeywords = pattern.patternData.keywords || []
      const overlap = keywords.filter((kw) => patternKeywords.includes(kw)).length
      const similarity = overlap / Math.max(keywords.length, patternKeywords.length)

      return {
        pattern,
        similarity
      }
    })

    // Filter patterns with at least 30% similarity and sort by similarity * confidence
    return scoredPatterns
      .filter((sp) => sp.similarity >= 0.3)
      .sort((a, b) => {
        const scoreA = a.similarity * a.pattern.confidence
        const scoreB = b.similarity * b.pattern.confidence
        return scoreB - scoreA
      })
      .map((sp) => sp.pattern)
  }

  /**
   * Detect format differences between original and corrected text
   */
  private detectFormatDifferences(
    original: string,
    corrected: string
  ): Record<string, unknown> | null {
    const differences: Record<string, unknown> = {}

    // Check for casing changes
    if (original.toLowerCase() === corrected.toLowerCase()) {
      differences.casingChanged = true
      differences.newCasing = this.detectCasingStyle(corrected)
    }

    // Check for prefix/suffix additions
    const originalWords = original.split(' ')
    const correctedWords = corrected.split(' ')

    if (correctedWords.length > originalWords.length) {
      const prefix = correctedWords[0]
      const suffix = correctedWords[correctedWords.length - 1]

      if (!originalWords.includes(prefix)) {
        differences.prefix = prefix
      }
      if (!originalWords.includes(suffix)) {
        differences.suffix = suffix
      }
    }

    // Check for format pattern (e.g., "As a... I want... So that...")
    const asAPattern = /as a .* i want .* so that/i
    const givenWhenThen = /given .* when .* then/i

    if (asAPattern.test(corrected)) {
      differences.format = 'user-story-template'
    } else if (givenWhenThen.test(corrected)) {
      differences.format = 'given-when-then'
    }

    return Object.keys(differences).length > 0 ? differences : null
  }

  /**
   * Detect casing style (Title Case, UPPER CASE, lower case, etc.)
   */
  private detectCasingStyle(text: string): string {
    if (text === text.toUpperCase()) return 'UPPER_CASE'
    if (text === text.toLowerCase()) return 'lower_case'

    const words = text.split(' ')
    const titleCased = words.every(
      (word) => word.length === 0 || word[0] === word[0].toUpperCase()
    )

    if (titleCased) return 'Title Case'

    return 'Mixed Case'
  }

  /**
   * Create or update a format pattern
   */
  private createOrUpdateFormatPattern(
    projectId: string,
    itemType: string,
    formatDifferences: Record<string, unknown>
  ): void {
    const db = databaseService.getDb()

    // Check for existing format pattern
    const existingPatterns = db
      .prepare(
        'SELECT * FROM learned_patterns WHERE project_id = ? AND pattern_type = ?'
      )
      .all(projectId, 'story_format') as Array<{
      id: string
      pattern_data: string
    }>

    for (const row of existingPatterns) {
      const patternData = JSON.parse(row.pattern_data)

      // If similar format exists, update it
      if (JSON.stringify(patternData.context) === JSON.stringify(formatDifferences)) {
        this.updatePatternConfidence(row.id, true)
        return
      }
    }

    // Create new format pattern
    this.createPattern({
      projectId,
      patternType: 'story_format',
      patternData: {
        context: {
          itemType,
          ...formatDifferences
        }
      }
    })
  }

  /**
   * Record pattern usage
   */
  private recordPatternUsage(patternId: string): void {
    const db = databaseService.getDb()

    databaseService.withWriteLockRetry(() => {
      db.prepare(
        `UPDATE learned_patterns
         SET usage_count = usage_count + 1,
             last_used = ?
         WHERE id = ?`
      ).run(new Date().toISOString(), patternId)
    })

    const event: LearningEvent = {
      type: 'usage',
      patternId,
      projectId: '', // Not available in this context
      data: {}
    }

    this.emit('learning-event', event)
  }

  /**
   * Get learning statistics for a project
   */
  getProjectStats(projectId: string): {
    totalPatterns: number
    highConfidencePatterns: number
    autoApproveEligiblePatterns: number
    averageConfidence: number
    patternsByType: Record<PatternType, number>
  } {
    const db = databaseService.getDb()

    const totalCount = db
      .prepare('SELECT COUNT(*) as count FROM learned_patterns WHERE project_id = ?')
      .get(projectId) as { count: number }

    const highConfidenceCount = db
      .prepare(
        'SELECT COUNT(*) as count FROM learned_patterns WHERE project_id = ? AND confidence >= 0.7'
      )
      .get(projectId) as { count: number }

    const autoApproveCount = db
      .prepare(
        `SELECT COUNT(*) as count FROM learned_patterns
         WHERE project_id = ? AND confidence >= ? AND usage_count >= ?`
      )
      .get(projectId, this.AUTO_APPROVE_THRESHOLD, this.MIN_USAGE_FOR_AUTO_APPROVE) as { count: number }

    const avgConfidence = db
      .prepare('SELECT AVG(confidence) as avg FROM learned_patterns WHERE project_id = ?')
      .get(projectId) as { avg: number | null }

    const typeCounts = db
      .prepare(
        'SELECT pattern_type, COUNT(*) as count FROM learned_patterns WHERE project_id = ? GROUP BY pattern_type'
      )
      .all(projectId) as Array<{ pattern_type: PatternType; count: number }>

    const patternsByType: Record<string, number> = {}
    for (const { pattern_type, count } of typeCounts) {
      patternsByType[pattern_type] = count
    }

    return {
      totalPatterns: totalCount.count,
      highConfidencePatterns: highConfidenceCount.count,
      autoApproveEligiblePatterns: autoApproveCount.count,
      averageConfidence: avgConfidence.avg ?? 0,
      patternsByType: patternsByType as Record<PatternType, number>
    }
  }
}

export const learningService = new LearningService()
