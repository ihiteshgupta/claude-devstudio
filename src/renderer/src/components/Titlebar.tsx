import { useAppStore } from '../stores/appStore'

export function Titlebar(): JSX.Element {
  const { currentProject, toggleSidebar, isSidebarOpen } = useAppStore()

  return (
    <div className="h-12 bg-card border-b border-border flex items-center justify-between px-4 titlebar-drag">
      {/* macOS traffic lights space + toggle */}
      <div className="flex items-center gap-2 titlebar-no-drag">
        <div className="w-20" /> {/* Space for traffic lights */}
        <button
          onClick={toggleSidebar}
          className="p-1.5 hover:bg-secondary rounded-md transition-colors"
          title={isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        >
          <svg
            className="w-5 h-5 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      </div>

      {/* Title */}
      <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-2">
        <svg className="w-5 h-5 text-[#D97757]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9v-2h2v2zm0-4H9V7h2v5zm4 4h-2v-2h2v2zm0-4h-2V7h2v5z"/>
        </svg>
        <h1 className="text-sm font-medium text-foreground">
          {currentProject ? currentProject.name : 'Claude DevStudio'}
        </h1>
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-2 titlebar-no-drag">
        <span className="text-xs text-muted-foreground">MVP v0.1</span>
      </div>
    </div>
  )
}
