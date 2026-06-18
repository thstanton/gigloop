import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useContacts } from '@/lib/hooks/useContacts';
import type { Contact } from '@/types/api';
import { EmptyState } from '@/components/common/EmptyState';
import { PRIMARY_ROLE_LABELS, PRIMARY_ROLE_ORDER, type ContactPrimaryRole } from '@/lib/constants';

// ─── Empty state ──────────────────────────────────────────────────────────────

function ContactsEmptyState({
  searchActive,
  roleFilter,
}: {
  searchActive: boolean;
  roleFilter: ContactPrimaryRole | null;
}) {
  const navigate = useNavigate();
  const filtered = searchActive || roleFilter !== null;

  let heading: string;
  let description: string;
  if (searchActive) {
    heading = 'No contacts match your search';
    description = 'Try a different name or email.';
  } else if (roleFilter) {
    const roleLabel = PRIMARY_ROLE_LABELS[roleFilter].toLowerCase();
    heading = `No ${roleLabel} contacts yet`;
    description = `Add your first ${roleLabel} to get started.`;
  } else {
    heading = 'No contacts yet';
    description = 'Add your first contact to get started.';
  }

  return (
    <EmptyState
      icon={<Users size={40} strokeWidth={1.5} />}
      heading={heading}
      description={description}
      action={!filtered && <Button size="sm" onClick={() => navigate('/admin/contacts/new')}>New contact</Button>}
    />
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
                    <span className="text-xs text-muted">{PRIMARY_ROLE_LABELS[c.primaryRole as ContactPrimaryRole]}</span>
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
              <span className="text-xs text-muted">{PRIMARY_ROLE_LABELS[c.primaryRole as ContactPrimaryRole]}</span>
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const { data = [], isLoading, isError } = useContacts();

  const roleFilter = (searchParams.get('role') as ContactPrimaryRole | null) ?? null;
  const searchActive = search.trim().length > 0;

  const filtered = data.filter((c) => {
    if (searchActive) {
      const q = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q)
      );
    }
    if (roleFilter) return c.primaryRole === roleFilter;
    return true;
  });

  function handleRoleFilter(role: ContactPrimaryRole | null) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (role) {
        next.set('role', role);
      } else {
        next.delete('role');
      }
      return next;
    });
  }

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

      {/* Role filter row */}
      <div className="flex gap-1 mb-4 border-b border-border">
        {([null, ...PRIMARY_ROLE_ORDER] as Array<ContactPrimaryRole | null>).map((role) => {
          const label = role ? PRIMARY_ROLE_LABELS[role] : 'All';
          const isActive = !searchActive && role === roleFilter;
          return (
            <button
              key={role ?? 'all'}
              onClick={() => handleRoleFilter(role)}
              className={cn(
                'px-3 py-2 text-sm -mb-px border-b-2 transition-colors duration-100 whitespace-nowrap',
                isActive
                  ? 'border-primary text-primary font-medium'
                  : 'border-transparent text-muted hover:text-foreground',
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {isLoading && <ListSkeleton />}

      {!isLoading && isError && (
        <p className="py-12 text-center text-sm text-muted">Failed to load contacts.</p>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <ContactsEmptyState searchActive={searchActive} roleFilter={roleFilter} />
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
