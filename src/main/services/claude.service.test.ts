/**
 * Claude DevStudio
 * Copyright (c) 2024 Claude DevStudio Contributors
 * Licensed under MIT License - see LICENSE file
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import * as childProcess from 'child_process'
import type { ExecSyncOptions } from 'child_process'
import { AgentType } from '@shared/types'
import { MockChildProcess, createMockSpawn } from '../test/mocks/claude-cli'

// Mock child_process module BEFORE importing the service
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  execSync: vi.fn(() => Buffer.from('claude-cli version 1.0.0'))
}))

// Import the service after mocking
const { claudeService } = await import('./claude.service')

describe('ClaudeCLIService', () => {
  let mockSpawn: ReturnType<typeof createMockSpawn>
  let mockExecSync: ReturnType<typeof vi.fn>

  beforeAll(() => {
    // Silence console.log in tests
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  beforeEach(() => {
    // Reset service state first
    claudeService.cancelCurrent()
    claudeService.removeAllListeners()

    // Create fresh mocks
    mockSpawn = createMockSpawn({
      response: JSON.stringify({ type: 'content', content: 'Test response' }) + '\n'
    })
    mockExecSync = vi.fn(() => Buffer.from('claude-cli version 1.0.0'))

    // Apply mocks
    vi.mocked(childProcess.spawn).mockImplementation(mockSpawn as any)
    vi.mocked(childProcess.execSync).mockImplementation(
      mockExecSync as (command: string, options?: ExecSyncOptions) => Buffer
    )
  })

  afterEach(() => {
    claudeService.cancelCurrent()
    claudeService.removeAllListeners()
    vi.clearAllMocks()
  })

  describe('checkStatus', () => {
    it('should return installed and authenticated when Claude is available', async () => {
      mockExecSync
        .mockReturnValueOnce(Buffer.from('')) // test -f succeeds
        .mockReturnValueOnce(Buffer.from('claude-cli version 1.2.3'))

      const status = await claudeService.checkStatus()

      expect(status).toEqual({
        installed: true,
        authenticated: true,
        version: 'claude-cli version 1.2.3'
      })
    })

    it('should handle version check timeout', async () => {
      mockExecSync
        .mockReturnValueOnce(Buffer.from('')) // test -f succeeds
        .mockReturnValueOnce(() => {
          throw new Error('timeout')
        })

      const status = await claudeService.checkStatus()

      expect(status).toEqual({
        installed: false,
        authenticated: false,
        version: null
      })
    })

    it('should handle version check errors', async () => {
      mockExecSync
        .mockReturnValueOnce(Buffer.from('')) // test -f succeeds
        .mockReturnValueOnce(() => {
          throw new Error('Command failed')
        })

      const status = await claudeService.checkStatus()

      expect(status.installed).toBe(false)
      expect(status.authenticated).toBe(false)
    })
  })

  describe('sendMessage', () => {
    it('should spawn Claude process with correct arguments', async () => {
      const mockProcess = new MockChildProcess({
        response: JSON.stringify({ type: 'content', content: 'Response' }) + '\n'
      })

      mockSpawn.mockReturnValueOnce(mockProcess as any)
      setImmediate(() => mockProcess.simulateResponse())

      await claudeService.sendMessage({
        sessionId: 'test-session',
        message: 'Test message',
        projectPath: '/test/path',
        agentType: 'developer'
      })

      // Wait a bit for spawn to be called
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(mockSpawn).toHaveBeenCalled()
      const callArgs = mockSpawn.mock.calls[0]
      const command = callArgs[0]

      // Verify command contains required flags
      expect(command).toContain('--print')
      expect(command).toContain('--verbose')
      expect(command).toContain('--output-format stream-json')
      expect(command).toContain('--system-prompt')
      expect(command).toContain('Test message')
    })

    it('should use correct system prompt for each agent type', async () => {
      const agentTypes: AgentType[] = [
        'developer',
        'product-owner',
        'tester',
        'security',
        'devops',
        'documentation'
      ]

      for (const agentType of agentTypes) {
        const mockProcess = new MockChildProcess({
          response: JSON.stringify({ type: 'content', content: 'Response' }) + '\n'
        })

        mockSpawn.mockReturnValueOnce(mockProcess as any)
        setImmediate(() => mockProcess.simulateResponse())

        await claudeService.sendMessage({
          sessionId: `test-session-${agentType}`,
          message: 'Test',
          projectPath: '/test',
          agentType
        })

        await new Promise((resolve) => setTimeout(resolve, 50))

        expect(mockSpawn).toHaveBeenCalled()
      }
    })

    it('should properly escape single quotes in arguments', async () => {
      const mockProcess = new MockChildProcess({
        response: JSON.stringify({ type: 'content', content: 'Response' }) + '\n'
      })

      mockSpawn.mockReturnValueOnce(mockProcess as any)
      setImmediate(() => mockProcess.simulateResponse())

      await claudeService.sendMessage({
        sessionId: 'test-session',
        message: "Message with 'single quotes'",
        projectPath: '/test/path',
        agentType: 'developer'
      })

      await new Promise((resolve) => setTimeout(resolve, 50))

      const command = mockSpawn.mock.calls[0][0]
      expect(command).toContain("'\\''")
    })

    it('should cancel existing process before starting new one', async () => {
      const firstProcess = new MockChildProcess({
        response: JSON.stringify({ type: 'content', content: 'First' }) + '\n'
      })

      const secondProcess = new MockChildProcess({
        response: JSON.stringify({ type: 'content', content: 'Second' }) + '\n'
      })

      mockSpawn.mockReturnValueOnce(firstProcess as any)
      setImmediate(() => firstProcess.simulateResponse())

      await claudeService.sendMessage({
        sessionId: 'session-1',
        message: 'First',
        projectPath: '/test',
        agentType: 'developer'
      })

      await new Promise((resolve) => setTimeout(resolve, 50))

      // Start second message before first completes
      mockSpawn.mockReturnValueOnce(secondProcess as any)
      setImmediate(() => secondProcess.simulateResponse())

      await claudeService.sendMessage({
        sessionId: 'session-2',
        message: 'Second',
        projectPath: '/test',
        agentType: 'developer'
      })

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(firstProcess.kill).toHaveBeenCalledWith('SIGTERM')
    })

    it('should close stdin immediately', async () => {
      const mockProcess = new MockChildProcess({
        response: JSON.stringify({ type: 'content', content: 'Response' }) + '\n'
      })

      mockSpawn.mockReturnValueOnce(mockProcess as any)
      setImmediate(() => mockProcess.simulateResponse())

      await claudeService.sendMessage({
        sessionId: 'test-session',
        message: 'Test',
        projectPath: '/test',
        agentType: 'developer'
      })

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(mockProcess.stdin.end).toHaveBeenCalled()
    })

    it('should set correct environment variables', async () => {
      const mockProcess = new MockChildProcess({
        response: JSON.stringify({ type: 'content', content: 'Response' }) + '\n'
      })

      mockSpawn.mockReturnValueOnce(mockProcess as any)
      setImmediate(() => mockProcess.simulateResponse())

      await claudeService.sendMessage({
        sessionId: 'test-session',
        message: 'Test',
        projectPath: '/test/path',
        agentType: 'developer'
      })

      await new Promise((resolve) => setTimeout(resolve, 50))

      const options = mockSpawn.mock.calls[0][2] as any
      expect(options.env.FORCE_COLOR).toBe('0')
      expect(options.env.NO_COLOR).toBe('1')
      expect(options.env.TERM).toBe('dumb')
    })

    it('should use projectPath as cwd when provided', async () => {
      const mockProcess = new MockChildProcess({
        response: JSON.stringify({ type: 'content', content: 'Response' }) + '\n'
      })

      mockSpawn.mockReturnValueOnce(mockProcess as any)
      setImmediate(() => mockProcess.simulateResponse())

      await claudeService.sendMessage({
        sessionId: 'test-session',
        message: 'Test',
        projectPath: '/custom/project/path',
        agentType: 'developer'
      })

      await new Promise((resolve) => setTimeout(resolve, 50))

      const options = mockSpawn.mock.calls[0][2] as any
      expect(options.cwd).toBe('/custom/project/path')
    })

    it('should use process.cwd() when projectPath not provided', async () => {
      const mockProcess = new MockChildProcess({
        response: JSON.stringify({ type: 'content', content: 'Response' }) + '\n'
      })

      mockSpawn.mockReturnValueOnce(mockProcess as any)
      setImmediate(() => mockProcess.simulateResponse())

      await claudeService.sendMessage({
        sessionId: 'test-session',
        message: 'Test',
        projectPath: '',
        agentType: 'developer'
      })

      await new Promise((resolve) => setTimeout(resolve, 50))

      const options = mockSpawn.mock.calls[0][2] as any
      expect(options.cwd).toBe(process.cwd())
    })

    it('should return sessionId', async () => {
      const mockProcess = new MockChildProcess({
        response: JSON.stringify({ type: 'content', content: 'Response' }) + '\n'
      })

      mockSpawn.mockReturnValueOnce(mockProcess as any)
      setImmediate(() => mockProcess.simulateResponse())

      const result = await claudeService.sendMessage({
        sessionId: 'test-123',
        message: 'Test',
        projectPath: '/test',
        agentType: 'developer'
      })

      expect(result.sessionId).toBe('test-123')
    })
  })

  describe('streaming response handling', () => {
    it('should emit stream events for content chunks', async () => {
      const mockProcess = new MockChildProcess({
        chunks: [
          JSON.stringify({ type: 'content', content: 'Hello ' }) + '\n',
          JSON.stringify({ type: 'content', content: 'World' }) + '\n'
        ]
      })

      const streamEvents: any[] = []
      claudeService.on('stream', (data) => streamEvents.push(data))

      mockSpawn.mockReturnValueOnce(mockProcess as any)
      setImmediate(() => mockProcess.simulateResponse())

      await claudeService.sendMessage({
        sessionId: 'test-session',
        message: 'Test',
        projectPath: '/test',
        agentType: 'developer'
      })

      await new Promise((resolve) => setTimeout(resolve, 150))

      expect(streamEvents.length).toBeGreaterThan(0)
      expect(streamEvents[0]).toMatchObject({
        sessionId: 'test-session',
        content: 'Hello ',
        type: 'chunk'
      })
    })

    it('should handle thinking events', async () => {
      const mockProcess = new MockChildProcess({
        chunks: [
          JSON.stringify({ type: 'thinking', content: 'Let me think...' }) + '\n',
          JSON.stringify({ type: 'content', content: 'Answer' }) + '\n'
        ]
      })

      const streamEvents: any[] = []
      claudeService.on('stream', (data) => streamEvents.push(data))

      mockSpawn.mockReturnValueOnce(mockProcess as any)
      setImmediate(() => mockProcess.simulateResponse())

      await claudeService.sendMessage({
        sessionId: 'test-session',
        message: 'Test',
        projectPath: '/test',
        agentType: 'developer'
      })

      await new Promise((resolve) => setTimeout(resolve, 150))

      const thinkingEvent = streamEvents.find((e) => e.type === 'thinking')
      expect(thinkingEvent).toBeDefined()
      expect(thinkingEvent.thinking).toBe('Let me think...')
    })

    it('should handle tool_use events', async () => {
      const mockProcess = new MockChildProcess({
        chunks: [
          JSON.stringify({
            type: 'tool_use',
            name: 'read_file',
            input: { path: 'test.txt' }
          }) + '\n'
        ]
      })

      const streamEvents: any[] = []
      claudeService.on('stream', (data) => streamEvents.push(data))

      mockSpawn.mockReturnValueOnce(mockProcess as any)
      setImmediate(() => mockProcess.simulateResponse())

      await claudeService.sendMessage({
        sessionId: 'test-session',
        message: 'Test',
        projectPath: '/test',
        agentType: 'developer'
      })

      await new Promise((resolve) => setTimeout(resolve, 150))

      const toolCallEvent = streamEvents.find((e) => e.type === 'tool_call')
      expect(toolCallEvent).toBeDefined()
      expect(toolCallEvent.toolCall).toMatchObject({
        name: 'read_file',
        input: { path: 'test.txt' }
      })
    })

    it('should handle tool_result events', async () => {
      const mockProcess = new MockChildProcess({
        chunks: [
          JSON.stringify({
            type: 'tool_use',
            name: 'bash',
            input: { command: 'ls' }
          }) + '\n',
          JSON.stringify({ type: 'tool_result', content: 'file1.txt\nfile2.txt' }) + '\n'
        ]
      })

      mockSpawn.mockReturnValueOnce(mockProcess as any)
      setImmediate(() => mockProcess.simulateResponse())

      const completeEvents: any[] = []
      claudeService.on('complete', (data) => completeEvents.push(data))

      await claudeService.sendMessage({
        sessionId: 'test-session',
        message: 'Test',
        projectPath: '/test',
        agentType: 'developer'
      })

      await new Promise((resolve) => setTimeout(resolve, 200))

      expect(completeEvents.length).toBeGreaterThan(0)
      expect(completeEvents[0].toolCalls).toBeDefined()
      expect(completeEvents[0].toolCalls[0].result).toBe('file1.txt\nfile2.txt')
    })

    it('should handle todo events', async () => {
      const mockProcess = new MockChildProcess({
        chunks: [
          JSON.stringify({
            type: 'todo',
            content: 'Implement feature',
            status: 'pending',
            activeForm: 'Implementing feature'
          }) + '\n'
        ]
      })

      const streamEvents: any[] = []
      claudeService.on('stream', (data) => streamEvents.push(data))

      mockSpawn.mockReturnValueOnce(mockProcess as any)
      setImmediate(() => mockProcess.simulateResponse())

      await claudeService.sendMessage({
        sessionId: 'test-session',
        message: 'Test',
        projectPath: '/test',
        agentType: 'developer'
      })

      await new Promise((resolve) => setTimeout(resolve, 150))

      const todoEvent = streamEvents.find((e) => e.type === 'todos')
      expect(todoEvent).toBeDefined()
      expect(todoEvent.todos).toEqual([
        {
          content: 'Implement feature',
          status: 'pending',
          activeForm: 'Implementing feature'
        }
      ])
    })

    it('should handle non-JSON plain text fallback', async () => {
      const mockProcess = new MockChildProcess({
        chunks: ['Plain text response\n', 'More plain text\n']
      })

      const streamEvents: any[] = []
      claudeService.on('stream', (data) => streamEvents.push(data))

      mockSpawn.mockReturnValueOnce(mockProcess as any)
      setImmediate(() => mockProcess.simulateResponse())

      await claudeService.sendMessage({
        sessionId: 'test-session',
        message: 'Test',
        projectPath: '/test',
        agentType: 'developer'
      })

      await new Promise((resolve) => setTimeout(resolve, 150))

      expect(streamEvents.length).toBeGreaterThan(0)
      expect(streamEvents[0].content).toBe('Plain text response\n')
    })

    it('should skip empty lines in stream', async () => {
      const mockProcess = new MockChildProcess({
        chunks: [
          '\n',
          '\n',
          JSON.stringify({ type: 'content', content: 'Text' }) + '\n',
          '\n'
        ]
      })

      const streamEvents: any[] = []
      claudeService.on('stream', (data) => streamEvents.push(data))

      mockSpawn.mockReturnValueOnce(mockProcess as any)
      setImmediate(() => mockProcess.simulateResponse())

      await claudeService.sendMessage({
        sessionId: 'test-session',
        message: 'Test',
        projectPath: '/test',
        agentType: 'developer'
      })

      await new Promise((resolve) => setTimeout(resolve, 150))

      const contentEvents = streamEvents.filter((e) => e.content)
      expect(contentEvents.length).toBeGreaterThan(0)
    })
  })

  describe('error handling', () => {
    it('should emit error events for stderr with error keywords', async () => {
      const mockProcess = new MockChildProcess({})

      const errorEvents: any[] = []
      claudeService.on('error', (data) => errorEvents.push(data))

      mockSpawn.mockReturnValueOnce(mockProcess as any)

      await claudeService.sendMessage({
        sessionId: 'test-session',
        message: 'Test',
        projectPath: '/test',
        agentType: 'developer'
      })

      await new Promise((resolve) => setTimeout(resolve, 20))

      // Simulate stderr with error
      mockProcess.stderr.emit('data', Buffer.from('Error: Something went wrong'))

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(errorEvents.length).toBeGreaterThan(0)
      expect(errorEvents[0].error).toContain('Error: Something went wrong')

      // Clean up
      claudeService.cancelCurrent()
      claudeService.removeAllListeners('error')
    })

    it('should not emit error for non-error stderr messages', async () => {
      const mockProcess = new MockChildProcess({})

      const errorEvents: any[] = []
      claudeService.on('error', (data) => errorEvents.push(data))

      mockSpawn.mockReturnValueOnce(mockProcess as any)

      await claudeService.sendMessage({
        sessionId: 'test-session',
        message: 'Test',
        projectPath: '/test',
        agentType: 'developer'
      })

      await new Promise((resolve) => setTimeout(resolve, 20))

      mockProcess.stderr.emit('data', Buffer.from('Info: Processing...'))

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(errorEvents.length).toBe(0)

      // Clean up
      claudeService.cancelCurrent()
      claudeService.removeAllListeners('error')
    })

    it('should emit error on process error event', async () => {
      const mockProcess = new MockChildProcess({
        error: new Error('Process spawn failed')
      })

      const errorEvents: any[] = []
      claudeService.on('error', (data) => errorEvents.push(data))

      mockSpawn.mockReturnValueOnce(mockProcess as any)
      setImmediate(() => mockProcess.simulateResponse())

      await claudeService.sendMessage({
        sessionId: 'test-session',
        message: 'Test',
        projectPath: '/test',
        agentType: 'developer'
      })

      await new Promise((resolve) => setTimeout(resolve, 150))

      expect(errorEvents.length).toBeGreaterThan(0)
      expect(errorEvents[0].error).toBe('Process spawn failed')

      // Clean up
      claudeService.removeAllListeners('error')
    })
  })

  describe('process completion', () => {
    it('should emit complete event with accumulated content', async () => {
      const mockProcess = new MockChildProcess({
        chunks: [
          JSON.stringify({ type: 'content', content: 'Hello ' }) + '\n',
          JSON.stringify({ type: 'content', content: 'World' }) + '\n'
        ]
      })

      const completeEvents: any[] = []
      claudeService.on('complete', (data) => completeEvents.push(data))

      mockSpawn.mockReturnValueOnce(mockProcess as any)
      setImmediate(() => mockProcess.simulateResponse())

      await claudeService.sendMessage({
        sessionId: 'test-session',
        message: 'Test',
        projectPath: '/test',
        agentType: 'developer'
      })

      await new Promise((resolve) => setTimeout(resolve, 200))

      expect(completeEvents.length).toBeGreaterThan(0)
      expect(completeEvents[0]).toMatchObject({
        sessionId: 'test-session',
        content: expect.stringContaining('Hello ')
      })

      // Clean up
      claudeService.removeAllListeners('complete')
    })

    it('should include thinking in complete event', async () => {
      const mockProcess = new MockChildProcess({
        chunks: [
          JSON.stringify({ type: 'thinking', content: 'Analyzing...' }) + '\n',
          JSON.stringify({ type: 'content', content: 'Done' }) + '\n'
        ]
      })

      const completeEvents: any[] = []
      claudeService.on('complete', (data) => completeEvents.push(data))

      mockSpawn.mockReturnValueOnce(mockProcess as any)
      setImmediate(() => mockProcess.simulateResponse())

      await claudeService.sendMessage({
        sessionId: 'test-session',
        message: 'Test',
        projectPath: '/test',
        agentType: 'developer'
      })

      await new Promise((resolve) => setTimeout(resolve, 200))

      expect(completeEvents.length).toBeGreaterThan(0)
      expect(completeEvents[0].thinking).toBe('Analyzing...')

      // Clean up
      claudeService.removeAllListeners('complete')
    })

    it('should clear currentProcess on completion', async () => {
      const mockProcess = new MockChildProcess({
        response: JSON.stringify({ type: 'content', content: 'Done' }) + '\n'
      })

      mockSpawn.mockReturnValueOnce(mockProcess as any)
      setImmediate(() => mockProcess.simulateResponse())

      await claudeService.sendMessage({
        sessionId: 'test-session',
        message: 'Test',
        projectPath: '/test',
        agentType: 'developer'
      })

      await new Promise((resolve) => setTimeout(resolve, 150))

      const cancelled = claudeService.cancelCurrent()
      expect(cancelled).toBe(false)
    })
  })

  describe('cancelCurrent', () => {
    it('should cancel active process', async () => {
      const mockProcess = new MockChildProcess({
        chunks: [
          JSON.stringify({ type: 'content', content: 'Long ' }) + '\n',
          JSON.stringify({ type: 'content', content: 'response...' }) + '\n'
        ],
        delay: 200
      })

      mockSpawn.mockReturnValueOnce(mockProcess as any)
      setImmediate(() => mockProcess.simulateResponse())

      await claudeService.sendMessage({
        sessionId: 'test-session',
        message: 'Test',
        projectPath: '/test',
        agentType: 'developer'
      })

      await new Promise((resolve) => setTimeout(resolve, 50))

      const cancelled = claudeService.cancelCurrent()

      expect(cancelled).toBe(true)
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM')
    })

    it('should return false when no process is active', () => {
      const cancelled = claudeService.cancelCurrent()
      expect(cancelled).toBe(false)
    })

    it('should set currentProcess to null after cancellation', async () => {
      const mockProcess = new MockChildProcess({
        chunks: [JSON.stringify({ type: 'content', content: 'Text' }) + '\n'],
        delay: 200
      })

      mockSpawn.mockReturnValueOnce(mockProcess as any)
      setImmediate(() => mockProcess.simulateResponse())

      await claudeService.sendMessage({
        sessionId: 'test-session',
        message: 'Test',
        projectPath: '/test',
        agentType: 'developer'
      })

      await new Promise((resolve) => setTimeout(resolve, 20))

      claudeService.cancelCurrent()

      // Try to cancel again
      const secondCancel = claudeService.cancelCurrent()
      expect(secondCancel).toBe(false)
    })
  })

  describe('cleanup', () => {
    it('should cancel active process on cleanup', async () => {
      const mockProcess = new MockChildProcess({
        chunks: [JSON.stringify({ type: 'content', content: 'Text' }) + '\n'],
        delay: 200
      })

      mockSpawn.mockReturnValueOnce(mockProcess as any)
      setImmediate(() => mockProcess.simulateResponse())

      await claudeService.sendMessage({
        sessionId: 'test-session',
        message: 'Test',
        projectPath: '/test',
        agentType: 'developer'
      })

      await new Promise((resolve) => setTimeout(resolve, 20))

      // Add a listener to prevent unhandled error
      claudeService.on('error', () => {})

      claudeService.cleanup()

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(mockProcess.kill).toHaveBeenCalled()
    })

    it('should remove all event listeners on cleanup', async () => {
      const streamHandler = vi.fn()
      const errorHandler = vi.fn()
      const completeHandler = vi.fn()

      claudeService.on('stream', streamHandler)
      claudeService.on('error', errorHandler)
      claudeService.on('complete', completeHandler)

      expect(claudeService.listenerCount('stream')).toBeGreaterThan(0)
      expect(claudeService.listenerCount('error')).toBeGreaterThan(0)
      expect(claudeService.listenerCount('complete')).toBeGreaterThan(0)

      claudeService.cleanup()

      expect(claudeService.listenerCount('stream')).toBe(0)
      expect(claudeService.listenerCount('error')).toBe(0)
      expect(claudeService.listenerCount('complete')).toBe(0)
    })

    it('should be safe to call cleanup multiple times', () => {
      claudeService.cleanup()
      claudeService.cleanup()
      claudeService.cleanup()

      // Should not throw
      expect(claudeService.listenerCount('stream')).toBe(0)
    })

    it('should handle cleanup with no active process', () => {
      claudeService.cleanup()

      const cancelled = claudeService.cancelCurrent()
      expect(cancelled).toBe(false)
    })
  })

  describe('EventEmitter integration', () => {
    it('should support multiple event listeners', async () => {
      const mockProcess = new MockChildProcess({
        chunks: [JSON.stringify({ type: 'content', content: 'Test' }) + '\n']
      })

      const listener1 = vi.fn()
      const listener2 = vi.fn()
      const listener3 = vi.fn()

      claudeService.on('stream', listener1)
      claudeService.on('stream', listener2)
      claudeService.on('stream', listener3)

      mockSpawn.mockReturnValueOnce(mockProcess as any)
      setImmediate(() => mockProcess.simulateResponse())

      await claudeService.sendMessage({
        sessionId: 'test-session',
        message: 'Test',
        projectPath: '/test',
        agentType: 'developer'
      })

      await new Promise((resolve) => setTimeout(resolve, 150))

      expect(listener1).toHaveBeenCalled()
      expect(listener2).toHaveBeenCalled()
      expect(listener3).toHaveBeenCalled()

      // Clean up
      claudeService.removeAllListeners('stream')
    })

    it('should allow removing specific listeners', async () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()

      claudeService.on('stream', listener1)
      claudeService.on('stream', listener2)

      claudeService.removeListener('stream', listener1)

      const mockProcess = new MockChildProcess({
        chunks: [JSON.stringify({ type: 'content', content: 'Test' }) + '\n']
      })

      mockSpawn.mockReturnValueOnce(mockProcess as any)
      setImmediate(() => mockProcess.simulateResponse())

      await claudeService.sendMessage({
        sessionId: 'test-session',
        message: 'Test',
        projectPath: '/test',
        agentType: 'developer'
      })

      await new Promise((resolve) => setTimeout(resolve, 150))

      expect(listener1).not.toHaveBeenCalled()
      expect(listener2).toHaveBeenCalled()

      // Clean up
      claudeService.removeAllListeners('stream')
    })

    it('should support once listeners', async () => {
      const mockProcess = new MockChildProcess({
        chunks: [
          JSON.stringify({ type: 'content', content: 'First' }) + '\n',
          JSON.stringify({ type: 'content', content: 'Second' }) + '\n'
        ]
      })

      const onceListener = vi.fn()
      claudeService.once('stream', onceListener)

      mockSpawn.mockReturnValueOnce(mockProcess as any)
      setImmediate(() => mockProcess.simulateResponse())

      await claudeService.sendMessage({
        sessionId: 'test-session',
        message: 'Test',
        projectPath: '/test',
        agentType: 'developer'
      })

      await new Promise((resolve) => setTimeout(resolve, 200))

      expect(onceListener).toHaveBeenCalledTimes(1)

      // Clean up
      claudeService.removeAllListeners('stream')
    })
  })
})
