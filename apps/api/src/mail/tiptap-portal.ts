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

function valueToNodes(value: string, base?: TiptapNode): TiptapNode[] {
  if (!value.includes('\n')) return [base ? { ...base, text: value } : { type: 'text', text: value }];
  return value.split('\n').flatMap((part, i, arr) => {
    const nodes: TiptapNode[] = [];
    if (part) nodes.push(base ? { ...base, text: part } : { type: 'text', text: part });
    if (i < arr.length - 1) nodes.push({ type: 'hardBreak' });
    return nodes;
  });
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
    const nodes = valueToNodes(resolveVar(key, context));
    return nodes.length === 1 ? nodes[0] : nodes;
  }

  if (n.type === 'text' && n.text && VAR_PATTERN.test(n.text)) {
    const substituted = n.text.replace(VAR_PATTERN, (_, key) => resolveVar(key, context));
    const nodes = valueToNodes(substituted, n);
    return nodes.length === 1 ? nodes[0] : nodes;
  }

  if (n.content) {
    return {
      ...n,
      content: n.content.flatMap((child) => {
        const result = substituteTiptapVariables(child, context);
        return Array.isArray(result) ? result : [result];
      }),
    };
  }

  return n;
}
