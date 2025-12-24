import { spawn, ChildProcess, execSync } from 'child_process'
import { EventEmitter } from 'events'
import { AgentType, ClaudeStatus, AGENT_PERSONAS } from '@shared/types'

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

    const systemPrompt = AGENT_PERSONAS[agentType].systemPrompt

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
    // Use --output-format stream-json for structured JSON output (requires --verbose with --print)
    const shellCommand = `'${this.claudePath}' --print --verbose --output-format stream-json --system-prompt '${escapedSystemPrompt}' '${escapedMessage}'`

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
    let jsonBuffer = '' // Buffer for incomplete JSON lines
    let extractedContent = '' // Accumulated text content
    let thinking = ''
    const todos: Array<{ content: string; status: string; activeForm: string }> = []
    const toolCalls: Array<{ name: string; input: unknown; result?: string }> = []

    // Handle stdout - parse stream-json format (newline-delimited JSON)
    this.currentProcess.stdout?.on('data', (data: Buffer) => {
      const chunk = data.toString()
      fullOutput += chunk
      jsonBuffer += chunk

      // Process complete JSON lines
      const lines = jsonBuffer.split('\n')
      jsonBuffer = lines.pop() || '' // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue

        try {
          const event = JSON.parse(line)
          console.log('[Claude Service] JSON event type:', event.type)

          // Handle different event types from stream-json
          if (event.type === 'content' || event.type === 'text') {
            const text = event.content || event.text || ''
            extractedContent += text
            this.emit('stream', {
              sessionId,
              content: text,
              type: 'chunk'
            })
          } else if (event.type === 'thinking') {
            thinking += event.content || ''
            this.emit('stream', {
              sessionId,
              thinking: event.content,
              type: 'thinking'
            })
          } else if (event.type === 'tool_use' || event.type === 'tool_call') {
            toolCalls.push({
              name: event.name || event.tool_name,
              input: event.input || event.tool_input
            })
            this.emit('stream', {
              sessionId,
              toolCall: { name: event.name, input: event.input },
              type: 'tool_call'
            })
          } else if (event.type === 'tool_result') {
            // Match result to last tool call
            if (toolCalls.length > 0) {
              toolCalls[toolCalls.length - 1].result = event.content
            }
          } else if (event.type === 'todo' || event.type === 'todos') {
            const todoItems = event.todos || [event]
            todos.push(...todoItems)
            this.emit('stream', {
              sessionId,
              todos: todoItems,
              type: 'todos'
            })
          } else if (event.type === 'result' || event.type === 'message') {
            // Final result event
            const text = event.result || event.content || ''
            if (text && !extractedContent.includes(text)) {
              extractedContent += text
            }
          }
        } catch {
          // Not valid JSON, might be plain text fallback
          console.log('[Claude Service] Non-JSON line:', line.substring(0, 50))
          extractedContent += line + '\n'
          this.emit('stream', {
            sessionId,
            content: line + '\n',
            type: 'chunk'
          })
        }
      }
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
      console.log('[Claude Service] Extracted content length:', extractedContent.length)

      // Process any remaining buffer
      if (jsonBuffer.trim()) {
        try {
          const event = JSON.parse(jsonBuffer)
          if (event.result || event.content) {
            extractedContent += event.result || event.content
          }
        } catch {
          extractedContent += jsonBuffer
        }
      }

      if (code === 0 || extractedContent.length > 0 || fullOutput.length > 0) {
        this.emit('complete', {
          sessionId,
          content: extractedContent || fullOutput,
          // Include structured data
          thinking: thinking || undefined,
          todos: todos.length > 0 ? todos : undefined,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined
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
