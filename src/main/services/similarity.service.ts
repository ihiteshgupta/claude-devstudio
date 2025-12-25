/**
 * Similarity Service
 *
 * Provides semantic similarity checking for project items using multiple algorithms:
 * - Levenshtein distance for title matching
 * - TF-IDF style keyword extraction and matching
 * - N-gram similarity (bigrams/trigrams)
 * - Jaccard similarity on words
 *
 * Combines multiple similarity metrics to detect duplicate or similar items.
 */

import { databaseService } from './database.service'

export interface SimilarityResult {
  item: {
    id: string
    title: string
    type: 'story' | 'task' | 'roadmap' | 'test'
  }
  score: number // 0-1 combined score
  matchType: 'exact' | 'high' | 'medium' | 'low'
  breakdown: {
    titleSimilarity: number
    descriptionSimilarity: number
    keywordOverlap: number
  }
}

export interface SimilarityService {
  findSimilarStories(
    projectId: string,
    title: string,
    description?: string
  ): Promise<SimilarityResult[]>
  findSimilarTasks(
    projectId: string,
    title: string,
    description?: string
  ): Promise<SimilarityResult[]>
  findSimilarRoadmapItems(
    projectId: string,
    title: string,
    description?: string
  ): Promise<SimilarityResult[]>
  findSimilar(
    projectId: string,
    type: 'story' | 'task' | 'roadmap' | 'test',
    title: string,
    description?: string
  ): Promise<SimilarityResult[]>
}

/**
 * Common English stopwords to filter out for better matching
 */
const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'has',
  'he',
  'in',
  'is',
  'it',
  'its',
  'of',
  'on',
  'that',
  'the',
  'to',
  'was',
  'will',
  'with',
  'can',
  'should',
  'would',
  'could',
  'have',
  'this',
  'we',
  'you',
  'your',
  'our',
  'their',
  'them',
  'been',
  'do',
  'does',
  'did',
  'but',
  'if',
  'or',
  'because',
  'until',
  'while',
  'after',
  'before',
  'when',
  'where',
  'why',
  'how',
  'all',
  'each',
  'every',
  'both',
  'few',
  'more',
  'most',
  'other',
  'some',
  'such',
])

class SimilarityServiceImpl implements SimilarityService {
  /**
   * Find similar user stories
   */
  async findSimilarStories(
    projectId: string,
    title: string,
    description?: string
  ): Promise<SimilarityResult[]> {
    return this.findSimilar(projectId, 'story', title, description)
  }

  /**
   * Find similar tasks
   */
  async findSimilarTasks(
    projectId: string,
    title: string,
    description?: string
  ): Promise<SimilarityResult[]> {
    return this.findSimilar(projectId, 'task', title, description)
  }

  /**
   * Find similar roadmap items
   */
  async findSimilarRoadmapItems(
    projectId: string,
    title: string,
    description?: string
  ): Promise<SimilarityResult[]> {
    return this.findSimilar(projectId, 'roadmap', title, description)
  }

  /**
   * Find similar items of a specific type
   */
  async findSimilar(
    projectId: string,
    type: 'story' | 'task' | 'roadmap' | 'test',
    title: string,
    description?: string
  ): Promise<SimilarityResult[]> {
    const db = databaseService.getDb()
    const results: SimilarityResult[] = []

    // Get existing items based on type
    const items = this.getItemsByType(db, projectId, type)

    // Calculate similarity for each item
    for (const item of items) {
      const titleSimilarity = this.calculateTitleSimilarity(title, item.title)
      const descriptionSimilarity = description && item.description
        ? this.calculateDescriptionSimilarity(description, item.description)
        : 0
      const keywordOverlap = this.calculateKeywordOverlap(
        title,
        description || '',
        item.title,
        item.description || ''
      )

      // Weighted combined score
      // Title is most important (60%), keywords (25%), description (15%)
      const score =
        titleSimilarity * 0.6 +
        keywordOverlap * 0.25 +
        descriptionSimilarity * 0.15

      // Only include results above minimum threshold
      if (score >= 0.3) {
        results.push({
          item: {
            id: item.id,
            title: item.title,
            type,
          },
          score,
          matchType: this.getMatchType(score),
          breakdown: {
            titleSimilarity,
            descriptionSimilarity,
            keywordOverlap,
          },
        })
      }
    }

    // Sort by score descending and return top 10
    return results.sort((a, b) => b.score - a.score).slice(0, 10)
  }

  /**
   * Get items by type from database
   */
  private getItemsByType(
    db: ReturnType<typeof databaseService.getDb>,
    projectId: string,
    type: 'story' | 'task' | 'roadmap' | 'test'
  ): Array<{ id: string; title: string; description?: string }> {
    switch (type) {
      case 'story':
        return db
          .prepare('SELECT id, title, description FROM user_stories WHERE project_id = ?')
          .all(projectId) as Array<{ id: string; title: string; description: string | null }>

      case 'task':
        return db
          .prepare('SELECT id, title, description FROM task_queue WHERE project_id = ?')
          .all(projectId) as Array<{ id: string; title: string; description: string | null }>

      case 'roadmap':
        return db
          .prepare('SELECT id, title, description FROM roadmap_items WHERE project_id = ?')
          .all(projectId) as Array<{ id: string; title: string; description: string | null }>

      case 'test':
        return db
          .prepare('SELECT id, title, description FROM test_cases WHERE project_id = ?')
          .all(projectId) as Array<{ id: string; title: string; description: string | null }>

      default:
        return []
    }
  }

  /**
   * Calculate title similarity using multiple algorithms
   */
  private calculateTitleSimilarity(title1: string, title2: string): number {
    const normalized1 = this.normalizeText(title1)
    const normalized2 = this.normalizeText(title2)

    // Exact match
    if (normalized1 === normalized2) return 1.0

    // Combine multiple metrics
    const levenshtein = this.levenshteinSimilarity(normalized1, normalized2)
    const jaccard = this.jaccardSimilarity(normalized1, normalized2)
    const ngram = this.ngramSimilarity(normalized1, normalized2, 2)

    // Weighted average (Levenshtein 40%, Jaccard 40%, N-gram 20%)
    return levenshtein * 0.4 + jaccard * 0.4 + ngram * 0.2
  }

  /**
   * Calculate description similarity
   */
  private calculateDescriptionSimilarity(desc1: string, desc2: string): number {
    const normalized1 = this.normalizeText(desc1)
    const normalized2 = this.normalizeText(desc2)

    if (!normalized1 || !normalized2) return 0

    // For longer texts, use Jaccard and keyword-based matching
    const jaccard = this.jaccardSimilarity(normalized1, normalized2)
    const keywords = this.calculateKeywordSimilarity(normalized1, normalized2)

    return jaccard * 0.5 + keywords * 0.5
  }

  /**
   * Calculate keyword overlap between two items
   */
  private calculateKeywordOverlap(
    title1: string,
    desc1: string,
    title2: string,
    desc2: string
  ): number {
    const keywords1 = this.extractKeywords(title1 + ' ' + desc1)
    const keywords2 = this.extractKeywords(title2 + ' ' + desc2)

    if (keywords1.length === 0 || keywords2.length === 0) return 0

    // Calculate TF-IDF style overlap
    const set1 = new Set(keywords1)
    const set2 = new Set(keywords2)

    const intersection = new Set([...set1].filter((x) => set2.has(x)))
    const union = new Set([...set1, ...set2])

    return intersection.size / union.size
  }

  /**
   * Extract keywords from text (TF-IDF style)
   */
  private extractKeywords(text: string): string[] {
    const words = this.normalizeText(text)
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))

    // Count word frequencies
    const wordFreq = new Map<string, number>()
    for (const word of words) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1)
    }

    // Return words sorted by frequency (top 10)
    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map((entry) => entry[0])
  }

  /**
   * Calculate keyword-based similarity
   */
  private calculateKeywordSimilarity(text1: string, text2: string): number {
    const keywords1 = this.extractKeywords(text1)
    const keywords2 = this.extractKeywords(text2)

    if (keywords1.length === 0 || keywords2.length === 0) return 0

    const set1 = new Set(keywords1)
    const set2 = new Set(keywords2)

    const intersection = new Set([...set1].filter((x) => set2.has(x)))

    return (2 * intersection.size) / (set1.size + set2.size)
  }

  /**
   * Levenshtein distance similarity (normalized to 0-1)
   */
  private levenshteinSimilarity(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(str1, str2)
    const maxLength = Math.max(str1.length, str2.length)

    if (maxLength === 0) return 1.0

    return 1 - distance / maxLength
  }

  /**
   * Calculate Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length
    const len2 = str2.length

    // Create matrix
    const matrix: number[][] = Array(len1 + 1)
      .fill(null)
      .map(() => Array(len2 + 1).fill(0))

    // Initialize first column and row
    for (let i = 0; i <= len1; i++) matrix[i][0] = i
    for (let j = 0; j <= len2; j++) matrix[0][j] = j

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + cost // substitution
        )
      }
    }

    return matrix[len1][len2]
  }

  /**
   * Jaccard similarity on words
   */
  private jaccardSimilarity(str1: string, str2: string): number {
    const words1 = new Set(
      str1
        .split(/\s+/)
        .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    )
    const words2 = new Set(
      str2
        .split(/\s+/)
        .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    )

    if (words1.size === 0 || words2.size === 0) return 0

    const intersection = new Set([...words1].filter((x) => words2.has(x)))
    const union = new Set([...words1, ...words2])

    return intersection.size / union.size
  }

  /**
   * N-gram similarity
   */
  private ngramSimilarity(str1: string, str2: string, n: number): number {
    const ngrams1 = this.generateNgrams(str1, n)
    const ngrams2 = this.generateNgrams(str2, n)

    if (ngrams1.length === 0 || ngrams2.length === 0) return 0

    const set1 = new Set(ngrams1)
    const set2 = new Set(ngrams2)

    const intersection = new Set([...set1].filter((x) => set2.has(x)))
    const union = new Set([...set1, ...set2])

    return intersection.size / union.size
  }

  /**
   * Generate n-grams from text
   */
  private generateNgrams(text: string, n: number): string[] {
    const words = text.split(/\s+/).filter((w) => w.length > 0)
    const ngrams: string[] = []

    for (let i = 0; i <= words.length - n; i++) {
      ngrams.push(words.slice(i, i + n).join(' '))
    }

    return ngrams
  }

  /**
   * Normalize text for comparison
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
  }

  /**
   * Determine match type based on score
   */
  private getMatchType(score: number): 'exact' | 'high' | 'medium' | 'low' {
    if (score >= 0.95) return 'exact'
    if (score >= 0.75) return 'high'
    if (score >= 0.5) return 'medium'
    return 'low'
  }
}

export const similarityService = new SimilarityServiceImpl()
