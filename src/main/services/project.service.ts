import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join, basename } from 'path'
import type { Project } from '@shared/types'

class ProjectService {
  private dataPath: string
  private projectsFile: string
  private projects: Map<string, Project> = new Map()

  constructor() {
    this.dataPath = join(app.getPath('userData'), 'claude-data')
    this.projectsFile = join(this.dataPath, 'projects.json')
    this.ensureDataDir()
    this.loadProjects()
  }

  private ensureDataDir(): void {
    if (!existsSync(this.dataPath)) {
      mkdirSync(this.dataPath, { recursive: true })
    }
  }

  private loadProjects(): void {
    try {
      if (existsSync(this.projectsFile)) {
        const data = JSON.parse(readFileSync(this.projectsFile, 'utf-8'))
        for (const project of data) {
          this.projects.set(project.id, {
            ...project,
            createdAt: new Date(project.createdAt),
            lastOpenedAt: new Date(project.lastOpenedAt)
          })
        }
      }
    } catch (error) {
      console.error('Failed to load projects:', error)
    }
  }

  private saveProjects(): void {
    try {
      const data = Array.from(this.projects.values())
      writeFileSync(this.projectsFile, JSON.stringify(data, null, 2))
    } catch (error) {
      console.error('Failed to save projects:', error)
    }
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `proj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * List all projects sorted by last opened
   */
  listProjects(): Project[] {
    return Array.from(this.projects.values()).sort(
      (a, b) => b.lastOpenedAt.getTime() - a.lastOpenedAt.getTime()
    )
  }

  /**
   * Create a new project
   */
  createProject(input: { name?: string; path: string; description?: string }): Project {
    // Validate path exists
    if (!existsSync(input.path)) {
      throw new Error(`Project path does not exist: ${input.path}`)
    }

    // Check if project already exists for this path
    for (const project of this.projects.values()) {
      if (project.path === input.path) {
        // Update and return existing project
        project.lastOpenedAt = new Date()
        this.saveProjects()
        return project
      }
    }

    const project: Project = {
      id: this.generateId(),
      name: input.name || basename(input.path),
      path: input.path,
      description: input.description,
      createdAt: new Date(),
      lastOpenedAt: new Date()
    }

    this.projects.set(project.id, project)
    this.saveProjects()
    return project
  }

  /**
   * Get a project by ID
   */
  getProject(id: string): Project | null {
    return this.projects.get(id) || null
  }

  /**
   * Open a project (update last opened time)
   */
  openProject(id: string): Project | null {
    const project = this.projects.get(id)
    if (project) {
      project.lastOpenedAt = new Date()
      this.saveProjects()
    }
    return project || null
  }

  /**
   * Update a project
   */
  updateProject(id: string, updates: Partial<Omit<Project, 'id' | 'createdAt'>>): Project | null {
    const project = this.projects.get(id)
    if (project) {
      Object.assign(project, updates)
      this.saveProjects()
    }
    return project || null
  }

  /**
   * Delete a project (removes from list, doesn't delete files)
   */
  deleteProject(id: string): boolean {
    const deleted = this.projects.delete(id)
    if (deleted) {
      this.saveProjects()
    }
    return deleted
  }

  /**
   * Create a new project folder
   */
  createNewProject(input: { name: string; parentPath: string }): string {
    const projectPath = join(input.parentPath, input.name)

    if (existsSync(projectPath)) {
      throw new Error(`Folder already exists: ${projectPath}`)
    }

    mkdirSync(projectPath, { recursive: true })
    return projectPath
  }
}

export const projectService = new ProjectService()
