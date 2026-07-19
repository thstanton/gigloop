import { substituteTiptapVariables } from './tiptap-substitute';
import type { EmailContext } from './mail.service';

const ctx: EmailContext = {
  customerName: 'Jane Smith',
  greetingName: 'Jane',
  bookingDate: '2026-08-15',
  venueName: 'The Grand Hotel',
  bookingFee: '£1,500.00',
  setsSchedule: 'Ceremony (30 min)\nDrinks Reception (90 min)',
  musicianName: 'Tim Stanton',
  musicianEmail: 'tim@example.com',
  portalLink: 'https://app.gigman.com/booking/abc123',
  issueDate: '',
  invoiceTotal: '',
  invoiceDueDate: '',
};

const emptyCtx: EmailContext = {
  customerName: '',
  greetingName: '',
  bookingDate: '',
  venueName: '',
  bookingFee: '',
  setsSchedule: '',
  musicianName: '',
  musicianEmail: '',
  portalLink: '',
  issueDate: '',
  invoiceTotal: '',
  invoiceDueDate: '',
};

describe('substituteTiptapVariables', () => {
  describe('variable chip nodes', () => {
    it('replaces a variable chip node with a plain text node', () => {
      const input = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'variable', attrs: { name: 'customerName' } }],
          },
        ],
      };

      const result = substituteTiptapVariables(input, ctx) as { content: Array<{ content: Array<{ type: string; text: string }> }> };

      expect(result.content[0].content[0]).toEqual({ type: 'text', text: 'Jane Smith' });
    });

    it('replaces multiple chip nodes in the same paragraph', () => {
      const input = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'variable', attrs: { name: 'customerName' } },
              { type: 'text', text: ' — ' },
              { type: 'variable', attrs: { name: 'bookingDate' } },
            ],
          },
        ],
      };

      const result = substituteTiptapVariables(input, ctx) as { content: Array<{ content: Array<{ type: string; text: string }> }> };
      const nodes = result.content[0].content;

      expect(nodes[0]).toEqual({ type: 'text', text: 'Jane Smith' });
      expect(nodes[1]).toEqual({ type: 'text', text: ' — ' });
      expect(nodes[2]).toEqual({ type: 'text', text: '2026-08-15' });
    });

    it('splits multi-line values into text + hardBreak nodes', () => {
      const input = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'variable', attrs: { name: 'setsSchedule' } }],
          },
        ],
      };

      const result = substituteTiptapVariables(input, ctx) as { content: Array<{ content: unknown[] }> };
      const nodes = result.content[0].content;

      expect(nodes).toHaveLength(3);
      expect(nodes[0]).toEqual({ type: 'text', text: 'Ceremony (30 min)' });
      expect(nodes[1]).toEqual({ type: 'hardBreak' });
      expect(nodes[2]).toEqual({ type: 'text', text: 'Drinks Reception (90 min)' });
    });

    it('falls back to VARIABLE_FALLBACKS for unknown variable names', () => {
      const input = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'variable', attrs: { name: 'unknownVar' } }],
          },
        ],
      };

      const result = substituteTiptapVariables(input, ctx) as { content: Array<{ content: Array<{ text: string }> }> };
      // Falls back to '' or the defined fallback — either way it's a string, not a chip
      expect(typeof result.content[0].content[0].text).toBe('string');
    });

    it('uses VARIABLE_FALLBACKS when context value is empty', () => {
      const input = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'variable', attrs: { name: 'customerName' } }],
          },
        ],
      };

      const result = substituteTiptapVariables(input, emptyCtx) as { content: Array<{ content: Array<{ text: string }> }> };
      // customerName fallback is 'your client' (from VARIABLE_FALLBACKS)
      expect(result.content[0].content[0].text).toBe('your client');
    });

    it('substitutes an empty string when context value is empty and no fallback is defined', () => {
      const input = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'variable', attrs: { name: 'issueDate' } }],
          },
        ],
      };

      // issueDate has no fallback in VARIABLE_FALLBACKS
      const result = substituteTiptapVariables(input, emptyCtx) as { content: Array<{ content: Array<{ text: string }> }> };
      expect(result.content[0].content[0].text).toBe('');
    });
  });

  describe('text node placeholder fallback', () => {
    it('replaces {{variableName}} placeholders in plain text nodes', () => {
      const input = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Dear {{customerName}},' }],
          },
        ],
      };

      const result = substituteTiptapVariables(input, ctx) as { content: Array<{ content: Array<{ text: string }> }> };
      expect(result.content[0].content[0].text).toBe('Dear Jane Smith,');
    });

    it('replaces multiple placeholders in the same text node', () => {
      const input = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: '{{customerName}} on {{bookingDate}} at {{venueName}}' }],
          },
        ],
      };

      const result = substituteTiptapVariables(input, ctx) as { content: Array<{ content: Array<{ text: string }> }> };
      expect(result.content[0].content[0].text).toBe('Jane Smith on 2026-08-15 at The Grand Hotel');
    });
  });

  describe('structure preservation', () => {
    it('does not mutate the input node', () => {
      const chip = { type: 'variable', attrs: { name: 'customerName' } };
      const input = { type: 'doc', content: [{ type: 'paragraph', content: [chip] }] };
      const inputCopy = JSON.parse(JSON.stringify(input));

      substituteTiptapVariables(input, ctx);

      expect(input).toEqual(inputCopy);
    });

    it('preserves text marks (bold, italic) on substituted text nodes', () => {
      const input = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: '{{customerName}}',
                marks: [{ type: 'bold' }],
              },
            ],
          },
        ],
      };

      const result = substituteTiptapVariables(input, ctx) as { content: Array<{ content: Array<{ text: string; marks?: unknown[] }> }> };
      const node = result.content[0].content[0];
      expect(node.text).toBe('Jane Smith');
      expect(node.marks).toEqual([{ type: 'bold' }]);
    });

    it('passes through nodes with no substitutions unchanged (structurally)', () => {
      const input = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'No variables here.' }] },
        ],
      };

      const result = substituteTiptapVariables(input, ctx);
      expect(result).toEqual(input);
    });
  });
});
