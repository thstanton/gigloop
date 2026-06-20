import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, useClerk, useUser } from '@clerk/react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { PublicProfile } from '@/types/api';
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
  Package,
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
  { label: 'Packages',  to: '/admin/packages',  icon: Package },
  { label: 'Templates', to: '/admin/templates', icon: FileText },
  { label: 'Settings',  to: '/admin/settings',  icon: Settings },
];

// ─── Hooks ───────────────────────────────────────────────────────────────────

function usePublicProfileData() {
  const { isLoaded } = useAuth();
  const { data, isPending } = useQuery({
    queryKey: ['publicProfile'],
    queryFn: () => apiGet<PublicProfile>('/me/public'),
    enabled: isLoaded,
    staleTime: 5 * 60 * 1000,
  });
  return {
    businessName: data?.businessName ?? '',
    photo: data?.photo ?? null,
    isLoading: !isLoaded || isPending,
  };
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
                'flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors duration-150',
                isActive
                  ? 'bg-primary/20 text-chrome-foreground font-medium'
                  : 'text-chrome-muted hover:bg-chrome-foreground/8 hover:text-chrome-foreground font-normal',
              )
            }
          >
            <Icon size={16} strokeWidth={1.75} className="flex-shrink-0" aria-hidden="true" />
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
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded hover:bg-chrome-foreground/8 transition-colors duration-150"
      >
        <UserAvatar size="sm" />
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-medium text-chrome-foreground leading-tight truncate">{fullName}</p>
        </div>
        <ChevronUp
          size={14}
          strokeWidth={1.75}
          className={cn('text-chrome-muted flex-shrink-0 transition-transform duration-150', !open && 'rotate-180')}
        />
      </button>
    </div>
  );
}

// ─── Shared: user avatar ─────────────────────────────────────────────────────

function UserAvatar({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const { user } = useUser();
  const { photo } = usePublicProfileData();
  const initials =
    [user?.firstName, user?.lastName]
      .filter(Boolean)
      .map((n) => n![0])
      .join('')
      .toUpperCase() || '?';

  const sizeClass = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9';

  if (photo) {
    return (
      <div className={cn('rounded-full overflow-hidden flex-shrink-0 bg-white', sizeClass)}>
        <img src={photo} alt="Profile" className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-full bg-primary flex items-center justify-center flex-shrink-0',
        sizeClass,
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

function Sidebar() {
  return (
    <aside className="hidden md:flex fixed top-14 left-0 bottom-0 w-60 bg-chrome-sidebar flex-col z-30">
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-5">
        <SidebarNavGroup items={primaryNav} />
        <div>
          <div className="h-px bg-chrome-muted/30 mx-1 mb-3" />
          <SidebarNavGroup items={secondaryNav} />
        </div>
      </nav>

      <div className="px-2 py-3 border-t border-chrome-muted/30 flex-shrink-0">
        <UserMenu />
      </div>
    </aside>
  );
}

// ─── Desktop: top bar ─────────────────────────────────────────────────────────

function DesktopTopBar({ businessName, isLoading }: { businessName: string; isLoading: boolean }) {
  return (
    <header className="hidden md:flex fixed top-0 inset-x-0 h-14 bg-chrome items-center px-6 z-30">
      <span className="text-xl font-display font-semibold text-chrome-foreground tracking-wide">GigMan</span>
      <div className="ml-auto">
        {isLoading
          ? <div className="h-3 w-28 bg-chrome-muted/40 rounded animate-pulse" />
          : <span className="text-sm text-chrome-muted">{businessName}</span>
        }
      </div>
    </header>
  );
}

// ─── Mobile: top bar ─────────────────────────────────────────────────────────

function MobileTopBar() {
  return (
    <header className="md:hidden fixed top-0 inset-x-0 h-14 bg-chrome flex items-center px-4 z-20">
      <span className="text-sm font-display font-semibold text-chrome-foreground tracking-wide">GigMan</span>
    </header>
  );
}

// ─── Mobile: bottom tab bar ───────────────────────────────────────────────────

function BottomTabBar() {
  const [moreOpen, setMoreOpen] = useState(false);
  const { user } = useUser();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const location = useLocation();
  const moreIsActive = secondaryNav.some((item) => location.pathname.startsWith(item.to));

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  const email = user?.primaryEmailAddress?.emailAddress ?? '';

  return (
    <>
      <nav className="md:hidden fixed bottom-0 inset-x-0 h-16 bg-chrome border-t border-chrome-muted/30 flex z-30">
        {primaryNav.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/admin'}
            className={({ isActive }) =>
              cn(
                'flex-1 flex flex-col items-center justify-center gap-1 transition-colors duration-150',
                isActive ? 'text-chrome-foreground' : 'text-chrome-muted',
              )
            }
          >
            <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
            <span className="text-[10px] font-medium leading-none">{label}</span>
          </NavLink>
        ))}

        <button
          onClick={() => setMoreOpen(true)}
          className={cn(
            'flex-1 flex flex-col items-center justify-center gap-1 transition-colors duration-150',
            moreIsActive ? 'text-chrome-foreground' : 'text-chrome-muted',
          )}
        >
          <MoreHorizontal size={22} strokeWidth={1.75} aria-hidden="true" />
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
                <Icon size={18} strokeWidth={1.75} className="flex-shrink-0" aria-hidden="true" />
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
  const { businessName, isLoading } = usePublicProfileData();

  return (
    <div className="min-h-screen bg-surface">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:px-4 focus:py-2 focus:bg-background focus:text-foreground"
      >
        Skip to main content
      </a>

      {/* Desktop sidebar */}
      <Sidebar />

      {/* Mobile top bar */}
      <MobileTopBar />

      {/* Content — offset for sidebar on desktop, top bar on mobile */}
      <div className="md:ml-60 flex flex-col min-h-screen pt-14 pb-16 md:pb-0">
        <DesktopTopBar businessName={businessName} isLoading={isLoading} />
        <main id="main-content" className="flex-1">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <BottomTabBar />
    </div>
  );
}
