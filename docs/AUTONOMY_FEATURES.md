# Autonomy Features Roadmap

## Problem Statement

Currently, Claude DevStudio has two disconnected systems:
1. **Chat Interface** - Users interact with AI agents, get responses with suggestions
2. **Task Queue** - Autonomous task execution with approval gates

**The Gap:** When you ask the Developer agent to "create a user story for login feature", it gives you a text response but **doesn't actually create the story in the project database**. Similarly, it doesn't check for existing similar stories or learn from previous interactions.

---

## Feature Categories

### 1. Response-to-Action Bridge (Critical)

#### 1.1 Action Parser
**Status:** Not Implemented
**Priority:** P0 - Critical

Parse Claude's responses to extract actionable items:
- Detect "Create file at X" patterns
- Detect "Create story: X" patterns
- Detect "Run command: X" patterns
- Detect "Add task: X" patterns

```typescript
interface ExtractedAction {
  type: 'create-file' | 'create-story' | 'run-command' | 'create-task' | 'create-test'
  title: string
  description?: string
  metadata: Record<string, any>
  confidence: number // 0-1 how confident the extraction is
}

function parseActionsFromResponse(response: string): ExtractedAction[]
```

#### 1.2 Chat-to-Database Bridge
**Status:** Not Implemented
**Priority:** P0 - Critical

When agent suggests creating something, actually create it:
- Create user stories in `user_stories` table
- Create roadmap items in `roadmap_items` table
- Create tasks in `task_queue` table
- Create test cases in `test_cases` table

#### 1.3 Action Confirmation UI
**Status:** Not Implemented
**Priority:** P0 - Critical

Show extracted actions in chat with approve/reject buttons:
```
Agent: I'll create a user story for the login feature.

[Detected Action]
Create User Story: "User Login with Email"
Description: "As a user, I want to login with my email..."
Priority: High

[✓ Create] [✗ Skip] [Edit Before Creating]
```

---

### 2. Duplicate Detection (Important)

#### 2.1 Similarity Check Before Creation
**Status:** Not Implemented
**Priority:** P1 - High

Before creating any item, check for similar existing items:
- Semantic similarity using embeddings
- Title/description fuzzy matching
- Tag overlap detection

```typescript
interface SimilarityResult {
  existingItem: StoryItem | RoadmapItem | Task
  similarityScore: number // 0-1
  matchType: 'exact' | 'similar' | 'related'
}

async function findSimilarItems(
  type: 'story' | 'task' | 'roadmap',
  title: string,
  description: string
): Promise<SimilarityResult[]>
```

#### 2.2 Merge/Link Suggestions
**Status:** Not Implemented
**Priority:** P1 - High

When similar items found, suggest:
- "This looks similar to existing story X. Link them?"
- "Merge with existing task Y?"
- "Add as subtask of Z?"

---

### 3. Context Awareness (Important)

#### 3.1 Project Context Injection
**Status:** Partial (file context exists)
**Priority:** P1 - High

Automatically include in agent prompts:
- Existing user stories summary
- Current sprint items
- Recent tasks and their status
- Roadmap items in "Now" lane
- Recent git commits

#### 3.2 Agent Memory
**Status:** Not Implemented
**Priority:** P1 - High

Remember previous interactions:
- What stories were discussed
- What decisions were made
- What tasks were created
- What was approved/rejected

```typescript
interface AgentMemory {
  projectId: string
  recentStories: string[]      // IDs of recently discussed stories
  recentDecisions: Decision[]  // Key decisions made
  createdItems: CreatedItem[]  // Items created in this session
  rejectedSuggestions: string[] // Things user said no to
}
```

---

### 4. Autonomous Execution (Critical)

#### 4.1 Auto-Queue from Chat
**Status:** Not Implemented
**Priority:** P0 - Critical

When agent response contains actionable items:
1. Parse actions from response
2. Show confirmation UI
3. On approve → Create task in queue
4. Start autonomous execution

#### 4.2 Task Type Detection
**Status:** Not Implemented
**Priority:** P1 - High

Automatically determine task type from context:
- "Write tests for X" → `testing`
- "Implement feature Y" → `code-generation`
- "Review security of Z" → `security-audit`
- "Document API" → `documentation`

#### 4.3 Priority Extraction
**Status:** Not Implemented
**Priority:** P2 - Medium

Extract priority from conversation:
- "This is urgent" → priority: 90
- "When you get a chance" → priority: 30
- "Before the demo tomorrow" → priority: 100

---

### 5. Learning & Evolution (Advanced)

#### 5.1 Pattern Learning
**Status:** Not Implemented
**Priority:** P2 - Medium

Learn from user corrections:
- If user edits a created story, learn the preferred format
- If user rejects suggestions, learn what to avoid
- If user always approves certain patterns, auto-approve similar

#### 5.2 Style Adaptation
**Status:** Not Implemented
**Priority:** P2 - Medium

Adapt to project conventions:
- Learn story format from existing stories
- Learn naming conventions from codebase
- Learn testing patterns from existing tests

#### 5.3 Feedback Loop
**Status:** Not Implemented
**Priority:** P2 - Medium

Track outcomes:
- Did the generated code work?
- Did tests pass?
- Was the story accepted in sprint?

Use feedback to improve future suggestions.

---

### 6. Multi-Agent Coordination (Advanced)

#### 6.1 Agent Handoff
**Status:** Partial (workflows exist)
**Priority:** P1 - High

Seamless handoff between agents:
- PO creates story → Developer gets notified
- Developer implements → Tester creates tests
- Security flags issue → Developer fixes

#### 6.2 Conflict Resolution
**Status:** Not Implemented
**Priority:** P2 - Medium

When agents disagree:
- Security says "don't do X", Developer did X
- Present conflict to user for resolution
- Learn from resolution

---

## Implementation Phases

### Phase 1: Basic Autonomy (2-3 weeks)
- [ ] Action parser for common patterns
- [ ] Chat-to-database bridge for stories
- [ ] Simple confirmation UI
- [ ] Duplicate title detection

### Phase 2: Smart Creation (2-3 weeks)
- [ ] Semantic similarity check
- [ ] Project context injection
- [ ] Task type auto-detection
- [ ] Auto-queue approved actions

### Phase 3: Context & Memory (2-3 weeks)
- [ ] Agent session memory
- [ ] Recent items context
- [ ] Decision tracking
- [ ] Sprint/roadmap awareness

### Phase 4: Learning (3-4 weeks)
- [ ] Pattern learning from corrections
- [ ] Style adaptation
- [ ] Feedback collection
- [ ] Outcome tracking

### Phase 5: Advanced Coordination (3-4 weeks)
- [ ] Real-time agent handoff
- [ ] Conflict detection
- [ ] Multi-agent workflows from chat
- [ ] Automated sprint planning

---

## Technical Architecture

### New Services Needed

```
src/main/services/
├── action-parser.service.ts      # Parse actions from responses
├── similarity.service.ts         # Find similar items
├── agent-memory.service.ts       # Track agent context
├── chat-bridge.service.ts        # Connect chat to task queue
└── learning.service.ts           # Pattern learning
```

### New IPC Channels

```typescript
// Action parsing
ACTIONS_PARSE: 'actions:parse'
ACTIONS_EXECUTE: 'actions:execute'
ACTIONS_CONFIRM: 'actions:confirm'

// Similarity
SIMILARITY_CHECK: 'similarity:check'
SIMILARITY_MERGE: 'similarity:merge'

// Memory
MEMORY_GET: 'memory:get'
MEMORY_UPDATE: 'memory:update'
MEMORY_CLEAR: 'memory:clear'
```

### Database Schema Additions

```sql
-- Action history
CREATE TABLE action_history (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  action_type TEXT,
  action_data TEXT,
  status TEXT, -- proposed, approved, rejected, executed
  created_at TEXT,
  executed_at TEXT
);

-- Agent memory
CREATE TABLE agent_memory (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  agent_type TEXT,
  memory_type TEXT, -- decision, item, rejection
  content TEXT,
  created_at TEXT,
  expires_at TEXT
);

-- Learning patterns
CREATE TABLE learned_patterns (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  pattern_type TEXT,
  pattern_data TEXT,
  confidence REAL,
  usage_count INTEGER,
  last_used TEXT
);
```

---

## Success Metrics

### Autonomy Score
- % of agent suggestions that result in actual database changes
- Current: 0%
- Target: 70%+ with user confirmation

### Duplicate Prevention
- % of duplicates caught before creation
- Target: 90%+

### Context Relevance
- % of suggestions that reference existing project items
- Target: 80%+

### User Approval Rate
- % of proposed actions approved by user
- Target: 85%+ (indicates good suggestions)

---

## Example User Journey (Future State)

```
User: "Create a user story for social login with Google"

Agent: I'll create a user story for Google OAuth login.

[Checking for similar items...]
Found 1 similar story: "User Login with Email" (62% similar)
→ Should this be a separate story or added to the existing one?

[New Story] [Add to Existing] [Cancel]

User clicks [New Story]

Agent: Creating the story...

[Created] User Story #42: "Social Login with Google"
- Priority: High
- Sprint: Current (Sprint 3)
- Linked to: "User Login with Email" (related)

Would you like me to:
[Generate acceptance criteria] [Create implementation tasks] [Done]

User clicks [Create implementation tasks]

Agent: I'll create development tasks for this story.

[Created Tasks]
1. Task #101: "Set up Google OAuth credentials" (auto)
2. Task #102: "Implement OAuth callback handler" (approval_gates)
3. Task #103: "Add Google login button to UI" (auto)
4. Task #104: "Write integration tests" (auto)

4 tasks queued. Start autonomous execution?
[Start] [Review First] [Cancel]
```

---

## References

- Current chat flow: `src/renderer/src/components/ChatPanel.tsx`
- Current task queue: `src/main/services/task-queue.service.ts`
- Current workflows: `src/main/services/workflow.service.ts`
- Type definitions: `src/shared/types/index.ts`
