import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import path from 'path'
import fs from 'fs'
import { databaseService } from './database.service'
import { gitAutomationService } from './git-automation.service'

export type Environment = 'development' | 'staging' | 'production'
export type DeploymentStatus = 'pending' | 'building' | 'deploying' | 'success' | 'failed' | 'rolled_back'

export interface BuildConfig {
  command: string
  args: string[]
  env?: Record<string, string>
  outputDir?: string
}

export interface BuildResult {
  id: string
  projectId: string
  status: 'success' | 'failed'
  startTime: Date
  endTime: Date
  duration: number
  outputDir?: string
  artifacts: string[]
  logs: string
  gitCommit?: string
  gitBranch?: string
  errorMessage?: string
}

export interface DeploymentConfig {
  environment: Environment
  buildId?: string
  artifactPath?: string
  preDeployHooks?: string[]
  postDeployHooks?: string[]
  healthCheckUrl?: string
  healthCheckTimeout?: number
  rollbackOnFailure?: boolean
}

export interface Deployment {
  id: string
  projectId: string
  buildId?: string
  environment: Environment
  status: DeploymentStatus
  startTime: Date
  endTime?: Date
  duration?: number
  gitCommit?: string
  gitTag?: string
  deployedBy: string
  healthCheckPassed?: boolean
  errorMessage?: string
  rollbackFromId?: string
}

export interface HealthCheckResult {
  passed: boolean
  statusCode?: number
  responseTime?: number
  errorMessage?: string
}

class DeploymentService extends EventEmitter {
  private runningProcess: ChildProcess | null = null
  private isBuilding = false
  private isDeploying = false

  // ============ Build Operations ============

  /**
   * Run a build for a project
   */
  async runBuild(
    projectPath: string,
    projectId: string,
    options: {
      taskId?: string
      config?: Partial<BuildConfig>
    } = {}
  ): Promise<BuildResult> {
    if (this.isBuilding) {
      throw new Error('Build already in progress')
    }

    const buildId = `build_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    const startTime = new Date()
    this.isBuilding = true

    this.emit('build-started', { buildId, projectId, projectPath })

    try {
      // Detect build configuration
      const config = await this.detectBuildConfig(projectPath, options.config)

      // Get git info
      const gitInfo = await this.getGitInfo(projectPath)

      // Run the build
      const buildOutput = await this.executeBuild(projectPath, config)
      const endTime = new Date()

      // Find artifacts
      const artifacts = await this.findArtifacts(projectPath, config.outputDir)

      const result: BuildResult = {
        id: buildId,
        projectId,
        status: buildOutput.success ? 'success' : 'failed',
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        outputDir: config.outputDir,
        artifacts,
        logs: buildOutput.logs,
        gitCommit: gitInfo.commit,
        gitBranch: gitInfo.branch,
        errorMessage: buildOutput.error
      }

      // Store build result
      await this.storeBuildResult(result, options.taskId)

      this.emit('build-completed', result)
      return result
    } catch (error) {
      const endTime = new Date()
      const result: BuildResult = {
        id: buildId,
        projectId,
        status: 'failed',
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        artifacts: [],
        logs: '',
        errorMessage: error instanceof Error ? error.message : String(error)
      }

      this.emit('build-failed', result)
      return result
    } finally {
      this.isBuilding = false
      this.runningProcess = null
    }
  }

  /**
   * Detect build configuration from project
   */
  private async detectBuildConfig(
    projectPath: string,
    overrides?: Partial<BuildConfig>
  ): Promise<BuildConfig> {
    const packageJsonPath = path.join(projectPath, 'package.json')

    let defaultConfig: BuildConfig = {
      command: 'npm',
      args: ['run', 'build'],
      outputDir: 'dist'
    }

    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
      const scripts = packageJson.scripts || {}

      // Detect output directory
      if (fs.existsSync(path.join(projectPath, 'vite.config.ts'))) {
        defaultConfig.outputDir = 'dist'
      } else if (fs.existsSync(path.join(projectPath, 'next.config.js'))) {
        defaultConfig.outputDir = '.next'
      } else if (fs.existsSync(path.join(projectPath, 'angular.json'))) {
        defaultConfig.outputDir = 'dist'
      }

      // Check for yarn or pnpm
      if (fs.existsSync(path.join(projectPath, 'yarn.lock'))) {
        defaultConfig.command = 'yarn'
        defaultConfig.args = ['build']
      } else if (fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml'))) {
        defaultConfig.command = 'pnpm'
        defaultConfig.args = ['build']
      }

      // Check for specific build scripts
      if (scripts['build:prod']) {
        defaultConfig.args = ['run', 'build:prod']
      } else if (scripts['build:production']) {
        defaultConfig.args = ['run', 'build:production']
      }
    } catch {
      // Use defaults
    }

    return { ...defaultConfig, ...overrides }
  }

  /**
   * Execute the build command
   */
  private async executeBuild(
    projectPath: string,
    config: BuildConfig
  ): Promise<{ success: boolean; logs: string; error?: string }> {
    return new Promise((resolve) => {
      let logs = ''
      let errorOutput = ''

      this.runningProcess = spawn(config.command, config.args, {
        cwd: projectPath,
        shell: true,
        env: { ...process.env, ...config.env, CI: 'true', NODE_ENV: 'production' }
      })

      this.runningProcess.stdout?.on('data', (data) => {
        const chunk = data.toString()
        logs += chunk
        this.emit('build-output', { type: 'stdout', content: chunk })
      })

      this.runningProcess.stderr?.on('data', (data) => {
        const chunk = data.toString()
        errorOutput += chunk
        logs += chunk
        this.emit('build-output', { type: 'stderr', content: chunk })
      })

      this.runningProcess.on('close', (code) => {
        resolve({
          success: code === 0,
          logs,
          error: code !== 0 ? errorOutput || 'Build failed with exit code ' + code : undefined
        })
      })

      this.runningProcess.on('error', (error) => {
        resolve({
          success: false,
          logs,
          error: error.message
        })
      })
    })
  }

  /**
   * Find build artifacts
   */
  private async findArtifacts(projectPath: string, outputDir?: string): Promise<string[]> {
    const artifacts: string[] = []

    if (!outputDir) return artifacts

    const fullPath = path.join(projectPath, outputDir)
    if (!fs.existsSync(fullPath)) return artifacts

    // List top-level files and directories in output
    try {
      const entries = fs.readdirSync(fullPath, { withFileTypes: true })
      for (const entry of entries) {
        artifacts.push(path.join(outputDir, entry.name))
      }
    } catch {
      // Output directory might not exist
    }

    return artifacts
  }

  /**
   * Get current git info
   */
  private async getGitInfo(projectPath: string): Promise<{ commit?: string; branch?: string }> {
    try {
      const { execSync } = await import('child_process')
      const commit = execSync('git rev-parse HEAD', { cwd: projectPath }).toString().trim()
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: projectPath }).toString().trim()
      return { commit, branch }
    } catch {
      return {}
    }
  }

  /**
   * Store build result in database
   */
  private async storeBuildResult(result: BuildResult, taskId?: string): Promise<void> {
    const db = databaseService.getDb()

    db.prepare(`
      INSERT INTO builds (
        id, project_id, task_id, status, start_time, end_time, duration,
        output_dir, artifacts, logs, git_commit, git_branch, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      result.id,
      result.projectId,
      taskId || null,
      result.status,
      result.startTime.toISOString(),
      result.endTime.toISOString(),
      result.duration,
      result.outputDir || null,
      JSON.stringify(result.artifacts),
      result.logs.substring(0, 100000), // Limit log size
      result.gitCommit || null,
      result.gitBranch || null,
      result.errorMessage || null
    )
  }

  // ============ Deployment Operations ============

  /**
   * Deploy to an environment
   */
  async deploy(
    projectPath: string,
    projectId: string,
    config: DeploymentConfig
  ): Promise<Deployment> {
    if (this.isDeploying) {
      throw new Error('Deployment already in progress')
    }

    const deploymentId = `deploy_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    const startTime = new Date()
    this.isDeploying = true

    const deployment: Deployment = {
      id: deploymentId,
      projectId,
      buildId: config.buildId,
      environment: config.environment,
      status: 'deploying',
      startTime,
      deployedBy: 'autonomous-system',
      gitCommit: await this.getGitInfo(projectPath).then(i => i.commit)
    }

    this.emit('deployment-started', deployment)

    try {
      // Run pre-deploy hooks
      if (config.preDeployHooks) {
        for (const hook of config.preDeployHooks) {
          await this.runHook(projectPath, hook)
        }
      }

      // Execute deployment based on environment
      await this.executeDeployment(projectPath, config)

      // Run health check if configured
      if (config.healthCheckUrl) {
        const healthCheck = await this.runHealthCheck(
          config.healthCheckUrl,
          config.healthCheckTimeout || 30000
        )

        deployment.healthCheckPassed = healthCheck.passed

        if (!healthCheck.passed && config.rollbackOnFailure) {
          deployment.status = 'failed'
          deployment.errorMessage = `Health check failed: ${healthCheck.errorMessage}`

          // Trigger rollback
          await this.rollback(projectPath, projectId, config.environment)
          deployment.status = 'rolled_back'
        }
      }

      // Run post-deploy hooks
      if (config.postDeployHooks && deployment.status !== 'rolled_back') {
        for (const hook of config.postDeployHooks) {
          await this.runHook(projectPath, hook)
        }
      }

      if (deployment.status === 'deploying') {
        deployment.status = 'success'
      }

      deployment.endTime = new Date()
      deployment.duration = deployment.endTime.getTime() - startTime.getTime()

      // Store deployment
      await this.storeDeployment(deployment)

      this.emit('deployment-completed', deployment)
      return deployment
    } catch (error) {
      deployment.status = 'failed'
      deployment.errorMessage = error instanceof Error ? error.message : String(error)
      deployment.endTime = new Date()
      deployment.duration = deployment.endTime.getTime() - startTime.getTime()

      await this.storeDeployment(deployment)

      if (config.rollbackOnFailure) {
        await this.rollback(projectPath, projectId, config.environment)
        deployment.status = 'rolled_back'
      }

      this.emit('deployment-failed', deployment)
      return deployment
    } finally {
      this.isDeploying = false
    }
  }

  /**
   * Execute the deployment
   */
  private async executeDeployment(
    projectPath: string,
    config: DeploymentConfig
  ): Promise<void> {
    const packageJsonPath = path.join(projectPath, 'package.json')

    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
      const scripts = packageJson.scripts || {}

      // Check for environment-specific deploy scripts
      const deployScript = scripts[`deploy:${config.environment}`] ||
                          scripts['deploy'] ||
                          null

      if (deployScript) {
        await this.runCommand(projectPath, 'npm', ['run', `deploy:${config.environment}`])
      } else {
        // Log that no deploy script was found
        this.emit('deployment-output', {
          type: 'info',
          content: `No deploy script found for ${config.environment}. Deployment is a no-op.`
        })
      }
    } catch (error) {
      throw new Error(`Deployment execution failed: ${error instanceof Error ? error.message : error}`)
    }
  }

  /**
   * Run a deployment hook
   */
  private async runHook(projectPath: string, hook: string): Promise<void> {
    const [command, ...args] = hook.split(' ')
    await this.runCommand(projectPath, command, args)
  }

  /**
   * Run a command
   */
  private async runCommand(
    projectPath: string,
    command: string,
    args: string[]
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      let stdout = ''
      let stderr = ''

      const proc = spawn(command, args, {
        cwd: projectPath,
        shell: true,
        env: { ...process.env, CI: 'true' }
      })

      proc.stdout?.on('data', (data) => {
        stdout += data.toString()
        this.emit('deployment-output', { type: 'stdout', content: data.toString() })
      })

      proc.stderr?.on('data', (data) => {
        stderr += data.toString()
        this.emit('deployment-output', { type: 'stderr', content: data.toString() })
      })

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr })
        } else {
          reject(new Error(`Command failed with exit code ${code}: ${stderr}`))
        }
      })

      proc.on('error', reject)
    })
  }

  /**
   * Run a health check
   */
  private async runHealthCheck(
    url: string,
    timeout: number
  ): Promise<HealthCheckResult> {
    const startTime = Date.now()

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      const responseTime = Date.now() - startTime

      if (response.ok) {
        return {
          passed: true,
          statusCode: response.status,
          responseTime
        }
      } else {
        return {
          passed: false,
          statusCode: response.status,
          responseTime,
          errorMessage: `HTTP ${response.status}: ${response.statusText}`
        }
      }
    } catch (error) {
      return {
        passed: false,
        responseTime: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Rollback to previous deployment
   */
  async rollback(
    projectPath: string,
    projectId: string,
    environment: Environment
  ): Promise<Deployment | null> {
    const db = databaseService.getDb()

    // Get last successful deployment
    const lastSuccessful = db.prepare(`
      SELECT * FROM deployments
      WHERE project_id = ? AND environment = ? AND status = 'success'
      ORDER BY start_time DESC
      LIMIT 1 OFFSET 1
    `).get(projectId, environment) as any

    if (!lastSuccessful) {
      this.emit('rollback-failed', { projectId, environment, reason: 'No previous deployment found' })
      return null
    }

    // Create rollback deployment
    const rollbackId = `deploy_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    const startTime = new Date()

    const rollback: Deployment = {
      id: rollbackId,
      projectId,
      buildId: lastSuccessful.build_id,
      environment,
      status: 'deploying',
      startTime,
      deployedBy: 'rollback-system',
      gitCommit: lastSuccessful.git_commit,
      rollbackFromId: lastSuccessful.id
    }

    this.emit('rollback-started', rollback)

    try {
      // Checkout the previous commit if available
      if (lastSuccessful.git_commit) {
        await gitAutomationService.cherryPick(projectPath, lastSuccessful.git_commit)
      }

      // Re-run deployment for that commit
      const packageJsonPath = path.join(projectPath, 'package.json')
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
      const scripts = packageJson.scripts || {}

      if (scripts[`deploy:${environment}`]) {
        await this.runCommand(projectPath, 'npm', ['run', `deploy:${environment}`])
      }

      rollback.status = 'success'
      rollback.endTime = new Date()
      rollback.duration = rollback.endTime.getTime() - startTime.getTime()

      await this.storeDeployment(rollback)

      this.emit('rollback-completed', rollback)
      return rollback
    } catch (error) {
      rollback.status = 'failed'
      rollback.errorMessage = error instanceof Error ? error.message : String(error)
      rollback.endTime = new Date()
      rollback.duration = rollback.endTime.getTime() - startTime.getTime()

      await this.storeDeployment(rollback)

      this.emit('rollback-failed', rollback)
      return rollback
    }
  }

  /**
   * Store deployment in database
   */
  private async storeDeployment(deployment: Deployment): Promise<void> {
    const db = databaseService.getDb()

    db.prepare(`
      INSERT OR REPLACE INTO deployments (
        id, project_id, build_id, environment, status, start_time, end_time,
        duration, git_commit, git_tag, deployed_by, health_check_passed,
        error_message, rollback_from_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      deployment.id,
      deployment.projectId,
      deployment.buildId || null,
      deployment.environment,
      deployment.status,
      deployment.startTime.toISOString(),
      deployment.endTime?.toISOString() || null,
      deployment.duration || null,
      deployment.gitCommit || null,
      deployment.gitTag || null,
      deployment.deployedBy,
      deployment.healthCheckPassed === undefined ? null : deployment.healthCheckPassed ? 1 : 0,
      deployment.errorMessage || null,
      deployment.rollbackFromId || null
    )
  }

  // ============ Query Operations ============

  /**
   * Get recent builds
   */
  getRecentBuilds(projectId: string, limit: number = 20): BuildResult[] {
    const db = databaseService.getDb()

    const rows = db.prepare(`
      SELECT * FROM builds
      WHERE project_id = ?
      ORDER BY start_time DESC
      LIMIT ?
    `).all(projectId, limit) as any[]

    return rows.map(row => ({
      id: row.id,
      projectId: row.project_id,
      status: row.status,
      startTime: new Date(row.start_time),
      endTime: new Date(row.end_time),
      duration: row.duration,
      outputDir: row.output_dir,
      artifacts: JSON.parse(row.artifacts || '[]'),
      logs: row.logs,
      gitCommit: row.git_commit,
      gitBranch: row.git_branch,
      errorMessage: row.error_message
    }))
  }

  /**
   * Get recent deployments
   */
  getRecentDeployments(
    projectId: string,
    environment?: Environment,
    limit: number = 20
  ): Deployment[] {
    const db = databaseService.getDb()

    let query = `SELECT * FROM deployments WHERE project_id = ?`
    const params: any[] = [projectId]

    if (environment) {
      query += ' AND environment = ?'
      params.push(environment)
    }

    query += ' ORDER BY start_time DESC LIMIT ?'
    params.push(limit)

    const rows = db.prepare(query).all(...params) as any[]

    return rows.map(row => ({
      id: row.id,
      projectId: row.project_id,
      buildId: row.build_id,
      environment: row.environment,
      status: row.status,
      startTime: new Date(row.start_time),
      endTime: row.end_time ? new Date(row.end_time) : undefined,
      duration: row.duration,
      gitCommit: row.git_commit,
      gitTag: row.git_tag,
      deployedBy: row.deployed_by,
      healthCheckPassed: row.health_check_passed === null ? undefined : row.health_check_passed === 1,
      errorMessage: row.error_message,
      rollbackFromId: row.rollback_from_id
    }))
  }

  /**
   * Get current deployment for an environment
   */
  getCurrentDeployment(projectId: string, environment: Environment): Deployment | null {
    const deployments = this.getRecentDeployments(projectId, environment, 1)
    return deployments[0] || null
  }

  /**
   * Cancel current build
   */
  cancelBuild(): boolean {
    if (this.runningProcess && this.isBuilding) {
      this.runningProcess.kill('SIGTERM')
      this.isBuilding = false
      this.emit('build-cancelled')
      return true
    }
    return false
  }

  /**
   * Check if currently building
   */
  isBuildRunning(): boolean {
    return this.isBuilding
  }

  /**
   * Check if currently deploying
   */
  isDeploymentRunning(): boolean {
    return this.isDeploying
  }
}

export const deploymentService = new DeploymentService()
