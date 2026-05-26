import type { PortalPublicProfile } from '../types/api';

interface PortalLayoutProps {
  profile: PortalPublicProfile;
  children: React.ReactNode;
}

function getThemeFonts(theme: PortalPublicProfile['portalTheme']): string {
  if (theme === 'BOLD_ROMANTIC' || theme === 'LIGHT_ROMANTIC') {
    return "font-['Cormorant_Garamond',Georgia,serif]";
  }
  return "font-['DM_Sans',system-ui,sans-serif]";
}

function isRomantic(theme: PortalPublicProfile['portalTheme']): boolean {
  return theme === 'BOLD_ROMANTIC' || theme === 'LIGHT_ROMANTIC';
}

function isBold(theme: PortalPublicProfile['portalTheme']): boolean {
  return theme === 'BOLD_MODERN' || theme === 'BOLD_ROMANTIC';
}

export function PortalLayout({ profile, children }: PortalLayoutProps) {
  const theme = profile.portalTheme ?? 'LIGHT_MODERN';
  const fontClass = getThemeFonts(theme);
  const romantic = isRomantic(theme);
  const bold = isBold(theme);
  const brand = profile.brandColour ?? '#1a1a1a';

  return (
    <div className={`min-h-screen ${fontClass} ${bold ? 'bg-[#1a1a1a] text-white' : 'bg-white text-[#1a1a1a]'}`}>
      <header className={`${bold ? 'bg-[#1a1a1a]' : 'bg-white border-b border-[#e5e5e5]'} px-6 py-5`}>
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          {profile.logoUrl && (
            <img
              src={profile.logoUrl}
              alt={profile.businessName}
              className={`h-10 w-auto object-contain ${bold ? 'brightness-0 invert' : ''}`}
            />
          )}
          <div>
            <p
              className={`font-semibold ${romantic ? 'text-xl tracking-wide' : 'text-base'} ${bold ? 'text-white' : 'text-[#1a1a1a]'}`}
              style={!bold ? { color: brand } : undefined}
            >
              {profile.displayName ?? profile.businessName}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {children}
      </main>

      <footer className={`mt-16 px-6 py-6 text-center text-xs ${bold ? 'text-white/40' : 'text-[#9ca3af]'}`}>
        Powered by GigMan
      </footer>
    </div>
  );
}

export { getThemeFonts, isRomantic, isBold };
