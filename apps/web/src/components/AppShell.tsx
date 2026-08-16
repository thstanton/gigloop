import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, useClerk, useUser } from '@clerk/react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { PublicProfile } from '@/types/api';
import {
  LogOut,
  ChevronUp,
  MoreHorizontal,
  Search,
} from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { isEnabled } from '@/lib/featureFlags';
import { GlobalCommandPalette } from '@/features/search/GlobalCommandPalette';
import {
  PRIMARY_NAV_DESTINATIONS,
  SECONDARY_NAV_DESTINATIONS,
  type NavDestinationRow,
} from '@/lib/constants';

// Global command palette (ADR-0067) — dark-launched behind a default-off env flag.
const SEARCH_FLAG = 'VITE_FEATURE_COMMAND_PALETTE';

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

function SidebarNavGroup({ items }: { items: readonly NavDestinationRow[] }) {
  return (
    <ul className="space-y-0.5">
      {items.map(({ label, route, icon: Icon }) => (
        <li key={route}>
          <NavLink
            to={route}
            end={route === '/admin'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors duration-150',
                isActive
                  ? 'bg-primary/20 text-chrome-foreground font-medium'
                  : 'text-chrome-muted hover:bg-chrome-foreground/5 hover:text-chrome-foreground font-normal',
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
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded hover:bg-chrome-foreground/5 transition-colors duration-150"
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
        <SidebarNavGroup items={PRIMARY_NAV_DESTINATIONS} />
        <div>
          <div className="h-px bg-chrome-muted/30 mx-1 mb-3" />
          <SidebarNavGroup items={SECONDARY_NAV_DESTINATIONS} />
        </div>
      </nav>

      <div className="px-2 py-3 border-t border-chrome-muted/30 flex-shrink-0">
        <UserMenu />
      </div>
    </aside>
  );
}

// ─── Desktop: top bar ─────────────────────────────────────────────────────────

function DesktopTopBar({
  businessName,
  isLoading,
  onOpenSearch,
}: {
  businessName: string;
  isLoading: boolean;
  onOpenSearch?: () => void;
}) {
  return (
    <header className="hidden md:flex fixed top-0 inset-x-0 h-14 bg-chrome items-center px-6 z-30">
      <span className="text-2xl font-wordmark font-semibold text-chrome-foreground tracking-wide">GigLoop</span>
      <div className="ml-auto flex items-center gap-4">
        {onOpenSearch && (
          <button
            type="button"
            onClick={onOpenSearch}
            className="flex items-center gap-2 rounded-md bg-chrome-muted/20 px-3 py-1.5 text-sm text-chrome-muted transition-colors hover:text-chrome-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-foreground/50"
          >
            <Search size={16} aria-hidden />
            <span>Search</span>
            <kbd className="ml-2 rounded border border-chrome-muted/40 px-1.5 text-xs font-medium">⌘K</kbd>
          </button>
        )}
        {isLoading
          ? <div className="h-3 w-28 bg-chrome-muted/40 rounded animate-pulse" />
          : <span className="text-sm text-chrome-muted">{businessName}</span>
        }
      </div>
    </header>
  );
}

// ─── Mobile: top bar ─────────────────────────────────────────────────────────

function MobileTopBar({ onOpenSearch }: { onOpenSearch?: () => void }) {
  return (
    <header className="md:hidden fixed top-0 inset-x-0 h-14 bg-chrome flex items-center px-4 z-20">
      <span className="text-base font-wordmark font-semibold text-chrome-foreground tracking-wide">GigLoop</span>
      {onOpenSearch && (
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Search"
          className="ml-auto -mr-2 flex h-11 w-11 items-center justify-center text-chrome-muted transition-colors hover:text-chrome-foreground"
        >
          <Search size={22} strokeWidth={1.75} aria-hidden />
        </button>
      )}
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
  const moreIsActive = SECONDARY_NAV_DESTINATIONS.some((item) => location.pathname.startsWith(item.route));

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  const email = user?.primaryEmailAddress?.emailAddress ?? '';

  return (
    <>
      <nav className="md:hidden fixed bottom-0 inset-x-0 h-16 bg-chrome border-t border-chrome-muted/30 flex z-30">
        {PRIMARY_NAV_DESTINATIONS.map(({ label, route, icon: Icon }) => (
          <NavLink
            key={route}
            to={route}
            end={route === '/admin'}
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
            {SECONDARY_NAV_DESTINATIONS.map(({ label, route, icon: Icon }) => (
              <NavLink
                key={route}
                to={route}
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

// The Booking Builder is a sustained, focused editing task — it takes over the
// mobile bottom tab bar to remove an un-guardable exit (ADR-0051). First and only
// surface to hide the tab bar; desktop sidebar is unaffected.
const BUILDER_ROUTE = /^\/admin\/bookings\/[^/]+\/builder\/?$/;

export default function AppShell() {
  const { businessName, isLoading } = usePublicProfileData();
  const { pathname } = useLocation();
  const hideTabBar = BUILDER_ROUTE.test(pathname);

  const searchEnabled = isEnabled(SEARCH_FLAG);
  const [searchOpen, setSearchOpen] = useState(false);
  const openSearch = searchEnabled ? () => setSearchOpen(true) : undefined;

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
      <MobileTopBar onOpenSearch={openSearch} />

      {/* Content — offset for sidebar on desktop, top bar on mobile. The Builder
          hides the mobile tab bar, so drop its pb-16 to use the full height there. */}
      <div className={cn('md:ml-60 flex flex-col min-h-screen pt-14 md:pb-0', !hideTabBar && 'pb-16')}>
        <DesktopTopBar businessName={businessName} isLoading={isLoading} onOpenSearch={openSearch} />
        <main id="main-content" className="flex-1">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom tab bar (hidden inside the Builder — ADR-0051) */}
      {!hideTabBar && <BottomTabBar />}

      {/* Global command palette — dark-launched behind SEARCH_FLAG (ADR-0067) */}
      {searchEnabled && <GlobalCommandPalette open={searchOpen} onOpenChange={setSearchOpen} />}
    </div>
  );
}
