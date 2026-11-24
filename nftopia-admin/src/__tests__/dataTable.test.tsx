// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DataTable, type Column } from '../components/DataTable'

interface Row {
  id: string
  name: string
  age: number
}

const columns: Column<Row>[] = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'age', header: 'Age', sortable: true },
]

const rows: Row[] = [
  { id: '1', name: 'Charlie', age: 40 },
  { id: '2', name: 'Alice', age: 20 },
  { id: '3', name: 'Bob', age: 30 },
]

afterEach(() => {
  cleanup()
})

describe('DataTable sorting (#689)', () => {
  it('sorts ascending then descending then back to unsorted on repeated header clicks', () => {
    render(<DataTable<Row> columns={columns} data={rows} keyExtractor={(r) => r.id} />)

    const getNameCells = () =>
      screen.getAllByRole('row').slice(1).map((row) => row.querySelector('td')?.textContent)

    expect(getNameCells()).toEqual(['Charlie', 'Alice', 'Bob'])

    fireEvent.click(screen.getByRole('button', { name: /Name/ }))
    expect(getNameCells()).toEqual(['Alice', 'Bob', 'Charlie'])

    fireEvent.click(screen.getByRole('button', { name: /Name/ }))
    expect(getNameCells()).toEqual(['Charlie', 'Bob', 'Alice'])

    fireEvent.click(screen.getByRole('button', { name: /Name/ }))
    expect(getNameCells()).toEqual(['Charlie', 'Alice', 'Bob'])
  })

  it('sorts a numeric column numerically, not as strings', () => {
    render(<DataTable<Row> columns={columns} data={rows} keyExtractor={(r) => r.id} />)

    fireEvent.click(screen.getByRole('button', { name: /Age/ }))

    const ages = screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => row.querySelectorAll('td')[1]?.textContent)
    expect(ages).toEqual(['20', '30', '40'])
  })

  it('supports toggling sort via the keyboard', () => {
    render(<DataTable<Row> columns={columns} data={rows} keyExtractor={(r) => r.id} />)

    const nameHeader = screen.getByRole('button', { name: /Name/ })
    fireEvent.keyDown(nameHeader, { key: 'Enter' })

    const getNameCells = () =>
      screen.getAllByRole('row').slice(1).map((row) => row.querySelector('td')?.textContent)
    expect(getNameCells()).toEqual(['Alice', 'Bob', 'Charlie'])
  })

  it('sets aria-sort on the active column header', () => {
    render(<DataTable<Row> columns={columns} data={rows} keyExtractor={(r) => r.id} />)

    fireEvent.click(screen.getByRole('button', { name: /Name/ }))

    const headers = screen.getAllByRole('columnheader')
    expect(headers[0].getAttribute('aria-sort')).toBe('ascending')
    expect(headers[1].getAttribute('aria-sort')).toBe('none')
  })

  it('does not make a non-sortable column header interactive', () => {
    const plainColumns: Column<Row>[] = [{ key: 'name', header: 'Name' }]
    render(<DataTable<Row> columns={plainColumns} data={rows} keyExtractor={(r) => r.id} />)

    expect(screen.queryByRole('button', { name: 'Name' })).toBeNull()
  })
})

describe('DataTable error state (#689)', () => {
  it('shows the error message instead of rows or the empty message', () => {
    render(
      <DataTable<Row>
        columns={columns}
        data={rows}
        keyExtractor={(r) => r.id}
        error="Unable to load records."
      />,
    )

    expect(screen.getByRole('alert').textContent).toBe('Unable to load records.')
    expect(screen.queryByText('Charlie')).toBeNull()
  })

  it('takes precedence over the loading state', () => {
    render(
      <DataTable<Row>
        columns={columns}
        data={rows}
        keyExtractor={(r) => r.id}
        loading
        error="Unable to load records."
      />,
    )

    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.queryByText('Loading data…')).toBeNull()
  })
})

describe('DataTable keyboard navigation (#689)', () => {
  it('activates a clickable row via Enter', () => {
    let clicked: Row | null = null
    render(
      <DataTable<Row>
        columns={columns}
        data={rows}
        keyExtractor={(r) => r.id}
        onRowClick={(row) => {
          clicked = row
        }}
      />,
    )

    const firstRow = screen.getAllByRole('button').find((el) => el.textContent?.includes('Charlie'))
    expect(firstRow).toBeTruthy()
    fireEvent.keyDown(firstRow!, { key: 'Enter' })

    expect(clicked).toEqual(rows[0])
  })

  it('activates a clickable row via Space', () => {
    let clicked: Row | null = null
    render(
      <DataTable<Row>
        columns={columns}
        data={rows}
        keyExtractor={(r) => r.id}
        onRowClick={(row) => {
          clicked = row
        }}
      />,
    )

    const firstRow = screen.getAllByRole('button').find((el) => el.textContent?.includes('Charlie'))
    fireEvent.keyDown(firstRow!, { key: ' ' })

    expect(clicked).toEqual(rows[0])
  })

  it('rows are not keyboard-focusable when there is no onRowClick', () => {
    render(<DataTable<Row> columns={columns} data={rows} keyExtractor={(r) => r.id} />)

    const row = screen.getAllByRole('row')[1]
    expect(row.getAttribute('tabindex')).toBeNull()
  })
})
