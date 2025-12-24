import { EventEmitter } from 'events'
import { claudeService } from './claude.service'
import { databaseService } from './database.service'
import type { AgentType, Workflow, WorkflowStep, WorkflowTemplate } from '@shared/types'

// Workflow template definitions
const WORKFLOW_TEMPLATES: Record<
  WorkflowTemplate,
  {
    name: string
    description: string
    steps: Array<{
      agentType: AgentType
      taskTemplate: string
    }>
  }
> = {
  'story-to-tests': {
    name: 'User Story → Test Cases',
    description: 'Generate test cases from a user story',
    steps: [
      {
        agentType: 'product-owner',
        taskTemplate:
          'Review and refine this user story, ensuring it has clear acceptance criteria:\n\n{input}'
      },
      {
        agentType: 'tester',
        taskTemplate:
          'Based on this user story and acceptance criteria, generate comprehensive test cases including edge cases:\n\n{previousOutput}'
      }
    ]
  },
  'story-to-implementation': {
    name: 'User Story → Implementation',
    description: 'Generate technical spec and code from a user story',
    steps: [
      {
        agentType: 'product-owner',
        taskTemplate:
          'Review and refine this user story with detailed acceptance criteria:\n\n{input}'
      },
      {
        agentType: 'developer',
        taskTemplate:
          'Create a technical specification for implementing this user story:\n\n{previousOutput}'
      },
      {
        agentType: 'developer',
        taskTemplate:
          'Implement the feature based on this technical specification. Write clean, well-tested code:\n\n{previousOutput}'
      }
    ]
  },
  'code-review-security': {
    name: 'Code Review + Security Audit',
    description: 'Review code for quality and security issues',
    steps: [
      {
        agentType: 'developer',
        taskTemplate:
          'Perform a thorough code review of these changes, checking for bugs, code style, and best practices:\n\n{input}'
      },
      {
        agentType: 'security',
        taskTemplate:
          'Perform a security audit of this code, checking for vulnerabilities and OWASP Top 10 issues:\n\n{input}'
      }
    ]
  },
  'full-feature-pipeline': {
    name: 'Full Feature Pipeline',
    description: 'Complete workflow from story to deployed feature',
    steps: [
      {
        agentType: 'product-owner',
        taskTemplate: 'Refine this user story with detailed acceptance criteria:\n\n{input}'
      },
      {
        agentType: 'developer',
        taskTemplate: 'Create technical specification:\n\n{previousOutput}'
      },
      {
        agentType: 'tester',
        taskTemplate: 'Generate test cases from the story and spec:\n\n{previousOutput}'
      },
      {
        agentType: 'developer',
        taskTemplate: 'Implement the feature with tests:\n\n{previousOutput}'
      },
      {
        agentType: 'security',
        taskTemplate: 'Security review of the implementation:\n\n{previousOutput}'
      },
      {
        agentType: 'documentation',
        taskTemplate: 'Generate documentation for the feature:\n\n{previousOutput}'
      }
    ]
  }
}

interface WorkflowRunnerOptions {
  workflowId: string
  projectPath: string
  onStepStart?: (step: WorkflowStep) => void
  onStepComplete?: (step: WorkflowStep, output: string) => void
  onStepError?: (step: WorkflowStep, error: string) => void
  onComplete?: (workflow: Workflow) => void
  onError?: (error: string) => void
}

class WorkflowService extends EventEmitter {
  private runningWorkflows: Map<string, boolean> = new Map()

  /**
   * Get available workflow templates
   */
  getTemplates(): Array<{
    id: WorkflowTemplate
    name: string
    description: string
    stepCount: number
  }> {
    return Object.entries(WORKFLOW_TEMPLATES).map(([id, template]) => ({
      id: id as WorkflowTemplate,
      name: template.name,
      description: template.description,
      stepCount: template.steps.length
    }))
  }

  /**
   * Create a workflow from a template
   */
  createFromTemplate(
    projectId: string,
    template: WorkflowTemplate,
    initialInput: string
  ): Workflow {
    const templateDef = WORKFLOW_TEMPLATES[template]
    if (!templateDef) {
      throw new Error(`Unknown workflow template: ${template}`)
    }

    // Create workflow steps with the initial input
    const steps = templateDef.steps.map((step, index) => ({
      agentType: step.agentType,
      task: index === 0 ? step.taskTemplate.replace('{input}', initialInput) : step.taskTemplate,
      inputData: index === 0 ? initialInput : undefined
    }))

    return databaseService.createWorkflow({
      projectId,
      name: templateDef.name,
      description: templateDef.description,
      steps
    })
  }

  /**
   * Run a workflow
   */
  async runWorkflow(options: WorkflowRunnerOptions): Promise<void> {
    const { workflowId, projectPath, onStepStart, onStepComplete, onStepError, onComplete, onError } =
      options

    // Check if already running
    if (this.runningWorkflows.get(workflowId)) {
      throw new Error('Workflow is already running')
    }

    const workflow = databaseService.getWorkflow(workflowId)
    if (!workflow) {
      throw new Error('Workflow not found')
    }

    this.runningWorkflows.set(workflowId, true)
    databaseService.updateWorkflowStatus(workflowId, 'running')

    let previousOutput = ''

    try {
      for (const step of workflow.steps) {
        // Check if cancelled
        if (!this.runningWorkflows.get(workflowId)) {
          databaseService.updateWorkflowStatus(workflowId, 'cancelled')
          return
        }

        // Update step status
        databaseService.updateWorkflowStep(step.id, { status: 'running' })
        onStepStart?.(step)

        // Prepare the task with previous output
        let task = step.task
        if (previousOutput && task.includes('{previousOutput}')) {
          task = task.replace('{previousOutput}', previousOutput)
        }

        try {
          // Run the agent
          const output = await this.runAgentTask(step.agentType, task, projectPath)

          // Update step with output
          databaseService.updateWorkflowStep(step.id, {
            status: 'completed',
            outputData: output
          })

          previousOutput = output
          onStepComplete?.(step, output)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          databaseService.updateWorkflowStep(step.id, { status: 'failed' })
          onStepError?.(step, errorMessage)

          // Mark remaining steps as skipped
          const remainingSteps = workflow.steps.filter((s) => s.stepOrder > step.stepOrder)
          for (const remainingStep of remainingSteps) {
            databaseService.updateWorkflowStep(remainingStep.id, { status: 'skipped' })
          }

          databaseService.updateWorkflowStatus(workflowId, 'failed')
          onError?.(errorMessage)
          return
        }
      }

      // All steps completed
      databaseService.updateWorkflowStatus(workflowId, 'completed')
      const completedWorkflow = databaseService.getWorkflow(workflowId)
      if (completedWorkflow) {
        onComplete?.(completedWorkflow)
      }
    } finally {
      this.runningWorkflows.delete(workflowId)
    }
  }

  /**
   * Cancel a running workflow
   */
  cancelWorkflow(workflowId: string): boolean {
    if (this.runningWorkflows.has(workflowId)) {
      this.runningWorkflows.set(workflowId, false)
      claudeService.cancelCurrent()
      return true
    }
    return false
  }

  /**
   * Run a single agent task and wait for completion
   */
  private runAgentTask(agentType: AgentType, task: string, projectPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const sessionId = `workflow_${Date.now()}`
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
   * Generate user story from natural language prompt
   */
  async generateUserStory(
    projectId: string,
    projectPath: string,
    prompt: string
  ): Promise<{
    title: string
    description: string
    acceptanceCriteria: string
  }> {
    const task = `Based on the following requirement, create a well-structured user story.

Requirement: ${prompt}

Please output in this exact format:
TITLE: [concise title]
DESCRIPTION: As a [user type], I want [feature], so that [benefit]
ACCEPTANCE CRITERIA:
- Given [context], when [action], then [outcome]
- [additional criteria...]

Be specific and include edge cases in the acceptance criteria.`

    const output = await this.runAgentTask('product-owner', task, projectPath)

    // Parse the output
    const titleMatch = output.match(/TITLE:\s*(.+)/i)
    const descMatch = output.match(/DESCRIPTION:\s*([\s\S]+?)(?=ACCEPTANCE CRITERIA:|$)/i)
    const acMatch = output.match(/ACCEPTANCE CRITERIA:\s*([\s\S]+)/i)

    return {
      title: titleMatch?.[1]?.trim() || prompt.slice(0, 100),
      description: descMatch?.[1]?.trim() || prompt,
      acceptanceCriteria: acMatch?.[1]?.trim() || ''
    }
  }

  /**
   * Generate test cases from a user story
   */
  async generateTestCases(
    projectPath: string,
    userStory: { title: string; description: string; acceptanceCriteria: string }
  ): Promise<
    Array<{
      title: string
      description: string
      preconditions: string
      steps: string
      expectedResult: string
    }>
  > {
    const task = `Generate comprehensive test cases for this user story:

Title: ${userStory.title}
Description: ${userStory.description}
Acceptance Criteria:
${userStory.acceptanceCriteria}

For each test case, output in this exact format (generate 3-5 test cases):

---TEST CASE---
TITLE: [test case title]
DESCRIPTION: [what this test verifies]
PRECONDITIONS: [required setup]
STEPS:
1. [step 1]
2. [step 2]
...
EXPECTED RESULT: [expected outcome]
---END---

Include positive tests, negative tests, and edge cases.`

    const output = await this.runAgentTask('tester', task, projectPath)

    // Parse test cases
    const testCases: Array<{
      title: string
      description: string
      preconditions: string
      steps: string
      expectedResult: string
    }> = []

    const testCaseBlocks = output.split('---TEST CASE---').slice(1)

    for (const block of testCaseBlocks) {
      const titleMatch = block.match(/TITLE:\s*(.+)/i)
      const descMatch = block.match(/DESCRIPTION:\s*(.+)/i)
      const preMatch = block.match(/PRECONDITIONS:\s*(.+)/i)
      const stepsMatch = block.match(/STEPS:\s*([\s\S]+?)(?=EXPECTED RESULT:|---END---|$)/i)
      const expectedMatch = block.match(/EXPECTED RESULT:\s*(.+)/i)

      if (titleMatch) {
        testCases.push({
          title: titleMatch[1].trim(),
          description: descMatch?.[1]?.trim() || '',
          preconditions: preMatch?.[1]?.trim() || '',
          steps: stepsMatch?.[1]?.trim() || '',
          expectedResult: expectedMatch?.[1]?.trim() || ''
        })
      }
    }

    return testCases
  }
}

export const workflowService = new WorkflowService()
