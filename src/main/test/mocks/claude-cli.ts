/**
 * Claude DevStudio
 * Copyright (c) 2024 Claude DevStudio Contributors
 * Licensed under MIT License - see LICENSE file
 *
 * Mock Claude CLI for testing without actual CLI dependency
 */

import { vi } from 'vitest'
import { EventEmitter } from 'events'

export interface MockStreamOptions {
  response?: string
  chunks?: string[]
  error?: Error
  exitCode?: number
  delay?: number
}

export class MockChildProcess extends EventEmitter {
  stdout: EventEmitter
  stderr: EventEmitter
  stdin: { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> }
  pid: number
  killed: boolean

  constructor(private options: MockStreamOptions = {}) {
    super()
    this.stdout = new EventEmitter()
    this.stderr = new EventEmitter()
    this.stdin = {
      write: vi.fn(),
      end: vi.fn()
    }
    this.pid = Math.floor(Math.random() * 10000)
    this.killed = false
  }

  kill = vi.fn(() => {
    this.killed = true
    this.emit('close', 1, 'SIGTERM')
    return true
  })

  // Simulate streaming response
  async simulateResponse(): Promise<void> {
    const { response, chunks, error, exitCode = 0, delay = 10 } = this.options

    if (error) {
      await this.sleep(delay)
      this.stderr.emit('data', Buffer.from(error.message))
      this.emit('error', error)
      this.emit('close', 1)
      return
    }

    if (chunks) {
      for (const chunk of chunks) {
        await this.sleep(delay)
        this.stdout.emit('data', Buffer.from(chunk))
      }
    } else if (response) {
      await this.sleep(delay)
      this.stdout.emit('data', Buffer.from(response))
    }

    await this.sleep(delay)
    this.emit('close', exitCode)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// Mock spawn function
export function createMockSpawn(defaultOptions: MockStreamOptions = {}) {
  return vi.fn((_command: string, _args?: string[], _options?: unknown) => {
    const process = new MockChildProcess(defaultOptions)
    // Auto-simulate response after a tick
    setImmediate(() => process.simulateResponse())
    return process
  })
}

// Pre-configured responses for common scenarios
export const mockResponses = {
  // Simple text response
  simple: (text: string): MockStreamOptions => ({
    response: text
  }),

  // Streaming response with chunks
  streaming: (chunks: string[]): MockStreamOptions => ({
    chunks,
    delay: 50
  }),

  // Error response
  error: (message: string): MockStreamOptions => ({
    error: new Error(message),
    exitCode: 1
  }),

  // Claude CLI format responses
  claudeResponse: (content: string): MockStreamOptions => ({
    response: JSON.stringify({
      type: 'message',
      content: [{ type: 'text', text: content }]
    })
  }),

  // Thinking + response
  thinkingResponse: (thinking: string, response: string): MockStreamOptions => ({
    chunks: [
      JSON.stringify({ type: 'thinking', content: thinking }),
      JSON.stringify({ type: 'message', content: [{ type: 'text', text: response }] })
    ],
    delay: 100
  }),

  // Code block response
  codeResponse: (code: string, language = 'typescript'): MockStreamOptions => ({
    response: `\`\`\`${language}\n${code}\n\`\`\``
  }),

  // Multi-step response
  multiStep: (steps: string[]): MockStreamOptions => ({
    chunks: steps.map((step, i) => `Step ${i + 1}: ${step}\n`),
    delay: 100
  })
}

// Mock which command to check Claude CLI availability
export const mockWhich = vi.fn((command: string) => {
  if (command === 'claude') {
    return '/usr/local/bin/claude'
  }
  return null
})

// Mock exec for synchronous command execution
export const mockExecSync = vi.fn((_command: string) => {
  return Buffer.from('claude-cli version 1.0.0')
})

// Helper to verify Claude was called with specific arguments
export function expectClaudeCalledWith(
  mockSpawn: ReturnType<typeof createMockSpawn>,
  expectedArgs: Partial<{
    prompt: string
    systemPrompt: string
    model: string
    context: string[]
  }>
) {
  expect(mockSpawn).toHaveBeenCalled()
  const calls = mockSpawn.mock.calls
  const lastCall = calls[calls.length - 1]
  const [command, args] = lastCall

  expect(command).toBe('claude')

  if (expectedArgs.prompt) {
    expect(args).toContain(expectedArgs.prompt)
  }
  if (expectedArgs.systemPrompt) {
    expect(args).toContain('--system-prompt')
    expect(args).toContain(expectedArgs.systemPrompt)
  }
  if (expectedArgs.model) {
    expect(args).toContain('--model')
    expect(args).toContain(expectedArgs.model)
  }
}
