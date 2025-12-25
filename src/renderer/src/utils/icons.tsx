import {
  Code,
  ClipboardList,
  TestTube,
  Shield,
  Rocket,
  BookOpen,
  FileText,
  FileJson,
  FileType,
  File,
  Folder,
  FolderOpen,
  MessageSquare,
  CalendarDays,
  type LucideIcon
} from 'lucide-react'
import type { AgentType } from '@shared/types'

// Agent icons mapping
export const AGENT_ICONS: Record<AgentType, LucideIcon> = {
  developer: Code,
  'product-owner': ClipboardList,
  tester: TestTube,
  security: Shield,
  devops: Rocket,
  documentation: BookOpen
}

// Agent colors
export const AGENT_COLORS: Record<AgentType, string> = {
  developer: 'text-blue-400',
  'product-owner': 'text-green-400',
  tester: 'text-purple-400',
  security: 'text-red-400',
  devops: 'text-orange-400',
  documentation: 'text-cyan-400'
}

// Agent background colors
export const AGENT_BG_COLORS: Record<AgentType, string> = {
  developer: 'bg-blue-500/20',
  'product-owner': 'bg-green-500/20',
  tester: 'bg-purple-500/20',
  security: 'bg-red-500/20',
  devops: 'bg-orange-500/20',
  documentation: 'bg-cyan-500/20'
}

// Agent labels
export const AGENT_LABELS: Record<AgentType, string> = {
  developer: 'Developer',
  'product-owner': 'Product Owner',
  tester: 'Tester',
  security: 'Security',
  devops: 'DevOps',
  documentation: 'Documentation'
}

// File extension to icon mapping
export const FILE_ICONS: Record<string, LucideIcon> = {
  '.ts': Code,
  '.tsx': Code,
  '.js': Code,
  '.jsx': Code,
  '.json': FileJson,
  '.md': FileText,
  '.txt': FileText,
  '.css': FileType,
  '.scss': FileType,
  '.html': FileType,
  default: File
}

// Get file icon by extension
export function getFileIcon(filename: string): LucideIcon {
  const ext = filename.slice(filename.lastIndexOf('.'))
  return FILE_ICONS[ext] || FILE_ICONS.default
}

// Folder icons
export const FolderIcon = Folder
export const FolderOpenIcon = FolderOpen

// Common icons
export const ChatIcon = MessageSquare
export const SprintIcon = CalendarDays
export const StoryIcon = FileText
export const TestIcon = TestTube

// Render agent icon component
interface AgentIconProps {
  agentType: AgentType
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function AgentIcon({ agentType, className = '', size = 'md' }: AgentIconProps): JSX.Element {
  const IconComponent = AGENT_ICONS[agentType] || Code
  const color = AGENT_COLORS[agentType] || 'text-zinc-400'

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  }

  return <IconComponent className={`${sizeClasses[size]} ${color} ${className}`} />
}

// Render file icon component
interface FileIconProps {
  filename: string
  isDirectory?: boolean
  isExpanded?: boolean
  className?: string
}

export function FileIcon({ filename, isDirectory, isExpanded, className = '' }: FileIconProps): JSX.Element {
  if (isDirectory) {
    const IconComponent = isExpanded ? FolderOpen : Folder
    return <IconComponent className={`w-4 h-4 text-violet-400 ${className}`} />
  }

  const IconComponent = getFileIcon(filename)
  return <IconComponent className={`w-4 h-4 text-zinc-400 ${className}`} />
}
