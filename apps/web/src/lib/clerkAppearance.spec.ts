import { describe, it, expect } from 'vitest';
import { buildClerkAppearance, readRootToken } from './clerkAppearance';

// Shape, never values: every colour is derived from whatever the token reader returns, so a
// restated literal in the builder would show up as a value the reader never produced.
describe('buildClerkAppearance', () => {
  const read = (name: string) => `T${name}`;
  const appearance = buildClerkAppearance(read);

  it('derives every colour from a declared token', () => {
    const colours = [
      ...Object.entries(appearance.variables).filter(([key]) => key.startsWith('color')),
      ['card.backgroundColor', appearance.elements.card.backgroundColor],
      ['card.border', appearance.elements.card.border],
    ];
    for (const [key, value] of colours) {
      expect(String(value), key).toMatch(/hsl\(T--[a-z-]+\)/);
    }
  });

  it('follows the reader, so a dark palette flows through', () => {
    const dark = buildClerkAppearance(() => 'DARK');
    expect(dark.variables.colorPrimary).toBe('hsl(DARK)');
    expect(dark.elements.card.backgroundColor).toBe('hsl(DARK)');
  });

  it('hands Clerk comma-separated components, as the old literals were', () => {
    const triplet = buildClerkAppearance(() => '152 45% 25%');
    expect(triplet.variables.colorPrimary).toBe('hsl(152, 45%, 25%)');
  });
});

describe('readRootToken', () => {
  it('reads and trims a custom property from the document root', () => {
    document.documentElement.style.setProperty('--probe', ' 1 2% 3% ');
    expect(readRootToken('--probe')).toBe('1 2% 3%');
    document.documentElement.style.removeProperty('--probe');
  });
});
