import { EventEmitter } from 'events'
import { claudeService } from './claude.service'
import type { AgentType } from '@shared/types'

// ============================================
// Chat Workflow Types
// ============================================

export type WorkflowType = 'sequential' | 'parallel' | 'conditional'
export type ChatWorkflowStatus = 'parsing' | 'confirming' | 'running' | 'paused' | 'completed' | 'failed'

export interface WorkflowTask {
  agent: AgentType
  instruction: string
  dependsOn?: string[] // IDs of previous tasks
}

export interface ParsedIntent {
  workflowType: WorkflowType
  agents: AgentType[]
  tasks: WorkflowTask[]
  inputContext?: string
}

export interface ChatWorkflowRequest {
  id: string
  projectId: string
  sessionId: string // The chat session this came from
  originalMessage: string
  parsedIntent: ParsedIntent
  status: ChatWorkflowStatus
  createdAt: Date
  completedAt?: Date
}

export interface WorkflowStepResult {
  stepIndex: number
  agent: AgentType
  instruction: string
  output: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  startedAt?: Date
  completedAt?: Date
}

export interface WorkflowCallbacks {
  onStepStart?: (step: number, agent: AgentType) => void
  onStepProgress?: (step: number, content: string) => void
  onStepComplete?: (step: number, result: WorkflowStepResult) => void
  onWorkflowComplete?: (results: WorkflowStepResult[]) => void
  onError?: (error: string, step?: number) => void
}

// ============================================
// Intent Parsing Patterns
// ============================================

interface AgentPattern {
  keywords: string[]
  agentType: AgentType
}

const AGENT_PATTERNS: AgentPattern[] = [
  { keywords: ['developer', 'dev', 'implement', 'code', 'build'], agentType: 'developer' },
  { keywords: ['product owner', 'po', 'refine', 'story', 'requirement'], agentType: 'product-owner' },
  { keywords: ['tester', 'test', 'qa', 'quality'], agentType: 'tester' },
  { keywords: ['security', 'secure', 'audit', 'vulnerability'], agentType: 'security' },
  { keywords: ['devops', 'deploy', 'infrastructure', 'ci/cd', 'pipeline'], agentType: 'devops' },
  { keywords: ['documentation', 'docs', 'document', 'write docs'], agentType: 'documentation' }
]

const SEQUENTIAL_INDICATORS = [
  'then', 'after that', 'next', 'followed by', 'afterwards', 'subsequently',
  'once done', 'after', 'finally', 'lastly', 'and then'
]

const PARALLEL_INDICATORS = [
  'and', 'together', 'in parallel', 'at the same time', 'simultaneously',
  'concurrently', 'both', 'also'
]

const ACTION_VERBS = [
  'review', 'implement', 'test', 'audit', 'document', 'refine',
  'create', 'generate', 'analyze', 'check', 'validate', 'build'
]

// ============================================
// Chat Workflow Service
// ============================================

class ChatWorkflowService extends EventEmitter {
  private workflows: Map<string, ChatWorkflowRequest> = new Map()
  private runningWorkflows: Map<string, boolean> = new Map()
  private pausedWorkflows: Map<string, WorkflowStepResult[]> = new Map()

  /**
   * Parse a chat message to detect workflow intent
   */
  async parseWorkflowIntent(message: string): Promise<{
    isWorkflow: boolean
    confidence: number
    parsedWorkflow?: ParsedIntent
  }> {
    const lowercaseMessage = message.toLowerCase()

    // Detect agents mentioned
    const mentionedAgents = new Set<AgentType>()
    for (const pattern of AGENT_PATTERNS) {
      for (const keyword of pattern.keywords) {
        if (lowercaseMessage.includes(keyword)) {
          mentionedAgents.add(pattern.agentType)
          break
        }
      }
    }

    // Need at least 2 agents for a workflow
    if (mentionedAgents.size < 2) {
      return { isWorkflow: false, confidence: 0 }
    }

    // Detect workflow type
    const hasSequentialIndicators = SEQUENTIAL_INDICATORS.some(ind =>
      lowercaseMessage.includes(ind)
    )
    const hasParallelIndicators = PARALLEL_INDICATORS.some(ind =>
      lowercaseMessage.includes(ind)
    )

    // Default to sequential if both or neither are detected
    const workflowType: WorkflowType = hasParallelIndicators && !hasSequentialIndicators
      ? 'parallel'
      : 'sequential'

    // Extract tasks by splitting on sequential/parallel indicators
    const tasks = this.extractTasks(message, Array.from(mentionedAgents), workflowType)

    // Calculate confidence based on:
    // - Number of agents mentioned (more = higher)
    // - Presence of action verbs (more = higher)
    // - Presence of workflow indicators (sequential/parallel)
    const agentScore = Math.min(mentionedAgents.size * 20, 40) // max 40
    const actionVerbCount = ACTION_VERBS.filter(verb =>
      lowercaseMessage.includes(verb)
    ).length
    const actionScore = Math.min(actionVerbCount * 15, 30) // max 30
    const indicatorScore = (hasSequentialIndicators || hasParallelIndicators) ? 30 : 0

    const confidence = Math.min(agentScore + actionScore + indicatorScore, 100)

    // Threshold: need at least 50% confidence
    if (confidence < 50) {
      return { isWorkflow: false, confidence }
    }

    const parsedWorkflow: ParsedIntent = {
      workflowType,
      agents: Array.from(mentionedAgents),
      tasks,
      inputContext: message
    }

    return {
      isWorkflow: true,
      confidence,
      parsedWorkflow
    }
  }

  /**
   * Extract tasks from message
   */
  private extractTasks(
    message: string,
    agents: AgentType[],
    workflowType: WorkflowType
  ): WorkflowTask[] {
    const tasks: WorkflowTask[] = []

    // Split message by sequential indicators to find task boundaries
    const parts = this.splitByIndicators(message)

    // Match each part to an agent and extract instruction
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const agent = this.findAgentInText(part, agents)

      if (agent) {
        const instruction = this.extractInstruction(part)

        const task: WorkflowTask = {
          agent,
          instruction
        }

        // For sequential workflows, each task depends on previous
        if (workflowType === 'sequential' && i > 0) {
          task.dependsOn = [(i - 1).toString()]
        }

        tasks.push(task)
      }
    }

    // If we couldn't extract proper tasks, create default sequence
    if (tasks.length === 0) {
      agents.forEach((agent, index) => {
        const task: WorkflowTask = {
          agent,
          instruction: `Process the request using ${agent} capabilities`
        }

        if (workflowType === 'sequential' && index > 0) {
          task.dependsOn = [(index - 1).toString()]
        }

        tasks.push(task)
      })
    }

    return tasks
  }

  /**
   * Split message by workflow indicators
   */
  private splitByIndicators(message: string): string[] {
    const indicators = [...SEQUENTIAL_INDICATORS, ...PARALLEL_INDICATORS]
    let parts = [message]

    for (const indicator of indicators) {
      const newParts: string[] = []
      for (const part of parts) {
        const regex = new RegExp(`\\b${indicator}\\b`, 'gi')
        const split = part.split(regex)
        newParts.push(...split)
      }
      parts = newParts
    }

    return parts.filter(p => p.trim().length > 0)
  }

  /**
   * Find which agent is mentioned in text
   */
  private findAgentInText(text: string, agents: AgentType[]): AgentType | null {
    const lowercaseText = text.toLowerCase()

    for (const agent of agents) {
      const pattern = AGENT_PATTERNS.find(p => p.agentType === agent)
      if (pattern) {
        for (const keyword of pattern.keywords) {
          if (lowercaseText.includes(keyword)) {
            return agent
          }
        }
      }
    }

    // Return first agent if no match found
    return agents[0] || null
  }

  /**
   * Extract instruction from text part
   */
  private extractInstruction(text: string): string {
    // Remove agent mentions to get clean instruction
    let instruction = text.trim()

    for (const pattern of AGENT_PATTERNS) {
      for (const keyword of pattern.keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi')
        instruction = instruction.replace(regex, '').trim()
      }
    }

    // Remove leading "to" if present
    instruction = instruction.replace(/^to\s+/i, '')

    // If too short, use original text
    if (instruction.length < 10) {
      instruction = text.trim()
    }

    return instruction
  }

  /**
   * Create a workflow from parsed intent
   */
  async createChatWorkflow(params: {
    projectId: string
    sessionId: string
    originalMessage: string
    parsedIntent: ParsedIntent
  }): Promise<ChatWorkflowRequest> {
    const workflow: ChatWorkflowRequest = {
      id: `chat-wf-${Date.now()}`,
      projectId: params.projectId,
      sessionId: params.sessionId,
      originalMessage: params.originalMessage,
      parsedIntent: params.parsedIntent,
      status: 'confirming',
      createdAt: new Date()
    }

    this.workflows.set(workflow.id, workflow)
    this.emit('chat-workflow-created', workflow)

    return workflow
  }

  /**
   * Execute a chat workflow with streaming callbacks
   */
  async executeChatWorkflow(
    workflowId: string,
    projectPath: string,
    callbacks: WorkflowCallbacks
  ): Promise<WorkflowStepResult[]> {
    const workflow = this.workflows.get(workflowId)
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`)
    }

    // Check if already running
    if (this.runningWorkflows.get(workflowId)) {
      throw new Error('Workflow is already running')
    }

    this.runningWorkflows.set(workflowId, true)
    workflow.status = 'running'

    const results: WorkflowStepResult[] = []
    let previousOutput = workflow.parsedIntent.inputContext || ''

    try {
      const { tasks, workflowType } = workflow.parsedIntent

      if (workflowType === 'parallel') {
        // Execute all tasks in parallel
        const promises = tasks.map((task, index) =>
          this.executeStep(
            index,
            task,
            previousOutput,
            projectPath,
            callbacks
          )
        )

        const parallelResults = await Promise.allSettled(promises)

        for (let i = 0; i < parallelResults.length; i++) {
          const result = parallelResults[i]
          if (result.status === 'fulfilled') {
            results.push(result.value)
          } else {
            results.push({
              stepIndex: i,
              agent: tasks[i].agent,
              instruction: tasks[i].instruction,
              output: '',
              status: 'failed',
              startedAt: new Date(),
              completedAt: new Date()
            })
            callbacks.onError?.(result.reason, i)
          }
        }
      } else {
        // Sequential execution
        for (let i = 0; i < tasks.length; i++) {
          // Check if paused
          if (!this.runningWorkflows.get(workflowId)) {
            workflow.status = 'paused'
            this.pausedWorkflows.set(workflowId, results)
            return results
          }

          const task = tasks[i]

          try {
            const result = await this.executeStep(
              i,
              task,
              previousOutput,
              projectPath,
              callbacks
            )

            results.push(result)
            previousOutput = result.output

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)

            results.push({
              stepIndex: i,
              agent: task.agent,
              instruction: task.instruction,
              output: '',
              status: 'failed',
              startedAt: new Date(),
              completedAt: new Date()
            })

            callbacks.onError?.(errorMessage, i)

            // Mark remaining steps as pending
            for (let j = i + 1; j < tasks.length; j++) {
              results.push({
                stepIndex: j,
                agent: tasks[j].agent,
                instruction: tasks[j].instruction,
                output: '',
                status: 'pending'
              })
            }

            workflow.status = 'failed'
            throw error
          }
        }
      }

      // All steps completed
      workflow.status = 'completed'
      workflow.completedAt = new Date()
      callbacks.onWorkflowComplete?.(results)

      this.emit('chat-workflow-complete', { workflowId, results })

    } finally {
      this.runningWorkflows.delete(workflowId)
    }

    return results
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(
    stepIndex: number,
    task: WorkflowTask,
    previousOutput: string,
    projectPath: string,
    callbacks: WorkflowCallbacks
  ): Promise<WorkflowStepResult> {
    const result: WorkflowStepResult = {
      stepIndex,
      agent: task.agent,
      instruction: task.instruction,
      output: '',
      status: 'running',
      startedAt: new Date()
    }

    callbacks.onStepStart?.(stepIndex, task.agent)

    try {
      // Build full instruction with context
      let fullInstruction = task.instruction
      if (previousOutput && task.dependsOn && task.dependsOn.length > 0) {
        fullInstruction = `${task.instruction}\n\nContext from previous step:\n${previousOutput}`
      }

      // Run the agent task
      const output = await this.runAgentTask(
        task.agent,
        fullInstruction,
        projectPath,
        (content) => {
          result.output += content
          callbacks.onStepProgress?.(stepIndex, content)
        }
      )

      result.output = output
      result.status = 'completed'
      result.completedAt = new Date()

      callbacks.onStepComplete?.(stepIndex, result)
      this.emit('chat-workflow-step-complete', { stepIndex, result })

    } catch (error) {
      result.status = 'failed'
      result.completedAt = new Date()
      throw error
    }

    return result
  }

  /**
   * Run a single agent task with streaming
   */
  private runAgentTask(
    agentType: AgentType,
    task: string,
    projectPath: string,
    onProgress?: (content: string) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const sessionId = `chat-wf-${Date.now()}-${Math.random()}`
      let output = ''
      let completed = false

      const handleStream = (data: { sessionId: string; content: string }): void => {
        if (data.sessionId === sessionId) {
          output += data.content
          onProgress?.(data.content)
        }
      }

      const handleComplete = (data: { sessionId: string; content: string }): void => {
        if (data.sessionId === sessionId && !completed) {
          completed = true
          cleanup()
          resolve(data.content || output)
        }
      }

      const handleError = (data: { sessionId: string; error: string }): void => {
        if (data.sessionId === sessionId && !completed) {
          completed = true
          cleanup()
          reject(new Error(data.error))
        }
      }

      const cleanup = (): void => {
        claudeService.removeListener('stream', handleStream)
        claudeService.removeListener('complete', handleComplete)
        claudeService.removeListener('error', handleError)
      }

      claudeService.on('stream', handleStream)
      claudeService.on('complete', handleComplete)
      claudeService.on('error', handleError)

      claudeService
        .sendMessage({
          sessionId,
          message: task,
          projectPath,
          agentType
        })
        .catch((error) => {
          if (!completed) {
            completed = true
            cleanup()
            reject(error)
          }
        })
    })
  }

  /**
   * Pause a running workflow
   */
  pauseChatWorkflow(workflowId: string): void {
    const workflow = this.workflows.get(workflowId)
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`)
    }

    if (this.runningWorkflows.has(workflowId)) {
      this.runningWorkflows.set(workflowId, false)
      workflow.status = 'paused'
      claudeService.cancelCurrent()
    }
  }

  /**
   * Resume a paused workflow
   */
  async resumeChatWorkflow(
    workflowId: string,
    projectPath: string,
    callbacks: WorkflowCallbacks
  ): Promise<void> {
    const workflow = this.workflows.get(workflowId)
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`)
    }

    if (workflow.status !== 'paused') {
      throw new Error('Workflow is not paused')
    }

    // Clear paused state
    this.pausedWorkflows.delete(workflowId)

    // Continue from where we left off
    await this.executeChatWorkflow(workflowId, projectPath, callbacks)
  }

  /**
   * Cancel a workflow
   */
  cancelChatWorkflow(workflowId: string): void {
    const workflow = this.workflows.get(workflowId)
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`)
    }

    this.runningWorkflows.delete(workflowId)
    this.pausedWorkflows.delete(workflowId)
    workflow.status = 'failed'
    workflow.completedAt = new Date()

    claudeService.cancelCurrent()
  }

  /**
   * Get workflow status
   */
  getChatWorkflow(workflowId: string): ChatWorkflowRequest | null {
    return this.workflows.get(workflowId) || null
  }

  /**
   * List active workflows for a session
   */
  getSessionWorkflows(sessionId: string): ChatWorkflowRequest[] {
    return Array.from(this.workflows.values())
      .filter(wf => wf.sessionId === sessionId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  /**
   * List all workflows for a project
   */
  getProjectWorkflows(projectId: string): ChatWorkflowRequest[] {
    return Array.from(this.workflows.values())
      .filter(wf => wf.projectId === projectId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  /**
   * Delete a workflow
   */
  deleteChatWorkflow(workflowId: string): void {
    this.cancelChatWorkflow(workflowId)
    this.workflows.delete(workflowId)
  }

  /**
   * Cleanup all resources
   */
  cleanup(): void {
    for (const workflowId of this.runningWorkflows.keys()) {
      this.cancelChatWorkflow(workflowId)
    }
    this.workflows.clear()
    this.runningWorkflows.clear()
    this.pausedWorkflows.clear()
    this.removeAllListeners()
  }
}

export const chatWorkflowService = new ChatWorkflowService()
