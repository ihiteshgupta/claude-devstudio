import { spawn, ChildProcess, execSync } from 'child_process'
import { EventEmitter } from 'events'
import type { AgentType, ClaudeStatus } from '@shared/types'

// Agent system prompts
const AGENT_PROMPTS: Record<AgentType, string> = {
  developer: `You are a Developer AI Agent in Claude DevStudio. Your responsibilities:
- Generate clean, maintainable code following project conventions
- Perform thorough code reviews
- Suggest refactoring improvements
- Create technical specifications
- Help debug issues

Always follow the project's existing code style and patterns.
Prefer small, focused changes over large rewrites.
Be concise but thorough in your explanations.`,

  'product-owner': `You are a Product Owner AI Agent in Claude DevStudio. Your responsibilities:
- Create clear, well-structured user stories
- Generate detailed acceptance criteria
- Prioritize backlog items based on business value
- Assist with sprint planning and capacity estimation

Output user stories in this format:
**As a** [user type]
**I want** [feature]
**So that** [benefit]

**Acceptance Criteria:**
1. Given [context], when [action], then [outcome]`,

  tester: `You are a Test Agent in Claude DevStudio. Your responsibilities:
- Generate comprehensive test cases from requirements
- Create automated tests (unit, integration, e2e)
- Analyze test coverage and identify gaps
- Create detailed bug reports

Output test cases in this format:
**Test Case:** [ID]
**Title:** [descriptive title]
**Preconditions:** [setup required]
**Steps:** [numbered steps]
**Expected Result:** [outcome]`,

  security: `You are a Security Agent in Claude DevStudio. Your responsibilities:
- Identify security vulnerabilities in code
- Check for OWASP Top 10 issues
- Audit dependencies for known CVEs
- Suggest security best practices

Prioritize findings by severity: Critical > High > Medium > Low`,

  devops: `You are a DevOps Agent in Claude DevStudio. Your responsibilities:
- Create and optimize CI/CD pipelines
- Generate infrastructure as code (Terraform, Bicep)
- Manage deployment configurations
- Set up monitoring and alerting

Follow infrastructure best practices and principle of least privilege.`,

  documentation: `You are a Documentation Agent in Claude DevStudio. Your responsibilities:
- Generate API documentation
- Create and update README files
- Write code comments and docstrings
- Maintain changelog entries

Documentation should be clear, concise, and developer-friendly.`
}

interface SendMessageOptions {
  sessionId: string
  message: string
  projectPath: string
  agentType: AgentType
}

class ClaudeCLIService extends EventEmitter {
  private currentProcess: ChildProcess | null = null
  private claudePath: string | null = null

  constructor() {
    super()
    this.findClaudePath()
  }

  /**
   * Find the Claude CLI executable path
   */
  private findClaudePath(): void {
    // Common installation paths on macOS (check these first as they're faster)
    const commonPaths = [
      '/usr/local/bin/claude',
      '/opt/homebrew/bin/claude',
      `${process.env.HOME}/.local/bin/claude`,
      `${process.env.HOME}/.claude/bin/claude`,
      // NVM paths (common Node.js version manager)
      `${process.env.HOME}/.nvm/versions/node/v22.20.0/bin/claude`,
      `${process.env.HOME}/.nvm/versions/node/v20.19.0/bin/claude`,
      `${process.env.HOME}/.nvm/versions/node/v18.20.0/bin/claude`,
    ]

    for (const path of commonPaths) {
      try {
        execSync(`test -f "${path}"`, { stdio: 'ignore' })
        this.claudePath = path
        console.log('[Claude Service] Found Claude at:', path)
        return
      } catch {
        // Try next path
      }
    }

    // Try to find via shell (with full PATH)
    try {
      const result = execSync('zsh -l -c "which claude"', { encoding: 'utf-8' }).trim()
      if (result && !result.includes('not found')) {
        this.claudePath = result
        console.log('[Claude Service] Found Claude via shell at:', result)
        return
      }
    } catch {
      // Shell method failed
    }

    console.log('[Claude Service] Claude CLI not found')
    this.claudePath = null
  }

  /**
   * Check Claude CLI installation and auth status
   */
  async checkStatus(): Promise<ClaudeStatus> {
    if (!this.claudePath) {
      this.findClaudePath()
    }

    console.log('[Claude Service] checkStatus called, claudePath:', this.claudePath)

    if (!this.claudePath) {
      return {
        installed: false,
        authenticated: false,
        version: null
      }
    }

    try {
      // Get version
      const version = execSync(`${this.claudePath} --version`, {
        encoding: 'utf-8',
        timeout: 5000
      }).trim()
      console.log('[Claude Service] Version:', version)

      // For now, assume authenticated if we can get version
      // The actual auth check with --print takes too long
      return {
        installed: true,
        authenticated: true,
        version
      }
    } catch (error) {
      console.log('[Claude Service] checkStatus error:', error)
      return {
        installed: false,
        authenticated: false,
        version: null
      }
    }
  }

  /**
   * Send a message to Claude CLI
   */
  async sendMessage(options: SendMessageOptions): Promise<{ sessionId: string }> {
    const { sessionId, message, projectPath, agentType } = options

    if (!this.claudePath) {
      throw new Error('Claude CLI not found. Please install Claude Code.')
    }

    // Cancel any existing process
    this.cancelCurrent()

    const systemPrompt = AGENT_PROMPTS[agentType]

    // Build CLI arguments for print mode (non-interactive single response)
    // Note: We set cwd to projectPath so Claude has context, but don't use --add-dir
    // as it causes Claude to scan the entire directory which can be very slow
    const args = [
      '--print',  // Non-interactive mode - outputs response and exits
      '--system-prompt', systemPrompt,
      message
    ]

    console.log('[Claude Service] Spawning process with args:', args)
    console.log('[Claude Service] CWD:', projectPath || process.cwd())
    console.log('[Claude Service] Claude path:', this.claudePath)

    // Escape arguments for shell execution
    const escapedSystemPrompt = systemPrompt.replace(/'/g, "'\\''")
    const escapedMessage = message.replace(/'/g, "'\\''")

    // Build shell command with properly escaped arguments
    const shellCommand = `'${this.claudePath}' --print --system-prompt '${escapedSystemPrompt}' '${escapedMessage}'`

    console.log('[Claude Service] Shell command (first 200 chars):', shellCommand.substring(0, 200))

    // Spawn the process with shell: true for proper argument handling
    this.currentProcess = spawn(shellCommand, [], {
      cwd: projectPath || process.cwd(),
      shell: true,
      env: {
        ...process.env,
        PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
        FORCE_COLOR: '0',
        NO_COLOR: '1',
        TERM: 'dumb'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    })

    console.log('[Claude Service] Process PID:', this.currentProcess.pid)

    // Close stdin immediately - Claude CLI doesn't need input in --print mode
    this.currentProcess.stdin?.end()

    let fullOutput = ''

    // Handle stdout
    this.currentProcess.stdout?.on('data', (data: Buffer) => {
      const chunk = data.toString()
      fullOutput += chunk
      console.log('[Claude Service] Received chunk:', chunk.substring(0, 100))

      // Emit streaming chunks
      this.emit('stream', {
        sessionId,
        content: chunk
      })
    })

    // Handle stderr (Claude CLI outputs some info to stderr)
    this.currentProcess.stderr?.on('data', (data: Buffer) => {
      const chunk = data.toString()
      console.log('[Claude Service] stderr:', chunk)
      // Only emit as error if it looks like an actual error
      if (chunk.toLowerCase().includes('error') || chunk.toLowerCase().includes('failed')) {
        this.emit('error', {
          sessionId,
          error: chunk
        })
      }
    })

    // Handle process completion
    this.currentProcess.on('close', (code) => {
      console.log('[Claude Service] Process closed with code:', code)
      console.log('[Claude Service] Full output length:', fullOutput.length)
      if (code === 0 || fullOutput.length > 0) {
        this.emit('complete', {
          sessionId,
          content: fullOutput
        })
      } else {
        this.emit('error', {
          sessionId,
          error: `Process exited with code ${code}`
        })
      }
      this.currentProcess = null
    })

    // Handle errors
    this.currentProcess.on('error', (error) => {
      console.log('[Claude Service] Process error:', error.message)
      this.emit('error', {
        sessionId,
        error: error.message
      })
      this.currentProcess = null
    })

    return { sessionId }
  }

  /**
   * Cancel the current Claude process
   */
  cancelCurrent(): boolean {
    if (this.currentProcess) {
      this.currentProcess.kill('SIGTERM')
      this.currentProcess = null
      return true
    }
    return false
  }

  /**
   * Cleanup all resources
   */
  cleanup(): void {
    this.cancelCurrent()
    this.removeAllListeners()
  }
}

export const claudeService = new ClaudeCLIService()
