import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveAppearance, variantForPathname } from './appearance';
import { APPEARANCE_STORAGE_KEY } from './hooks/useAppearance';

describe('appearance resolution', () => {
  it.each([
    ['flag off overrides stored dark and OS dark', false, 'dark', true, '/admin', 'light'],
    ['flag off ignores OS dark for System', false, 'system', true, '/admin', 'light'],
    ['admin System follows a light OS setting', true, 'system', false, '/admin', 'light'],
    ['admin System follows a dark OS setting', true, 'system', true, '/admin', 'dark'],
    ['admin Light overrides a dark OS setting', true, 'light', true, '/admin/bookings', 'light'],
    ['admin Dark overrides a light OS setting', true, 'dark', false, '/admin/settings', 'dark'],
    ['onboarding is an admin surface', true, 'dark', false, '/onboarding/profile', 'dark'],
    ['client portal stays light with Dark stored', true, 'dark', true, '/booking/token', 'light'],
    ['band portal stays light with Dark stored', true, 'dark', true, '/band/token', 'light'],
    ['public routes stay light with Dark stored', true, 'dark', true, '/sign-in', 'light'],
  ] as const)('%s', (_description, enabled, preference, systemDark, pathname, expected) => {
    expect(resolveAppearance({ enabled, preference, systemDark, pathname })).toBe(expected);
  });
});

describe('variantForPathname', () => {
  it.each([
    ['/', 'default'],
    ['/sign-in', 'default'],
    ['/admin', 'admin'],
    ['/admin/bookings/123', 'admin'],
    ['/admin/portal-preview', 'admin'],
    ['/onboarding/portal', 'admin'],
    ['/booking/token', 'portal'],
    ['/booking/token/contract', 'portal'],
    ['/band/token', 'portal'],
  ] as const)('%s → %s', (pathname, expected) => {
    expect(variantForPathname(pathname)).toBe(expected);
  });
});

describe('the pre-paint bootstrap', () => {
  it('runs before the app and mirrors the appearance inputs and route classification', () => {
    const html = readFileSync(`${process.cwd()}/index.html`, 'utf8');
    const scriptStart = html.indexOf('<script id="appearance-bootstrap">');
    const scriptContentStart = html.indexOf('>', scriptStart) + 1;
    const scriptEnd = html.indexOf('</script>', scriptContentStart);
    const script = html.slice(scriptContentStart, scriptEnd);
    const moduleEntry = html.indexOf('<script type="module"');

    expect(scriptStart).toBeGreaterThanOrEqual(0);
    expect(scriptEnd).toBeGreaterThan(scriptContentStart);
    expect(scriptStart).toBeLessThan(moduleEntry);
    expect(html).toContain('data-appearance-enabled="%VITE_FEATURE_APPEARANCE%"');
    expect(html).toContain(`data-appearance-storage-key="${APPEARANCE_STORAGE_KEY}"`);
    expect(script).toContain('window.localStorage.getItem(root.dataset.appearanceStorageKey');
    expect(script).toContain("pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/onboarding/')");
    expect(script).toContain("pathname.startsWith('/booking/') || pathname.startsWith('/band/')");
    expect(script).toContain("window.matchMedia('(prefers-color-scheme: dark)').matches");
    expect(script).toContain("root.classList.toggle('dark', dark)");
  });

  it('redeclares every light token inside portal preview scope', () => {
    const rootCss = readFileSync(`${process.cwd()}/src/styles/globals.css`, 'utf8');
    const scopeCss = readFileSync(`${process.cwd()}/src/features/portal/portal-preview-light-scope.css`, 'utf8');
    const block = (css: string, selector: string) => {
      const selectorStart = css.indexOf(selector);
      const open = css.indexOf('{', selectorStart);
      const close = css.indexOf('}', open);
      return selectorStart < 0 || open < 0 || close < 0 ? '' : css.slice(open + 1, close);
    };
    const rootBlock = block(rootCss, ':root');
    const scopeBlock = block(scopeCss, '.portal-preview-light-scope');
    expect(rootBlock).not.toBe('');
    expect(scopeBlock).not.toBe('');

    const tokens = (cssBlock: string) => Object.fromEntries(cssBlock.split('\n').flatMap((line) => {
      const declaration = line.trim();
      if (!declaration.startsWith('--')) return [];
      const colon = declaration.indexOf(':');
      const semicolon = declaration.indexOf(';', colon);
      if (colon < 0 || semicolon < 0) return [];
      return [[declaration.slice(2, colon), declaration.slice(colon + 1, semicolon).trim()]];
    }));
    const lightTokens = tokens(rootBlock);
    const scopedTokens = tokens(scopeBlock);
    expect(scopedTokens).toMatchObject(lightTokens);
  });
});
