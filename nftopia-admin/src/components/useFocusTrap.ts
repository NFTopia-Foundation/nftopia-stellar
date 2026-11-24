import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Focus trapping + restore-focus-on-close for a modal/dialog (#700).
 *
 * Attach the returned ref to the dialog's outer container. While mounted:
 * Tab/Shift+Tab cycles only through focusable elements inside it (focus
 * never escapes to the rest of the page), and on unmount focus returns to
 * whatever element had it before the dialog opened (typically the button
 * that triggered it).
 *
 * This only works correctly for a dialog that is mounted only while open —
 * as `ConfirmActionDialog` already is — so this hook's mount/unmount lines
 * up with the dialog opening/closing. For any future destructive-action
 * dialog built the same way, call this once in the dialog's form component
 * and spread the ref onto its outermost element.
 */
export function useFocusTrap<T extends HTMLElement>() {
  const containerRef = useRef<T | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const previouslyFocused = document.activeElement as HTMLElement | null

    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))

    const first = focusables()[0]
    ;(first ?? container).focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return

      const items = focusables()
      if (items.length === 0) {
        event.preventDefault()
        return
      }

      const firstEl = items[0]
      const lastEl = items[items.length - 1]
      const active = document.activeElement as HTMLElement | null
      const activeIsInside = active !== null && items.includes(active)

      if (event.shiftKey) {
        if (!activeIsInside || active === firstEl) {
          event.preventDefault()
          lastEl.focus()
        }
      } else if (!activeIsInside || active === lastEl) {
        event.preventDefault()
        firstEl.focus()
      }
    }

    container.addEventListener('keydown', handleKeyDown)

    return () => {
      container.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [])

  return containerRef
}
