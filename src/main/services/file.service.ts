import { readdir, stat, readFile } from 'fs/promises'
import { join, extname, relative } from 'path'

export interface FileNode {
  name: string
  path: string
  relativePath: string
  type: 'file' | 'directory'
  children?: FileNode[]
  extension?: string
  size?: number
}

// Files and directories to ignore
const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  '.next',
  '.nuxt',
  'dist',
  'build',
  '.cache',
  'coverage',
  '__pycache__',
  '.pytest_cache',
  '.venv',
  'venv',
  '.DS_Store',
  'Thumbs.db',
  '.env',
  '.env.local',
  '*.log',
  '*.lock',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml'
]

// Supported file extensions for code context
const CODE_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.swift',
  '.c', '.cpp', '.h', '.hpp', '.cs',
  '.html', '.css', '.scss', '.sass', '.less',
  '.json', '.yaml', '.yml', '.toml', '.xml',
  '.md', '.mdx', '.txt', '.rst',
  '.sql', '.graphql', '.prisma',
  '.sh', '.bash', '.zsh', '.fish',
  '.dockerfile', '.docker-compose.yml',
  '.env.example', '.gitignore', '.eslintrc', '.prettierrc'
]

class FileService {
  /**
   * Check if a path should be ignored
   */
  private shouldIgnore(name: string): boolean {
    return IGNORE_PATTERNS.some(pattern => {
      if (pattern.startsWith('*')) {
        return name.endsWith(pattern.slice(1))
      }
      return name === pattern || name.startsWith(pattern)
    })
  }

  /**
   * Check if a file is a supported code file
   */
  isCodeFile(filePath: string): boolean {
    const ext = extname(filePath).toLowerCase()
    return CODE_EXTENSIONS.includes(ext) ||
           filePath.endsWith('Dockerfile') ||
           filePath.endsWith('Makefile')
  }

  /**
   * Get the file tree for a project directory
   */
  async getFileTree(projectPath: string, maxDepth: number = 4): Promise<FileNode[]> {
    return this.scanDirectory(projectPath, projectPath, 0, maxDepth)
  }

  private async scanDirectory(
    currentPath: string,
    rootPath: string,
    depth: number,
    maxDepth: number
  ): Promise<FileNode[]> {
    if (depth >= maxDepth) return []

    try {
      const entries = await readdir(currentPath, { withFileTypes: true })
      const nodes: FileNode[] = []

      // Sort: directories first, then files alphabetically
      const sorted = entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1
        if (!a.isDirectory() && b.isDirectory()) return 1
        return a.name.localeCompare(b.name)
      })

      for (const entry of sorted) {
        if (this.shouldIgnore(entry.name)) continue

        const fullPath = join(currentPath, entry.name)
        const relativePath = relative(rootPath, fullPath)

        if (entry.isDirectory()) {
          const children = await this.scanDirectory(fullPath, rootPath, depth + 1, maxDepth)
          // Only include directories that have files
          if (children.length > 0) {
            nodes.push({
              name: entry.name,
              path: fullPath,
              relativePath,
              type: 'directory',
              children
            })
          }
        } else if (this.isCodeFile(entry.name)) {
          const fileStat = await stat(fullPath)
          nodes.push({
            name: entry.name,
            path: fullPath,
            relativePath,
            type: 'file',
            extension: extname(entry.name),
            size: fileStat.size
          })
        }
      }

      return nodes
    } catch (error) {
      console.error(`Error scanning directory ${currentPath}:`, error)
      return []
    }
  }

  /**
   * Read file content
   */
  async readFileContent(filePath: string): Promise<string> {
    try {
      const content = await readFile(filePath, 'utf-8')
      return content
    } catch (error) {
      throw new Error(`Failed to read file: ${filePath}`)
    }
  }

  /**
   * Read multiple files and format them for context
   */
  async getFilesContext(filePaths: string[], rootPath: string): Promise<string> {
    const contexts: string[] = []

    for (const filePath of filePaths) {
      try {
        const content = await this.readFileContent(filePath)
        const relativePath = relative(rootPath, filePath)
        const ext = extname(filePath).slice(1) || 'text'

        contexts.push(`## File: ${relativePath}\n\`\`\`${ext}\n${content}\n\`\`\``)
      } catch (error) {
        contexts.push(`## File: ${filePath}\n[Error reading file]`)
      }
    }

    return contexts.join('\n\n')
  }

  /**
   * Get project summary (README, package.json, etc.)
   */
  async getProjectSummary(projectPath: string): Promise<string> {
    const summaryFiles = [
      'README.md',
      'readme.md',
      'README.txt',
      'package.json',
      'requirements.txt',
      'Cargo.toml',
      'go.mod',
      'pyproject.toml',
      'Gemfile',
      'pom.xml',
      'build.gradle'
    ]

    const contexts: string[] = []

    for (const fileName of summaryFiles) {
      const filePath = join(projectPath, fileName)
      try {
        const content = await this.readFileContent(filePath)
        contexts.push(`## ${fileName}\n${content}`)
      } catch {
        // File doesn't exist, skip
      }
    }

    return contexts.length > 0
      ? contexts.join('\n\n---\n\n')
      : 'No project summary files found (README.md, package.json, etc.)'
  }
}

export const fileService = new FileService()
