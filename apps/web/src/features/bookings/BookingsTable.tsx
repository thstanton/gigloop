import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { ChevronUp, ChevronDown, ChevronsUpDown, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BookingStatusPill from '@/components/domain/BookingStatusPill';
import type { BookingListItem } from '@/types/api';
import { cn } from '@/lib/utils';
import { formatDateAndDay, formatFeeWhole } from '@/lib/formatters';
import { EmptyState } from '@/components/common/EmptyState';

// ─── Column helper ───────────────────────────────────────────────────────────

const col = createColumnHelper<BookingListItem>();

const columns = [
  col.accessor('date', {
    header: 'Date',
    sortingFn: 'datetime',
    cell: ({ getValue }) => {
      const { date, day } = formatDateAndDay(getValue());
      return (
        <span className="flex flex-col gap-0.5">
          <span className="text-sm text-foreground">{date}</span>
          <span className="text-xs text-muted">{day}</span>
        </span>
      );
    },
  }),

  col.accessor((row) => row.title ?? row.customer.name, {
    id: 'customer',
    header: 'Customer',
    cell: ({ row }) => {
      const { customer, title } = row.original;
      return (
        <span className="flex flex-col gap-0.5">
          <span className="text-sm text-foreground">{customer.name}</span>
          {title && <span className="text-xs text-muted">{title}</span>}
        </span>
      );
    },
  }),

  col.accessor((row) => row.venue?.name ?? '', {
    id: 'venue',
    header: 'Venue',
    cell: ({ row }) =>
      row.original.venue ? (
        <span className="text-sm text-foreground">{row.original.venue.name}</span>
      ) : (
        <span className="text-sm text-muted">—</span>
      ),
  }),

  col.accessor('status', {
    header: 'Status',
    enableSorting: false,
    cell: ({ getValue }) => <BookingStatusPill status={getValue()} />,
  }),

  col.accessor((row) => (row.fee ? parseFloat(row.fee) : -1), {
    id: 'fee',
    header: 'Fee',
    cell: ({ row }) => (
      <span className="text-sm text-foreground tabular-nums">
        {formatFeeWhole(row.original.fee) ?? '—'}
      </span>
    ),
  }),
];

// ─── Sort icon ───────────────────────────────────────────────────────────────

function SortIcon({ direction }: { direction: 'asc' | 'desc' | false }) {
  if (direction === 'asc') return <ChevronUp size={13} className="text-foreground" />;
  if (direction === 'desc') return <ChevronDown size={13} className="text-foreground" />;
  return <ChevronsUpDown size={13} className="text-muted opacity-0 group-hover/header:opacity-100 transition-opacity" />;
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function BookingsEmptyState({ onNew }: { onNew?: () => void }) {
  return (
    <EmptyState
      icon={<Calendar size={40} strokeWidth={1.5} />}
      heading="No bookings yet"
      description="Add your first booking to get started."
      action={onNew && <Button size="sm" onClick={onNew}>New booking</Button>}
    />
  );
}

// ─── Mobile card list ─────────────────────────────────────────────────────────

function BookingCardList({ data }: { data: BookingListItem[] }) {
  const navigate = useNavigate();
  return (
    <div className="divide-y divide-border">
      {data.map((booking) => {
        const { date, day } = formatDateAndDay(booking.date);
        const fee = formatFeeWhole(booking.fee);
        return (
          <div
            key={booking.id}
            onClick={() => navigate(`/admin/bookings/${booking.id}`)}
            className="py-3 flex flex-col gap-1 cursor-pointer active:bg-surface transition-colors duration-100"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium text-foreground truncate block">
                  {booking.customer.name}
                </span>
                {booking.title && (
                  <span className="text-xs text-muted truncate block">{booking.title}</span>
                )}
                <div className="mt-1">
                  <BookingStatusPill status={booking.status} />
                </div>
              </div>
              {fee && <span className="text-sm text-foreground tabular-nums flex-shrink-0">{fee}</span>}
            </div>
            <span className="text-sm text-muted">{date} · {day}</span>
            {booking.venue && (
              <span className="text-xs text-muted truncate">{booking.venue.name}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── BookingsTable ────────────────────────────────────────────────────────────

interface BookingsTableProps {
  data: BookingListItem[];
  onNew?: () => void;
}

export default function BookingsTable({ data, onNew }: BookingsTableProps) {
  const navigate = useNavigate();
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'date', desc: false },
  ]);

  const tableData = useMemo(() => data, [data]);

  const table = useReactTable({
    data: tableData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (data.length === 0) {
    return <BookingsEmptyState onNew={onNew} />;
  }

  return (
    <>
      {/* Mobile: card list */}
      <div className="md:hidden">
        <BookingCardList data={data} />
      </div>

      {/* Desktop: sortable table */}
      <div className="hidden md:block w-full overflow-x-auto">
        <table className="w-full min-w-[580px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              {table.getFlatHeaders().map((header) => {
                const canSort = header.column.getCanSort();
                const sorted = header.column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    className={cn(
                      'group/header px-4 py-2.5 text-left text-xs font-medium text-muted select-none whitespace-nowrap',
                      canSort && 'cursor-pointer hover:text-foreground transition-colors',
                    )}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort && <SortIcon direction={sorted} />}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => navigate(`/admin/bookings/${row.original.id}`)}
                className="h-14 border-b border-border cursor-pointer hover:bg-surface transition-colors duration-100 group"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
