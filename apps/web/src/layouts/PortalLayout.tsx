import type { PortalPublicProfile } from '../types/api';

interface PortalLayoutProps {
  profile: PortalPublicProfile;
  children: React.ReactNode;
  wide?: boolean;
  hero?: React.ReactNode;
}

function getDisplayFontClass(theme: string | null): string {
  if (theme === 'BOLD_ROMANTIC' || theme === 'LIGHT_ROMANTIC') {
    return "font-['Caveat',cursive]";
  }
  return "font-['Lexend_Deca',sans-serif]";
}

function isRomantic(theme: string | null): boolean {
  return theme === 'BOLD_ROMANTIC' || theme === 'LIGHT_ROMANTIC';
}

function isBold(theme: string | null): boolean {
  return theme === 'BOLD_MODERN' || theme === 'BOLD_ROMANTIC';
}

export function PortalLayout({ profile, children, wide = false, hero }: PortalLayoutProps) {
  const theme = profile.portalTheme ?? 'LIGHT_MODERN';
  const displayFontClass = getDisplayFontClass(theme);
  const romantic = isRomantic(theme);
  const bold = isBold(theme);
  const brand = profile.brandColour ?? '#1a1a1a';

  return (
    <div
      className={`min-h-screen font-['Commissioner',sans-serif] ${bold ? 'text-white' : 'bg-white text-[#1a1a1a]'}`}
      style={bold ? { backgroundColor: brand } : undefined}
    >
      <header
        className={`${bold ? 'py-4 border-b border-white/15' : 'py-5 bg-white border-b border-[#ede9e4]'}`}
        style={bold ? { backgroundColor: brand } : undefined}
      >
        <div className={`${wide ? 'max-w-4xl' : 'max-w-2xl'} mx-auto px-6 flex items-center gap-4`}>
          {profile.logoUrl && (
            <img
              src={profile.logoUrl}
              alt={profile.businessName}
              className={`h-9 w-auto object-contain ${bold ? 'brightness-0 invert' : ''}`}
            />
          )}
          <p
            className={`font-semibold ${displayFontClass} ${romantic ? 'text-xl tracking-wide' : 'text-sm tracking-tight'} ${bold ? 'text-white' : ''}`}
            style={!bold ? { color: brand } : undefined}
          >
            {profile.displayName ?? profile.businessName}
          </p>
        </div>
      </header>

      {hero}

      <main className={`${wide ? 'max-w-4xl' : 'max-w-2xl'} mx-auto px-6 py-8`}>
        {children}
      </main>

      <footer className={`mt-16 px-6 py-6 text-center text-xs ${bold ? 'text-white/25' : 'text-[#c4bdb4]'}`}>
        Powered by GigMan
      </footer>
    </div>
  );
}

export { getDisplayFontClass, isRomantic, isBold };
