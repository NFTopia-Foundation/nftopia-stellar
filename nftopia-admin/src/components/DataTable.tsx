import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'

export interface Column<T> {
  key: string
  header: ReactNode
  render?: (item: T, index: number) => ReactNode
  className?: string
  headerClassName?: string
  /**
   * Opt a column into client-side sorting (#689). DataTable sorts whatever
   * `data` it was given — if `data` is only the current server-paginated
   * page, sorting only reorders that page, not the full backing dataset.
   * That's an intentional, documented limitation of a purely client-side
   * sort; a screen that needs full-dataset sorting should sort server-side
   * and treat `data` as already ordered instead of marking a column
   * sortable here.
   */
  sortable?: boolean
  /**
   * Value to compare when sorting by this column. Defaults to the raw
   * `item[key]`, which only works when `key` is an actual property on `T`
   * holding a string or number — a column whose `render` derives its
   * display from multiple fields (or nested data) must supply this.
   */
  sortValue?: (item: T) => string | number
}

export interface PaginationConfig {
  page: number
  pageSize: number
  total: number
  onPageChange: (newPage: number) => void
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (item: T, index: number) => string
  loading?: boolean
  /** Replaces the table body with an error message; takes precedence over loading/empty. */
  error?: ReactNode
  emptyMessage?: ReactNode
  onRowClick?: (item: T) => void
  pagination?: PaginationConfig
  ariaLabel?: string
}

type SortDirection = 'asc' | 'desc'
interface SortState {
  key: string
  direction: SortDirection
}

function defaultSortValue<T>(item: T, key: string): string | number {
  const value = (item as Record<string, unknown>)[key]
  return typeof value === 'number' ? value : String(value ?? '')
}

/**
 * Shared generic DataTable component adhering to NFTopia design aesthetics.
 * Provides accessible, responsive tabular views with loading/error/empty
 * states, row click callbacks, pagination controls, optional per-column
 * client-side sorting, and keyboard-operable rows and sortable headers.
 *
 * Usage:
 * ```tsx
 * <DataTable<User>
 *   ariaLabel="Users"
 *   columns={[
 *     { key: 'name', header: 'Name', sortable: true },
 *     { key: 'role', header: 'Role', render: (u) => <RoleBadge role={u.role} /> },
 *   ]}
 *   data={users}
 *   keyExtractor={(u) => u.id}
 *   onRowClick={(u) => openDetail(u)}
 * />
 * ```
 */
export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  loading = false,
  error,
  emptyMessage = 'No records found.',
  onRowClick,
  pagination,
  ariaLabel,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState | null>(null)

  const totalPages = pagination
    ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
    : 1
  const currentPage = pagination ? pagination.page : 1

  const sortedData = useMemo(() => {
    if (!sort) return data
    const column = columns.find((col) => col.key === sort.key)
    if (!column) return data

    const getValue = column.sortValue ?? ((item: T) => defaultSortValue(item, column.key))
    const direction = sort.direction === 'asc' ? 1 : -1

    return [...data].sort((a, b) => {
      const av = getValue(a)
      const bv = getValue(b)
      if (av < bv) return -1 * direction
      if (av > bv) return 1 * direction
      return 0
    })
  }, [data, sort, columns])

  const toggleSort = (key: string) => {
    setSort((current) => {
      if (!current || current.key !== key) return { key, direction: 'asc' }
      if (current.direction === 'asc') return { key, direction: 'desc' }
      return null
    })
  }

  const handleHeaderKeyDown = (event: KeyboardEvent<HTMLSpanElement>, key: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      toggleSort(key)
    }
  }

  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, item: T) => {
    if ((event.key === 'Enter' || event.key === ' ') && onRowClick) {
      event.preventDefault()
      onRowClick(item)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-900/40 shadow-lg">
        <table aria-label={ariaLabel} className="min-w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              {columns.map((col) => {
                const isSorted = sort?.key === col.key
                const ariaSort = isSorted
                  ? sort.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'

                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={col.sortable ? ariaSort : undefined}
                    className={`px-4 py-3 font-semibold ${col.headerClassName || col.className || ''}`}
                  >
                    {col.sortable ? (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleSort(col.key)}
                        onKeyDown={(event) => handleHeaderKeyDown(event, col.key)}
                        className="inline-flex cursor-pointer select-none items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                      >
                        {col.header}
                        <span aria-hidden="true" className="text-[10px] text-slate-500">
                          {isSorted ? (sort.direction === 'asc' ? '▲' : '▼') : '⇕'}
                        </span>
                      </span>
                    ) : (
                      col.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {error ? (
              <tr>
                <td
                  colSpan={columns.length}
                  role="alert"
                  className="px-4 py-12 text-center text-sm text-red-400"
                >
                  {error}
                </td>
              </tr>
            ) : loading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-sm text-slate-400"
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg
                      className="h-5 w-5 animate-spin text-cyan-400"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      />
                    </svg>
                    <span>Loading data…</span>
                  </div>
                </td>
              </tr>
            ) : sortedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-sm text-slate-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sortedData.map((item, index) => {
                const key = keyExtractor(item, index)
                const isClickable = typeof onRowClick === 'function'

                return (
                  <tr
                    key={key}
                    onClick={() => isClickable && onRowClick(item)}
                    tabIndex={isClickable ? 0 : undefined}
                    role={isClickable ? 'button' : undefined}
                    onKeyDown={isClickable ? (event) => handleRowKeyDown(event, item) : undefined}
                    className={[
                      'transition-colors',
                      isClickable
                        ? 'cursor-pointer hover:bg-white/[0.04] focus:outline-none focus-visible:bg-white/[0.06] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-cyan-400'
                        : 'hover:bg-white/[0.02]',
                    ].join(' ')}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-4 py-3 text-slate-300 ${col.className || ''}`}
                      >
                        {col.render
                          ? col.render(item, index)
                          : ((item as Record<string, unknown>)[col.key] as ReactNode)}
                      </td>
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.total > 0 && !loading && !error && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-1 text-xs text-slate-400">
          <div>
            Showing{' '}
            <span className="font-medium text-slate-200">
              {(currentPage - 1) * pagination.pageSize + 1}
            </span>{' '}
            to{' '}
            <span className="font-medium text-slate-200">
              {Math.min(currentPage * pagination.pageSize, pagination.total)}
            </span>{' '}
            of{' '}
            <span className="font-medium text-slate-200">{pagination.total}</span>{' '}
            results
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => pagination.onPageChange(currentPage - 1)}
              className="rounded-lg border border-white/10 bg-slate-800/80 px-2.5 py-1 text-slate-200 transition hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800/80"
              aria-label="Previous page"
            >
              Previous
            </button>
            <span className="px-2 py-1 text-slate-300 font-medium">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => pagination.onPageChange(currentPage + 1)}
              className="rounded-lg border border-white/10 bg-slate-800/80 px-2.5 py-1 text-slate-200 transition hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800/80"
              aria-label="Next page"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
