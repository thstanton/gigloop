import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useContacts } from '@/lib/hooks/useContacts';
import type { Contact } from '@/types/api';

const PRIMARY_ROLE_LABELS: Record<string, string> = {
  CUSTOMER: 'Customer',
  VENUE: 'Venue',
  BOOKING_AGENT: 'Booking agent',
};

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ filtered }: { filtered: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <Users size={48} strokeWidth={1.25} className="text-muted opacity-40" />
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-foreground">
          {filtered ? 'No contacts match your search' : 'No contacts yet'}
        </p>
        <p className="text-sm text-muted">
          {filtered ? 'Try a different name or email.' : 'Add your first contact to get started.'}
        </p>
      </div>
      {!filtered && (
        <Button size="sm" onClick={() => navigate('/admin/contacts/new')}>
          New contact
        </Button>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ListSkeleton() {
  return (
    <div className="w-full">
      <div className="border-b border-border py-2.5 px-4 flex gap-8">
        {['w-24', 'w-36', 'w-28'].map((w, i) => (
          <div key={i} className={`h-3 ${w} bg-border rounded animate-pulse`} />
        ))}
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-12 border-b border-border px-4 flex items-center gap-8">
          <div className="h-3 w-32 bg-border rounded animate-pulse" />
          <div className="h-3 w-40 bg-border rounded animate-pulse" />
          <div className="h-3 w-28 bg-border rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

// ─── Table (desktop) ──────────────────────────────────────────────────────────

function ContactsTable({ contacts }: { contacts: Contact[] }) {
  const navigate = useNavigate();
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse">
        <thead>
          <tr className="border-b border-border">
            {['Name', 'Email', 'Phone'].map((h) => (
              <th
                key={h}
                className="px-4 py-2.5 text-left text-xs font-medium text-muted whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {contacts.map((c) => (
            <tr
              key={c.id}
              onClick={() => navigate(`/admin/contacts/${c.id}`)}
              className="h-12 border-b border-border cursor-pointer hover:bg-surface transition-colors duration-100"
            >
              <td className="px-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{c.name}</span>
                  {c.primaryRole && (
                    <span className="text-xs text-muted">{PRIMARY_ROLE_LABELS[c.primaryRole]}</span>
                  )}
                </div>
              </td>
              <td className="px-4">
                {c.email ? (
                  <a
                    href={`mailto:${c.email}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm text-muted hover:text-primary transition-colors"
                  >
                    {c.email}
                  </a>
                ) : (
                  <span className="text-sm text-muted">—</span>
                )}
              </td>
              <td className="px-4">
                {c.phone ? (
                  <a
                    href={`tel:${c.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm text-muted hover:text-primary transition-colors"
                  >
                    {c.phone}
                  </a>
                ) : (
                  <span className="text-sm text-muted">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Card list (mobile) ───────────────────────────────────────────────────────

function ContactCardList({ contacts }: { contacts: Contact[] }) {
  const navigate = useNavigate();
  return (
    <div className="divide-y divide-border">
      {contacts.map((c) => (
        <div
          key={c.id}
          onClick={() => navigate(`/admin/contacts/${c.id}`)}
          className="py-3 flex flex-col gap-0.5 cursor-pointer active:bg-surface transition-colors duration-100"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{c.name}</span>
            {c.primaryRole && (
              <span className="text-xs text-muted">{PRIMARY_ROLE_LABELS[c.primaryRole]}</span>
            )}
          </div>
          {(c.email || c.phone) && (
            <span className="text-sm text-muted" onClick={(e) => e.stopPropagation()}>
              {c.email && (
                <a href={`mailto:${c.email}`} className="hover:text-primary transition-colors">
                  {c.email}
                </a>
              )}
              {c.email && c.phone && ' · '}
              {c.phone && (
                <a href={`tel:${c.phone}`} className="hover:text-primary transition-colors">
                  {c.phone}
                </a>
              )}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ContactsListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { data = [], isLoading, isError } = useContacts();

  const filtered = search.trim()
    ? data.filter((c) => {
        const q = search.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.phone?.includes(q)
        );
      })
    : data;

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-semibold text-foreground">Contacts</h1>
        <Button onClick={() => navigate('/admin/contacts/new')}>New contact</Button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
        />
        <Input
          placeholder="Search by name, email or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Content */}
      {isLoading && <ListSkeleton />}

      {!isLoading && isError && (
        <p className="py-12 text-center text-sm text-muted">Failed to load contacts.</p>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <EmptyState filtered={search.trim().length > 0} />
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <>
          <div className="hidden md:block">
            <ContactsTable contacts={filtered} />
          </div>
          <div className="md:hidden">
            <ContactCardList contacts={filtered} />
          </div>
        </>
      )}
    </div>
  );
}
