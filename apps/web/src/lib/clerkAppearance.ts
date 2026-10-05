// Clerk's hosted UI renders its own surfaces, so it cannot read our Tailwind classes. Its
// colours are derived from the declared CSS tokens (globals.css) at the moment the resolved
// appearance changes — never restated as literals, so the palette stays declared once (ADR-0085).

type TokenReader = (name: string) => string;

// Tokens are bare space-separated triplets ("152 45% 25%"); Clerk is handed the comma form it
// always received, so its colour parsing (hover/shade derivation) sees the same shape as before.
const hsl = (token: string, read: TokenReader) => `hsl(${read(token).trim().split(/\s+/).join(', ')})`;

export function buildClerkAppearance(read: TokenReader) {
  const background = hsl('--background', read);
  return {
    variables: {
      colorPrimary: hsl('--primary', read),
      colorBackground: background,
      colorInputBackground: hsl('--surface', read),
      colorText: hsl('--foreground', read),
      colorTextSecondary: hsl('--muted', read),
      borderRadius: '0.25rem',
      fontFamily: "'Commissioner', sans-serif",
    },
    elements: {
      card: {
        backgroundColor: background,
        boxShadow: 'none',
        border: `1px solid ${hsl('--border', read)}`,
      },
      headerTitle: {
        fontFamily: "'Playfair Display', serif",
      },
      formButtonPrimary: {
        boxShadow: 'none',
      },
    },
  };
}

/** Reads the token values currently in force on the document root (`.dark` included). */
export function readRootToken(name: string): string {
  return window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
