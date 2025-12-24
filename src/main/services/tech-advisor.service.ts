import { EventEmitter } from 'events'
import { databaseService } from './database.service'
import { claudeService } from './claude.service'
import type {
  TechChoice,
  TechOption,
  TechCategory,
  TechChoiceStatus
} from '@shared/types'

interface AnalyzeRequirementInput {
  projectId: string
  taskId?: string
  category: TechCategory
  question: string
  context?: string
  projectPath: string
}

class TechAdvisorService extends EventEmitter {
  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `tech_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * List all tech choices for a project
   */
  listChoices(projectId: string, status?: TechChoiceStatus): TechChoice[] {
    const db = databaseService.getDb()

    let query = 'SELECT * FROM tech_choices WHERE project_id = ?'
    const params: string[] = [projectId]

    if (status) {
      query += ' AND status = ?'
      params.push(status)
    }

    query += ' ORDER BY created_at DESC'

    const rows = db.prepare(query).all(...params) as TechChoiceRow[]
    return rows.map(this.rowToChoice)
  }

  /**
   * Get a single tech choice by ID
   */
  getChoice(id: string): TechChoice | null {
    const db = databaseService.getDb()
    const row = db.prepare('SELECT * FROM tech_choices WHERE id = ?').get(id) as TechChoiceRow | undefined
    return row ? this.rowToChoice(row) : null
  }

  /**
   * Analyze requirement and generate technology options
   */
  async analyzeRequirement(input: AnalyzeRequirementInput): Promise<TechChoice> {
    const db = databaseService.getDb()
    const now = new Date().toISOString()
    const id = this.generateId()

    // Create placeholder entry
    db.prepare(`
      INSERT INTO tech_choices (
        id, project_id, task_id, category, question, context,
        options, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.projectId,
      input.taskId || null,
      input.category,
      input.question,
      input.context || null,
      '[]',
      'pending',
      now,
      now
    )

    this.emit('analysis-started', id)

    try {
      // Generate options using Claude
      const options = await this.generateOptions(input)

      // Update with options
      db.prepare(`
        UPDATE tech_choices
        SET options = ?, updated_at = ?
        WHERE id = ?
      `).run(JSON.stringify(options), new Date().toISOString(), id)

      const choice = this.getChoice(id)!
      this.emit('analysis-complete', choice)
      return choice

    } catch (error) {
      // Mark as failed
      db.prepare('DELETE FROM tech_choices WHERE id = ?').run(id)
      throw error
    }
  }

  /**
   * Generate technology options using Claude CLI
   */
  private async generateOptions(input: AnalyzeRequirementInput): Promise<TechOption[]> {
    const prompt = this.buildAnalysisPrompt(input)

    return new Promise((resolve, reject) => {
      const sessionId = `tech_${Date.now()}`
      let output = ''
      let completed = false

      const handleStream = (data: { sessionId: string; content: string }): void => {
        if (data.sessionId === sessionId) {
          output += data.content
        }
      }

      const handleComplete = (data: { sessionId: string; content: string }): void => {
        if (data.sessionId === sessionId && !completed) {
          completed = true
          cleanup()
          try {
            const options = this.parseOptionsFromOutput(data.content || output)
            resolve(options)
          } catch (e) {
            reject(e)
          }
        }
      }

      const handleError = (data: { sessionId: string; error: string }): void => {
        if (data.sessionId === sessionId && !completed) {
          completed = true
          cleanup()
          reject(new Error(data.error))
        }
      }

      const cleanup = (): void => {
        claudeService.removeListener('stream', handleStream)
        claudeService.removeListener('complete', handleComplete)
        claudeService.removeListener('error', handleError)
      }

      claudeService.on('stream', handleStream)
      claudeService.on('complete', handleComplete)
      claudeService.on('error', handleError)

      claudeService
        .sendMessage({
          sessionId,
          message: prompt,
          projectPath: input.projectPath,
          agentType: 'developer'
        })
        .catch((error) => {
          if (!completed) {
            completed = true
            cleanup()
            reject(error)
          }
        })
    })
  }

  /**
   * Build prompt for technology analysis
   */
  private buildAnalysisPrompt(input: AnalyzeRequirementInput): string {
    return `You are a technology advisor. Analyze the following requirement and provide 2-3 technology options.

Category: ${input.category}
Question: ${input.question}
${input.context ? `\nContext:\n${input.context}` : ''}

For each option, provide the analysis in this EXACT format (use exactly these markers):

---OPTION---
NAME: [Technology name]
DESCRIPTION: [Brief description of the technology]
PROS:
- [Pro 1]
- [Pro 2]
- [Pro 3]
CONS:
- [Con 1]
- [Con 2]
LEARNING_CURVE: [low|medium|high]
COMMUNITY: [small|medium|large]
RECOMMENDED: [true|false]
SETUP_TIME: [e.g., "1-2 hours", "1 day"]
---END---

Requirements:
1. Provide exactly 2-3 options
2. Mark only ONE option as RECOMMENDED: true
3. Be specific about pros and cons
4. Consider the project context if provided
5. Include modern, well-maintained options only`
  }

  /**
   * Parse options from Claude output
   */
  private parseOptionsFromOutput(output: string): TechOption[] {
    const options: TechOption[] = []
    const optionBlocks = output.split('---OPTION---').slice(1)

    for (const block of optionBlocks) {
      const nameMatch = block.match(/NAME:\s*(.+)/i)
      const descMatch = block.match(/DESCRIPTION:\s*(.+)/i)
      const prosMatch = block.match(/PROS:\s*([\s\S]+?)(?=CONS:|$)/i)
      const consMatch = block.match(/CONS:\s*([\s\S]+?)(?=LEARNING_CURVE:|$)/i)
      const learningMatch = block.match(/LEARNING_CURVE:\s*(\w+)/i)
      const communityMatch = block.match(/COMMUNITY:\s*(\w+)/i)
      const recommendedMatch = block.match(/RECOMMENDED:\s*(\w+)/i)
      const setupMatch = block.match(/SETUP_TIME:\s*(.+)/i)

      if (nameMatch) {
        const pros = this.parseListItems(prosMatch?.[1] || '')
        const cons = this.parseListItems(consMatch?.[1] || '')

        options.push({
          name: nameMatch[1].trim(),
          description: descMatch?.[1]?.trim() || '',
          pros,
          cons,
          learningCurve: this.parseLearningCurve(learningMatch?.[1]),
          communitySupport: this.parseCommunity(communityMatch?.[1]),
          isRecommended: recommendedMatch?.[1]?.toLowerCase() === 'true',
          estimatedSetupTime: setupMatch?.[1]?.trim()
        })
      }
    }

    // Ensure at least one recommendation
    if (options.length > 0 && !options.some(o => o.isRecommended)) {
      options[0].isRecommended = true
    }

    return options
  }

  /**
   * Parse list items from text
   */
  private parseListItems(text: string): string[] {
    return text
      .split('\n')
      .map(line => line.replace(/^[-*•]\s*/, '').trim())
      .filter(line => line.length > 0)
  }

  /**
   * Parse learning curve value
   */
  private parseLearningCurve(value?: string): 'low' | 'medium' | 'high' {
    const normalized = value?.toLowerCase()
    if (normalized === 'low') return 'low'
    if (normalized === 'high') return 'high'
    return 'medium'
  }

  /**
   * Parse community support value
   */
  private parseCommunity(value?: string): 'small' | 'medium' | 'large' {
    const normalized = value?.toLowerCase()
    if (normalized === 'small') return 'small'
    if (normalized === 'large') return 'large'
    return 'medium'
  }

  /**
   * Make a decision on a tech choice
   */
  decide(
    id: string,
    selectedOption: string,
    rationale?: string,
    decidedBy?: string
  ): TechChoice | null {
    const existing = this.getChoice(id)
    if (!existing) return null

    const db = databaseService.getDb()
    const now = new Date().toISOString()

    db.prepare(`
      UPDATE tech_choices
      SET selected_option = ?, decision_rationale = ?, status = ?,
          decided_by = ?, decided_at = ?, updated_at = ?
      WHERE id = ?
    `).run(
      selectedOption,
      rationale || null,
      'decided',
      decidedBy || null,
      now,
      now,
      id
    )

    const updated = this.getChoice(id)
    if (updated) {
      this.emit('decision-made', updated)
    }
    return updated
  }

  /**
   * Cancel a tech choice
   */
  cancel(id: string): boolean {
    const existing = this.getChoice(id)
    if (!existing) return false

    const db = databaseService.getDb()
    db.prepare('UPDATE tech_choices SET status = ?, updated_at = ? WHERE id = ?')
      .run('cancelled', new Date().toISOString(), id)

    this.emit('choice-cancelled', id)
    return true
  }

  /**
   * Delete a tech choice
   */
  delete(id: string): boolean {
    const db = databaseService.getDb()
    const result = db.prepare('DELETE FROM tech_choices WHERE id = ?').run(id)
    return result.changes > 0
  }

  /**
   * Convert database row to TechChoice
   */
  private rowToChoice(row: TechChoiceRow): TechChoice {
    return {
      id: row.id,
      projectId: row.project_id,
      taskId: row.task_id || undefined,
      category: row.category as TechCategory,
      question: row.question,
      context: row.context || undefined,
      options: JSON.parse(row.options) as TechOption[],
      selectedOption: row.selected_option || undefined,
      decisionRationale: row.decision_rationale || undefined,
      status: row.status as TechChoiceStatus,
      decidedBy: row.decided_by || undefined,
      decidedAt: row.decided_at ? new Date(row.decided_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }
  }
}

// Database row type
interface TechChoiceRow {
  id: string
  project_id: string
  task_id: string | null
  category: string
  question: string
  context: string | null
  options: string
  selected_option: string | null
  decision_rationale: string | null
  status: string
  decided_by: string | null
  decided_at: string | null
  created_at: string
  updated_at: string
}

export const techAdvisorService = new TechAdvisorService()
