import { VARIABLE_FALLBACKS } from '../templates/default-templates';
import type { EmailContext } from './mail.service';

interface TiptapNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  content?: TiptapNode[];
}

// Walk the Tiptap JSON tree and replace variable chip nodes with plain text nodes.
// Returns a new tree — does not mutate the input.
export function substituteTiptapVariables(
  node: unknown,
  context: EmailContext,
): unknown {
  const n = node as TiptapNode;

  if (n.type === 'variable') {
    const key = String(n.attrs?.name ?? '');
    const value = context[key as keyof EmailContext] || VARIABLE_FALLBACKS[key] || '';
    return { type: 'text', text: value };
  }

  if (n.content) {
    return { ...n, content: n.content.map((child) => substituteTiptapVariables(child, context)) };
  }

  return n;
}
