import { databaseService } from './database.service'

// ============================================
// Style Analysis Types
// ============================================

export interface StyleAnalysis {
  storyFormat: {
    titlePattern?: string // e.g., "As a [user], I want [action]"
    descriptionTemplate?: string
    averageTitleLength: number
    commonPriorities: string[]
    commonTypes: string[]
  }
  namingConventions: {
    storyTitleCase: 'sentence' | 'title' | 'lower' | 'mixed'
    taskTitleCase: 'sentence' | 'title' | 'lower' | 'mixed'
    commonPrefixes: string[]
    commonSuffixes: string[]
  }
  testPatterns: {
    commonTestTypes: string[]
    averageTestsPerStory: number
    namingPattern?: string // e.g., "test_[feature]_[scenario]"
  }
  taskPatterns: {
    commonTaskTypes: string[]
    averageTasksPerStory: number
    commonAgentTypes: string[]
  }
}

export interface ConventionSuggestion {
  field: string
  suggestion: string
  confidence: number // 0-1
  basedOn: number // number of examples analyzed
}

interface AnalysisCache {
  data: StyleAnalysis
  timestamp: number
}

// ============================================
// Style Analyzer Service
// ============================================

class StyleAnalyzerService {
  private cache: Map<string, AnalysisCache> = new Map()
  private readonly CACHE_TTL = 10 * 60 * 1000 // 10 minutes

  /**
   * Perform full project analysis
   */
  async analyzeProject(projectId: string): Promise<StyleAnalysis> {
    // Check cache
    const cached = this.getCachedAnalysis(projectId)
    if (cached) {
      return cached
    }

    // Perform analysis
    const [storyFormat, namingConventions, testPatterns, taskPatterns] = await Promise.all([
      this.analyzeStoryFormat(projectId),
      this.analyzeNamingConventions(projectId),
      this.analyzeTestPatterns(projectId),
      this.analyzeTaskPatterns(projectId)
    ])

    const analysis: StyleAnalysis = {
      storyFormat,
      namingConventions,
      testPatterns,
      taskPatterns
    }

    // Cache result
    this.cache.set(projectId, {
      data: analysis,
      timestamp: Date.now()
    })

    return analysis
  }

  /**
   * Analyze story format patterns
   */
  async analyzeStoryFormat(projectId: string): Promise<StyleAnalysis['storyFormat']> {
    const db = databaseService.getDb()

    // Get all stories for this project
    const stories = db
      .prepare('SELECT title, description, priority FROM user_stories WHERE project_id = ?')
      .all(projectId) as Array<{
      title: string
      description: string | null
      priority: string
    }>

    if (stories.length === 0) {
      return {
        averageTitleLength: 0,
        commonPriorities: ['medium'],
        commonTypes: []
      }
    }

    // Calculate average title length
    const totalLength = stories.reduce((sum, s) => sum + s.title.length, 0)
    const averageTitleLength = Math.round(totalLength / stories.length)

    // Find common priorities
    const priorityCounts = new Map<string, number>()
    stories.forEach((s) => {
      const count = priorityCounts.get(s.priority) || 0
      priorityCounts.set(s.priority, count + 1)
    })
    const commonPriorities = Array.from(priorityCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map((e) => e[0])

    // Detect title pattern (e.g., "As a ..., I want ...")
    const titlePattern = this.detectStoryTitlePattern(stories.map((s) => s.title))

    // Detect common story types from titles
    const commonTypes = this.extractCommonPatterns(stories.map((s) => s.title))

    return {
      titlePattern,
      averageTitleLength,
      commonPriorities,
      commonTypes
    }
  }

  /**
   * Analyze naming conventions
   */
  async analyzeNamingConventions(
    projectId: string
  ): Promise<StyleAnalysis['namingConventions']> {
    const db = databaseService.getDb()

    // Get story titles
    const stories = db
      .prepare('SELECT title FROM user_stories WHERE project_id = ?')
      .all(projectId) as Array<{ title: string }>
    const storyTitles = stories.map((s) => s.title)

    // Get task titles
    const tasks = db
      .prepare('SELECT title FROM task_queue WHERE project_id = ?')
      .all(projectId) as Array<{ title: string }>
    const taskTitles = tasks.map((t) => t.title)

    // Detect title case
    const storyTitleCase = this.detectTitleCase(storyTitles)
    const taskTitleCase = this.detectTitleCase(taskTitles)

    // Find common prefixes and suffixes
    const allTitles = [...storyTitles, ...taskTitles]
    const commonPrefixes = this.extractCommonPrefixes(allTitles)
    const commonSuffixes = this.extractCommonSuffixes(allTitles)

    return {
      storyTitleCase,
      taskTitleCase,
      commonPrefixes,
      commonSuffixes
    }
  }

  /**
   * Analyze test patterns
   */
  async analyzeTestPatterns(projectId: string): Promise<StyleAnalysis['testPatterns']> {
    const db = databaseService.getDb()

    // Get all test cases
    const tests = db
      .prepare('SELECT title, user_story_id FROM test_cases WHERE project_id = ?')
      .all(projectId) as Array<{
      title: string
      user_story_id: string | null
    }>

    if (tests.length === 0) {
      return {
        commonTestTypes: [],
        averageTestsPerStory: 0
      }
    }

    // Calculate average tests per story
    const storiesWithTests = new Set(tests.filter((t) => t.user_story_id).map((t) => t.user_story_id))
    const averageTestsPerStory =
      storiesWithTests.size > 0 ? Math.round(tests.length / storiesWithTests.size) : 0

    // Extract common test types from titles
    const commonTestTypes = this.extractTestTypes(tests.map((t) => t.title))

    // Detect naming pattern
    const namingPattern = this.detectTestNamingPattern(tests.map((t) => t.title))

    return {
      commonTestTypes,
      averageTestsPerStory,
      namingPattern
    }
  }

  /**
   * Analyze task patterns
   */
  async analyzeTaskPatterns(projectId: string): Promise<StyleAnalysis['taskPatterns']> {
    const db = databaseService.getDb()

    // Get all tasks
    const tasks = db
      .prepare('SELECT task_type, agent_type, roadmap_item_id FROM task_queue WHERE project_id = ?')
      .all(projectId) as Array<{
      task_type: string
      agent_type: string | null
      roadmap_item_id: string | null
    }>

    if (tasks.length === 0) {
      return {
        commonTaskTypes: [],
        averageTasksPerStory: 0,
        commonAgentTypes: []
      }
    }

    // Count task types
    const taskTypeCounts = new Map<string, number>()
    tasks.forEach((t) => {
      const count = taskTypeCounts.get(t.task_type) || 0
      taskTypeCounts.set(t.task_type, count + 1)
    })
    const commonTaskTypes = Array.from(taskTypeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map((e) => e[0])

    // Count agent types
    const agentTypeCounts = new Map<string, number>()
    tasks.forEach((t) => {
      if (t.agent_type) {
        const count = agentTypeCounts.get(t.agent_type) || 0
        agentTypeCounts.set(t.agent_type, count + 1)
      }
    })
    const commonAgentTypes = Array.from(agentTypeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map((e) => e[0])

    // Calculate average tasks per roadmap item
    const itemsWithTasks = new Set(tasks.filter((t) => t.roadmap_item_id).map((t) => t.roadmap_item_id))
    const averageTasksPerStory =
      itemsWithTasks.size > 0 ? Math.round(tasks.length / itemsWithTasks.size) : 0

    return {
      commonTaskTypes,
      averageTasksPerStory,
      commonAgentTypes
    }
  }

  /**
   * Suggest story title based on keywords and learned conventions
   */
  async suggestStoryTitle(
    projectId: string,
    keywords: string[]
  ): Promise<ConventionSuggestion | null> {
    const analysis = await this.analyzeProject(projectId)

    if (!analysis.storyFormat.titlePattern) {
      return null
    }

    // Use the detected pattern to create suggestion
    const pattern = analysis.storyFormat.titlePattern
    const suggestion = this.applySuggestionPattern(pattern, keywords)

    // Calculate confidence based on number of examples
    const db = databaseService.getDb()
    const storyCount = db
      .prepare('SELECT COUNT(*) as count FROM user_stories WHERE project_id = ?')
      .get(projectId) as { count: number }

    const confidence = Math.min(storyCount.count / 10, 1) // Max confidence at 10+ stories

    return {
      field: 'title',
      suggestion,
      confidence,
      basedOn: storyCount.count
    }
  }

  /**
   * Suggest task title based on story title and conventions
   */
  async suggestTaskTitle(
    projectId: string,
    storyTitle: string
  ): Promise<ConventionSuggestion | null> {
    const analysis = await this.analyzeProject(projectId)

    if (analysis.namingConventions.commonPrefixes.length === 0) {
      return null
    }

    // Use most common prefix
    const prefix = analysis.namingConventions.commonPrefixes[0]
    const suggestion = `${prefix} ${storyTitle.toLowerCase()}`

    // Calculate confidence
    const db = databaseService.getDb()
    const taskCount = db
      .prepare('SELECT COUNT(*) as count FROM task_queue WHERE project_id = ?')
      .get(projectId) as { count: number }

    const confidence = Math.min(taskCount.count / 10, 1)

    return {
      field: 'title',
      suggestion,
      confidence,
      basedOn: taskCount.count
    }
  }

  /**
   * Detect title case pattern from a list of titles
   */
  detectTitleCase(titles: string[]): 'sentence' | 'title' | 'lower' | 'mixed' {
    if (titles.length === 0) return 'sentence'

    let sentenceCount = 0
    let titleCount = 0
    let lowerCount = 0

    titles.forEach((title) => {
      const words = title.split(/\s+/)
      if (words.length === 0) return

      const firstWord = words[0]
      const restWords = words.slice(1)

      // Check if first word starts with capital
      const firstCapital = /^[A-Z]/.test(firstWord)

      // Check if rest of words are mostly lowercase
      const restLowercase = restWords.filter((w) => /^[a-z]/.test(w)).length
      const restCapitalized = restWords.filter((w) => /^[A-Z]/.test(w)).length

      if (!firstCapital) {
        lowerCount++
      } else if (restCapitalized > restLowercase) {
        titleCount++ // Title Case (Most Words Capitalized)
      } else {
        sentenceCount++ // Sentence case (Only first word capitalized)
      }
    })

    // Return most common pattern
    const max = Math.max(sentenceCount, titleCount, lowerCount)
    if (max === lowerCount) return 'lower'
    if (max === titleCount) return 'title'
    if (max === sentenceCount) return 'sentence'

    return 'mixed'
  }

  /**
   * Extract common patterns from text array
   */
  extractCommonPatterns(texts: string[]): string[] {
    if (texts.length === 0) return []

    // Extract first 3 words from each text as potential patterns
    const patterns = new Map<string, number>()

    texts.forEach((text) => {
      const words = text.split(/\s+/).slice(0, 3)
      if (words.length >= 2) {
        const pattern = words.join(' ')
        patterns.set(pattern, (patterns.get(pattern) || 0) + 1)
      }
    })

    // Return patterns that appear in at least 20% of texts
    const threshold = Math.max(2, Math.floor(texts.length * 0.2))
    return Array.from(patterns.entries())
      .filter(([, count]) => count >= threshold)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pattern]) => pattern)
  }

  /**
   * Get cached analysis if available and not expired
   */
  getCachedAnalysis(projectId: string): StyleAnalysis | null {
    const cached = this.cache.get(projectId)
    if (!cached) return null

    const age = Date.now() - cached.timestamp
    if (age > this.CACHE_TTL) {
      this.cache.delete(projectId)
      return null
    }

    return cached.data
  }

  /**
   * Invalidate cache for a project
   */
  invalidateCache(projectId: string): void {
    this.cache.delete(projectId)
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  /**
   * Detect story title pattern (e.g., "As a ..., I want ...")
   */
  private detectStoryTitlePattern(titles: string[]): string | undefined {
    if (titles.length === 0) return undefined

    // Check for common story patterns
    const asAUserPattern = titles.filter((t) =>
      /^as\s+(a|an)\s+/i.test(t.trim())
    ).length
    const iWantPattern = titles.filter((t) => /\bi\s+want\b/i.test(t)).length

    // If more than 30% follow "As a..." pattern
    if (asAUserPattern > titles.length * 0.3) {
      return 'As a [user], I want [action]'
    }

    // If more than 30% contain "I want"
    if (iWantPattern > titles.length * 0.3) {
      return 'I want [action]'
    }

    return undefined
  }

  /**
   * Extract common prefixes from titles
   */
  private extractCommonPrefixes(titles: string[]): string[] {
    if (titles.length === 0) return []

    const prefixCounts = new Map<string, number>()

    titles.forEach((title) => {
      const firstWord = title.split(/\s+/)[0]?.toLowerCase()
      if (firstWord) {
        prefixCounts.set(firstWord, (prefixCounts.get(firstWord) || 0) + 1)
      }
    })

    // Return prefixes that appear in at least 20% of titles
    const threshold = Math.max(2, Math.floor(titles.length * 0.2))
    return Array.from(prefixCounts.entries())
      .filter(([, count]) => count >= threshold)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([prefix]) => prefix.charAt(0).toUpperCase() + prefix.slice(1))
  }

  /**
   * Extract common suffixes from titles
   */
  private extractCommonSuffixes(titles: string[]): string[] {
    if (titles.length === 0) return []

    const suffixCounts = new Map<string, number>()

    titles.forEach((title) => {
      const words = title.split(/\s+/)
      const lastWord = words[words.length - 1]?.toLowerCase()
      if (lastWord) {
        suffixCounts.set(lastWord, (suffixCounts.get(lastWord) || 0) + 1)
      }
    })

    // Return suffixes that appear in at least 20% of titles
    const threshold = Math.max(2, Math.floor(titles.length * 0.2))
    return Array.from(suffixCounts.entries())
      .filter(([, count]) => count >= threshold)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([suffix]) => suffix)
  }

  /**
   * Extract common test types from test titles
   */
  private extractTestTypes(titles: string[]): string[] {
    if (titles.length === 0) return []

    const typeCounts = new Map<string, number>()

    // Common test type keywords
    const testKeywords = [
      'unit',
      'integration',
      'e2e',
      'end-to-end',
      'functional',
      'acceptance',
      'regression',
      'smoke',
      'performance',
      'security'
    ]

    titles.forEach((title) => {
      const lower = title.toLowerCase()
      testKeywords.forEach((keyword) => {
        if (lower.includes(keyword)) {
          typeCounts.set(keyword, (typeCounts.get(keyword) || 0) + 1)
        }
      })
    })

    return Array.from(typeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type]) => type)
  }

  /**
   * Detect test naming pattern
   */
  private detectTestNamingPattern(titles: string[]): string | undefined {
    if (titles.length === 0) return undefined

    // Check for common patterns
    const testPrefixPattern = titles.filter((t) => /^test[_\s]/i.test(t.trim())).length
    const shouldPattern = titles.filter((t) => /\bshould\b/i.test(t)).length
    const itPattern = titles.filter((t) => /^it\b/i.test(t.trim())).length

    // If more than 30% follow a pattern
    const threshold = titles.length * 0.3

    if (testPrefixPattern > threshold) {
      return 'test_[feature]_[scenario]'
    }

    if (shouldPattern > threshold) {
      return '[feature] should [expected behavior]'
    }

    if (itPattern > threshold) {
      return 'it [expected behavior]'
    }

    return undefined
  }

  /**
   * Apply suggestion pattern with keywords
   */
  private applySuggestionPattern(pattern: string, keywords: string[]): string {
    let suggestion = pattern

    // Simple keyword replacement
    if (keywords.length > 0) {
      suggestion = suggestion.replace(/\[user\]/i, keywords[0] || 'user')
    }
    if (keywords.length > 1) {
      suggestion = suggestion.replace(/\[action\]/i, keywords[1] || 'action')
    }

    return suggestion
  }
}

// ============================================
// Export Singleton Instance
// ============================================

export const styleAnalyzerService = new StyleAnalyzerService()
