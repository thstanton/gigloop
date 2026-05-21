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
  MoreHorizontal,
} from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

// ─── Nav config ──────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  to: string;
  icon: React.ElementType;
}

const primaryNav: NavItem[] = [
  { label: 'Dashboard',  to: '/admin',            icon: LayoutDashboard },
  { label: 'Bookings',   to: '/admin/bookings',   icon: CalendarDays },
  { label: 'Contacts',   to: '/admin/contacts',   icon: Users },
  { label: 'Repertoire', to: '/admin/repertoire', icon: Music2 },
];

const secondaryNav: NavItem[] = [
  { label: 'Templates', to: '/admin/templates', icon: FileText },
  { label: 'Settings',  to: '/admin/settings',  icon: Settings },
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

// ─── Shared: sidebar nav group ───────────────────────────────────────────────

function SidebarNavGroup({ items }: { items: NavItem[] }) {
  return (
    <ul className="space-y-0.5">
      {items.map(({ label, to, icon: Icon }) => (
        <li key={to}>
          <NavLink
            to={to}
            end={to === '/admin'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors duration-150 relative',
                isActive
                  ? 'bg-surface text-foreground font-medium before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5 before:bg-primary before:rounded-full'
                  : 'text-muted hover:bg-surface hover:text-foreground font-normal',
              )
            }
          >
            <Icon size={16} strokeWidth={1.75} className="flex-shrink-0" />
            {label}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

// ─── Shared: user menu (desktop sidebar) ─────────────────────────────────────

function UserMenu() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  const email = user?.primaryEmailAddress?.emailAddress ?? '';

  return (
    <div className="relative">
      {open && <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />}

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
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-surface transition-colors duration-150"
      >
        <UserAvatar size="sm" />
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-medium text-foreground leading-tight truncate">{fullName}</p>
        </div>
        <ChevronUp
          size={14}
          strokeWidth={1.75}
          className={cn('text-muted flex-shrink-0 transition-transform duration-150', !open && 'rotate-180')}
        />
      </button>
    </div>
  );
}

// ─── Shared: user avatar ─────────────────────────────────────────────────────

function UserAvatar({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const { user } = useUser();
  const initials =
    [user?.firstName, user?.lastName]
      .filter(Boolean)
      .map((n) => n![0])
      .join('')
      .toUpperCase() || '?';

  return (
    <div
      className={cn(
        'rounded-full bg-primary flex items-center justify-center flex-shrink-0',
        size === 'sm' ? 'w-7 h-7' : 'w-9 h-9',
      )}
    >
      <span
        className={cn(
          'text-primary-foreground font-semibold leading-none',
          size === 'sm' ? 'text-xs' : 'text-sm',
        )}
      >
        {initials}
      </span>
    </div>
  );
}

// ─── Desktop: sidebar ─────────────────────────────────────────────────────────

function Sidebar({ businessName }: { businessName: string }) {
  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 bg-background border-r border-border flex-col z-30">
      <div className="h-14 flex items-center px-4 border-b border-border flex-shrink-0">
        <span className="text-sm font-semibold text-foreground truncate">
          {businessName || <span className="text-muted animate-pulse">Loading…</span>}
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-5">
        <SidebarNavGroup items={primaryNav} />
        <div>
          <div className="h-px bg-border mx-1 mb-3" />
          <SidebarNavGroup items={secondaryNav} />
        </div>
      </nav>

      <div className="px-2 py-3 border-t border-border flex-shrink-0">
        <UserMenu />
      </div>
    </aside>
  );
}

// ─── Desktop: top bar ─────────────────────────────────────────────────────────

function DesktopTopBar() {
  return (
    <header className="hidden lg:flex h-14 bg-background border-b border-border items-center px-6 flex-shrink-0">
      {/* Page title slot — filled by pages via context */}
    </header>
  );
}

// ─── Mobile: top bar ─────────────────────────────────────────────────────────

function MobileTopBar({ businessName }: { businessName: string }) {
  return (
    <header className="lg:hidden fixed top-0 inset-x-0 h-14 bg-background border-b border-border flex items-center px-4 z-20">
      <span className="text-sm font-semibold text-foreground truncate">
        {businessName || <span className="text-muted animate-pulse">Loading…</span>}
      </span>
    </header>
  );
}

// ─── Mobile: bottom tab bar ───────────────────────────────────────────────────

function BottomTabBar() {
  const [moreOpen, setMoreOpen] = useState(false);
  const { user } = useUser();
  const { signOut } = useClerk();
  const navigate = useNavigate();

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  const email = user?.primaryEmailAddress?.emailAddress ?? '';

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 inset-x-0 h-16 bg-background border-t border-border flex z-30">
        {primaryNav.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/admin'}
            className={({ isActive }) =>
              cn(
                'flex-1 flex flex-col items-center justify-center gap-1 transition-colors duration-150',
                isActive ? 'text-primary' : 'text-muted',
              )
            }
          >
            <Icon size={22} strokeWidth={1.75} />
            <span className="text-[10px] font-medium leading-none">{label}</span>
          </NavLink>
        ))}

        <button
          onClick={() => setMoreOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-1 text-muted transition-colors duration-150"
        >
          <MoreHorizontal size={22} strokeWidth={1.75} />
          <span className="text-[10px] font-medium leading-none">More</span>
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="px-0 pb-8">
          {/* User info */}
          <div className="flex items-center gap-3 px-5 py-4">
            <UserAvatar size="md" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{fullName}</p>
              <p className="text-xs text-muted truncate">{email}</p>
            </div>
          </div>

          <Separator />

          {/* Secondary nav */}
          <nav className="py-2">
            {secondaryNav.map(({ label, to, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-5 py-3 text-sm transition-colors duration-150',
                    isActive ? 'text-foreground font-medium' : 'text-muted',
                  )
                }
              >
                <Icon size={18} strokeWidth={1.75} className="flex-shrink-0" />
                {label}
              </NavLink>
            ))}
          </nav>

          <Separator />

          {/* Sign out */}
          <button
            onClick={() => signOut(() => navigate('/sign-in'))}
            className="w-full flex items-center gap-3 px-5 py-3 text-sm text-muted transition-colors duration-150"
          >
            <LogOut size={18} strokeWidth={1.75} />
            Sign out
          </button>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ─── AppShell ────────────────────────────────────────────────────────────────

export default function AppShell() {
  const businessName = useBusinessName();

  return (
    <div className="min-h-screen bg-surface">
      {/* Desktop sidebar */}
      <Sidebar businessName={businessName} />

      {/* Mobile top bar */}
      <MobileTopBar businessName={businessName} />

      {/* Content — offset for sidebar on desktop, top bar on mobile */}
      <div className="lg:ml-60 flex flex-col min-h-screen pt-14 lg:pt-0 pb-16 lg:pb-0">
        <DesktopTopBar />
        <main className="flex-1 lg:overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <BottomTabBar />
    </div>
  );
}
