import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import type { BookingListItem, BookingStatus } from '@/types/api';

type Filter = BookingStatus | 'ALL';

interface UseBookingsResult {
  data: BookingListItem[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useBookings(filter: Filter): UseBookingsResult {
  const { getToken } = useAuth();
  const [data, setData] = useState<BookingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getToken().then((token) => {
      if (!token || cancelled) return;

      const url =
        filter === 'ALL'
          ? '/api/bookings'
          : `/api/bookings?status=${filter}`;

      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => {
          if (!r.ok) throw new Error(`${r.status}`);
          return r.json() as Promise<BookingListItem[]>;
        })
        .then((items) => { if (!cancelled) { setData(items); setLoading(false); } })
        .catch((e: Error) => { if (!cancelled) { setError(e.message); setLoading(false); } });
    });

    return () => { cancelled = true; };
  }, [filter, tick, getToken]);

  return { data, loading, error, refetch: () => setTick((n) => n + 1) };
}
