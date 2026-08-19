import {
  ALL_BUILT_IN_TYPES,
  BUILT_IN_EMAIL_TYPES,
  BUILT_IN_NAMES,
  TEMPLATE_DEFAULT_SUBJECTS,
  getDefaultContent,
} from './default-templates';

type TNode = { type?: string; text?: string; attrs?: Record<string, unknown>; content?: TNode[] };

function walk(node: TNode, visit: (n: TNode) => void): void {
  visit(node);
  for (const child of node.content ?? []) walk(child, visit);
}

function textOf(content: Record<string, unknown>): string {
  const parts: string[] = [];
  walk(content as TNode, (n) => {
    if (n.type === 'text' && n.text) parts.push(n.text);
  });
  return parts.join(' ');
}

function variableNamesOf(content: Record<string, unknown>): string[] {
  const names: string[] = [];
  walk(content as TNode, (n) => {
    if (n.type === 'variable') names.push(String(n.attrs?.name ?? ''));
  });
  return names;
}

describe('default templates', () => {
  it('gives every built-in type a non-empty display name', () => {
    for (const type of ALL_BUILT_IN_TYPES) {
      expect(BUILT_IN_NAMES[type].length).toBeGreaterThan(0);
    }
  });

  // getDefaultContent falls back to a single blank paragraph for a type with no entry, so
  // "has some content" would pass green for a half-added type. Assert real copy instead.
  it('gives every built-in type a default body with actual text and variables', () => {
    for (const type of ALL_BUILT_IN_TYPES) {
      const content = getDefaultContent(type);
      expect(textOf(content).trim().length).toBeGreaterThan(0);
      expect(variableNamesOf(content).length).toBeGreaterThan(0);
    }
  });

  // ─── series_invoice_cover copy constraints (#846) ────────────────────────────
  // A series invoice is billed to the series, not a booking: the deposit/balance axis
  // is booking-only (CONTEXT.md) and there is no single event date. These are the
  // constraints a future copy edit could silently break, so they are asserted on the
  // template's *shape* rather than by restating its wording.

  describe('series_invoice_cover', () => {
    const content = getDefaultContent('series_invoice_cover');

    it('is a built-in email type with a default subject', () => {
      expect(BUILT_IN_EMAIL_TYPES).toContain('series_invoice_cover');
      expect(TEMPLATE_DEFAULT_SUBJECTS['series_invoice_cover']).toBeTruthy();
    });

    it('names the series and the dates it covers', () => {
      const names = variableNamesOf(content);
      expect(names).toContain('seriesLabel');
      expect(names).toContain('datesCovered');
    });

    it('never frames the invoice as a deposit or a balance', () => {
      expect(textOf(content)).not.toMatch(/deposit|balance/i);
      expect(TEMPLATE_DEFAULT_SUBJECTS['series_invoice_cover']).not.toMatch(/deposit|balance/i);
    });

    it('never reaches for a singular booking date', () => {
      expect(variableNamesOf(content)).not.toContain('bookingDate');
      expect(textOf(content)).not.toContain('{{bookingDate}}');
      expect(TEMPLATE_DEFAULT_SUBJECTS['series_invoice_cover']).not.toContain('{{bookingDate}}');
    });
  });
});
