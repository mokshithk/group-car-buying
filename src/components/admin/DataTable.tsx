import React from 'react';
import { Button, Skeleton } from '@/components/ui';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';

export interface ColumnDef<T> {
  key: string;
  header: string;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  widthClass?: string;
  render: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  error?: string;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  onSortChange?: (key: string) => void;
  page?: number;
  pageSize?: number;
  totalCount?: number;
  onPageChange?: (nextPage: number) => void;
}

/**
 * Dense, accessible internal data table with sticky header, aligned numerals,
 * keyboard sorting, pagination footer, loading skeletons, and empty/error states.
 */
export function DataTable<T>({
  columns,
  data,
  rowKey,
  isLoading = false,
  error,
  onRetry,
  emptyTitle = 'No matching records',
  emptyDescription = 'Try adjusting active filters or search criteria.',
  emptyAction,
  sortKey,
  sortDirection = 'desc',
  onSortChange,
  page = 1,
  pageSize = 20,
  totalCount = 0,
  onPageChange,
}: DataTableProps<T>) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startItem = totalCount === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(totalCount, safePage * pageSize);

  if (error) {
    return (
      <div
        role="alert"
        className="bg-white border border-rose-200 rounded-xl p-8 text-center space-y-3"
      >
        <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div className="text-sm font-bold text-slate-900">Unable to load records</div>
        <p className="text-xs text-rose-700 max-w-md mx-auto">{error}</p>
        {onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
            Retry Query
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-subtle">
      <div className="overflow-x-auto max-h-[68vh]">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-slate-600">
            <tr>
              {columns.map((col) => {
                const isSorted = sortKey === col.key;
                const alignClass =
                  col.align === 'right'
                    ? 'text-right justify-end'
                    : col.align === 'center'
                    ? 'text-center justify-center'
                    : 'text-left justify-start';

                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={
                      isSorted ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'
                    }
                    className={`px-4 py-3 font-semibold uppercase tracking-wider text-[11px] whitespace-nowrap ${
                      col.widthClass || ''
                    }`}
                  >
                    {col.sortable && onSortChange ? (
                      <button
                        type="button"
                        onClick={() => onSortChange(col.key)}
                        className={`inline-flex items-center gap-1 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded px-1 -mx-1 w-full ${alignClass}`}
                      >
                        <span>{col.header}</span>
                        {isSorted ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="w-3 h-3 text-brand-600 shrink-0" />
                          ) : (
                            <ArrowDown className="w-3 h-3 text-brand-600 shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                        )}
                      </button>
                    ) : (
                      <div className={`flex items-center ${alignClass}`}>{col.header}</div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, idx) => (
                <tr key={`skel-${idx}`}>
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <Skeleton className="h-4 w-full max-w-[140px] rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-14 text-center">
                  <div className="space-y-2 max-w-sm mx-auto">
                    <div className="text-sm font-semibold text-slate-800">{emptyTitle}</div>
                    <p className="text-xs text-slate-500">{emptyDescription}</p>
                    {emptyAction && <div className="pt-2">{emptyAction}</div>}
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={rowKey(row)}
                  className="hover:bg-slate-50/80 transition-colors"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 text-slate-700 align-middle ${
                        col.align === 'right'
                          ? 'text-right tabular-nums'
                          : col.align === 'center'
                          ? 'text-center'
                          : 'text-left'
                      }`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      {onPageChange && (
        <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
          <div className="tabular-nums">
            Showing <strong className="text-slate-900">{startItem}</strong>&ndash;
            <strong className="text-slate-900">{endItem}</strong> of{' '}
            <strong className="text-slate-900">{totalCount}</strong> records
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={safePage <= 1 || isLoading}
              onClick={() => onPageChange(Math.max(1, safePage - 1))}
              leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
            >
              Prev
            </Button>
            <span className="px-2 font-mono text-[11px] font-semibold text-slate-700 tabular-nums">
              Page {safePage} / {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={safePage >= totalPages || isLoading}
              onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
              rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
