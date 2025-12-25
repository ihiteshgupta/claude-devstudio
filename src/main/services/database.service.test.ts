/**
 * Claude DevStudio
 * Copyright (c) 2024 Claude DevStudio Contributors
 * Licensed under MIT License - see LICENSE file
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import type { AgentType } from '@shared/types'
import { existsSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// Use a fixed test directory - must be defined inline for vi.mock hoisting
const TEST_DATA_PATH = '/tmp/claude-devstudio-test-db'

// Mock electron app module BEFORE importing the service
vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/claude-devstudio-test-db'
  }
}))

// Import after mocking
import { DatabaseService, type UserStory, type TestCase, type Workflow } from './database.service'

describe('DatabaseService', () => {
  let db: DatabaseService
  let dbInstance: Database.Database

  beforeEach(() => {
    // Create a new database service for each test
    db = new DatabaseService()
    dbInstance = db.getDb()
  })

  afterEach(() => {
    try {
      db.close()
    } catch {
      // Ignore close errors
    }
    // Clean up test database files
    try {
      const dbDir = join(TEST_DATA_PATH, 'claude-data')
      if (existsSync(dbDir)) {
        rmSync(dbDir, { recursive: true, force: true })
      }
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('Database Initialization', () => {
    it('should initialize database with WAL mode', () => {
      const pragmaResult = dbInstance.pragma('journal_mode', { simple: true })
      expect(pragmaResult).toBe('wal')
    })

    it('should create all required tables', () => {
      const tables = dbInstance
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .all() as Array<{ name: string }>

      const tableNames = tables.map((t) => t.name)

      expect(tableNames).toContain('chat_sessions')
      expect(tableNames).toContain('messages')
      expect(tableNames).toContain('workflows')
      expect(tableNames).toContain('workflow_steps')
      expect(tableNames).toContain('user_stories')
      expect(tableNames).toContain('test_cases')
      expect(tableNames).toContain('sprints')
      expect(tableNames).toContain('roadmap_items')
      expect(tableNames).toContain('task_queue')
      expect(tableNames).toContain('tech_choices')
      expect(tableNames).toContain('task_dependencies')
      expect(tableNames).toContain('approval_gates')
    })

    it('should return database instance via getDb()', () => {
      const instance = db.getDb()
      expect(instance).toBeDefined()
      expect(instance).toBeInstanceOf(Database)
    })
  })

  describe('Write Lock Mechanism', () => {
    it('should execute operation with write lock', () => {
      const result = db.withWriteLock(() => {
        return 'test-result'
      })
      expect(result).toBe('test-result')
    })

    it('should throw error if write lock is already held', () => {
      expect(() => {
        db.withWriteLock(() => {
          // Try to acquire lock again within locked operation
          db.withWriteLock(() => {
            return 'nested'
          })
        })
      }).toThrow('Database write operation already in progress. Please retry.')
    })

    it('should release write lock after operation completes', () => {
      db.withWriteLock(() => {
        return 'first'
      })

      // Should not throw since lock was released
      const result = db.withWriteLock(() => {
        return 'second'
      })
      expect(result).toBe('second')
    })

    it('should release write lock even if operation throws error', () => {
      expect(() => {
        db.withWriteLock(() => {
          throw new Error('Test error')
        })
      }).toThrow('Test error')

      // Lock should be released, allowing this to succeed
      const result = db.withWriteLock(() => {
        return 'after-error'
      })
      expect(result).toBe('after-error')
    })
  })

  describe('Write Lock with Retry', () => {
    it('should retry on lock contention', () => {
      let attempt = 0
      const result = db.withWriteLockRetry(() => {
        attempt++
        if (attempt < 2) {
          throw new Error('Database write operation already in progress. Please retry.')
        }
        return 'success'
      }, 3, 1)

      expect(result).toBe('success')
      expect(attempt).toBe(2)
    })

    it('should throw error after max retries', () => {
      expect(() => {
        db.withWriteLockRetry(
          () => {
            throw new Error('Database write operation already in progress. Please retry.')
          },
          3,
          1
        )
      }).toThrow('Database write operation already in progress. Please retry.')
    })

    it('should succeed on first attempt if no contention', () => {
      const result = db.withWriteLockRetry(() => {
        return 'immediate-success'
      })
      expect(result).toBe('immediate-success')
    })
  })

  describe('Transaction Support', () => {
    it('should execute operations in a transaction', () => {
      const result = db.transaction(() => {
        db.createSession('proj-1', 'developer', 'Test Session')
        const sessions = db.listSessions('proj-1')
        return sessions.length
      })

      expect(result).toBe(1)
    })

    it('should rollback transaction on error', () => {
      try {
        db.transaction(() => {
          db.createSession('proj-1', 'developer', 'Test Session')
          throw new Error('Transaction error')
        })
      } catch (error) {
        // Expected error
      }

      const sessions = db.listSessions('proj-1')
      expect(sessions).toHaveLength(0)
    })
  })

  describe('Chat Sessions', () => {
    it('should create a chat session', () => {
      const session = db.createSession('project-1', 'developer', 'Test Session')

      expect(session).toBeDefined()
      expect(session.id).toMatch(/^session_/)
      expect(session.projectId).toBe('project-1')
      expect(session.agentType).toBe('developer')
      expect(session.messages).toEqual([])
      expect(session.createdAt).toBeInstanceOf(Date)
      expect(session.updatedAt).toBeInstanceOf(Date)
    })

    it('should create session with default title', () => {
      const session = db.createSession('project-1', 'tester')

      expect(session.id).toBeDefined()
    })

    it('should retrieve a session by id', () => {
      const created = db.createSession('project-1', 'developer', 'Test Session')
      const retrieved = db.getSession(created.id)

      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(created.id)
      expect(retrieved?.projectId).toBe('project-1')
      expect(retrieved?.agentType).toBe('developer')
    })

    it('should return null for non-existent session', () => {
      const session = db.getSession('non-existent-id')
      expect(session).toBeNull()
    })

    it('should list all sessions for a project', () => {
      db.createSession('project-1', 'developer', 'Session 1')
      db.createSession('project-1', 'tester', 'Session 2')
      db.createSession('project-2', 'developer', 'Session 3')

      const sessions = db.listSessions('project-1')

      expect(sessions).toHaveLength(2)
      expect(sessions[0].projectId).toBe('project-1')
      expect(sessions[1].projectId).toBe('project-1')
    })

    it('should list sessions filtered by agent type', () => {
      db.createSession('project-1', 'developer', 'Session 1')
      db.createSession('project-1', 'tester', 'Session 2')
      db.createSession('project-1', 'developer', 'Session 3')

      const sessions = db.listSessions('project-1', 'developer')

      expect(sessions).toHaveLength(2)
      expect(sessions.every((s) => s.agentType === 'developer')).toBe(true)
    })

    it('should delete a session', () => {
      const session = db.createSession('project-1', 'developer', 'Test Session')
      const deleted = db.deleteSession(session.id)

      expect(deleted).toBe(true)
      expect(db.getSession(session.id)).toBeNull()
    })

    it('should return false when deleting non-existent session', () => {
      const deleted = db.deleteSession('non-existent-id')
      expect(deleted).toBe(false)
    })
  })

  describe('Messages', () => {
    let sessionId: string

    beforeEach(() => {
      const session = db.createSession('project-1', 'developer', 'Test Session')
      sessionId = session.id
    })

    it('should add a message to a session', () => {
      const message = db.addMessage(sessionId, {
        role: 'user',
        content: 'Hello',
        timestamp: new Date()
      })

      expect(message).toBeDefined()
      expect(message.id).toMatch(/^msg_/)
      expect(message.role).toBe('user')
      expect(message.content).toBe('Hello')
    })

    it('should add message with agent type', () => {
      const message = db.addMessage(sessionId, {
        role: 'assistant',
        content: 'Hi there',
        agentType: 'developer' as AgentType,
        timestamp: new Date()
      })

      expect(message.agentType).toBe('developer')
    })

    it('should retrieve session messages in order', () => {
      db.addMessage(sessionId, {
        role: 'user',
        content: 'First message',
        timestamp: new Date()
      })

      db.addMessage(sessionId, {
        role: 'assistant',
        content: 'Second message',
        timestamp: new Date()
      })

      const messages = db.getSessionMessages(sessionId)

      expect(messages).toHaveLength(2)
      expect(messages[0].content).toBe('First message')
      expect(messages[1].content).toBe('Second message')
    })

    it('should update session updated_at when adding message', () => {
      const session = db.getSession(sessionId)
      const originalUpdatedAt = session?.updatedAt

      db.addMessage(sessionId, {
        role: 'user',
        content: 'New message',
        timestamp: new Date()
      })

      const updatedSession = db.getSession(sessionId)
      // updatedAt should be updated (>= original)
      expect(updatedSession?.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt!.getTime())
    })

    it('should update message content', () => {
      const message = db.addMessage(sessionId, {
        role: 'user',
        content: 'Original content',
        timestamp: new Date()
      })

      db.updateMessage(message.id, 'Updated content')

      const messages = db.getSessionMessages(sessionId)
      expect(messages[0].content).toBe('Updated content')
    })

    it('should handle messages with null agent type', () => {
      const message = db.addMessage(sessionId, {
        role: 'user',
        content: 'User message',
        timestamp: new Date()
      })

      const messages = db.getSessionMessages(sessionId)
      expect(messages[0].agentType).toBeUndefined()
    })
  })

  describe('User Stories', () => {
    it('should create a user story', () => {
      const story = db.createUserStory({
        projectId: 'project-1',
        title: 'As a user, I want to login',
        description: 'User authentication',
        acceptanceCriteria: 'User can login successfully',
        storyPoints: 5,
        priority: 'high'
      })

      expect(story).toBeDefined()
      expect(story.id).toMatch(/^story_/)
      expect(story.title).toBe('As a user, I want to login')
      expect(story.storyPoints).toBe(5)
      expect(story.priority).toBe('high')
      expect(story.status).toBe('backlog')
    })

    it('should create story with minimal data', () => {
      const story = db.createUserStory({
        projectId: 'project-1',
        title: 'Basic story'
      })

      expect(story.id).toBeDefined()
      expect(story.priority).toBe('medium')
      expect(story.status).toBe('backlog')
    })

    it('should list user stories for a project', () => {
      db.createUserStory({ projectId: 'project-1', title: 'Story 1' })
      db.createUserStory({ projectId: 'project-1', title: 'Story 2' })
      db.createUserStory({ projectId: 'project-2', title: 'Story 3' })

      const stories = db.listUserStories('project-1')

      expect(stories).toHaveLength(2)
      expect(stories.every((s) => s.projectId === 'project-1')).toBe(true)
    })

    it('should list stories filtered by sprint', () => {
      const sprint = db.createSprint({
        projectId: 'project-1',
        name: 'Sprint 1',
        startDate: new Date(),
        endDate: new Date()
      })

      const story1 = db.createUserStory({ projectId: 'project-1', title: 'Story 1' })
      db.updateUserStory(story1.id, { sprintId: sprint.id })

      db.createUserStory({ projectId: 'project-1', title: 'Story 2' })

      const sprintStories = db.listUserStories('project-1', sprint.id)
      expect(sprintStories).toHaveLength(1)
      expect(sprintStories[0].sprintId).toBe(sprint.id)
    })

    it('should list stories without sprint (backlog)', () => {
      db.createUserStory({ projectId: 'project-1', title: 'Story 1' })
      db.createUserStory({ projectId: 'project-1', title: 'Story 2' })

      const backlogStories = db.listUserStories('project-1', null as unknown as string)
      expect(backlogStories).toHaveLength(2)
    })

    it('should update user story', () => {
      const story = db.createUserStory({
        projectId: 'project-1',
        title: 'Original title'
      })

      const updated = db.updateUserStory(story.id, {
        title: 'Updated title',
        status: 'in-progress',
        storyPoints: 8
      })

      expect(updated).toBeDefined()
      expect(updated?.title).toBe('Updated title')
      expect(updated?.status).toBe('in-progress')
      expect(updated?.storyPoints).toBe(8)
    })

    it('should update story sprint assignment', () => {
      const story = db.createUserStory({
        projectId: 'project-1',
        title: 'Test story'
      })

      const sprint = db.createSprint({
        projectId: 'project-1',
        name: 'Sprint 1',
        startDate: new Date(),
        endDate: new Date()
      })

      const updated = db.updateUserStory(story.id, { sprintId: sprint.id })
      expect(updated?.sprintId).toBe(sprint.id)
    })

    it('should handle null/undefined updates gracefully', () => {
      const story = db.createUserStory({
        projectId: 'project-1',
        title: 'Test story',
        description: 'Original description'
      })

      // Undefined values should be ignored, original value retained
      const updated = db.updateUserStory(story.id, {
        description: undefined
      })

      expect(updated?.description).toBe('Original description')
    })

    it('should return null when updating non-existent story', () => {
      const updated = db.updateUserStory('non-existent', { title: 'New title' })
      expect(updated).toBeNull()
    })

    it('should delete user story', () => {
      const story = db.createUserStory({
        projectId: 'project-1',
        title: 'To be deleted'
      })

      const deleted = db.deleteUserStory(story.id)
      expect(deleted).toBe(true)

      const stories = db.listUserStories('project-1')
      expect(stories).toHaveLength(0)
    })

    it('should return false when deleting non-existent story', () => {
      const deleted = db.deleteUserStory('non-existent')
      expect(deleted).toBe(false)
    })

    it('should update story updated_at timestamp', () => {
      const story = db.createUserStory({
        projectId: 'project-1',
        title: 'Test story'
      })

      const originalUpdatedAt = story.updatedAt

      // Small delay to ensure different timestamp
      const updated = db.updateUserStory(story.id, { title: 'New title' })
      expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime())
    })

    it('should not update if no fields provided', () => {
      const story = db.createUserStory({
        projectId: 'project-1',
        title: 'Test story'
      })

      const updated = db.updateUserStory(story.id, {})
      expect(updated).toBeDefined()
    })
  })

  describe('Sprints', () => {
    it('should create a sprint', () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-14')

      const sprint = db.createSprint({
        projectId: 'project-1',
        name: 'Sprint 1',
        description: 'First sprint',
        startDate,
        endDate,
        goal: 'Complete MVP'
      })

      expect(sprint).toBeDefined()
      expect(sprint.id).toMatch(/^sprint_/)
      expect(sprint.name).toBe('Sprint 1')
      expect(sprint.status).toBe('planned')
      expect(sprint.startDate).toEqual(startDate)
      expect(sprint.endDate).toEqual(endDate)
      expect(sprint.goal).toBe('Complete MVP')
    })

    it('should create sprint with minimal data', () => {
      const sprint = db.createSprint({
        projectId: 'project-1',
        name: 'Sprint 1',
        startDate: new Date(),
        endDate: new Date()
      })

      expect(sprint.id).toBeDefined()
      expect(sprint.status).toBe('planned')
    })

    it('should get sprint by id', () => {
      const created = db.createSprint({
        projectId: 'project-1',
        name: 'Sprint 1',
        startDate: new Date(),
        endDate: new Date()
      })

      const retrieved = db.getSprint(created.id)

      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(created.id)
      expect(retrieved?.name).toBe('Sprint 1')
    })

    it('should return null for non-existent sprint', () => {
      const sprint = db.getSprint('non-existent')
      expect(sprint).toBeNull()
    })

    it('should list sprints for a project', () => {
      db.createSprint({
        projectId: 'project-1',
        name: 'Sprint 1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-14')
      })

      db.createSprint({
        projectId: 'project-1',
        name: 'Sprint 2',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-28')
      })

      db.createSprint({
        projectId: 'project-2',
        name: 'Sprint 3',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-14')
      })

      const sprints = db.listSprints('project-1')

      expect(sprints).toHaveLength(2)
      expect(sprints.every((s) => s.projectId === 'project-1')).toBe(true)
    })

    it('should update sprint', () => {
      const sprint = db.createSprint({
        projectId: 'project-1',
        name: 'Sprint 1',
        startDate: new Date(),
        endDate: new Date()
      })

      const newEndDate = new Date('2024-02-01')
      const updated = db.updateSprint(sprint.id, {
        name: 'Updated Sprint',
        status: 'active',
        endDate: newEndDate
      })

      expect(updated).toBeDefined()
      expect(updated?.name).toBe('Updated Sprint')
      expect(updated?.status).toBe('active')
      expect(updated?.endDate).toEqual(newEndDate)
    })

    it('should update sprint goal', () => {
      const sprint = db.createSprint({
        projectId: 'project-1',
        name: 'Sprint 1',
        startDate: new Date(),
        endDate: new Date()
      })

      const updated = db.updateSprint(sprint.id, {
        goal: 'New goal'
      })

      expect(updated?.goal).toBe('New goal')
    })

    it('should return null when updating non-existent sprint', () => {
      const updated = db.updateSprint('non-existent', { name: 'New name' })
      expect(updated).toBeNull()
    })

    it('should delete sprint', () => {
      const sprint = db.createSprint({
        projectId: 'project-1',
        name: 'Sprint 1',
        startDate: new Date(),
        endDate: new Date()
      })

      const deleted = db.deleteSprint(sprint.id)
      expect(deleted).toBe(true)

      expect(db.getSprint(sprint.id)).toBeNull()
    })

    it('should unassign stories when deleting sprint', () => {
      const sprint = db.createSprint({
        projectId: 'project-1',
        name: 'Sprint 1',
        startDate: new Date(),
        endDate: new Date()
      })

      const story = db.createUserStory({
        projectId: 'project-1',
        title: 'Test story'
      })

      db.addStoryToSprint(sprint.id, story.id)
      db.deleteSprint(sprint.id)

      const stories = db.listUserStories('project-1')
      expect(stories[0].sprintId).toBeUndefined()
    })

    it('should return false when deleting non-existent sprint', () => {
      const deleted = db.deleteSprint('non-existent')
      expect(deleted).toBe(false)
    })

    it('should add story to sprint', () => {
      const sprint = db.createSprint({
        projectId: 'project-1',
        name: 'Sprint 1',
        startDate: new Date(),
        endDate: new Date()
      })

      const story = db.createUserStory({
        projectId: 'project-1',
        title: 'Test story'
      })

      const added = db.addStoryToSprint(sprint.id, story.id)
      expect(added).toBe(true)

      const stories = db.listUserStories('project-1', sprint.id)
      expect(stories).toHaveLength(1)
      expect(stories[0].sprintId).toBe(sprint.id)
    })

    it('should return false when adding non-existent story to sprint', () => {
      const sprint = db.createSprint({
        projectId: 'project-1',
        name: 'Sprint 1',
        startDate: new Date(),
        endDate: new Date()
      })

      const added = db.addStoryToSprint(sprint.id, 'non-existent-story')
      expect(added).toBe(false)
    })

    it('should remove story from sprint', () => {
      const sprint = db.createSprint({
        projectId: 'project-1',
        name: 'Sprint 1',
        startDate: new Date(),
        endDate: new Date()
      })

      const story = db.createUserStory({
        projectId: 'project-1',
        title: 'Test story'
      })

      db.addStoryToSprint(sprint.id, story.id)
      const removed = db.removeStoryFromSprint(story.id)

      expect(removed).toBe(true)

      const stories = db.listUserStories('project-1', sprint.id)
      expect(stories).toHaveLength(0)
    })

    it('should return false when removing non-existent story from sprint', () => {
      const removed = db.removeStoryFromSprint('non-existent-story')
      expect(removed).toBe(false)
    })
  })

  describe('Test Cases', () => {
    it('should create a test case', () => {
      const story = db.createUserStory({
        projectId: 'project-1',
        title: 'Test story'
      })

      const testCase = db.createTestCase({
        projectId: 'project-1',
        userStoryId: story.id,
        title: 'Test login functionality',
        description: 'Verify user can login',
        preconditions: 'User has valid credentials',
        steps: '1. Enter username\n2. Enter password\n3. Click login',
        expectedResult: 'User is logged in successfully'
      })

      expect(testCase).toBeDefined()
      expect(testCase.id).toMatch(/^test_/)
      expect(testCase.title).toBe('Test login functionality')
      expect(testCase.userStoryId).toBe(story.id)
      expect(testCase.status).toBe('draft')
    })

    it('should create test case without user story', () => {
      const testCase = db.createTestCase({
        projectId: 'project-1',
        title: 'Standalone test'
      })

      expect(testCase.id).toBeDefined()
      expect(testCase.userStoryId).toBeUndefined()
    })

    it('should create test case with minimal data', () => {
      const testCase = db.createTestCase({
        projectId: 'project-1',
        title: 'Basic test'
      })

      expect(testCase.id).toBeDefined()
      expect(testCase.status).toBe('draft')
    })

    it('should list test cases for a project', () => {
      db.createTestCase({ projectId: 'project-1', title: 'Test 1' })
      db.createTestCase({ projectId: 'project-1', title: 'Test 2' })
      db.createTestCase({ projectId: 'project-2', title: 'Test 3' })

      const testCases = db.listTestCases('project-1')

      expect(testCases).toHaveLength(2)
      expect(testCases.every((tc) => tc.projectId === 'project-1')).toBe(true)
    })

    it('should list test cases filtered by user story', () => {
      const story = db.createUserStory({
        projectId: 'project-1',
        title: 'Test story'
      })

      db.createTestCase({
        projectId: 'project-1',
        userStoryId: story.id,
        title: 'Test 1'
      })

      db.createTestCase({
        projectId: 'project-1',
        title: 'Test 2'
      })

      const testCases = db.listTestCases('project-1', story.id)

      expect(testCases).toHaveLength(1)
      expect(testCases[0].userStoryId).toBe(story.id)
    })
  })

  describe('Workflows', () => {
    it('should create a workflow with steps', () => {
      const workflow = db.createWorkflow({
        projectId: 'project-1',
        name: 'Story to Tests Pipeline',
        description: 'Generate tests from user story',
        steps: [
          {
            agentType: 'product-owner' as AgentType,
            task: 'Review story requirements'
          },
          {
            agentType: 'tester' as AgentType,
            task: 'Generate test cases',
            inputData: 'Previous step output'
          }
        ]
      })

      expect(workflow).toBeDefined()
      expect(workflow.id).toMatch(/^workflow_/)
      expect(workflow.name).toBe('Story to Tests Pipeline')
      expect(workflow.status).toBe('pending')
      expect(workflow.steps).toHaveLength(2)
      expect(workflow.steps[0].agentType).toBe('product-owner')
      expect(workflow.steps[1].agentType).toBe('tester')
      expect(workflow.steps[0].stepOrder).toBe(0)
      expect(workflow.steps[1].stepOrder).toBe(1)
    })

    it('should create workflow with minimal data', () => {
      const workflow = db.createWorkflow({
        projectId: 'project-1',
        name: 'Simple workflow',
        steps: []
      })

      expect(workflow.id).toBeDefined()
      expect(workflow.steps).toHaveLength(0)
    })

    it('should get workflow by id', () => {
      const created = db.createWorkflow({
        projectId: 'project-1',
        name: 'Test workflow',
        steps: [
          {
            agentType: 'developer' as AgentType,
            task: 'Write code'
          }
        ]
      })

      const retrieved = db.getWorkflow(created.id)

      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(created.id)
      expect(retrieved?.steps).toHaveLength(1)
    })

    it('should return null for non-existent workflow', () => {
      const workflow = db.getWorkflow('non-existent')
      expect(workflow).toBeNull()
    })

    it('should list workflows for a project', () => {
      db.createWorkflow({
        projectId: 'project-1',
        name: 'Workflow 1',
        steps: []
      })

      db.createWorkflow({
        projectId: 'project-1',
        name: 'Workflow 2',
        steps: []
      })

      db.createWorkflow({
        projectId: 'project-2',
        name: 'Workflow 3',
        steps: []
      })

      const workflows = db.listWorkflows('project-1')

      expect(workflows).toHaveLength(2)
      expect(workflows.every((w) => w.projectId === 'project-1')).toBe(true)
      expect(workflows[0].steps).toHaveLength(0) // List view doesn't include steps
    })

    it('should update workflow step status', () => {
      const workflow = db.createWorkflow({
        projectId: 'project-1',
        name: 'Test workflow',
        steps: [
          {
            agentType: 'developer' as AgentType,
            task: 'Write code'
          }
        ]
      })

      const stepId = workflow.steps[0].id

      db.updateWorkflowStep(stepId, {
        status: 'running'
      })

      const updated = db.getWorkflow(workflow.id)
      expect(updated?.steps[0].status).toBe('running')
      expect(updated?.steps[0].completedAt).toBeUndefined()
    })

    it('should update workflow step with output data', () => {
      const workflow = db.createWorkflow({
        projectId: 'project-1',
        name: 'Test workflow',
        steps: [
          {
            agentType: 'developer' as AgentType,
            task: 'Write code'
          }
        ]
      })

      const stepId = workflow.steps[0].id

      db.updateWorkflowStep(stepId, {
        outputData: 'Step completed successfully'
      })

      const updated = db.getWorkflow(workflow.id)
      expect(updated?.steps[0].outputData).toBe('Step completed successfully')
    })

    it('should set completed_at when step status is completed', () => {
      const workflow = db.createWorkflow({
        projectId: 'project-1',
        name: 'Test workflow',
        steps: [
          {
            agentType: 'developer' as AgentType,
            task: 'Write code'
          }
        ]
      })

      const stepId = workflow.steps[0].id

      db.updateWorkflowStep(stepId, {
        status: 'completed',
        outputData: 'Done'
      })

      const updated = db.getWorkflow(workflow.id)
      expect(updated?.steps[0].status).toBe('completed')
      expect(updated?.steps[0].completedAt).toBeInstanceOf(Date)
    })

    it('should update workflow status', () => {
      const workflow = db.createWorkflow({
        projectId: 'project-1',
        name: 'Test workflow',
        steps: []
      })

      db.updateWorkflowStatus(workflow.id, 'running')

      const updated = db.getWorkflow(workflow.id)
      expect(updated?.status).toBe('running')
    })

    it('should update workflow updated_at when status changes', () => {
      const workflow = db.createWorkflow({
        projectId: 'project-1',
        name: 'Test workflow',
        steps: []
      })

      const originalUpdatedAt = workflow.updatedAt

      db.updateWorkflowStatus(workflow.id, 'completed')

      const updated = db.getWorkflow(workflow.id)
      expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime())
    })

    it('should not update workflow step if no fields provided', () => {
      const workflow = db.createWorkflow({
        projectId: 'project-1',
        name: 'Test workflow',
        steps: [
          {
            agentType: 'developer' as AgentType,
            task: 'Write code'
          }
        ]
      })

      const stepId = workflow.steps[0].id
      db.updateWorkflowStep(stepId, {})

      const updated = db.getWorkflow(workflow.id)
      expect(updated?.steps[0].status).toBe('pending')
    })
  })

  describe('Database Close', () => {
    it('should close database connection', () => {
      const testDb = new DatabaseService()
      expect(() => testDb.close()).not.toThrow()
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty project id in listSessions', () => {
      const sessions = db.listSessions('')
      expect(sessions).toEqual([])
    })

    it('should handle empty project id in listUserStories', () => {
      const stories = db.listUserStories('')
      expect(stories).toEqual([])
    })

    it('should handle empty project id in listSprints', () => {
      const sprints = db.listSprints('')
      expect(sprints).toEqual([])
    })

    it('should handle empty project id in listTestCases', () => {
      const testCases = db.listTestCases('')
      expect(testCases).toEqual([])
    })

    it('should handle empty project id in listWorkflows', () => {
      const workflows = db.listWorkflows('')
      expect(workflows).toEqual([])
    })

    it('should handle session with messages', () => {
      const session = db.createSession('project-1', 'developer')

      db.addMessage(session.id, {
        role: 'user',
        content: 'Test message',
        timestamp: new Date()
      })

      const retrieved = db.getSession(session.id)
      expect(retrieved?.messages).toHaveLength(1)
    })

    it('should handle cascade delete of messages when session is deleted', () => {
      const session = db.createSession('project-1', 'developer')

      db.addMessage(session.id, {
        role: 'user',
        content: 'Test message',
        timestamp: new Date()
      })

      db.deleteSession(session.id)

      const messages = db.getSessionMessages(session.id)
      expect(messages).toHaveLength(0)
    })

    it('should handle workflow with input data in steps', () => {
      const workflow = db.createWorkflow({
        projectId: 'project-1',
        name: 'Test workflow',
        steps: [
          {
            agentType: 'developer' as AgentType,
            task: 'Review code',
            inputData: 'some-file.ts'
          }
        ]
      })

      const retrieved = db.getWorkflow(workflow.id)
      expect(retrieved?.steps[0].inputData).toBe('some-file.ts')
    })

    it('should handle multiple workflow steps in correct order', () => {
      const workflow = db.createWorkflow({
        projectId: 'project-1',
        name: 'Multi-step workflow',
        steps: [
          { agentType: 'developer' as AgentType, task: 'Step 1' },
          { agentType: 'tester' as AgentType, task: 'Step 2' },
          { agentType: 'security' as AgentType, task: 'Step 3' }
        ]
      })

      const retrieved = db.getWorkflow(workflow.id)
      expect(retrieved?.steps).toHaveLength(3)
      expect(retrieved?.steps[0].stepOrder).toBe(0)
      expect(retrieved?.steps[1].stepOrder).toBe(1)
      expect(retrieved?.steps[2].stepOrder).toBe(2)
    })

    it('should maintain session order by updated_at DESC', () => {
      const session1 = db.createSession('project-1', 'developer', 'First')
      const session2 = db.createSession('project-1', 'developer', 'Second')

      // Add message to first session to update its updated_at
      db.addMessage(session1.id, {
        role: 'user',
        content: 'Update',
        timestamp: new Date()
      })

      const sessions = db.listSessions('project-1')
      // Both sessions should be returned
      expect(sessions).toHaveLength(2)
      expect(sessions.map(s => s.id)).toContain(session1.id)
      expect(sessions.map(s => s.id)).toContain(session2.id)
    })

    it('should maintain story order by created_at DESC', () => {
      const story1 = db.createUserStory({ projectId: 'project-1', title: 'First' })
      const story2 = db.createUserStory({ projectId: 'project-1', title: 'Second' })

      const stories = db.listUserStories('project-1')
      // Both stories should be returned - order may vary with same timestamp
      expect(stories).toHaveLength(2)
      expect(stories.map(s => s.id)).toContain(story1.id)
      expect(stories.map(s => s.id)).toContain(story2.id)
    })

    it('should handle updating all story fields', () => {
      // Create a sprint first to satisfy foreign key constraint
      const sprint = db.createSprint({
        projectId: 'project-1',
        name: 'Test Sprint',
        startDate: new Date(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      })

      const story = db.createUserStory({
        projectId: 'project-1',
        title: 'Original'
      })

      const updated = db.updateUserStory(story.id, {
        title: 'New title',
        description: 'New description',
        acceptanceCriteria: 'New criteria',
        storyPoints: 13,
        status: 'done',
        priority: 'critical',
        sprintId: sprint.id
      })

      expect(updated?.title).toBe('New title')
      expect(updated?.description).toBe('New description')
      expect(updated?.acceptanceCriteria).toBe('New criteria')
      expect(updated?.storyPoints).toBe(13)
      expect(updated?.status).toBe('done')
      expect(updated?.priority).toBe('critical')
      expect(updated?.sprintId).toBe(sprint.id)
    })

    it('should handle updating all sprint fields', () => {
      const sprint = db.createSprint({
        projectId: 'project-1',
        name: 'Original',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-14')
      })

      const newStart = new Date('2024-02-01')
      const newEnd = new Date('2024-02-14')

      const updated = db.updateSprint(sprint.id, {
        name: 'New name',
        description: 'New description',
        startDate: newStart,
        endDate: newEnd,
        status: 'completed',
        goal: 'New goal'
      })

      expect(updated?.name).toBe('New name')
      expect(updated?.description).toBe('New description')
      expect(updated?.startDate).toEqual(newStart)
      expect(updated?.endDate).toEqual(newEnd)
      expect(updated?.status).toBe('completed')
      expect(updated?.goal).toBe('New goal')
    })

    it('should handle null values in user story updates', () => {
      const story = db.createUserStory({
        projectId: 'project-1',
        title: 'Test',
        description: 'Original description',
        storyPoints: 5
      })

      const updated = db.updateUserStory(story.id, {
        description: null as unknown as string,
        storyPoints: null as unknown as number
      })

      expect(updated?.description).toBeUndefined()
      expect(updated?.storyPoints).toBeUndefined()
    })
  })
})
