import * as React from 'react'
import * as ToastPrimitive from '@radix-ui/react-toast'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  type: ToastType
  title: string
  description?: string
  duration?: number
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
  warning: (title: string, description?: string) => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

const toastIcons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5 text-green-500" />,
  error: <AlertCircle className="w-5 h-5 text-red-500" />,
  info: <Info className="w-5 h-5 text-blue-500" />,
  warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />
}

const toastStyles: Record<ToastType, string> = {
  success: 'border-green-500/30 bg-green-500/10',
  error: 'border-red-500/30 bg-red-500/10',
  info: 'border-blue-500/30 bg-blue-500/10',
  warning: 'border-yellow-500/30 bg-yellow-500/10'
}

export function ToastProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const addToast = React.useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2, 11)
    setToasts((prev) => [...prev, { ...toast, id }])
  }, [])

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const success = React.useCallback(
    (title: string, description?: string) => {
      addToast({ type: 'success', title, description, duration: 3000 })
    },
    [addToast]
  )

  const error = React.useCallback(
    (title: string, description?: string) => {
      addToast({ type: 'error', title, description, duration: 5000 })
    },
    [addToast]
  )

  const info = React.useCallback(
    (title: string, description?: string) => {
      addToast({ type: 'info', title, description, duration: 4000 })
    },
    [addToast]
  )

  const warning = React.useCallback(
    (title: string, description?: string) => {
      addToast({ type: 'warning', title, description, duration: 4000 })
    },
    [addToast]
  )

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, info, warning }}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        {toasts.map((toast) => (
          <ToastPrimitive.Root
            key={toast.id}
            duration={toast.duration}
            onOpenChange={(open) => {
              if (!open) removeToast(toast.id)
            }}
            className={`
              group pointer-events-auto relative flex w-full items-center justify-between
              space-x-4 overflow-hidden rounded-lg border p-4 shadow-lg transition-all
              data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]
              data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none
              data-[state=open]:animate-in data-[state=closed]:animate-out
              data-[swipe=end]:animate-out data-[state=closed]:fade-out-80
              data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full
              bg-background ${toastStyles[toast.type]}
            `}
          >
            <div className="flex items-start gap-3">
              {toastIcons[toast.type]}
              <div className="grid gap-1">
                <ToastPrimitive.Title className="text-sm font-semibold text-foreground">
                  {toast.title}
                </ToastPrimitive.Title>
                {toast.description && (
                  <ToastPrimitive.Description className="text-sm text-muted-foreground">
                    {toast.description}
                  </ToastPrimitive.Description>
                )}
              </div>
            </div>
            <ToastPrimitive.Close
              className="absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed top-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:flex-col sm:top-auto sm:bottom-0 sm:right-0 sm:max-w-[420px]" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  )
}
