/**
 * Action Parser Service
 *
 * Parses Claude's responses to extract actionable items that can be
 * automatically created in the project database.
 */

import { EventEmitter } from 'events'

// Action types that can be extracted from responses
export type ActionType =
  | 'create-story'
  | 'create-task'
  | 'create-roadmap-item'
  | 'create-test'
  | 'create-file'
  | 'run-command'
  | 'update-item'
  | 'link-items'

export interface ExtractedAction {
  id: string
  type: ActionType
  title: string
  description?: string
  metadata: Record<string, any>
  confidence: number // 0-1 how confident the extraction is
  sourceText: string // The text that triggered this extraction
  status: 'proposed' | 'approved' | 'rejected' | 'executed'
}

export interface StoryAction extends ExtractedAction {
  type: 'create-story'
  metadata: {
    priority?: 'low' | 'medium' | 'high' | 'critical'
    acceptanceCriteria?: string[]
    storyType?: 'feature' | 'bug' | 'technical' | 'spike'
    estimatedPoints?: number
  }
}

export interface TaskAction extends ExtractedAction {
  type: 'create-task'
  metadata: {
    taskType?: string
    agentType?: string
    autonomyLevel?: 'auto' | 'approval_gates' | 'supervised'
    priority?: number
    parentStoryId?: string
  }
}

export interface RoadmapAction extends ExtractedAction {
  type: 'create-roadmap-item'
  metadata: {
    itemType?: 'epic' | 'feature' | 'milestone' | 'task'
    lane?: 'now' | 'next' | 'later' | 'done'
    priority?: 'low' | 'medium' | 'high' | 'critical'
  }
}

export interface TestAction extends ExtractedAction {
  type: 'create-test'
  metadata: {
    testType?: 'unit' | 'integration' | 'e2e' | 'performance'
    targetFile?: string
    framework?: string
  }
}

// Patterns for detecting different action types
const ACTION_PATTERNS = {
  // User Story patterns
  story: [
    /(?:create|add|write|define)\s+(?:a\s+)?(?:user\s+)?story\s*(?:for|about|:)?\s*["""]?(.+?)["""]?(?:\.|$)/i,
    /(?:as\s+a\s+.+?,\s+I\s+want\s+to\s+.+)/i,
    /user\s+story[:\s]+["""]?(.+?)["""]?(?:\.|$)/i,
    /story[:\s]+["""](.+?)["""]/i,
    /(?:let'?s|I'?ll|we\s+should)\s+create\s+(?:a\s+)?story\s+(?:for|about)\s+(.+?)(?:\.|$)/i,
  ],

  // Task patterns
  task: [
    /(?:create|add|queue|schedule)\s+(?:a\s+)?task\s*(?:for|to|:)?\s*["""]?(.+?)["""]?(?:\.|$)/i,
    /(?:TODO|TASK)[:\s]+(.+?)(?:\.|$)/i,
    /(?:let'?s|I'?ll|we\s+should)\s+(?:create|add)\s+(?:a\s+)?task\s+(?:for|to)\s+(.+?)(?:\.|$)/i,
    /add\s+to\s+(?:the\s+)?(?:task\s+)?queue[:\s]+(.+?)(?:\.|$)/i,
  ],

  // Roadmap item patterns
  roadmap: [
    /(?:add|create|plan)\s+(?:a\s+)?(?:roadmap\s+)?(?:epic|feature|milestone)\s*(?:for|:)?\s*["""]?(.+?)["""]?(?:\.|$)/i,
    /(?:epic|feature|milestone)[:\s]+["""]?(.+?)["""]?(?:\.|$)/i,
    /add\s+to\s+(?:the\s+)?roadmap[:\s]+(.+?)(?:\.|$)/i,
  ],

  // Test creation patterns
  test: [
    /(?:create|write|add|generate)\s+(?:a\s+)?(?:unit\s+|integration\s+|e2e\s+)?tests?\s*(?:for|:)?\s*["""]?(.+?)["""]?(?:\.|$)/i,
    /test\s+(?:case|spec)[:\s]+(.+?)(?:\.|$)/i,
    /(?:let'?s|I'?ll|we\s+should)\s+(?:write|create|add)\s+tests?\s+(?:for)\s+(.+?)(?:\.|$)/i,
  ],

  // File creation patterns
  file: [
    /(?:create|write|add)\s+(?:a\s+)?(?:new\s+)?file\s*(?:at|:)?\s*["""]?([^\s""]+)["""]?/i,
    /(?:create|write)\s+([^\s]+\.[a-z]+)/i,
  ],

  // Command patterns
  command: [
    /(?:run|execute)[:\s]+`([^`]+)`/i,
    /(?:run|execute)\s+(?:the\s+)?(?:command|script)[:\s]+(.+?)(?:\.|$)/i,
    /```(?:bash|sh|shell)\n([^`]+)```/i,
  ],
}

// Priority extraction patterns
const PRIORITY_PATTERNS = {
  critical: /(?:critical|urgent|asap|immediately|blocking)/i,
  high: /(?:high\s+priority|important|soon|priority)/i,
  medium: /(?:medium\s+priority|moderate|normal)/i,
  low: /(?:low\s+priority|later|when\s+possible|nice\s+to\s+have)/i,
}

// Agent type detection from context
const AGENT_TYPE_PATTERNS = {
  developer: /(?:implement|code|develop|build|create\s+component|write\s+function)/i,
  tester: /(?:test|verify|validate|qa|quality)/i,
  security: /(?:security|vulnerability|audit|penetration|auth)/i,
  devops: /(?:deploy|ci\/cd|pipeline|docker|kubernetes|infrastructure)/i,
  documentation: /(?:document|readme|api\s+docs|jsdoc|comment)/i,
  'product-owner': /(?:story|requirement|acceptance|user\s+need|feature\s+spec)/i,
}

class ActionParserService extends EventEmitter {
  private actionCounter = 0

  /**
   * Generate unique action ID
   */
  private generateId(): string {
    return `action_${Date.now()}_${++this.actionCounter}`
  }

  /**
   * Parse a response text and extract all actionable items
   */
  parseResponse(responseText: string, context?: { agentType?: string; projectId?: string }): ExtractedAction[] {
    const actions: ExtractedAction[] = []

    // Split into sentences/chunks for analysis
    const chunks = this.splitIntoChunks(responseText)

    for (const chunk of chunks) {
      // Try to extract each action type
      const storyAction = this.extractStoryAction(chunk)
      if (storyAction) actions.push(storyAction)

      const taskAction = this.extractTaskAction(chunk, context)
      if (taskAction) actions.push(taskAction)

      const roadmapAction = this.extractRoadmapAction(chunk)
      if (roadmapAction) actions.push(roadmapAction)

      const testAction = this.extractTestAction(chunk)
      if (testAction) actions.push(testAction)

      const fileAction = this.extractFileAction(chunk)
      if (fileAction) actions.push(fileAction)

      const commandAction = this.extractCommandAction(chunk)
      if (commandAction) actions.push(commandAction)
    }

    // Deduplicate similar actions
    return this.deduplicateActions(actions)
  }

  /**
   * Split text into analyzable chunks
   */
  private splitIntoChunks(text: string): string[] {
    // Split on sentence boundaries but keep context
    const sentences = text.split(/(?<=[.!?])\s+/)
    const chunks: string[] = []

    for (let i = 0; i < sentences.length; i++) {
      // Individual sentence
      chunks.push(sentences[i])

      // Pairs of sentences for context
      if (i < sentences.length - 1) {
        chunks.push(sentences[i] + ' ' + sentences[i + 1])
      }
    }

    // Also check full paragraphs
    const paragraphs = text.split(/\n\n+/)
    chunks.push(...paragraphs)

    return chunks
  }

  /**
   * Extract user story action
   */
  private extractStoryAction(text: string): StoryAction | null {
    for (const pattern of ACTION_PATTERNS.story) {
      const match = text.match(pattern)
      if (match) {
        const title = this.cleanTitle(match[1] || match[0])
        if (title.length < 5) continue // Too short to be meaningful

        return {
          id: this.generateId(),
          type: 'create-story',
          title,
          description: this.extractDescription(text, title),
          metadata: {
            priority: this.extractPriority(text),
            acceptanceCriteria: this.extractAcceptanceCriteria(text),
            storyType: this.detectStoryType(text),
          },
          confidence: this.calculateConfidence(text, 'story'),
          sourceText: text.substring(0, 200),
          status: 'proposed',
        }
      }
    }
    return null
  }

  /**
   * Extract task action
   */
  private extractTaskAction(text: string, context?: { agentType?: string }): TaskAction | null {
    for (const pattern of ACTION_PATTERNS.task) {
      const match = text.match(pattern)
      if (match) {
        const title = this.cleanTitle(match[1] || match[0])
        if (title.length < 5) continue

        return {
          id: this.generateId(),
          type: 'create-task',
          title,
          description: this.extractDescription(text, title),
          metadata: {
            taskType: this.detectTaskType(text),
            agentType: context?.agentType || this.detectAgentType(text),
            autonomyLevel: this.detectAutonomyLevel(text),
            priority: this.extractNumericPriority(text),
          },
          confidence: this.calculateConfidence(text, 'task'),
          sourceText: text.substring(0, 200),
          status: 'proposed',
        }
      }
    }
    return null
  }

  /**
   * Extract roadmap item action
   */
  private extractRoadmapAction(text: string): RoadmapAction | null {
    for (const pattern of ACTION_PATTERNS.roadmap) {
      const match = text.match(pattern)
      if (match) {
        const title = this.cleanTitle(match[1] || match[0])
        if (title.length < 5) continue

        return {
          id: this.generateId(),
          type: 'create-roadmap-item',
          title,
          description: this.extractDescription(text, title),
          metadata: {
            itemType: this.detectRoadmapItemType(text),
            lane: this.detectLane(text),
            priority: this.extractPriority(text),
          },
          confidence: this.calculateConfidence(text, 'roadmap'),
          sourceText: text.substring(0, 200),
          status: 'proposed',
        }
      }
    }
    return null
  }

  /**
   * Extract test action
   */
  private extractTestAction(text: string): TestAction | null {
    for (const pattern of ACTION_PATTERNS.test) {
      const match = text.match(pattern)
      if (match) {
        const title = this.cleanTitle(match[1] || match[0])
        if (title.length < 3) continue

        return {
          id: this.generateId(),
          type: 'create-test',
          title: `Test: ${title}`,
          description: this.extractDescription(text, title),
          metadata: {
            testType: this.detectTestType(text),
            targetFile: this.extractTargetFile(text),
          },
          confidence: this.calculateConfidence(text, 'test'),
          sourceText: text.substring(0, 200),
          status: 'proposed',
        }
      }
    }
    return null
  }

  /**
   * Extract file creation action
   */
  private extractFileAction(text: string): ExtractedAction | null {
    for (const pattern of ACTION_PATTERNS.file) {
      const match = text.match(pattern)
      if (match) {
        const filePath = match[1]
        if (!filePath || filePath.length < 3) continue

        return {
          id: this.generateId(),
          type: 'create-file',
          title: `Create file: ${filePath}`,
          metadata: {
            filePath,
            fileType: this.getFileType(filePath),
          },
          confidence: this.calculateConfidence(text, 'file'),
          sourceText: text.substring(0, 200),
          status: 'proposed',
        }
      }
    }
    return null
  }

  /**
   * Extract command action
   */
  private extractCommandAction(text: string): ExtractedAction | null {
    for (const pattern of ACTION_PATTERNS.command) {
      const match = text.match(pattern)
      if (match) {
        const command = match[1]
        if (!command || command.length < 2) continue

        return {
          id: this.generateId(),
          type: 'run-command',
          title: `Run: ${command.substring(0, 50)}${command.length > 50 ? '...' : ''}`,
          metadata: {
            command,
            shell: 'bash',
          },
          confidence: this.calculateConfidence(text, 'command'),
          sourceText: text.substring(0, 200),
          status: 'proposed',
        }
      }
    }
    return null
  }

  /**
   * Clean and normalize extracted title
   */
  private cleanTitle(title: string): string {
    return title
      .replace(/^["'"'`]+|["'"'`]+$/g, '') // Remove quotes
      .replace(/^\s+|\s+$/g, '') // Trim
      .replace(/\s+/g, ' ') // Normalize spaces
      .replace(/[.!?]+$/, '') // Remove trailing punctuation
      .substring(0, 200) // Limit length
  }

  /**
   * Extract description from surrounding text
   */
  private extractDescription(text: string, title: string): string {
    // Try to find description after the title
    const afterTitle = text.split(title)[1] || ''
    const description = afterTitle
      .replace(/^[:\-–—]\s*/, '')
      .split(/[.!?]/)[0]
      .trim()

    return description.length > 10 ? description : undefined
  }

  /**
   * Extract priority from text
   */
  private extractPriority(text: string): 'low' | 'medium' | 'high' | 'critical' {
    if (PRIORITY_PATTERNS.critical.test(text)) return 'critical'
    if (PRIORITY_PATTERNS.high.test(text)) return 'high'
    if (PRIORITY_PATTERNS.low.test(text)) return 'low'
    return 'medium'
  }

  /**
   * Extract numeric priority (0-100)
   */
  private extractNumericPriority(text: string): number {
    const priority = this.extractPriority(text)
    switch (priority) {
      case 'critical': return 100
      case 'high': return 75
      case 'medium': return 50
      case 'low': return 25
    }
  }

  /**
   * Extract acceptance criteria from text
   */
  private extractAcceptanceCriteria(text: string): string[] {
    const criteria: string[] = []

    // Look for bullet points or numbered lists
    const bulletPattern = /[-•*]\s+(.+?)(?:\n|$)/g
    const numberedPattern = /\d+[.)]\s+(.+?)(?:\n|$)/g

    let match
    while ((match = bulletPattern.exec(text)) !== null) {
      if (match[1].length > 5) criteria.push(match[1].trim())
    }
    while ((match = numberedPattern.exec(text)) !== null) {
      if (match[1].length > 5) criteria.push(match[1].trim())
    }

    return criteria.slice(0, 10) // Limit to 10 criteria
  }

  /**
   * Detect story type
   */
  private detectStoryType(text: string): 'feature' | 'bug' | 'technical' | 'spike' {
    if (/bug|fix|issue|error|broken/i.test(text)) return 'bug'
    if (/spike|research|investigate|explore/i.test(text)) return 'spike'
    if (/refactor|technical\s+debt|infrastructure|performance/i.test(text)) return 'technical'
    return 'feature'
  }

  /**
   * Detect task type
   */
  private detectTaskType(text: string): string {
    if (/test|spec|verify/i.test(text)) return 'testing'
    if (/security|audit|vulnerability/i.test(text)) return 'security-audit'
    if (/deploy|release|ship/i.test(text)) return 'deployment'
    if (/document|readme|api\s+doc/i.test(text)) return 'documentation'
    if (/review|check|inspect/i.test(text)) return 'code-review'
    if (/refactor|clean|improve/i.test(text)) return 'refactoring'
    if (/fix|bug|issue/i.test(text)) return 'bug-fix'
    return 'code-generation'
  }

  /**
   * Detect agent type from text
   */
  private detectAgentType(text: string): string {
    for (const [agent, pattern] of Object.entries(AGENT_TYPE_PATTERNS)) {
      if (pattern.test(text)) return agent
    }
    return 'developer'
  }

  /**
   * Detect autonomy level
   */
  private detectAutonomyLevel(text: string): 'auto' | 'approval_gates' | 'supervised' {
    if (/manual|supervised|careful|review\s+first/i.test(text)) return 'supervised'
    if (/approv|confirm|check\s+with|verify\s+before/i.test(text)) return 'approval_gates'
    return 'auto'
  }

  /**
   * Detect roadmap item type
   */
  private detectRoadmapItemType(text: string): 'epic' | 'feature' | 'milestone' | 'task' {
    if (/epic/i.test(text)) return 'epic'
    if (/milestone/i.test(text)) return 'milestone'
    if (/task/i.test(text)) return 'task'
    return 'feature'
  }

  /**
   * Detect roadmap lane
   */
  private detectLane(text: string): 'now' | 'next' | 'later' | 'done' {
    if (/now|current|immediately|this\s+sprint/i.test(text)) return 'now'
    if (/next|upcoming|soon/i.test(text)) return 'next'
    if (/later|future|backlog/i.test(text)) return 'later'
    return 'next'
  }

  /**
   * Detect test type
   */
  private detectTestType(text: string): 'unit' | 'integration' | 'e2e' | 'performance' {
    if (/e2e|end.?to.?end|playwright|cypress/i.test(text)) return 'e2e'
    if (/integration/i.test(text)) return 'integration'
    if (/performance|load|stress/i.test(text)) return 'performance'
    return 'unit'
  }

  /**
   * Extract target file for tests
   */
  private extractTargetFile(text: string): string | undefined {
    const fileMatch = text.match(/(?:for|of|in)\s+[`"']?([^\s`"']+\.[a-z]+)[`"']?/i)
    return fileMatch?.[1]
  }

  /**
   * Get file type from path
   */
  private getFileType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'ts': case 'tsx': return 'typescript'
      case 'js': case 'jsx': return 'javascript'
      case 'py': return 'python'
      case 'go': return 'go'
      case 'rs': return 'rust'
      case 'css': case 'scss': return 'style'
      case 'md': return 'markdown'
      case 'json': return 'json'
      case 'yaml': case 'yml': return 'yaml'
      default: return 'text'
    }
  }

  /**
   * Calculate confidence score for extraction
   */
  private calculateConfidence(text: string, actionType: string): number {
    let confidence = 0.5 // Base confidence

    // Increase for explicit action words
    if (/(?:create|add|write|generate|make)/i.test(text)) confidence += 0.2

    // Increase for quotes around title
    if (/["'"'`]/.test(text)) confidence += 0.1

    // Increase for structured format
    if (/:\s*["'"'`]/.test(text)) confidence += 0.1

    // Decrease for questions
    if (/\?/.test(text)) confidence -= 0.2

    // Decrease for conditional language
    if (/(?:might|could|maybe|perhaps|consider)/i.test(text)) confidence -= 0.15

    // Cap between 0 and 1
    return Math.max(0, Math.min(1, confidence))
  }

  /**
   * Remove duplicate or very similar actions
   */
  private deduplicateActions(actions: ExtractedAction[]): ExtractedAction[] {
    const seen = new Map<string, ExtractedAction>()

    for (const action of actions) {
      const key = `${action.type}:${action.title.toLowerCase().substring(0, 50)}`
      const existing = seen.get(key)

      if (!existing || action.confidence > existing.confidence) {
        seen.set(key, action)
      }
    }

    return Array.from(seen.values())
      .filter(a => a.confidence >= 0.4) // Filter low confidence
      .sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * Check if response contains any actionable content
   */
  hasActions(responseText: string): boolean {
    const actions = this.parseResponse(responseText)
    return actions.length > 0
  }

  /**
   * Get action count by type
   */
  getActionSummary(responseText: string): Record<ActionType, number> {
    const actions = this.parseResponse(responseText)
    const summary: Record<string, number> = {}

    for (const action of actions) {
      summary[action.type] = (summary[action.type] || 0) + 1
    }

    return summary as Record<ActionType, number>
  }
}

export const actionParserService = new ActionParserService()
