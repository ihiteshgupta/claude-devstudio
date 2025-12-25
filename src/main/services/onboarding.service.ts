import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { databaseService } from './database.service';
import { claudeService } from './claude.service';
import { roadmapService } from './roadmap.service';
import { taskQueueService } from './task-queue.service';

// Types
export interface OnboardingConfig {
  projectPath: string;
  projectName: string;
  projectId: string;
}

export interface ProjectAnalysis {
  projectType: string;
  language: string;
  frameworks: string[];
  hasTests: boolean;
  hasCICD: boolean;
  hasDocker: boolean;
  structure: ProjectStructure;
  dependencies: string[];
  suggestedAgents: string[];
}

export interface ProjectStructure {
  srcDirs: string[];
  testDirs: string[];
  configFiles: string[];
  entryPoints: string[];
  totalFiles: number;
  totalLines: number;
}

export interface OnboardingPlan {
  id: string;
  projectId: string;
  analysis: ProjectAnalysis;
  suggestedRoadmap: SuggestedRoadmapItem[];
  suggestedTasks: SuggestedTask[];
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'applied';
  userFeedback?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SuggestedRoadmapItem {
  type: 'epic' | 'feature' | 'milestone';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  lane: 'now' | 'next' | 'later';
  estimatedEffort: number;
  tags: string[];
  accepted: boolean;
}

export interface SuggestedTask {
  type: string;
  title: string;
  description: string;
  agentType: string;
  autonomyLevel: 'auto' | 'approval_gates' | 'supervised';
  priority: number;
  accepted: boolean;
}

class OnboardingService extends EventEmitter {
  private claudePath: string | null = null;

  constructor() {
    super();
    this.findClaudePath();
  }

  private findClaudePath(): void {
    const possiblePaths = [
      '/usr/local/bin/claude',
      '/opt/homebrew/bin/claude',
      path.join(process.env.HOME || '', '.local/bin/claude'),
      path.join(process.env.HOME || '', '.nvm/versions/node/v22.20.0/bin/claude'),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        this.claudePath = p;
        break;
      }
    }

    if (!this.claudePath) {
      try {
        const result = require('child_process').execSync('which claude', { encoding: 'utf8' }).trim();
        if (result) this.claudePath = result;
      } catch {
        // Claude not found
      }
    }
  }

  /**
   * Analyze a project directory to understand its structure and technology
   */
  async analyzeProject(projectPath: string): Promise<ProjectAnalysis> {
    this.emit('analysis:start', { projectPath });

    const analysis: ProjectAnalysis = {
      projectType: 'unknown',
      language: 'unknown',
      frameworks: [],
      hasTests: false,
      hasCICD: false,
      hasDocker: false,
      structure: {
        srcDirs: [],
        testDirs: [],
        configFiles: [],
        entryPoints: [],
        totalFiles: 0,
        totalLines: 0,
      },
      dependencies: [],
      suggestedAgents: ['developer'],
    };

    try {
      // Check for package.json (Node.js/TypeScript project)
      const packageJsonPath = path.join(projectPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        analysis.projectType = 'node';
        analysis.language = packageJson.devDependencies?.typescript ? 'typescript' : 'javascript';

        // Detect frameworks
        const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        if (allDeps.react) analysis.frameworks.push('react');
        if (allDeps.vue) analysis.frameworks.push('vue');
        if (allDeps.angular) analysis.frameworks.push('angular');
        if (allDeps.express) analysis.frameworks.push('express');
        if (allDeps.next) analysis.frameworks.push('nextjs');
        if (allDeps.electron) analysis.frameworks.push('electron');
        if (allDeps.nest) analysis.frameworks.push('nestjs');

        // Check for test frameworks
        if (allDeps.jest || allDeps.mocha || allDeps.vitest || allDeps.playwright) {
          analysis.hasTests = true;
          analysis.suggestedAgents.push('tester');
        }

        analysis.dependencies = Object.keys(allDeps);
      }

      // Check for Python project
      const requirementsTxt = path.join(projectPath, 'requirements.txt');
      const pyprojectToml = path.join(projectPath, 'pyproject.toml');
      if (fs.existsSync(requirementsTxt) || fs.existsSync(pyprojectToml)) {
        analysis.projectType = 'python';
        analysis.language = 'python';
      }

      // Check for Go project
      const goMod = path.join(projectPath, 'go.mod');
      if (fs.existsSync(goMod)) {
        analysis.projectType = 'go';
        analysis.language = 'go';
      }

      // Check for Rust project
      const cargoToml = path.join(projectPath, 'Cargo.toml');
      if (fs.existsSync(cargoToml)) {
        analysis.projectType = 'rust';
        analysis.language = 'rust';
      }

      // Check for CI/CD
      const cicdPaths = [
        '.github/workflows',
        '.gitlab-ci.yml',
        'Jenkinsfile',
        '.circleci',
        'azure-pipelines.yml',
      ];
      for (const ciPath of cicdPaths) {
        if (fs.existsSync(path.join(projectPath, ciPath))) {
          analysis.hasCICD = true;
          analysis.suggestedAgents.push('devops');
          break;
        }
      }

      // Check for Docker
      if (fs.existsSync(path.join(projectPath, 'Dockerfile')) ||
          fs.existsSync(path.join(projectPath, 'docker-compose.yml'))) {
        analysis.hasDocker = true;
      }

      // Analyze directory structure
      analysis.structure = await this.analyzeStructure(projectPath);

      // Check for tests directory
      const testDirs = ['test', 'tests', '__tests__', 'spec', 'e2e'];
      for (const testDir of testDirs) {
        if (fs.existsSync(path.join(projectPath, testDir))) {
          analysis.structure.testDirs.push(testDir);
          analysis.hasTests = true;
        }
      }

      // Add security agent for web projects
      if (analysis.frameworks.some(f => ['react', 'vue', 'angular', 'express', 'nextjs'].includes(f))) {
        analysis.suggestedAgents.push('security');
      }

      // Add documentation agent
      analysis.suggestedAgents.push('documentation');

      // Remove duplicates
      analysis.suggestedAgents = [...new Set(analysis.suggestedAgents)];

      this.emit('analysis:complete', { analysis });
      return analysis;
    } catch (error) {
      this.emit('analysis:error', { error });
      throw error;
    }
  }

  private async analyzeStructure(projectPath: string): Promise<ProjectStructure> {
    const structure: ProjectStructure = {
      srcDirs: [],
      testDirs: [],
      configFiles: [],
      entryPoints: [],
      totalFiles: 0,
      totalLines: 0,
    };

    const srcDirs = ['src', 'lib', 'app', 'components', 'pages'];
    const configPatterns = [
      'tsconfig.json', 'package.json', '.eslintrc', 'webpack.config',
      'vite.config', 'next.config', 'tailwind.config', '.env.example'
    ];

    try {
      const files = fs.readdirSync(projectPath);

      for (const file of files) {
        const fullPath = path.join(projectPath, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory() && srcDirs.includes(file)) {
          structure.srcDirs.push(file);
        }

        if (stat.isFile()) {
          for (const pattern of configPatterns) {
            if (file.includes(pattern) || file === pattern) {
              structure.configFiles.push(file);
              break;
            }
          }

          // Count files
          structure.totalFiles++;
        }
      }

      // Find entry points
      const entryPoints = ['index.ts', 'index.js', 'main.ts', 'main.js', 'app.ts', 'app.js'];
      for (const entry of entryPoints) {
        if (fs.existsSync(path.join(projectPath, entry)) ||
            fs.existsSync(path.join(projectPath, 'src', entry))) {
          structure.entryPoints.push(entry);
        }
      }
    } catch (error) {
      console.error('Error analyzing structure:', error);
    }

    return structure;
  }

  /**
   * Generate an initial roadmap plan using AI
   */
  async generatePlan(config: OnboardingConfig, analysis: ProjectAnalysis): Promise<OnboardingPlan> {
    this.emit('plan:generating', { config, analysis });

    const planId = `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create prompt for AI
    const prompt = this.buildPlanPrompt(config, analysis);

    try {
      // Use Claude CLI to generate the plan
      const aiResponse = await this.callClaude(prompt, config.projectPath);
      const parsedPlan = this.parsePlanResponse(aiResponse, analysis);

      const plan: OnboardingPlan = {
        id: planId,
        projectId: config.projectId,
        analysis,
        suggestedRoadmap: parsedPlan.roadmap,
        suggestedTasks: parsedPlan.tasks,
        status: 'pending_approval',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Store the plan
      this.storePlan(plan);

      this.emit('plan:generated', { plan });
      return plan;
    } catch (error) {
      this.emit('plan:error', { error });

      // Return a default plan if AI fails
      const defaultPlan = this.createDefaultPlan(planId, config, analysis);

      // Store the default plan so it can be retrieved later
      this.storePlan(defaultPlan);

      this.emit('plan:generated', { plan: defaultPlan });
      return defaultPlan;
    }
  }

  private buildPlanPrompt(config: OnboardingConfig, analysis: ProjectAnalysis): string {
    return `You are analyzing a ${analysis.language} project to create an initial development roadmap.

PROJECT INFO:
- Name: ${config.projectName}
- Type: ${analysis.projectType}
- Language: ${analysis.language}
- Frameworks: ${analysis.frameworks.join(', ') || 'None detected'}
- Has Tests: ${analysis.hasTests}
- Has CI/CD: ${analysis.hasCICD}
- Has Docker: ${analysis.hasDocker}
- Dependencies: ${analysis.dependencies.slice(0, 20).join(', ')}

STRUCTURE:
- Source directories: ${analysis.structure.srcDirs.join(', ') || 'None'}
- Test directories: ${analysis.structure.testDirs.join(', ') || 'None'}
- Config files: ${analysis.structure.configFiles.join(', ')}
- Entry points: ${analysis.structure.entryPoints.join(', ')}

Based on this analysis, create a roadmap with:
1. 2-3 immediate priorities (NOW lane)
2. 2-3 next priorities (NEXT lane)
3. 1-2 future items (LATER lane)

Also suggest 3-5 initial tasks for the task queue.

Respond in JSON format:
{
  "roadmap": [
    {
      "type": "epic|feature|milestone",
      "title": "...",
      "description": "...",
      "priority": "high|medium|low",
      "lane": "now|next|later",
      "estimatedEffort": <hours>,
      "tags": ["..."]
    }
  ],
  "tasks": [
    {
      "type": "code_generation|testing|security_audit|documentation|code_review",
      "title": "...",
      "description": "...",
      "agentType": "developer|tester|security|documentation|devops",
      "autonomyLevel": "auto|approval_gates|supervised",
      "priority": <1-10>
    }
  ]
}`;
  }

  private async callClaude(prompt: string, projectPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.claudePath) {
        reject(new Error('Claude CLI not found'));
        return;
      }

      const args = ['--print', '-p', prompt];
      const proc = spawn(this.claudePath, args, {
        cwd: projectPath,
        env: { ...process.env },
      });

      let output = '';
      let errorOutput = '';

      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(errorOutput || 'Claude CLI failed'));
        }
      });

      proc.on('error', (err) => {
        reject(err);
      });

      // Timeout after 60 seconds
      setTimeout(() => {
        proc.kill();
        reject(new Error('Claude CLI timeout'));
      }, 60000);
    });
  }

  private parsePlanResponse(response: string, analysis: ProjectAnalysis): { roadmap: SuggestedRoadmapItem[], tasks: SuggestedTask[] } {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          roadmap: (parsed.roadmap || []).map((item: any) => ({
            ...item,
            accepted: true, // Default to accepted, user can reject
          })),
          tasks: (parsed.tasks || []).map((task: any) => ({
            ...task,
            accepted: true,
          })),
        };
      }
    } catch (e) {
      console.error('Failed to parse AI response:', e);
    }

    // Return empty if parsing fails
    return { roadmap: [], tasks: [] };
  }

  private createDefaultPlan(planId: string, config: OnboardingConfig, analysis: ProjectAnalysis): OnboardingPlan {
    const defaultRoadmap: SuggestedRoadmapItem[] = [
      {
        type: 'feature',
        title: 'Setup Development Environment',
        description: 'Ensure all team members can build and run the project locally',
        priority: 'high',
        lane: 'now',
        estimatedEffort: 4,
        tags: ['setup', 'documentation'],
        accepted: true,
      },
      {
        type: 'feature',
        title: 'Code Quality Standards',
        description: 'Establish linting, formatting, and code review guidelines',
        priority: 'high',
        lane: 'now',
        estimatedEffort: 8,
        tags: ['quality', 'standards'],
        accepted: true,
      },
    ];

    if (!analysis.hasTests) {
      defaultRoadmap.push({
        type: 'epic',
        title: 'Testing Infrastructure',
        description: 'Set up testing framework and write initial test suite',
        priority: 'high',
        lane: 'next',
        estimatedEffort: 16,
        tags: ['testing', 'quality'],
        accepted: true,
      });
    }

    if (!analysis.hasCICD) {
      defaultRoadmap.push({
        type: 'feature',
        title: 'CI/CD Pipeline',
        description: 'Automate build, test, and deployment processes',
        priority: 'medium',
        lane: 'next',
        estimatedEffort: 12,
        tags: ['devops', 'automation'],
        accepted: true,
      });
    }

    const defaultTasks: SuggestedTask[] = [
      {
        type: 'documentation',
        title: 'Generate Project Documentation',
        description: 'Create comprehensive README and API documentation',
        agentType: 'documentation',
        autonomyLevel: 'auto',
        priority: 1,
        accepted: true,
      },
      {
        type: 'security_audit',
        title: 'Initial Security Scan',
        description: 'Scan dependencies and code for security vulnerabilities',
        agentType: 'security',
        autonomyLevel: 'supervised',
        priority: 2,
        accepted: true,
      },
      {
        type: 'code_review',
        title: 'Codebase Health Check',
        description: 'Review code quality, patterns, and potential improvements',
        agentType: 'developer',
        autonomyLevel: 'approval_gates',
        priority: 3,
        accepted: true,
      },
    ];

    return {
      id: planId,
      projectId: config.projectId,
      analysis,
      suggestedRoadmap: defaultRoadmap,
      suggestedTasks: defaultTasks,
      status: 'pending_approval',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  private storePlan(plan: OnboardingPlan): void {
    const db = databaseService.getDb();

    db.prepare(`
      INSERT OR REPLACE INTO onboarding_plans (
        id, project_id, analysis, suggested_roadmap, suggested_tasks,
        status, user_feedback, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      plan.id,
      plan.projectId,
      JSON.stringify(plan.analysis),
      JSON.stringify(plan.suggestedRoadmap),
      JSON.stringify(plan.suggestedTasks),
      plan.status,
      plan.userFeedback || null,
      plan.createdAt,
      plan.updatedAt
    );
  }

  /**
   * Get pending plan for a project
   */
  getPendingPlan(projectId: string): OnboardingPlan | null {
    const db = databaseService.getDb();
    const row = db.prepare(`
      SELECT * FROM onboarding_plans
      WHERE project_id = ? AND status = 'pending_approval'
      ORDER BY created_at DESC LIMIT 1
    `).get(projectId) as any;

    if (!row) return null;

    return {
      id: row.id,
      projectId: row.project_id,
      analysis: JSON.parse(row.analysis),
      suggestedRoadmap: JSON.parse(row.suggested_roadmap),
      suggestedTasks: JSON.parse(row.suggested_tasks),
      status: row.status,
      userFeedback: row.user_feedback,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Update plan with user feedback
   */
  async updatePlanWithFeedback(
    planId: string,
    feedback: string,
    acceptedRoadmapItems: string[],
    acceptedTasks: string[]
  ): Promise<OnboardingPlan> {
    const db = databaseService.getDb();
    const row = db.prepare('SELECT * FROM onboarding_plans WHERE id = ?').get(planId) as any;

    if (!row) {
      console.error(`[OnboardingService] Plan not found: ${planId}`);
      throw new Error(`Plan not found: ${planId}. The plan may have expired or was never saved. Please regenerate the plan.`);
    }

    const suggestedRoadmap = JSON.parse(row.suggested_roadmap).map((item: SuggestedRoadmapItem) => ({
      ...item,
      accepted: acceptedRoadmapItems.includes(item.title),
    }));

    const suggestedTasks = JSON.parse(row.suggested_tasks).map((task: SuggestedTask) => ({
      ...task,
      accepted: acceptedTasks.includes(task.title),
    }));

    db.prepare(`
      UPDATE onboarding_plans
      SET suggested_roadmap = ?, suggested_tasks = ?, user_feedback = ?, updated_at = ?
      WHERE id = ?
    `).run(
      JSON.stringify(suggestedRoadmap),
      JSON.stringify(suggestedTasks),
      feedback,
      new Date().toISOString(),
      planId
    );

    // If feedback provided, regenerate with AI incorporating feedback
    if (feedback.trim()) {
      const analysis = JSON.parse(row.analysis);
      const refinedPlan = await this.refinePlanWithFeedback(planId, feedback, analysis);
      return refinedPlan;
    }

    return this.getPendingPlan(row.project_id)!;
  }

  private async refinePlanWithFeedback(planId: string, feedback: string, analysis: ProjectAnalysis): Promise<OnboardingPlan> {
    const db = databaseService.getDb();
    const row = db.prepare('SELECT * FROM onboarding_plans WHERE id = ?').get(planId) as any;

    const prompt = `You previously generated a roadmap plan. The user has provided feedback:

FEEDBACK: ${feedback}

CURRENT PLAN:
${JSON.stringify({ roadmap: JSON.parse(row.suggested_roadmap), tasks: JSON.parse(row.suggested_tasks) }, null, 2)}

Please refine the plan based on this feedback. Respond in the same JSON format.`;

    try {
      const response = await this.callClaude(prompt, process.cwd());
      const parsed = this.parsePlanResponse(response, analysis);

      db.prepare(`
        UPDATE onboarding_plans
        SET suggested_roadmap = ?, suggested_tasks = ?, updated_at = ?
        WHERE id = ?
      `).run(
        JSON.stringify(parsed.roadmap),
        JSON.stringify(parsed.tasks),
        new Date().toISOString(),
        planId
      );
    } catch (e) {
      console.error('Failed to refine plan:', e);
    }

    return {
      id: row.id,
      projectId: row.project_id,
      analysis: JSON.parse(row.analysis),
      suggestedRoadmap: JSON.parse(row.suggested_roadmap),
      suggestedTasks: JSON.parse(row.suggested_tasks),
      status: row.status,
      userFeedback: feedback,
      createdAt: row.created_at,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Apply the approved plan - create roadmap items and tasks
   */
  async applyPlan(planId: string): Promise<{ roadmapItemsCreated: number; tasksCreated: number }> {
    const db = databaseService.getDb();
    const row = db.prepare('SELECT * FROM onboarding_plans WHERE id = ?').get(planId) as any;

    if (!row) throw new Error('Plan not found');

    const projectId = row.project_id;
    const suggestedRoadmap: SuggestedRoadmapItem[] = JSON.parse(row.suggested_roadmap);
    const suggestedTasks: SuggestedTask[] = JSON.parse(row.suggested_tasks);

    let roadmapItemsCreated = 0;
    let tasksCreated = 0;

    // Create accepted roadmap items
    for (const item of suggestedRoadmap.filter(r => r.accepted)) {
      try {
        roadmapService.create({
          projectId,
          type: item.type,
          title: item.title,
          description: item.description,
          priority: item.priority,
          lane: item.lane,
          estimatedEffort: item.estimatedEffort,
          tags: item.tags,
        });
        roadmapItemsCreated++;
      } catch (e) {
        console.error('Failed to create roadmap item:', e);
      }
    }

    // Create accepted tasks
    for (const task of suggestedTasks.filter(t => t.accepted)) {
      try {
        taskQueueService.enqueue({
          projectId,
          type: task.type as any,
          title: task.title,
          description: task.description,
          agentType: task.agentType as any,
          autonomyLevel: task.autonomyLevel,
          priority: task.priority,
          inputData: {},
        });
        tasksCreated++;
      } catch (e) {
        console.error('Failed to create task:', e);
      }
    }

    // Update plan status
    db.prepare(`
      UPDATE onboarding_plans SET status = 'applied', updated_at = ? WHERE id = ?
    `).run(new Date().toISOString(), planId);

    this.emit('plan:applied', { planId, roadmapItemsCreated, tasksCreated });

    return { roadmapItemsCreated, tasksCreated };
  }

  /**
   * Initialize onboarding for a new project
   */
  async initProject(config: OnboardingConfig): Promise<OnboardingPlan> {
    // Step 1: Analyze the project
    const analysis = await this.analyzeProject(config.projectPath);

    // Step 2: Generate initial plan
    const plan = await this.generatePlan(config, analysis);

    return plan;
  }
}

// Add database table for onboarding plans
export function initOnboardingTables(): void {
  const db = databaseService.getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS onboarding_plans (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      analysis TEXT NOT NULL,
      suggested_roadmap TEXT NOT NULL,
      suggested_tasks TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      user_feedback TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_onboarding_project ON onboarding_plans(project_id);
    CREATE INDEX IF NOT EXISTS idx_onboarding_status ON onboarding_plans(status);
  `);
}

export const onboardingService = new OnboardingService();
