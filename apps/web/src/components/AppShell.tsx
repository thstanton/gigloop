import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth, useClerk, useUser } from '@clerk/react';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Music2,
  FileText,
  Settings,
  LogOut,
  ChevronUp,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  to: string;
  icon: React.ElementType;
}

// ─── Nav config ──────────────────────────────────────────────────────────────

const primaryNav: NavItem[] = [
  { label: 'Dashboard', to: '/admin', icon: LayoutDashboard },
  { label: 'Bookings', to: '/admin/bookings', icon: CalendarDays },
  { label: 'Contacts', to: '/admin/contacts', icon: Users },
  { label: 'Repertoire', to: '/admin/repertoire', icon: Music2 },
];

const secondaryNav: NavItem[] = [
  { label: 'Templates', to: '/admin/templates', icon: FileText },
  { label: 'Settings', to: '/admin/settings', icon: Settings },
];

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useBusinessName() {
  const { getToken } = useAuth();
  const [businessName, setBusinessName] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    getToken().then((token) => {
      if (!token || cancelled) return;
      fetch('/api/user-profile/public', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((data: { businessName?: string }) => {
          if (!cancelled) setBusinessName(data.businessName ?? '');
        })
        .catch(() => {});
    });
    return () => { cancelled = true; };
  }, [getToken]);

  return businessName;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function NavGroup({ items }: { items: NavItem[] }) {
  return (
    <ul className="space-y-0.5">
      {items.map(({ label, to, icon: Icon }) => (
        <li key={to}>
          <NavLink
            to={to}
            end={to === '/admin'}
            className={({ isActive }) =>
              [
                'group flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors duration-150 relative',
                isActive
                  ? 'bg-surface text-foreground font-medium before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5 before:bg-primary before:rounded-full'
                  : 'text-muted hover:bg-surface hover:text-foreground font-normal',
              ].join(' ')
            }
          >
            <Icon
              size={16}
              strokeWidth={1.75}
              className="flex-shrink-0 transition-colors duration-150"
            />
            {label}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

function UserMenu() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const initials = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .map((n) => n![0])
    .join('')
    .toUpperCase() || '?';

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  const email = user?.primaryEmailAddress?.emailAddress ?? '';

  return (
    <div className="relative">
      {open && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setOpen(false)}
        />
      )}

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-background border border-border rounded-lg shadow-lg z-20 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border">
            <p className="text-sm font-medium text-foreground truncate">{fullName}</p>
            <p className="text-xs text-muted truncate">{email}</p>
          </div>
          <button
            onClick={() => signOut(() => navigate('/sign-in'))}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-muted hover:text-foreground hover:bg-surface transition-colors duration-150"
          >
            <LogOut size={14} strokeWidth={1.75} />
            Sign out
          </button>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-surface transition-colors duration-150 group"
      >
        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
          <span className="text-primary-foreground text-xs font-semibold leading-none">
            {initials}
          </span>
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-medium text-foreground leading-tight truncate">{fullName}</p>
        </div>
        <ChevronUp
          size={14}
          strokeWidth={1.75}
          className={`text-muted flex-shrink-0 transition-transform duration-150 ${open ? '' : 'rotate-180'}`}
        />
      </button>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function Sidebar({ businessName }: { businessName: string }) {
  return (
    <aside className="fixed inset-y-0 left-0 w-60 bg-background border-r border-border flex flex-col z-30">
      {/* Business name */}
      <div className="h-14 flex items-center px-4 border-b border-border flex-shrink-0">
        <span className="text-sm font-semibold text-foreground truncate">
          {businessName || (
            <span className="text-muted animate-pulse">Loading…</span>
          )}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-5">
        <NavGroup items={primaryNav} />
        <div>
          <div className="h-px bg-border mx-1 mb-3" />
          <NavGroup items={secondaryNav} />
        </div>
      </nav>

      {/* User menu */}
      <div className="px-2 py-3 border-t border-border flex-shrink-0">
        <UserMenu />
      </div>
    </aside>
  );
}

// ─── Top bar ─────────────────────────────────────────────────────────────────

function TopBar() {
  return (
    <header className="h-14 bg-background border-b border-border flex items-center px-6 flex-shrink-0">
      {/* Slot for page title — filled by pages via context in a future iteration */}
    </header>
  );
}

// ─── AppShell ────────────────────────────────────────────────────────────────

export default function AppShell() {
  const businessName = useBusinessName();

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar businessName={businessName} />
      <div className="ml-60 flex flex-col min-h-screen">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
