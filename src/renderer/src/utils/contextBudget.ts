// Context budget optimization for Claude API calls
// Manages token estimation and content truncation

// Approximate tokens per character (rough estimate for English text/code)
const CHARS_PER_TOKEN = 4

// File priority weights (higher = more important to include)
const FILE_PRIORITY: Record<string, number> = {
  // Critical project files
  'package.json': 100,
  'tsconfig.json': 90,
  'CLAUDE.md': 95,
  'README.md': 80,

  // Config files
  '.eslintrc': 60,
  '.prettierrc': 50,
  'vite.config': 70,
  'electron.vite.config': 75,

  // Entry points
  'index.ts': 85,
  'index.tsx': 85,
  'main.ts': 85,
  'App.tsx': 80,

  // Types
  'types.ts': 75,
  'types/index.ts': 75
}

export interface ContextFile {
  path: string
  content: string
  relativePath: string
  tokens: number
  priority: number
}

export interface ContextBudgetResult {
  files: ContextFile[]
  totalTokens: number
  truncated: boolean
  droppedFiles: string[]
}

/**
 * Estimate token count for a string
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

/**
 * Get priority score for a file
 */
function getFilePriority(relativePath: string): number {
  const fileName = relativePath.split('/').pop() || ''

  // Check exact matches
  for (const [pattern, priority] of Object.entries(FILE_PRIORITY)) {
    if (fileName === pattern || relativePath.endsWith(pattern)) {
      return priority
    }
  }

  // Extension-based priority
  if (fileName.endsWith('.test.ts') || fileName.endsWith('.spec.ts')) return 40
  if (fileName.endsWith('.tsx')) return 65
  if (fileName.endsWith('.ts')) return 60
  if (fileName.endsWith('.md')) return 30
  if (fileName.endsWith('.json')) return 35

  return 50 // Default priority
}

/**
 * Truncate content to fit within token budget
 */
export function truncateToTokens(content: string, maxTokens: number): string {
  const currentTokens = estimateTokens(content)
  if (currentTokens <= maxTokens) return content

  // Truncate by characters (approximate)
  const targetChars = maxTokens * CHARS_PER_TOKEN
  const truncated = content.slice(0, targetChars)

  // Try to end at a newline for cleaner output
  const lastNewline = truncated.lastIndexOf('\n')
  if (lastNewline > targetChars * 0.8) {
    return truncated.slice(0, lastNewline) + '\n\n[... content truncated ...]'
  }

  return truncated + '\n\n[... content truncated ...]'
}

/**
 * Optimize context to fit within token budget
 */
export function optimizeContext(
  files: Array<{ path: string; content: string; relativePath: string }>,
  budgetTokens: number,
  reserveTokens: number = 2000 // Reserve for system prompt and response
): ContextBudgetResult {
  const availableTokens = budgetTokens - reserveTokens

  // Calculate priorities and tokens for each file
  const contextFiles: ContextFile[] = files.map(f => ({
    ...f,
    tokens: estimateTokens(f.content),
    priority: getFilePriority(f.relativePath)
  }))

  // Sort by priority (highest first)
  contextFiles.sort((a, b) => b.priority - a.priority)

  const includedFiles: ContextFile[] = []
  const droppedFiles: string[] = []
  let totalTokens = 0

  for (const file of contextFiles) {
    if (totalTokens + file.tokens <= availableTokens) {
      // Include full file
      includedFiles.push(file)
      totalTokens += file.tokens
    } else if (totalTokens < availableTokens * 0.9) {
      // Try to include truncated version if we have space
      const remainingTokens = availableTokens - totalTokens
      if (remainingTokens > 500) {
        const truncatedContent = truncateToTokens(file.content, remainingTokens - 100)
        includedFiles.push({
          ...file,
          content: truncatedContent,
          tokens: estimateTokens(truncatedContent)
        })
        totalTokens += estimateTokens(truncatedContent)
      } else {
        droppedFiles.push(file.relativePath)
      }
    } else {
      droppedFiles.push(file.relativePath)
    }
  }

  return {
    files: includedFiles,
    totalTokens,
    truncated: droppedFiles.length > 0,
    droppedFiles
  }
}

/**
 * Format optimized context for Claude
 */
export function formatContextForClaude(result: ContextBudgetResult): string {
  if (result.files.length === 0) {
    return ''
  }

  const sections = result.files.map(f => {
    const ext = f.relativePath.split('.').pop() || 'text'
    return `## ${f.relativePath}\n\`\`\`${ext}\n${f.content}\n\`\`\``
  })

  let output = sections.join('\n\n')

  if (result.droppedFiles.length > 0) {
    output += `\n\n---\n_Note: ${result.droppedFiles.length} file(s) omitted due to context limits: ${result.droppedFiles.slice(0, 5).join(', ')}${result.droppedFiles.length > 5 ? '...' : ''}_`
  }

  return output
}

/**
 * Get context budget for agent type
 */
export function getAgentContextBudget(agentType: string): number {
  const budgets: Record<string, number> = {
    developer: 100000,
    'product-owner': 50000,
    tester: 80000,
    security: 60000,
    devops: 60000,
    documentation: 40000
  }
  return budgets[agentType] || 60000
}
