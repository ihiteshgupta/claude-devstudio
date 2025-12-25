/**
 * Copyright (c) 2025 Claude DevStudio
 *
 * Toast Component Tests
 *
 * Comprehensive test suite for Toast notification system including:
 * - ToastProvider rendering
 * - useToast hook behavior
 * - Toast creation and removal
 * - Helper methods (success, error, info, warning)
 * - Auto-dismiss functionality
 * - Toast styling and icons
 */

import * as React from 'react'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { ToastProvider, useToast } from './Toast'

describe('Toast Component', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('ToastProvider', () => {
    it('should render children', () => {
      render(
        <ToastProvider>
          <div data-testid="child">Test Child</div>
        </ToastProvider>
      )

      expect(screen.getByTestId('child')).toBeInTheDocument()
      expect(screen.getByText('Test Child')).toBeInTheDocument()
    })

    it('should provide toast context to children', () => {
      const TestComponent = (): JSX.Element => {
        const { toasts } = useToast()
        return <div data-testid="toast-count">{toasts.length}</div>
      }

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      )

      expect(screen.getByTestId('toast-count')).toHaveTextContent('0')
    })
  })

  describe('useToast Hook', () => {
    it('should throw error when used outside ToastProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        renderHook(() => useToast())
      }).toThrow('useToast must be used within a ToastProvider')

      consoleSpy.mockRestore()
    })

    it('should return toast context methods when used within provider', () => {
      const { result } = renderHook(() => useToast(), {
        wrapper: ToastProvider
      })

      expect(result.current).toHaveProperty('toasts')
      expect(result.current).toHaveProperty('addToast')
      expect(result.current).toHaveProperty('removeToast')
      expect(result.current).toHaveProperty('success')
      expect(result.current).toHaveProperty('error')
      expect(result.current).toHaveProperty('info')
      expect(result.current).toHaveProperty('warning')
    })
  })

  describe('addToast', () => {
    it('should add a toast to the list', () => {
      const { result } = renderHook(() => useToast(), {
        wrapper: ToastProvider
      })

      expect(result.current.toasts).toHaveLength(0)

      act(() => {
        result.current.addToast({
          type: 'info',
          title: 'Test Toast',
          description: 'Test Description',
          duration: 3000
        })
      })

      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0]).toMatchObject({
        type: 'info',
        title: 'Test Toast',
        description: 'Test Description',
        duration: 3000
      })
      expect(result.current.toasts[0].id).toBeDefined()
    })

    it('should generate unique IDs for each toast', () => {
      const { result } = renderHook(() => useToast(), {
        wrapper: ToastProvider
      })

      act(() => {
        result.current.addToast({ type: 'info', title: 'Toast 1' })
        result.current.addToast({ type: 'info', title: 'Toast 2' })
      })

      expect(result.current.toasts).toHaveLength(2)
      expect(result.current.toasts[0].id).not.toBe(result.current.toasts[1].id)
    })

    it('should add multiple toasts', () => {
      const { result } = renderHook(() => useToast(), {
        wrapper: ToastProvider
      })

      act(() => {
        result.current.addToast({ type: 'success', title: 'Success 1' })
        result.current.addToast({ type: 'error', title: 'Error 1' })
        result.current.addToast({ type: 'warning', title: 'Warning 1' })
      })

      expect(result.current.toasts).toHaveLength(3)
      expect(result.current.toasts[0].title).toBe('Success 1')
      expect(result.current.toasts[1].title).toBe('Error 1')
      expect(result.current.toasts[2].title).toBe('Warning 1')
    })
  })

  describe('removeToast', () => {
    it('should remove a toast by ID', () => {
      const { result } = renderHook(() => useToast(), {
        wrapper: ToastProvider
      })

      act(() => {
        result.current.addToast({ type: 'info', title: 'Toast 1' })
        result.current.addToast({ type: 'info', title: 'Toast 2' })
      })

      const toastId = result.current.toasts[0].id

      act(() => {
        result.current.removeToast(toastId)
      })

      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0].title).toBe('Toast 2')
    })

    it('should not affect other toasts when removing one', () => {
      const { result } = renderHook(() => useToast(), {
        wrapper: ToastProvider
      })

      act(() => {
        result.current.addToast({ type: 'info', title: 'Toast 1' })
        result.current.addToast({ type: 'info', title: 'Toast 2' })
        result.current.addToast({ type: 'info', title: 'Toast 3' })
      })

      const middleToastId = result.current.toasts[1].id

      act(() => {
        result.current.removeToast(middleToastId)
      })

      expect(result.current.toasts).toHaveLength(2)
      expect(result.current.toasts[0].title).toBe('Toast 1')
      expect(result.current.toasts[1].title).toBe('Toast 3')
    })

    it('should handle removing non-existent toast ID gracefully', () => {
      const { result } = renderHook(() => useToast(), {
        wrapper: ToastProvider
      })

      act(() => {
        result.current.addToast({ type: 'info', title: 'Toast 1' })
      })

      expect(() => {
        act(() => {
          result.current.removeToast('non-existent-id')
        })
      }).not.toThrow()

      expect(result.current.toasts).toHaveLength(1)
    })
  })

  describe('Helper Methods', () => {
    describe('success', () => {
      it('should add a success toast with correct type', () => {
        const { result } = renderHook(() => useToast(), {
          wrapper: ToastProvider
        })

        act(() => {
          result.current.success('Success Title', 'Success Description')
        })

        expect(result.current.toasts).toHaveLength(1)
        expect(result.current.toasts[0].type).toBe('success')
        expect(result.current.toasts[0].title).toBe('Success Title')
        expect(result.current.toasts[0].description).toBe('Success Description')
        expect(result.current.toasts[0].duration).toBe(3000)
      })

      it('should add success toast without description', () => {
        const { result } = renderHook(() => useToast(), {
          wrapper: ToastProvider
        })

        act(() => {
          result.current.success('Success Title')
        })

        expect(result.current.toasts[0].title).toBe('Success Title')
        expect(result.current.toasts[0].description).toBeUndefined()
      })
    })

    describe('error', () => {
      it('should add an error toast with correct type', () => {
        const { result } = renderHook(() => useToast(), {
          wrapper: ToastProvider
        })

        act(() => {
          result.current.error('Error Title', 'Error Description')
        })

        expect(result.current.toasts).toHaveLength(1)
        expect(result.current.toasts[0].type).toBe('error')
        expect(result.current.toasts[0].title).toBe('Error Title')
        expect(result.current.toasts[0].description).toBe('Error Description')
        expect(result.current.toasts[0].duration).toBe(5000)
      })

      it('should add error toast without description', () => {
        const { result } = renderHook(() => useToast(), {
          wrapper: ToastProvider
        })

        act(() => {
          result.current.error('Error Title')
        })

        expect(result.current.toasts[0].title).toBe('Error Title')
        expect(result.current.toasts[0].description).toBeUndefined()
      })
    })

    describe('info', () => {
      it('should add an info toast with correct type', () => {
        const { result } = renderHook(() => useToast(), {
          wrapper: ToastProvider
        })

        act(() => {
          result.current.info('Info Title', 'Info Description')
        })

        expect(result.current.toasts).toHaveLength(1)
        expect(result.current.toasts[0].type).toBe('info')
        expect(result.current.toasts[0].title).toBe('Info Title')
        expect(result.current.toasts[0].description).toBe('Info Description')
        expect(result.current.toasts[0].duration).toBe(4000)
      })

      it('should add info toast without description', () => {
        const { result } = renderHook(() => useToast(), {
          wrapper: ToastProvider
        })

        act(() => {
          result.current.info('Info Title')
        })

        expect(result.current.toasts[0].title).toBe('Info Title')
        expect(result.current.toasts[0].description).toBeUndefined()
      })
    })

    describe('warning', () => {
      it('should add a warning toast with correct type', () => {
        const { result } = renderHook(() => useToast(), {
          wrapper: ToastProvider
        })

        act(() => {
          result.current.warning('Warning Title', 'Warning Description')
        })

        expect(result.current.toasts).toHaveLength(1)
        expect(result.current.toasts[0].type).toBe('warning')
        expect(result.current.toasts[0].title).toBe('Warning Title')
        expect(result.current.toasts[0].description).toBe('Warning Description')
        expect(result.current.toasts[0].duration).toBe(4000)
      })

      it('should add warning toast without description', () => {
        const { result } = renderHook(() => useToast(), {
          wrapper: ToastProvider
        })

        act(() => {
          result.current.warning('Warning Title')
        })

        expect(result.current.toasts[0].title).toBe('Warning Title')
        expect(result.current.toasts[0].description).toBeUndefined()
      })
    })
  })

  describe('Toast Rendering', () => {
    it('should render toast with title', () => {
      const TestComponent = (): JSX.Element => {
        const { success } = useToast()
        React.useEffect(() => {
          success('Test Success')
        }, [success])
        return null
      }

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      )

      expect(screen.getByText('Test Success')).toBeInTheDocument()
    })

    it('should render toast with title and description', () => {
      const TestComponent = (): JSX.Element => {
        const { info } = useToast()
        React.useEffect(() => {
          info('Info Title', 'Info Description')
        }, [info])
        return null
      }

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      )

      expect(screen.getByText('Info Title')).toBeInTheDocument()
      expect(screen.getByText('Info Description')).toBeInTheDocument()
    })

    it('should render success toast with correct styling', () => {
      const TestComponent = (): JSX.Element => {
        const { success } = useToast()
        React.useEffect(() => {
          success('Success Toast')
        }, [success])
        return null
      }

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      )

      const toastElement = screen.getByText('Success Toast').closest('li')
      expect(toastElement).toHaveClass('border-green-500/30', 'bg-green-500/10')
    })

    it('should render error toast with correct styling', () => {
      const TestComponent = (): JSX.Element => {
        const { error } = useToast()
        React.useEffect(() => {
          error('Error Toast')
        }, [error])
        return null
      }

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      )

      const toastElement = screen.getByText('Error Toast').closest('li')
      expect(toastElement).toHaveClass('border-red-500/30', 'bg-red-500/10')
    })

    it('should render info toast with correct styling', () => {
      const TestComponent = (): JSX.Element => {
        const { info } = useToast()
        React.useEffect(() => {
          info('Info Toast')
        }, [info])
        return null
      }

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      )

      const toastElement = screen.getByText('Info Toast').closest('li')
      expect(toastElement).toHaveClass('border-blue-500/30', 'bg-blue-500/10')
    })

    it('should render warning toast with correct styling', () => {
      const TestComponent = (): JSX.Element => {
        const { warning } = useToast()
        React.useEffect(() => {
          warning('Warning Toast')
        }, [warning])
        return null
      }

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      )

      const toastElement = screen.getByText('Warning Toast').closest('li')
      expect(toastElement).toHaveClass('border-yellow-500/30', 'bg-yellow-500/10')
    })

    it('should render close button', () => {
      const TestComponent = (): JSX.Element => {
        const { success } = useToast()
        React.useEffect(() => {
          success('Closable Toast')
        }, [success])
        return null
      }

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      )

      expect(screen.getByLabelText('Close')).toBeInTheDocument()
    })

    it('should remove toast when close button is clicked', async () => {
      vi.useRealTimers()
      const user = userEvent.setup()

      const TestComponent = (): JSX.Element => {
        const { success } = useToast()
        React.useEffect(() => {
          success('Closable Toast')
        }, [success])
        return null
      }

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      )

      expect(screen.getByText('Closable Toast')).toBeInTheDocument()

      const closeButton = screen.getByLabelText('Close')
      await user.click(closeButton)

      await waitFor(() => {
        expect(screen.queryByText('Closable Toast')).not.toBeInTheDocument()
      })

      vi.useFakeTimers()
    })
  })

  describe('Toast Auto-Dismiss', () => {
    it('should auto-dismiss success toast after 3 seconds', async () => {
      vi.useRealTimers()

      const { result } = renderHook(() => useToast(), {
        wrapper: ToastProvider
      })

      act(() => {
        result.current.success('Auto Dismiss Success')
      })

      expect(result.current.toasts).toHaveLength(1)

      await waitFor(
        () => {
          expect(result.current.toasts).toHaveLength(0)
        },
        { timeout: 4000 }
      )

      vi.useFakeTimers()
    })

    it('should auto-dismiss error toast after 5 seconds', async () => {
      vi.useRealTimers()

      const { result } = renderHook(() => useToast(), {
        wrapper: ToastProvider
      })

      act(() => {
        result.current.error('Auto Dismiss Error')
      })

      expect(result.current.toasts).toHaveLength(1)

      // Should still be visible after 4 seconds
      await new Promise((resolve) => setTimeout(resolve, 4000))
      expect(result.current.toasts).toHaveLength(1)

      // Should be dismissed after 5 seconds
      await waitFor(
        () => {
          expect(result.current.toasts).toHaveLength(0)
        },
        { timeout: 2000 }
      )

      vi.useFakeTimers()
    })

    it('should auto-dismiss info toast after 4 seconds', async () => {
      vi.useRealTimers()

      const { result } = renderHook(() => useToast(), {
        wrapper: ToastProvider
      })

      act(() => {
        result.current.info('Auto Dismiss Info')
      })

      expect(result.current.toasts).toHaveLength(1)

      await waitFor(
        () => {
          expect(result.current.toasts).toHaveLength(0)
        },
        { timeout: 5000 }
      )

      vi.useFakeTimers()
    })

    it('should auto-dismiss warning toast after 4 seconds', async () => {
      vi.useRealTimers()

      const { result } = renderHook(() => useToast(), {
        wrapper: ToastProvider
      })

      act(() => {
        result.current.warning('Auto Dismiss Warning')
      })

      expect(result.current.toasts).toHaveLength(1)

      await waitFor(
        () => {
          expect(result.current.toasts).toHaveLength(0)
        },
        { timeout: 5000 }
      )

      vi.useFakeTimers()
    })

    it('should respect custom duration', async () => {
      vi.useRealTimers()

      const { result } = renderHook(() => useToast(), {
        wrapper: ToastProvider
      })

      act(() => {
        result.current.addToast({
          type: 'info',
          title: 'Custom Duration',
          duration: 2000
        })
      })

      expect(result.current.toasts).toHaveLength(1)

      // Should still be visible after 1.5 seconds
      await new Promise((resolve) => setTimeout(resolve, 1500))
      expect(result.current.toasts).toHaveLength(1)

      // Should be dismissed after 2 seconds
      await waitFor(
        () => {
          expect(result.current.toasts).toHaveLength(0)
        },
        { timeout: 1000 }
      )

      vi.useFakeTimers()
    })
  })

  describe('Multiple Toasts', () => {
    it('should handle multiple toasts at once', () => {
      const TestComponent = (): JSX.Element => {
        const { success, error, info, warning } = useToast()
        React.useEffect(() => {
          success('Success 1')
          error('Error 1')
          info('Info 1')
          warning('Warning 1')
        }, [success, error, info, warning])
        return null
      }

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      )

      expect(screen.getByText('Success 1')).toBeInTheDocument()
      expect(screen.getByText('Error 1')).toBeInTheDocument()
      expect(screen.getByText('Info 1')).toBeInTheDocument()
      expect(screen.getByText('Warning 1')).toBeInTheDocument()
    })

    it('should auto-dismiss toasts independently', async () => {
      vi.useRealTimers()

      const { result } = renderHook(() => useToast(), {
        wrapper: ToastProvider
      })

      act(() => {
        result.current.success('Success') // 3s
        result.current.error('Error') // 5s
      })

      expect(result.current.toasts).toHaveLength(2)

      // Success toast should dismiss after 3 seconds
      await waitFor(
        () => {
          expect(result.current.toasts).toHaveLength(1)
          expect(result.current.toasts[0].title).toBe('Error')
        },
        { timeout: 4000 }
      )

      // Error toast should dismiss after 5 seconds total
      await waitFor(
        () => {
          expect(result.current.toasts).toHaveLength(0)
        },
        { timeout: 3000 }
      )

      vi.useFakeTimers()
    })
  })
})
