import { cn } from '../lib/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps): JSX.Element {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-muted/50',
        className
      )}
    />
  )
}

export function SkeletonCard(): JSX.Element {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  )
}

export function SkeletonList({ count = 3 }: { count?: number }): JSX.Element {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

export function SkeletonChat(): JSX.Element {
  return (
    <div className="space-y-4 p-4">
      {/* User message skeleton */}
      <div className="flex justify-end">
        <div className="bg-primary/10 rounded-lg p-3 max-w-[70%] space-y-2">
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      {/* Assistant message skeleton */}
      <div className="flex justify-start">
        <div className="bg-muted rounded-lg p-3 max-w-[70%] space-y-2">
          <Skeleton className="h-3 w-64" />
          <Skeleton className="h-3 w-56" />
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
    </div>
  )
}

export function SkeletonTable(): JSX.Element {
  return (
    <div className="space-y-2">
      <div className="flex gap-4 p-3 border-b">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4 p-3">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
        </div>
      ))}
    </div>
  )
}
