// @vitest-environment jsdom
/**
 * Focus trapping + restore-focus-on-close (#700) for the shared
 * ConfirmActionDialog. The DLQ confirm/cancel flow itself is already
 * covered by transactionRetry.test.ts / transactionRetrySingleAction.test.tsx
 * — this file is specifically about the accessibility behavior added here.
 */
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '../i18n'
import ConfirmActionDialog from '../components/ConfirmActionDialog'

afterEach(() => {
  cleanup()
})

function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button onClick={() => setOpen(true)}>Open dialog</button>
      <ConfirmActionDialog
        open={open}
        title="Delete thing"
        description="This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={() => setOpen(false)}
        onClose={() => setOpen(false)}
      />
    </div>
  )
}

describe('ConfirmActionDialog focus handling (#700)', () => {
  it('moves focus inside the dialog when it opens', () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('Open dialog'))

    const dialog = screen.getByRole('dialog')
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('traps Tab within the dialog: tabbing past the last control wraps to the first', () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('Open dialog'))

    const cancelButton = screen.getByText('Cancel')
    const confirmButton = screen.getByText('Delete')

    confirmButton.focus()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' })
    expect(document.activeElement).toBe(cancelButton)
  })

  it('traps Shift+Tab within the dialog: shift-tabbing past the first control wraps to the last', () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('Open dialog'))

    const cancelButton = screen.getByText('Cancel')
    const confirmButton = screen.getByText('Delete')

    cancelButton.focus()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(confirmButton)
  })

  it('restores focus to the triggering element when the dialog closes', () => {
    render(<Harness />)
    const openButton = screen.getByText('Open dialog')

    openButton.focus()
    fireEvent.click(openButton)
    expect(screen.queryByRole('dialog')).not.toBeNull()

    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(openButton)
  })
})
