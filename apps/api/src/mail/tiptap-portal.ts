import { VARIABLE_FALLBACKS } from '../templates/default-templates';
import type { EmailContext } from './mail.service';

interface TiptapNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  content?: TiptapNode[];
}

const VAR_PATTERN = /\{\{(\w+)\}\}/g;

function resolveVar(key: string, context: EmailContext): string {
  return String(context[key as keyof EmailContext] || VARIABLE_FALLBACKS[key] || '');
}

// Walk the Tiptap JSON tree and replace variable chip nodes with plain text nodes.
// Also substitutes {{varName}} placeholders in text nodes as a fallback for templates
// stored with literal placeholder text rather than structured variable nodes.
// Returns a new tree — does not mutate the input.
export function substituteTiptapVariables(
  node: unknown,
  context: EmailContext,
): unknown {
  const n = node as TiptapNode;

  if (n.type === 'variable') {
    const key = String(n.attrs?.name ?? '');
    return { type: 'text', text: resolveVar(key, context) };
  }

  if (n.type === 'text' && n.text && VAR_PATTERN.test(n.text)) {
    return { ...n, text: n.text.replace(VAR_PATTERN, (_, key) => resolveVar(key, context)) };
  }

  if (n.content) {
    return { ...n, content: n.content.map((child) => substituteTiptapVariables(child, context)) };
  }

  return n;
}
