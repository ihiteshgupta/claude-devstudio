import { EventEmitter } from 'events'
import { databaseService } from './database.service'
import type { AgentType } from '@shared/types'

// Conflict types
export type ConflictType =
  | 'security_violation' // Security vs Developer
  | 'requirement_change' // PO changed requirements mid-work
  | 'test_disagreement' // Tester vs Developer on bug validity
  | 'priority_conflict' // Multiple agents disagree on priority
  | 'approach_conflict' // Different technical approaches suggested

export type ConflictSeverity = 'low' | 'medium' | 'high' | 'critical'
export type ConflictStatus = 'open' | 'user_reviewing' | 'resolved' | 'dismissed'
export type ResolutionDecision = 'side_with_agent1' | 'side_with_agent2' | 'compromise' | 'escalate'

export interface AgentPosition {
  stance: string
  reasoning: string
  evidence?: string[]
  recommendation: string
}

export interface ConflictResolution {
  decision: ResolutionDecision
  explanation: string
  resolvedBy: string
  actionsTaken?: string[]
}

export interface AgentConflict {
  id: string
  projectId: string
  itemId: string
  itemType: 'story' | 'task' | 'roadmap' | 'code'
  conflictType: ConflictType
  agent1: AgentType
  agent1Position: AgentPosition
  agent2: AgentType
  agent2Position: AgentPosition
  severity: ConflictSeverity
  status: ConflictStatus
  resolution?: ConflictResolution
  createdAt: Date
  resolvedAt?: Date
}

export interface SuggestedResolution {
  decision: ResolutionDecision
  confidence: number // 0-1
  reasoning: string
  basedOnSimilarCases: number
}

// Conflict detection patterns
interface ConflictPattern {
  keywords: string[]
  type: ConflictType
  severityIndicators: {
    critical: string[]
    high: string[]
    medium: string[]
    low: string[]
  }
}

const CONFLICT_PATTERNS: ConflictPattern[] = [
  {
    keywords: [
      'security vulnerability',
      'insecure',
      'xss',
      'sql injection',
      'csrf',
      'unsafe',
      'exploit',
      'attack vector'
    ],
    type: 'security_violation',
    severityIndicators: {
      critical: ['critical vulnerability', 'exploit', 'remote code execution', 'rce'],
      high: ['high severity', 'data breach', 'authentication bypass', 'privilege escalation'],
      medium: ['medium severity', 'weak encryption', 'insecure default'],
      low: ['low severity', 'information disclosure', 'minor issue']
    }
  },
  {
    keywords: [
      'requirement changed',
      'specification changed',
      'no longer needed',
      'different approach',
      'scope change'
    ],
    type: 'requirement_change',
    severityIndicators: {
      critical: ['complete redesign', 'architecture change', 'major rework'],
      high: ['significant change', 'breaking change', 'incompatible'],
      medium: ['moderate change', 'partial rework'],
      low: ['minor change', 'small adjustment']
    }
  },
  {
    keywords: [
      'bug',
      'failing test',
      'unexpected behavior',
      'incorrect result',
      'test failure',
      'assertion failed'
    ],
    type: 'test_disagreement',
    severityIndicators: {
      critical: ['critical bug', 'data loss', 'system crash', 'complete failure'],
      high: ['major bug', 'incorrect output', 'functional failure'],
      medium: ['moderate bug', 'edge case', 'inconsistent behavior'],
      low: ['minor bug', 'cosmetic issue', 'rare occurrence']
    }
  },
  {
    keywords: [
      'priority',
      'should be',
      'more important',
      'urgent',
      'blocker',
      'critical priority'
    ],
    type: 'priority_conflict',
    severityIndicators: {
      critical: ['blocker', 'blocks release', 'showstopper'],
      high: ['high priority', 'urgent', 'asap'],
      medium: ['medium priority', 'should be higher'],
      low: ['low priority', 'nice to have']
    }
  },
  {
    keywords: [
      'instead use',
      'better approach',
      'alternative',
      'different pattern',
      'suggest using',
      'prefer'
    ],
    type: 'approach_conflict',
    severityIndicators: {
      critical: ['fundamentally flawed', 'unscalable', 'unmaintainable'],
      high: ['poor design', 'inefficient', 'technical debt'],
      medium: ['could be improved', 'suboptimal', 'better alternative'],
      low: ['minor improvement', 'stylistic preference']
    }
  }
]

class ConflictDetectionService extends EventEmitter {
  constructor() {
    super()
    this.initTables()
  }

  private initTables(): void {
    const db = databaseService.getDb()

    // Agent conflicts table
    db.exec(`
      CREATE TABLE IF NOT EXISTS agent_conflicts (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        item_type TEXT NOT NULL,
        conflict_type TEXT NOT NULL,
        agent1 TEXT NOT NULL,
        agent1_position TEXT NOT NULL,
        agent2 TEXT NOT NULL,
        agent2_position TEXT NOT NULL,
        severity TEXT DEFAULT 'medium',
        status TEXT DEFAULT 'open',
        resolution TEXT,
        resolved_by TEXT,
        created_at TEXT NOT NULL,
        resolved_at TEXT
      )
    `)

    // Create indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_conflicts_project ON agent_conflicts(project_id);
      CREATE INDEX IF NOT EXISTS idx_conflicts_status ON agent_conflicts(status);
      CREATE INDEX IF NOT EXISTS idx_conflicts_item ON agent_conflicts(item_id);
      CREATE INDEX IF NOT EXISTS idx_conflicts_type ON agent_conflicts(conflict_type);
      CREATE INDEX IF NOT EXISTS idx_conflicts_severity ON agent_conflicts(severity);
    `)
  }

  /**
   * Detect conflicts between two agent outputs
   */
  async detectConflict(params: {
    projectId: string
    itemId: string
    itemType: 'story' | 'task' | 'roadmap' | 'code'
    agent1: AgentType
    agent1Output: string
    agent2: AgentType
    agent2Output: string
  }): Promise<AgentConflict | null> {
    const { projectId, itemId, itemType, agent1, agent1Output, agent2, agent2Output } = params

    // Analyze outputs for conflicting patterns
    const conflict = this.analyzeForConflicts(
      agent1,
      agent1Output,
      agent2,
      agent2Output,
      itemType
    )

    if (!conflict) {
      return null
    }

    // Create conflict record
    const conflictRecord: AgentConflict = {
      id: `conflict_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      projectId,
      itemId,
      itemType,
      conflictType: conflict.type,
      agent1,
      agent1Position: conflict.agent1Position,
      agent2,
      agent2Position: conflict.agent2Position,
      severity: conflict.severity,
      status: 'open',
      createdAt: new Date()
    }

    // Save to database
    this.saveConflict(conflictRecord)

    // Emit event
    this.emit('conflict-detected', conflictRecord)

    return conflictRecord
  }

  /**
   * Analyze two outputs for conflicts using pattern matching
   */
  private analyzeForConflicts(
    agent1: AgentType,
    output1: string,
    agent2: AgentType,
    output2: string,
    itemType: string
  ): {
    type: ConflictType
    severity: ConflictSeverity
    agent1Position: AgentPosition
    agent2Position: AgentPosition
  } | null {
    const output1Lower = output1.toLowerCase()
    const output2Lower = output2.toLowerCase()

    // Check for special agent pair conflicts
    if (agent1 === 'security' && agent2 === 'developer') {
      const securityIssues = this.checkSecurityViolations(output2, output1)
      if (securityIssues.length > 0) {
        return {
          type: 'security_violation',
          severity: this.determineSeverityFromIssues(securityIssues),
          agent1Position: {
            stance: 'Security concerns identified',
            reasoning: output1,
            evidence: securityIssues,
            recommendation: 'Address security vulnerabilities before proceeding'
          },
          agent2Position: {
            stance: 'Implementation provided',
            reasoning: output2,
            evidence: [],
            recommendation: 'Code as written'
          }
        }
      }
    }

    // Check for product owner requirement changes
    if (agent1 === 'product-owner' && this.hasRequirementChange(output1, output2)) {
      return {
        type: 'requirement_change',
        severity: 'high',
        agent1Position: {
          stance: 'Requirements updated',
          reasoning: output1,
          evidence: this.extractRequirementChanges(output1),
          recommendation: 'Update implementation to match new requirements'
        },
        agent2Position: {
          stance: 'Original implementation',
          reasoning: output2,
          evidence: [],
          recommendation: 'Continue with current approach'
        }
      }
    }

    // Check for tester vs developer disagreements
    if (
      (agent1 === 'tester' && agent2 === 'developer') ||
      (agent1 === 'developer' && agent2 === 'tester')
    ) {
      const testIssues = this.extractTestDisagreements(output1, output2)
      if (testIssues.length > 0) {
        return {
          type: 'test_disagreement',
          severity: 'medium',
          agent1Position: {
            stance: agent1 === 'tester' ? 'Test failures found' : 'Implementation is correct',
            reasoning: output1,
            evidence: testIssues,
            recommendation:
              agent1 === 'tester' ? 'Fix failing tests' : 'Tests need to be updated'
          },
          agent2Position: {
            stance: agent2 === 'tester' ? 'Test failures found' : 'Implementation is correct',
            reasoning: output2,
            evidence: [],
            recommendation:
              agent2 === 'tester' ? 'Fix failing tests' : 'Tests need to be updated'
          }
        }
      }
    }

    // General pattern matching
    for (const pattern of CONFLICT_PATTERNS) {
      const matchesInOutput1 = pattern.keywords.some((keyword) => output1Lower.includes(keyword))
      const matchesInOutput2 = pattern.keywords.some((keyword) => output2Lower.includes(keyword))

      // Look for contradictory statements
      const hasContradiction = this.detectContradiction(output1Lower, output2Lower, pattern)

      if (hasContradiction && (matchesInOutput1 || matchesInOutput2)) {
        const severity = this.determineSeverity(output1 + output2, pattern)

        return {
          type: pattern.type,
          severity,
          agent1Position: {
            stance: this.extractStance(output1),
            reasoning: output1.substring(0, 500),
            evidence: this.extractEvidence(output1, pattern),
            recommendation: this.extractRecommendation(output1)
          },
          agent2Position: {
            stance: this.extractStance(output2),
            reasoning: output2.substring(0, 500),
            evidence: this.extractEvidence(output2, pattern),
            recommendation: this.extractRecommendation(output2)
          }
        }
      }
    }

    return null
  }

  /**
   * Check for security violations in code against security report
   */
  checkSecurityViolations(code: string, securityReport: string): string[] {
    const violations: string[] = []
    const codeLower = code.toLowerCase()
    const reportLower = securityReport.toLowerCase()

    // Common security issues
    const securityChecks = [
      { pattern: /eval\(/g, issue: 'Use of eval() - potential code injection' },
      { pattern: /innerHTML\s*=/g, issue: 'Direct innerHTML usage - XSS risk' },
      { pattern: /document\.write/g, issue: 'document.write() - XSS risk' },
      { pattern: /sql.*\+.*['"`]/gi, issue: 'String concatenation in SQL - injection risk' },
      { pattern: /password.*=.*['"`][^'"`]+['"`]/gi, issue: 'Hardcoded password detected' },
      { pattern: /api[_-]?key.*=.*['"`][^'"`]+['"`]/gi, issue: 'Hardcoded API key detected' }
    ]

    for (const check of securityChecks) {
      if (check.pattern.test(code) && reportLower.includes(check.issue.toLowerCase())) {
        violations.push(check.issue)
      }
    }

    return violations
  }

  /**
   * Detect if there's a requirement change
   */
  private hasRequirementChange(poOutput: string, devOutput: string): boolean {
    const changeIndicators = [
      'actually',
      'instead',
      'changed',
      'updated requirements',
      'no longer',
      'different approach'
    ]
    const poLower = poOutput.toLowerCase()
    return changeIndicators.some((indicator) => poLower.includes(indicator))
  }

  /**
   * Extract requirement changes from text
   */
  private extractRequirementChanges(text: string): string[] {
    const changes: string[] = []
    const lines = text.split('\n')

    for (const line of lines) {
      if (
        line.toLowerCase().includes('change') ||
        line.toLowerCase().includes('instead') ||
        line.toLowerCase().includes('update')
      ) {
        changes.push(line.trim())
      }
    }

    return changes.slice(0, 5)
  }

  /**
   * Extract test disagreements
   */
  private extractTestDisagreements(output1: string, output2: string): string[] {
    const disagreements: string[] = []
    const testKeywords = ['fail', 'error', 'incorrect', 'unexpected', 'bug']

    for (const keyword of testKeywords) {
      if (output1.toLowerCase().includes(keyword) || output2.toLowerCase().includes(keyword)) {
        disagreements.push(`Test ${keyword} mentioned`)
      }
    }

    return disagreements
  }

  /**
   * Detect contradiction between outputs
   */
  private detectContradiction(output1: string, output2: string, pattern: ConflictPattern): boolean {
    // Look for negation patterns
    const negationWords = ['not', "don't", 'never', 'avoid', 'incorrect', 'wrong', 'disagree']

    const hasNegationIn1 = negationWords.some((word) => output1.includes(word))
    const hasNegationIn2 = negationWords.some((word) => output2.includes(word))
    const bothMentionTopic = pattern.keywords.some(
      (kw) => output1.includes(kw) && output2.includes(kw)
    )

    return bothMentionTopic && (hasNegationIn1 || hasNegationIn2)
  }

  /**
   * Determine severity from text and pattern
   */
  private determineSeverity(text: string, pattern: ConflictPattern): ConflictSeverity {
    const textLower = text.toLowerCase()

    for (const indicator of pattern.severityIndicators.critical) {
      if (textLower.includes(indicator.toLowerCase())) return 'critical'
    }
    for (const indicator of pattern.severityIndicators.high) {
      if (textLower.includes(indicator.toLowerCase())) return 'high'
    }
    for (const indicator of pattern.severityIndicators.medium) {
      if (textLower.includes(indicator.toLowerCase())) return 'medium'
    }

    return 'low'
  }

  /**
   * Determine severity from security issues
   */
  private determineSeverityFromIssues(issues: string[]): ConflictSeverity {
    const criticalPatterns = ['injection', 'code execution', 'hardcoded password']
    const highPatterns = ['xss', 'api key', 'eval']

    for (const issue of issues) {
      const issueLower = issue.toLowerCase()
      if (criticalPatterns.some((p) => issueLower.includes(p))) return 'critical'
      if (highPatterns.some((p) => issueLower.includes(p))) return 'high'
    }

    return 'medium'
  }

  /**
   * Extract stance from output
   */
  private extractStance(output: string): string {
    const firstSentence = output.split('.')[0]
    return firstSentence.substring(0, 200)
  }

  /**
   * Extract evidence from output
   */
  private extractEvidence(output: string, pattern: ConflictPattern): string[] {
    const evidence: string[] = []
    const lines = output.split('\n')

    for (const line of lines) {
      const lineLower = line.toLowerCase()
      if (pattern.keywords.some((kw) => lineLower.includes(kw))) {
        evidence.push(line.trim())
        if (evidence.length >= 3) break
      }
    }

    return evidence
  }

  /**
   * Extract recommendation from output
   */
  private extractRecommendation(output: string): string {
    const recommendationMarkers = ['recommend', 'suggest', 'should', 'must', 'need to']
    const lines = output.split('\n')

    for (const line of lines) {
      const lineLower = line.toLowerCase()
      if (recommendationMarkers.some((marker) => lineLower.includes(marker))) {
        return line.trim().substring(0, 300)
      }
    }

    return 'Review and decide on appropriate action'
  }

  /**
   * Save conflict to database
   */
  private saveConflict(conflict: AgentConflict): void {
    const db = databaseService.getDb()

    databaseService.withWriteLockRetry(() => {
      db.prepare(
        `INSERT INTO agent_conflicts (
          id, project_id, item_id, item_type, conflict_type,
          agent1, agent1_position, agent2, agent2_position,
          severity, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        conflict.id,
        conflict.projectId,
        conflict.itemId,
        conflict.itemType,
        conflict.conflictType,
        conflict.agent1,
        JSON.stringify(conflict.agent1Position),
        conflict.agent2,
        JSON.stringify(conflict.agent2Position),
        conflict.severity,
        conflict.status,
        conflict.createdAt.toISOString()
      )
    })
  }

  /**
   * Report a conflict manually
   */
  reportConflict(params: {
    projectId: string
    itemId: string
    itemType: 'story' | 'task' | 'roadmap' | 'code'
    conflictType: ConflictType
    agent1: AgentType
    agent1Position: AgentPosition
    agent2: AgentType
    agent2Position: AgentPosition
    severity?: ConflictSeverity
  }): AgentConflict {
    const conflict: AgentConflict = {
      id: `conflict_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      projectId: params.projectId,
      itemId: params.itemId,
      itemType: params.itemType,
      conflictType: params.conflictType,
      agent1: params.agent1,
      agent1Position: params.agent1Position,
      agent2: params.agent2,
      agent2Position: params.agent2Position,
      severity: params.severity || 'medium',
      status: 'open',
      createdAt: new Date()
    }

    this.saveConflict(conflict)
    this.emit('conflict-detected', conflict)

    return conflict
  }

  /**
   * Get open conflicts for a project
   */
  getOpenConflicts(projectId: string): AgentConflict[] {
    const db = databaseService.getDb()

    const rows = db
      .prepare(
        `SELECT * FROM agent_conflicts
         WHERE project_id = ? AND status = 'open'
         ORDER BY created_at DESC`
      )
      .all(projectId) as Array<{
      id: string
      project_id: string
      item_id: string
      item_type: string
      conflict_type: string
      agent1: string
      agent1_position: string
      agent2: string
      agent2_position: string
      severity: string
      status: string
      resolution: string | null
      resolved_by: string | null
      created_at: string
      resolved_at: string | null
    }>

    return rows.map((row) => this.mapRowToConflict(row))
  }

  /**
   * Resolve a conflict
   */
  resolveConflict(conflictId: string, resolution: ConflictResolution): void {
    const db = databaseService.getDb()
    const now = new Date().toISOString()

    databaseService.withWriteLockRetry(() => {
      db.prepare(
        `UPDATE agent_conflicts
         SET status = 'resolved', resolution = ?, resolved_by = ?, resolved_at = ?
         WHERE id = ?`
      ).run(JSON.stringify(resolution), resolution.resolvedBy, now, conflictId)
    })

    const conflict = this.getConflictById(conflictId)
    if (conflict) {
      this.emit('conflict-resolved', conflict)
    }
  }

  /**
   * Dismiss a conflict
   */
  dismissConflict(conflictId: string, reason: string): void {
    const db = databaseService.getDb()
    const now = new Date().toISOString()

    const resolution: ConflictResolution = {
      decision: 'escalate',
      explanation: `Dismissed: ${reason}`,
      resolvedBy: 'user'
    }

    databaseService.withWriteLockRetry(() => {
      db.prepare(
        `UPDATE agent_conflicts
         SET status = 'dismissed', resolution = ?, resolved_at = ?
         WHERE id = ?`
      ).run(JSON.stringify(resolution), now, conflictId)
    })

    const conflict = this.getConflictById(conflictId)
    if (conflict) {
      this.emit('conflict-dismissed', conflict)
    }
  }

  /**
   * Get conflicts for a specific item
   */
  getItemConflicts(itemId: string): AgentConflict[] {
    const db = databaseService.getDb()

    const rows = db
      .prepare(
        `SELECT * FROM agent_conflicts
         WHERE item_id = ?
         ORDER BY created_at DESC`
      )
      .all(itemId) as Array<{
      id: string
      project_id: string
      item_id: string
      item_type: string
      conflict_type: string
      agent1: string
      agent1_position: string
      agent2: string
      agent2_position: string
      severity: string
      status: string
      resolution: string | null
      resolved_by: string | null
      created_at: string
      resolved_at: string | null
    }>

    return rows.map((row) => this.mapRowToConflict(row))
  }

  /**
   * Suggest resolution based on past decisions
   */
  async suggestResolution(conflictId: string): Promise<SuggestedResolution | null> {
    const conflict = this.getConflictById(conflictId)
    if (!conflict) return null

    const db = databaseService.getDb()

    // Find similar past conflicts that were resolved
    const similarConflicts = db
      .prepare(
        `SELECT * FROM agent_conflicts
         WHERE conflict_type = ?
         AND status = 'resolved'
         AND resolution IS NOT NULL
         ORDER BY created_at DESC
         LIMIT 10`
      )
      .all(conflict.conflictType) as Array<{
      resolution: string
      agent1: string
      agent2: string
    }>

    if (similarConflicts.length === 0) {
      return null
    }

    // Analyze past resolutions
    const decisions: { [key: string]: number } = {}
    for (const similar of similarConflicts) {
      const resolution = JSON.parse(similar.resolution) as ConflictResolution
      decisions[resolution.decision] = (decisions[resolution.decision] || 0) + 1
    }

    // Find most common decision
    const mostCommon = Object.entries(decisions).sort((a, b) => b[1] - a[1])[0]
    const confidence = mostCommon[1] / similarConflicts.length

    return {
      decision: mostCommon[0] as ResolutionDecision,
      confidence,
      reasoning: `Based on ${similarConflicts.length} similar past conflicts, ${mostCommon[0]} was chosen ${mostCommon[1]} times`,
      basedOnSimilarCases: similarConflicts.length
    }
  }

  /**
   * Get conflict by ID
   */
  private getConflictById(conflictId: string): AgentConflict | null {
    const db = databaseService.getDb()

    const row = db
      .prepare('SELECT * FROM agent_conflicts WHERE id = ?')
      .get(conflictId) as {
      id: string
      project_id: string
      item_id: string
      item_type: string
      conflict_type: string
      agent1: string
      agent1_position: string
      agent2: string
      agent2_position: string
      severity: string
      status: string
      resolution: string | null
      resolved_by: string | null
      created_at: string
      resolved_at: string | null
    } | undefined

    return row ? this.mapRowToConflict(row) : null
  }

  /**
   * Map database row to AgentConflict
   */
  private mapRowToConflict(row: {
    id: string
    project_id: string
    item_id: string
    item_type: string
    conflict_type: string
    agent1: string
    agent1_position: string
    agent2: string
    agent2_position: string
    severity: string
    status: string
    resolution: string | null
    resolved_by: string | null
    created_at: string
    resolved_at: string | null
  }): AgentConflict {
    return {
      id: row.id,
      projectId: row.project_id,
      itemId: row.item_id,
      itemType: row.item_type as 'story' | 'task' | 'roadmap' | 'code',
      conflictType: row.conflict_type as ConflictType,
      agent1: row.agent1 as AgentType,
      agent1Position: JSON.parse(row.agent1_position),
      agent2: row.agent2 as AgentType,
      agent2Position: JSON.parse(row.agent2_position),
      severity: row.severity as ConflictSeverity,
      status: row.status as ConflictStatus,
      resolution: row.resolution ? JSON.parse(row.resolution) : undefined,
      createdAt: new Date(row.created_at),
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined
    }
  }
}

export const conflictDetectionService = new ConflictDetectionService()
