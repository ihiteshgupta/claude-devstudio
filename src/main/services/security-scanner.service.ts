import { EventEmitter } from 'events'
import { spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { databaseService } from './database.service'
import { claudeService } from './claude.service'
import { bugReportService } from './bug-report.service'

export type VulnerabilitySeverity = 'critical' | 'high' | 'moderate' | 'low' | 'info'
export type ScanType = 'dependency' | 'code' | 'secrets' | 'license' | 'sast'
export type FindingStatus = 'open' | 'acknowledged' | 'fixed' | 'false_positive'

export interface SecurityFinding {
  id: string
  projectId: string
  scanId: string
  type: ScanType
  severity: VulnerabilitySeverity
  title: string
  description: string
  filePath?: string
  lineNumber?: number
  codeSnippet?: string
  cwe?: string
  cve?: string
  packageName?: string
  packageVersion?: string
  fixedVersion?: string
  recommendation: string
  status: FindingStatus
  createdAt: Date
  updatedAt: Date
}

export interface SecurityScan {
  id: string
  projectId: string
  types: ScanType[]
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  findingsCount: Record<VulnerabilitySeverity, number>
  totalFindings: number
  duration: number
  startedAt: Date
  completedAt?: Date
  error?: string
}

export interface ScanConfig {
  projectId: string
  projectPath: string
  types?: ScanType[]
  createBugs?: boolean
  minSeverityForBug?: VulnerabilitySeverity
}

export interface DependencyVulnerability {
  name: string
  version: string
  severity: VulnerabilitySeverity
  title: string
  url?: string
  cve?: string
  fixedVersions?: string[]
  path?: string[]
}

const SEVERITY_LEVELS: VulnerabilitySeverity[] = ['critical', 'high', 'moderate', 'low', 'info']

class SecurityScannerService extends EventEmitter {
  private runningScans = new Map<string, { abort: () => void }>()

  /**
   * Run a security scan
   */
  async scan(config: ScanConfig): Promise<SecurityScan> {
    const scanId = `scan_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    const startedAt = new Date()
    const types = config.types || ['dependency', 'code', 'secrets']

    this.emit('scan-started', { scanId, projectId: config.projectId, types })

    let aborted = false
    const abortController = { abort: () => { aborted = true } }
    this.runningScans.set(scanId, abortController)

    const findings: SecurityFinding[] = []
    let error: string | undefined

    try {
      // Run dependency audit
      if (types.includes('dependency') && !aborted) {
        this.emit('scan-phase', { scanId, phase: 'dependency' })
        const depFindings = await this.scanDependencies(config.projectPath, config.projectId, scanId)
        findings.push(...depFindings)
      }

      // Run code analysis for secrets
      if (types.includes('secrets') && !aborted) {
        this.emit('scan-phase', { scanId, phase: 'secrets' })
        const secretFindings = await this.scanSecrets(config.projectPath, config.projectId, scanId)
        findings.push(...secretFindings)
      }

      // Run static code analysis
      if (types.includes('code') && !aborted) {
        this.emit('scan-phase', { scanId, phase: 'code' })
        const codeFindings = await this.scanCode(config.projectPath, config.projectId, scanId)
        findings.push(...codeFindings)
      }

      // Store findings in database
      for (const finding of findings) {
        this.storeFinding(finding)
      }

      // Create bugs for high-severity findings
      if (config.createBugs) {
        const minSeverity = config.minSeverityForBug || 'high'
        const severityIndex = SEVERITY_LEVELS.indexOf(minSeverity)
        const bugFindings = findings.filter(f =>
          SEVERITY_LEVELS.indexOf(f.severity) <= severityIndex
        )

        for (const finding of bugFindings) {
          await this.createBugFromFinding(finding, config.projectPath)
        }
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    } finally {
      this.runningScans.delete(scanId)
    }

    const completedAt = new Date()

    // Count findings by severity
    const findingsCount: Record<VulnerabilitySeverity, number> = {
      critical: 0, high: 0, moderate: 0, low: 0, info: 0
    }
    findings.forEach(f => { findingsCount[f.severity]++ })

    const scan: SecurityScan = {
      id: scanId,
      projectId: config.projectId,
      types,
      status: aborted ? 'cancelled' : error ? 'failed' : 'completed',
      findingsCount,
      totalFindings: findings.length,
      duration: completedAt.getTime() - startedAt.getTime(),
      startedAt,
      completedAt,
      error
    }

    // Store scan record
    this.storeScan(scan)

    this.emit('scan-completed', {
      scanId,
      status: scan.status,
      totalFindings: scan.totalFindings,
      findingsCount
    })

    return scan
  }

  /**
   * Scan npm dependencies for vulnerabilities
   */
  private async scanDependencies(
    projectPath: string,
    projectId: string,
    scanId: string
  ): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = []

    try {
      const result = await this.runCommand('npm', ['audit', '--json'], projectPath)
      const audit = JSON.parse(result.stdout || '{}')

      if (audit.vulnerabilities) {
        for (const [pkgName, vuln] of Object.entries(audit.vulnerabilities) as any[]) {
          const severity = this.mapNpmSeverity(vuln.severity)

          findings.push({
            id: `finding_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            projectId,
            scanId,
            type: 'dependency',
            severity,
            title: `Vulnerability in ${pkgName}@${vuln.range || 'unknown'}`,
            description: vuln.via?.map((v: any) => typeof v === 'string' ? v : v.title).join(', ') || 'No description',
            packageName: pkgName,
            packageVersion: vuln.range,
            fixedVersion: vuln.fixAvailable?.version,
            cve: vuln.via?.find((v: any) => v.cve)?.cve,
            recommendation: vuln.fixAvailable
              ? `Update to version ${vuln.fixAvailable.version}`
              : 'No fix available - consider alternative package',
            status: 'open',
            createdAt: new Date(),
            updatedAt: new Date()
          })
        }
      }
    } catch {
      // npm audit may fail or not be available
    }

    return findings
  }

  /**
   * Scan for hardcoded secrets and credentials
   */
  private async scanSecrets(
    projectPath: string,
    projectId: string,
    scanId: string
  ): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = []

    // Patterns to detect secrets
    const secretPatterns = [
      { pattern: /(['"])[A-Za-z0-9+/]{40,}={0,2}\1/g, name: 'Base64 encoded secret', severity: 'moderate' as VulnerabilitySeverity },
      { pattern: /api[_-]?key\s*[:=]\s*(['"])[^'"]{20,}\1/gi, name: 'API Key', severity: 'high' as VulnerabilitySeverity },
      { pattern: /secret[_-]?key\s*[:=]\s*(['"])[^'"]{20,}\1/gi, name: 'Secret Key', severity: 'high' as VulnerabilitySeverity },
      { pattern: /password\s*[:=]\s*(['"])[^'"]{8,}\1/gi, name: 'Hardcoded Password', severity: 'critical' as VulnerabilitySeverity },
      { pattern: /private[_-]?key\s*[:=]\s*(['"])[^'"]+\1/gi, name: 'Private Key', severity: 'critical' as VulnerabilitySeverity },
      { pattern: /aws[_-]?access[_-]?key[_-]?id\s*[:=]\s*(['"])[A-Z0-9]{20}\1/gi, name: 'AWS Access Key', severity: 'critical' as VulnerabilitySeverity },
      { pattern: /ghp_[A-Za-z0-9]{36}/g, name: 'GitHub Personal Access Token', severity: 'critical' as VulnerabilitySeverity },
      { pattern: /sk-[A-Za-z0-9]{32,}/g, name: 'OpenAI API Key', severity: 'critical' as VulnerabilitySeverity },
      { pattern: /bearer\s+[A-Za-z0-9._-]{20,}/gi, name: 'Bearer Token', severity: 'high' as VulnerabilitySeverity }
    ]

    // File extensions to scan
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.env', '.yaml', '.yml', '.config']
    const excludeDirs = ['node_modules', '.git', 'dist', 'build', 'coverage']

    const filesToScan = this.collectFiles(projectPath, extensions, excludeDirs)

    for (const filePath of filesToScan) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8')
        const lines = content.split('\n')
        const relativePath = path.relative(projectPath, filePath)

        for (const { pattern, name, severity } of secretPatterns) {
          pattern.lastIndex = 0 // Reset regex state

          for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            const line = lines[lineNum]
            if (pattern.test(line)) {
              findings.push({
                id: `finding_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
                projectId,
                scanId,
                type: 'secrets',
                severity,
                title: `Potential ${name} detected`,
                description: `Found a potential ${name} in the source code`,
                filePath: relativePath,
                lineNumber: lineNum + 1,
                codeSnippet: this.sanitizeSecret(line.trim()),
                cwe: 'CWE-798',
                recommendation: 'Move secrets to environment variables or a secure secret manager',
                status: 'open',
                createdAt: new Date(),
                updatedAt: new Date()
              })
            }
            pattern.lastIndex = 0 // Reset after each line
          }
        }
      } catch {
        // Skip files that can't be read
      }
    }

    return findings
  }

  /**
   * Run static code analysis
   */
  private async scanCode(
    projectPath: string,
    projectId: string,
    scanId: string
  ): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = []

    // Security anti-patterns to detect
    const codePatterns = [
      {
        pattern: /eval\s*\(/g,
        name: 'Use of eval()',
        severity: 'high' as VulnerabilitySeverity,
        cwe: 'CWE-95',
        recommendation: 'Avoid using eval() - use safer alternatives'
      },
      {
        pattern: /innerHTML\s*=/g,
        name: 'innerHTML assignment',
        severity: 'moderate' as VulnerabilitySeverity,
        cwe: 'CWE-79',
        recommendation: 'Use textContent or sanitize HTML to prevent XSS'
      },
      {
        pattern: /document\.write\s*\(/g,
        name: 'document.write usage',
        severity: 'moderate' as VulnerabilitySeverity,
        cwe: 'CWE-79',
        recommendation: 'Use DOM manipulation methods instead'
      },
      {
        pattern: /dangerouslySetInnerHTML/g,
        name: 'dangerouslySetInnerHTML in React',
        severity: 'moderate' as VulnerabilitySeverity,
        cwe: 'CWE-79',
        recommendation: 'Sanitize HTML content before rendering'
      },
      {
        pattern: /new\s+Function\s*\(/g,
        name: 'Dynamic function creation',
        severity: 'high' as VulnerabilitySeverity,
        cwe: 'CWE-95',
        recommendation: 'Avoid dynamic code execution'
      },
      {
        pattern: /exec\s*\(\s*[^)]+\+/g,
        name: 'Command injection risk',
        severity: 'critical' as VulnerabilitySeverity,
        cwe: 'CWE-78',
        recommendation: 'Sanitize inputs before command execution'
      },
      {
        pattern: /\.query\s*\(\s*[`'"][^`'"]*\$\{/g,
        name: 'SQL injection risk',
        severity: 'critical' as VulnerabilitySeverity,
        cwe: 'CWE-89',
        recommendation: 'Use parameterized queries'
      },
      {
        pattern: /createHash\s*\(\s*['"]md5['"]\s*\)/g,
        name: 'Weak cryptographic hash (MD5)',
        severity: 'moderate' as VulnerabilitySeverity,
        cwe: 'CWE-328',
        recommendation: 'Use SHA-256 or stronger hashing algorithms'
      },
      {
        pattern: /Math\.random\s*\(\s*\)/g,
        name: 'Insecure random number generation',
        severity: 'low' as VulnerabilitySeverity,
        cwe: 'CWE-338',
        recommendation: 'Use crypto.randomBytes for security-sensitive operations'
      }
    ]

    const extensions = ['.ts', '.tsx', '.js', '.jsx']
    const excludeDirs = ['node_modules', '.git', 'dist', 'build']
    const filesToScan = this.collectFiles(projectPath, extensions, excludeDirs)

    for (const filePath of filesToScan) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8')
        const lines = content.split('\n')
        const relativePath = path.relative(projectPath, filePath)

        for (const { pattern, name, severity, cwe, recommendation } of codePatterns) {
          pattern.lastIndex = 0

          for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            const line = lines[lineNum]
            if (pattern.test(line)) {
              findings.push({
                id: `finding_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
                projectId,
                scanId,
                type: 'sast',
                severity,
                title: name,
                description: `Detected ${name} which may pose a security risk`,
                filePath: relativePath,
                lineNumber: lineNum + 1,
                codeSnippet: line.trim().substring(0, 200),
                cwe,
                recommendation,
                status: 'open',
                createdAt: new Date(),
                updatedAt: new Date()
              })
            }
            pattern.lastIndex = 0
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    return findings
  }

  /**
   * Collect files for scanning
   */
  private collectFiles(
    dir: string,
    extensions: string[],
    excludeDirs: string[]
  ): string[] {
    const files: string[] = []

    const walk = (currentDir: string) => {
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true })

        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name)

          if (entry.isDirectory()) {
            if (!excludeDirs.includes(entry.name)) {
              walk(fullPath)
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase()
            if (extensions.includes(ext)) {
              files.push(fullPath)
            }
          }
        }
      } catch {
        // Skip inaccessible directories
      }
    }

    walk(dir)
    return files.slice(0, 1000) // Limit to prevent excessive scanning
  }

  /**
   * Sanitize secrets in code snippets
   */
  private sanitizeSecret(line: string): string {
    // Replace potential secrets with asterisks
    return line.replace(/(['"])[A-Za-z0-9+/=_-]{20,}\1/g, '"***REDACTED***"')
  }

  /**
   * Map npm severity to our severity levels
   */
  private mapNpmSeverity(npmSeverity: string): VulnerabilitySeverity {
    const map: Record<string, VulnerabilitySeverity> = {
      critical: 'critical',
      high: 'high',
      moderate: 'moderate',
      low: 'low',
      info: 'info'
    }
    return map[npmSeverity] || 'moderate'
  }

  /**
   * Run a command and capture output
   */
  private runCommand(
    command: string,
    args: string[],
    cwd: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
    return new Promise(resolve => {
      let stdout = ''
      let stderr = ''

      const proc = spawn(command, args, { cwd, shell: true })

      proc.stdout.on('data', data => { stdout += data.toString() })
      proc.stderr.on('data', data => { stderr += data.toString() })

      proc.on('close', code => {
        resolve({ stdout, stderr, exitCode: code })
      })

      proc.on('error', () => {
        resolve({ stdout, stderr, exitCode: null })
      })
    })
  }

  /**
   * Create a bug from a security finding
   */
  private async createBugFromFinding(
    finding: SecurityFinding,
    projectPath: string
  ): Promise<void> {
    try {
      await bugReportService.create({
        projectId: finding.projectId,
        title: `[Security] ${finding.title}`,
        description: `${finding.description}\n\nRecommendation: ${finding.recommendation}`,
        severity: finding.severity === 'critical' ? 'critical' :
                  finding.severity === 'high' ? 'high' :
                  finding.severity === 'moderate' ? 'medium' : 'low',
        source: 'security_scan',
        sourceId: finding.id,
        filePath: finding.filePath,
        lineNumber: finding.lineNumber,
        labels: ['security', finding.type, finding.cwe || ''].filter(Boolean)
      })
    } catch (error) {
      this.emit('bug-creation-error', {
        findingId: finding.id,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  /**
   * Store scan in database
   */
  private storeScan(scan: SecurityScan): void {
    const db = databaseService.getDb()

    db.prepare(`
      INSERT INTO security_scans (
        id, project_id, types, status, findings_count_json,
        total_findings, duration, started_at, completed_at, error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      scan.id,
      scan.projectId,
      JSON.stringify(scan.types),
      scan.status,
      JSON.stringify(scan.findingsCount),
      scan.totalFindings,
      scan.duration,
      scan.startedAt.toISOString(),
      scan.completedAt?.toISOString() || null,
      scan.error || null
    )
  }

  /**
   * Store finding in database
   */
  private storeFinding(finding: SecurityFinding): void {
    const db = databaseService.getDb()

    db.prepare(`
      INSERT INTO security_findings (
        id, project_id, scan_id, type, severity, title, description,
        file_path, line_number, code_snippet, cwe, cve,
        package_name, package_version, fixed_version, recommendation,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      finding.id,
      finding.projectId,
      finding.scanId,
      finding.type,
      finding.severity,
      finding.title,
      finding.description,
      finding.filePath || null,
      finding.lineNumber || null,
      finding.codeSnippet || null,
      finding.cwe || null,
      finding.cve || null,
      finding.packageName || null,
      finding.packageVersion || null,
      finding.fixedVersion || null,
      finding.recommendation,
      finding.status,
      finding.createdAt.toISOString(),
      finding.updatedAt.toISOString()
    )
  }

  /**
   * Update finding status
   */
  updateFindingStatus(id: string, status: FindingStatus): SecurityFinding | null {
    const db = databaseService.getDb()
    const now = new Date().toISOString()

    db.prepare('UPDATE security_findings SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, now, id)

    return this.getFinding(id)
  }

  /**
   * Get finding by ID
   */
  getFinding(id: string): SecurityFinding | null {
    const db = databaseService.getDb()
    const row = db.prepare('SELECT * FROM security_findings WHERE id = ?').get(id) as any

    if (!row) return null
    return this.rowToFinding(row)
  }

  /**
   * Get findings for a project
   */
  getFindings(
    projectId: string,
    options: {
      status?: FindingStatus[]
      severity?: VulnerabilitySeverity[]
      type?: ScanType[]
      limit?: number
    } = {}
  ): SecurityFinding[] {
    const db = databaseService.getDb()

    let query = 'SELECT * FROM security_findings WHERE project_id = ?'
    const params: any[] = [projectId]

    if (options.status?.length) {
      query += ` AND status IN (${options.status.map(() => '?').join(',')})`
      params.push(...options.status)
    }

    if (options.severity?.length) {
      query += ` AND severity IN (${options.severity.map(() => '?').join(',')})`
      params.push(...options.severity)
    }

    if (options.type?.length) {
      query += ` AND type IN (${options.type.map(() => '?').join(',')})`
      params.push(...options.type)
    }

    query += ' ORDER BY created_at DESC'

    if (options.limit) {
      query += ' LIMIT ?'
      params.push(options.limit)
    }

    const rows = db.prepare(query).all(...params) as any[]
    return rows.map(row => this.rowToFinding(row))
  }

  /**
   * Get recent scans
   */
  getRecentScans(projectId: string, limit = 10): SecurityScan[] {
    const db = databaseService.getDb()

    const rows = db.prepare(`
      SELECT * FROM security_scans
      WHERE project_id = ?
      ORDER BY started_at DESC
      LIMIT ?
    `).all(projectId, limit) as any[]

    return rows.map(row => this.rowToScan(row))
  }

  /**
   * Cancel a running scan
   */
  cancel(scanId: string): boolean {
    const controller = this.runningScans.get(scanId)
    if (controller) {
      controller.abort()
      return true
    }
    return false
  }

  /**
   * Get security summary for a project
   */
  getSummary(projectId: string): {
    openFindings: Record<VulnerabilitySeverity, number>
    lastScanDate: Date | null
    totalScans: number
    fixedLast30Days: number
  } {
    const db = databaseService.getDb()

    const openFindings: Record<VulnerabilitySeverity, number> = {
      critical: 0, high: 0, moderate: 0, low: 0, info: 0
    }

    const openRows = db.prepare(`
      SELECT severity, COUNT(*) as count FROM security_findings
      WHERE project_id = ? AND status = 'open'
      GROUP BY severity
    `).all(projectId) as any[]

    openRows.forEach(r => { openFindings[r.severity as VulnerabilitySeverity] = r.count })

    const lastScan = db.prepare(`
      SELECT started_at FROM security_scans
      WHERE project_id = ? ORDER BY started_at DESC LIMIT 1
    `).get(projectId) as any

    const totalScans = db.prepare(`
      SELECT COUNT(*) as count FROM security_scans WHERE project_id = ?
    `).get(projectId) as any

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const fixedRecent = db.prepare(`
      SELECT COUNT(*) as count FROM security_findings
      WHERE project_id = ? AND status = 'fixed' AND updated_at >= ?
    `).get(projectId, thirtyDaysAgo) as any

    return {
      openFindings,
      lastScanDate: lastScan ? new Date(lastScan.started_at) : null,
      totalScans: totalScans.count,
      fixedLast30Days: fixedRecent.count
    }
  }

  private rowToFinding(row: any): SecurityFinding {
    return {
      id: row.id,
      projectId: row.project_id,
      scanId: row.scan_id,
      type: row.type,
      severity: row.severity,
      title: row.title,
      description: row.description,
      filePath: row.file_path,
      lineNumber: row.line_number,
      codeSnippet: row.code_snippet,
      cwe: row.cwe,
      cve: row.cve,
      packageName: row.package_name,
      packageVersion: row.package_version,
      fixedVersion: row.fixed_version,
      recommendation: row.recommendation,
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }
  }

  private rowToScan(row: any): SecurityScan {
    return {
      id: row.id,
      projectId: row.project_id,
      types: JSON.parse(row.types || '[]'),
      status: row.status,
      findingsCount: JSON.parse(row.findings_count_json || '{}'),
      totalFindings: row.total_findings,
      duration: row.duration,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      error: row.error
    }
  }
}

export const securityScannerService = new SecurityScannerService()
