// Parser for Claude Code JSON stream responses
// Handles --output-format stream-json output

import type { TodoItem, SubAgentAction, ToolCall, ParsedClaudeResponse } from '@shared/types'

/**
 * Stream event types from Claude CLI --output-format stream-json
 */
export interface StreamEvent {
  type: string
  content?: string
  text?: string
  result?: string
  thinking?: string
  name?: string
  tool_name?: string
  input?: unknown
  tool_input?: unknown
  todos?: TodoItem[]
  [key: string]: unknown
}

/**
 * Accumulated response state during streaming
 */
export interface StreamState {
  content: string
  thinking: string
  todos: TodoItem[]
  toolCalls: ToolCall[]
  subAgentActions: SubAgentAction[]
}

/**
 * Create initial stream state
 */
export function createStreamState(): StreamState {
  return {
    content: '',
    thinking: '',
    todos: [],
    toolCalls: [],
    subAgentActions: []
  }
}

/**
 * Parse a single JSON event from stream-json output
 */
export function parseStreamEvent(line: string): StreamEvent | null {
  if (!line.trim()) return null

  try {
    return JSON.parse(line) as StreamEvent
  } catch {
    // Not valid JSON - return as plain text event
    return {
      type: 'text',
      content: line
    }
  }
}

/**
 * Process a stream event and update state
 */
export function processStreamEvent(event: StreamEvent, state: StreamState): StreamState {
  const newState = { ...state }

  switch (event.type) {
    case 'content':
    case 'text':
    case 'assistant':
      newState.content += event.content || event.text || ''
      break

    case 'thinking':
      newState.thinking += event.content || event.thinking || ''
      break

    case 'tool_use':
    case 'tool_call': {
      const toolCall: ToolCall = {
        id: `tool-${Date.now()}-${newState.toolCalls.length}`,
        name: (event.name || event.tool_name || 'unknown') as string,
        parameters: (event.input || event.tool_input || {}) as Record<string, unknown>,
        status: 'running'
      }
      newState.toolCalls = [...newState.toolCalls, toolCall]

      // Check if this is a sub-agent action (Task, Explore, Plan)
      if (['Task', 'Explore', 'Plan'].includes(toolCall.name)) {
        const subAction: SubAgentAction = {
          id: toolCall.id,
          type: toolCall.name as 'Task' | 'Explore' | 'Plan',
          description: getSubAgentDescription(toolCall),
          status: 'running'
        }
        newState.subAgentActions = [...newState.subAgentActions, subAction]
      }
      break
    }

    case 'tool_result': {
      // Update the last tool call with result
      if (newState.toolCalls.length > 0) {
        const lastIndex = newState.toolCalls.length - 1
        const updatedCalls = [...newState.toolCalls]
        updatedCalls[lastIndex] = {
          ...updatedCalls[lastIndex],
          status: 'completed',
          result: event.content as string
        }
        newState.toolCalls = updatedCalls

        // Also update sub-agent action if applicable
        const toolId = updatedCalls[lastIndex].id
        const subActionIndex = newState.subAgentActions.findIndex(a => a.id === toolId)
        if (subActionIndex >= 0) {
          const updatedActions = [...newState.subAgentActions]
          updatedActions[subActionIndex] = {
            ...updatedActions[subActionIndex],
            status: 'completed',
            result: event.content as string
          }
          newState.subAgentActions = updatedActions
        }
      }
      break
    }

    case 'todo':
    case 'todos':
      if (event.todos) {
        newState.todos = event.todos.map((t, i) => ({
          id: t.id || `todo-${Date.now()}-${i}`,
          content: t.content,
          status: t.status,
          activeForm: t.activeForm
        }))
      } else if (event.content) {
        // Single todo item
        newState.todos = [...newState.todos, {
          id: `todo-${Date.now()}`,
          content: event.content,
          status: (event.status as TodoItem['status']) || 'pending',
          activeForm: (event.activeForm as string) || event.content
        }]
      }
      break

    case 'result':
    case 'message':
      // Final result - may contain the complete response
      if (event.result || event.content) {
        const text = (event.result || event.content) as string
        if (!newState.content.includes(text)) {
          newState.content += text
        }
      }
      break

    default:
      // Unknown event type - try to extract content
      if (event.content && typeof event.content === 'string') {
        newState.content += event.content
      }
  }

  return newState
}

/**
 * Extract description from sub-agent tool call
 */
function getSubAgentDescription(toolCall: ToolCall): string {
  const params = toolCall.parameters as Record<string, unknown>
  return (params.description as string) ||
         (params.prompt as string)?.slice(0, 100) ||
         toolCall.name
}

/**
 * Parse complete JSON response (for non-streaming)
 */
export function parseJsonResponse(jsonString: string): ParsedClaudeResponse {
  try {
    const data = JSON.parse(jsonString)
    return {
      content: data.result || data.content || data.text || '',
      thinking: data.thinking || null,
      todos: data.todos || [],
      subAgentActions: [],
      toolCalls: data.tool_calls || []
    }
  } catch {
    // Not valid JSON - return as plain content
    return {
      content: jsonString,
      thinking: null,
      todos: [],
      subAgentActions: [],
      toolCalls: []
    }
  }
}

/**
 * Parse newline-delimited JSON stream
 */
export function parseNdjsonStream(ndjson: string): ParsedClaudeResponse {
  const lines = ndjson.split('\n').filter(line => line.trim())
  let state = createStreamState()

  for (const line of lines) {
    const event = parseStreamEvent(line)
    if (event) {
      state = processStreamEvent(event, state)
    }
  }

  return {
    content: state.content,
    thinking: state.thinking || null,
    todos: state.todos,
    subAgentActions: state.subAgentActions,
    toolCalls: state.toolCalls
  }
}

/**
 * Convert stream state to final response
 */
export function stateToResponse(state: StreamState): ParsedClaudeResponse {
  return {
    content: state.content,
    thinking: state.thinking || null,
    todos: state.todos,
    subAgentActions: state.subAgentActions,
    toolCalls: state.toolCalls
  }
}
