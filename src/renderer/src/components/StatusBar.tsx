import { useAppStore } from '../stores/appStore'

export function StatusBar(): JSX.Element {
  const { claudeStatus, isLoading, currentProject } = useAppStore()

  return (
    <div className="h-6 bg-card border-t border-border flex items-center justify-between px-4 text-xs text-muted-foreground">
      {/* Left side */}
      <div className="flex items-center gap-4">
        {/* Claude status */}
        <div className="flex items-center gap-1.5">
          <div
            className={`w-2 h-2 rounded-full ${
              claudeStatus?.installed && claudeStatus?.authenticated
                ? 'bg-green-500'
                : claudeStatus?.installed
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
            }`}
          />
          <span>
            {claudeStatus?.installed && claudeStatus?.authenticated
              ? 'Claude Connected'
              : claudeStatus?.installed
                ? 'Auth Required'
                : 'Claude Not Found'}
          </span>
        </div>

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span>Processing...</span>
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Current project */}
        {currentProject && (
          <span className="truncate max-w-[200px]" title={currentProject.path}>
            {currentProject.name}
          </span>
        )}

        {/* Claude version */}
        {claudeStatus?.version && (
          <span className="opacity-60">Claude {claudeStatus.version}</span>
        )}
      </div>
    </div>
  )
}
