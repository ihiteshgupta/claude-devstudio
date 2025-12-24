import { EventEmitter } from 'events'
import { claudeService } from './claude.service'
import { taskQueueService } from './task-queue.service'
import type {
  QueuedTask,
  TaskType,
  AgentType,
  AutonomyLevel
} from '@shared/types'

interface DecomposeInput {
  projectId: string
  title: string
  description: string
  context?: string
  projectPath: string
  autonomyLevel?: AutonomyLevel
  enqueueImmediately?: boolean
}

interface SubtaskSuggestion {
  title: string
  description: string
  taskType: TaskType
  agentType: AgentType
  estimatedDuration: number // in minutes
  dependencies: number[] // indices of dependent subtasks
  priority: number
}

interface DecomposeResult {
  parentTask: QueuedTask | null
  subtasks: SubtaskSuggestion[]
  enqueuedTasks: QueuedTask[]
}

class TaskDecomposerService extends EventEmitter {
  /**
   * Decompose a high-level task into subtasks
   */
  async decompose(input: DecomposeInput): Promise<DecomposeResult> {
    this.emit('decomposition-started', input.title)

    try {
      // Get subtask suggestions from Claude
      const suggestions = await this.getSubtaskSuggestions(input)

      let parentTask: QueuedTask | null = null
      const enqueuedTasks: QueuedTask[] = []

      // Optionally enqueue the tasks
      if (input.enqueueImmediately && suggestions.length > 0) {
        // Create parent task
        parentTask = taskQueueService.enqueueTask({
          projectId: input.projectId,
          title: input.title,
          description: input.description,
          taskType: 'decomposition',
          autonomyLevel: input.autonomyLevel || 'supervised',
          priority: 80,
          inputData: { context: input.context }
        })

        // Create subtasks in order
        const taskIdMap = new Map<number, string>()

        for (let i = 0; i < suggestions.length; i++) {
          const suggestion = suggestions[i]

          // Calculate dependencies
          const depIds = suggestion.dependencies
            .map(depIndex => taskIdMap.get(depIndex))
            .filter((id): id is string => !!id)

          const subtask = taskQueueService.enqueueTask({
            projectId: input.projectId,
            parentTaskId: parentTask.id,
            title: suggestion.title,
            description: suggestion.description,
            taskType: suggestion.taskType,
            agentType: suggestion.agentType,
            autonomyLevel: input.autonomyLevel || 'supervised',
            priority: suggestion.priority,
            estimatedDuration: suggestion.estimatedDuration * 60, // convert to seconds
            inputData: {
              dependencies: depIds
            }
          })

          taskIdMap.set(i, subtask.id)
          enqueuedTasks.push(subtask)

          // Create dependencies in the database
          for (const depId of depIds) {
            this.createDependency(subtask.id, depId)
          }
        }
      }

      const result: DecomposeResult = {
        parentTask,
        subtasks: suggestions,
        enqueuedTasks
      }

      this.emit('decomposition-complete', result)
      return result

    } catch (error) {
      this.emit('decomposition-error', error)
      throw error
    }
  }

  /**
   * Create a task dependency
   */
  private createDependency(taskId: string, dependsOnId: string): void {
    const db = require('./database.service').databaseService.getDb()
    const id = `dep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO task_dependencies (id, task_id, depends_on_task_id, dependency_type, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, taskId, dependsOnId, 'blocks', now)
  }

  /**
   * Get subtask suggestions from Claude
   */
  private async getSubtaskSuggestions(input: DecomposeInput): Promise<SubtaskSuggestion[]> {
    const prompt = this.buildDecompositionPrompt(input)

    return new Promise((resolve, reject) => {
      const sessionId = `decompose_${Date.now()}`
      let output = ''
      let completed = false

      const handleStream = (data: { sessionId: string; content: string }): void => {
        if (data.sessionId === sessionId) {
          output += data.content
        }
      }

      const handleComplete = (data: { sessionId: string; content: string }): void => {
        if (data.sessionId === sessionId && !completed) {
          completed = true
          cleanup()
          try {
            const suggestions = this.parseSubtasksFromOutput(data.content || output)
            resolve(suggestions)
          } catch (e) {
            reject(e)
          }
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
          message: prompt,
          projectPath: input.projectPath,
          agentType: 'developer'
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
   * Build prompt for task decomposition
   */
  private buildDecompositionPrompt(input: DecomposeInput): string {
    return `You are a project manager and technical lead. Break down the following high-level task into smaller, actionable subtasks.

Task: ${input.title}
Description: ${input.description}
${input.context ? `\nContext:\n${input.context}` : ''}

For each subtask, provide the details in this EXACT format (use exactly these markers):

---SUBTASK---
INDEX: [0-based index number]
TITLE: [Short, actionable title]
DESCRIPTION: [Detailed description of what needs to be done]
TASK_TYPE: [one of: code-generation, code-review, testing, documentation, security-audit, deployment, refactoring, bug-fix, tech-decision]
AGENT_TYPE: [one of: developer, product-owner, tester, security, devops, documentation]
ESTIMATED_MINUTES: [number]
DEPENDS_ON: [comma-separated indices of prerequisite subtasks, or "none"]
PRIORITY: [1-100, higher is more urgent]
---END---

Requirements:
1. Break down into 3-8 actionable subtasks
2. Order subtasks logically with proper dependencies
3. Assign appropriate agent types based on the work
4. Be specific in descriptions
5. Consider testing and documentation as separate tasks
6. Prioritize correctly (setup tasks first, then implementation, then testing)`
  }

  /**
   * Parse subtasks from Claude output
   */
  private parseSubtasksFromOutput(output: string): SubtaskSuggestion[] {
    const suggestions: SubtaskSuggestion[] = []
    const subtaskBlocks = output.split('---SUBTASK---').slice(1)

    for (const block of subtaskBlocks) {
      const indexMatch = block.match(/INDEX:\s*(\d+)/i)
      const titleMatch = block.match(/TITLE:\s*(.+)/i)
      const descMatch = block.match(/DESCRIPTION:\s*(.+)/i)
      const typeMatch = block.match(/TASK_TYPE:\s*(\S+)/i)
      const agentMatch = block.match(/AGENT_TYPE:\s*(\S+)/i)
      const durationMatch = block.match(/ESTIMATED_MINUTES:\s*(\d+)/i)
      const dependsMatch = block.match(/DEPENDS_ON:\s*(.+)/i)
      const priorityMatch = block.match(/PRIORITY:\s*(\d+)/i)

      if (titleMatch) {
        const dependsStr = dependsMatch?.[1]?.trim() || 'none'
        const dependencies = dependsStr.toLowerCase() === 'none'
          ? []
          : dependsStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))

        suggestions.push({
          title: titleMatch[1].trim(),
          description: descMatch?.[1]?.trim() || '',
          taskType: this.parseTaskType(typeMatch?.[1]),
          agentType: this.parseAgentType(agentMatch?.[1]),
          estimatedDuration: parseInt(durationMatch?.[1] || '30'),
          dependencies,
          priority: parseInt(priorityMatch?.[1] || '50')
        })
      }
    }

    return suggestions
  }

  /**
   * Parse task type from string
   */
  private parseTaskType(value?: string): TaskType {
    const normalized = value?.toLowerCase().replace(/_/g, '-')
    const validTypes: TaskType[] = [
      'code-generation', 'code-review', 'testing', 'documentation',
      'security-audit', 'deployment', 'refactoring', 'bug-fix', 'tech-decision'
    ]
    return validTypes.includes(normalized as TaskType)
      ? normalized as TaskType
      : 'code-generation'
  }

  /**
   * Parse agent type from string
   */
  private parseAgentType(value?: string): AgentType {
    const normalized = value?.toLowerCase().replace(/_/g, '-')
    const validTypes: AgentType[] = [
      'developer', 'product-owner', 'tester', 'security', 'devops', 'documentation'
    ]
    return validTypes.includes(normalized as AgentType)
      ? normalized as AgentType
      : 'developer'
  }

  /**
   * Suggest agent types for a task based on its description
   */
  async suggestAgents(
    taskDescription: string,
    projectPath: string
  ): Promise<{ agentType: AgentType; confidence: number; reason: string }[]> {
    const prompt = `Analyze this task and suggest which AI agent types would be best suited:

Task: ${taskDescription}

Available agent types:
- developer: Code generation, reviews, debugging
- product-owner: User stories, requirements, prioritization
- tester: Test cases, QA, quality assurance
- security: Security audits, vulnerability detection
- devops: CI/CD, infrastructure, deployment
- documentation: API docs, READMEs, technical writing

For each relevant agent, output in this format (suggest 1-3 agents):

---AGENT---
TYPE: [agent type]
CONFIDENCE: [0-100]
REASON: [why this agent is suitable]
---END---`

    return new Promise((resolve, reject) => {
      const sessionId = `suggest_${Date.now()}`
      let output = ''
      let completed = false

      const handleComplete = (data: { sessionId: string; content: string }): void => {
        if (data.sessionId === sessionId && !completed) {
          completed = true
          claudeService.removeAllListeners()

          const agents: { agentType: AgentType; confidence: number; reason: string }[] = []
          const blocks = (data.content || output).split('---AGENT---').slice(1)

          for (const block of blocks) {
            const typeMatch = block.match(/TYPE:\s*(\S+)/i)
            const confMatch = block.match(/CONFIDENCE:\s*(\d+)/i)
            const reasonMatch = block.match(/REASON:\s*(.+)/i)

            if (typeMatch) {
              agents.push({
                agentType: this.parseAgentType(typeMatch[1]),
                confidence: parseInt(confMatch?.[1] || '50'),
                reason: reasonMatch?.[1]?.trim() || ''
              })
            }
          }

          resolve(agents.sort((a, b) => b.confidence - a.confidence))
        }
      }

      const handleError = (data: { sessionId: string; error: string }): void => {
        if (data.sessionId === sessionId && !completed) {
          completed = true
          claudeService.removeAllListeners()
          reject(new Error(data.error))
        }
      }

      claudeService.on('stream', (data) => {
        if (data.sessionId === sessionId) output += data.content
      })
      claudeService.on('complete', handleComplete)
      claudeService.on('error', handleError)

      claudeService.sendMessage({
        sessionId,
        message: prompt,
        projectPath,
        agentType: 'developer'
      }).catch(reject)
    })
  }

  /**
   * Estimate task duration based on description
   */
  async estimateDuration(
    taskDescription: string,
    taskType: TaskType,
    projectPath: string
  ): Promise<{ minutes: number; confidence: number; breakdown: string }> {
    const prompt = `Estimate how long this task would take for an AI agent to complete:

Task: ${taskDescription}
Type: ${taskType}

Consider:
- Complexity of the task
- Amount of code/content to generate
- Need for iteration or refinement

Output in this format:
ESTIMATED_MINUTES: [number]
CONFIDENCE: [0-100, how confident you are in this estimate]
BREAKDOWN: [brief explanation of how you arrived at this estimate]`

    return new Promise((resolve, reject) => {
      const sessionId = `estimate_${Date.now()}`
      let completed = false

      const handleComplete = (data: { sessionId: string; content: string }): void => {
        if (data.sessionId === sessionId && !completed) {
          completed = true
          claudeService.removeAllListeners()

          const content = data.content
          const minutesMatch = content.match(/ESTIMATED_MINUTES:\s*(\d+)/i)
          const confMatch = content.match(/CONFIDENCE:\s*(\d+)/i)
          const breakdownMatch = content.match(/BREAKDOWN:\s*(.+)/i)

          resolve({
            minutes: parseInt(minutesMatch?.[1] || '30'),
            confidence: parseInt(confMatch?.[1] || '50'),
            breakdown: breakdownMatch?.[1]?.trim() || ''
          })
        }
      }

      claudeService.on('complete', handleComplete)
      claudeService.on('error', (data) => {
        if (data.sessionId === sessionId && !completed) {
          completed = true
          claudeService.removeAllListeners()
          reject(new Error(data.error))
        }
      })

      claudeService.sendMessage({
        sessionId,
        message: prompt,
        projectPath,
        agentType: 'developer'
      }).catch(reject)
    })
  }
}

export const taskDecomposerService = new TaskDecomposerService()
