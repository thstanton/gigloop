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

// The single variable-resolution point shared by both substitution surfaces
// (rich-text body via the tree, and plain-string subject) so the fallback
// catalogue and missing-variable semantics can never drift between them.
// Resolution is escape-agnostic — escaping is the renderer's job, not this
// function's — which is why the subject path can safely reuse it.
// `missing` (optional): a key is recorded when the *raw* context value is falsy,
// before the fallback is applied (an empty bookingDate reports missing *and*
// renders "your event"). The Set dedups; callers that pass none opt out.
export function resolveVar(key: string, context: EmailContext, missing?: Set<string>): string {
  const raw = context[key as keyof EmailContext];
  if (!raw) missing?.add(key);
  return String(raw || VARIABLE_FALLBACKS[key] || '');
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
  missing?: Set<string>,
): unknown {
  const n = node as TiptapNode;

  if (n.type === 'variable') {
    const key = String(n.attrs?.name ?? '');
    const nodes = valueToNodes(resolveVar(key, context, missing));
    return nodes.length === 1 ? nodes[0] : nodes;
  }

  if (n.type === 'text' && n.text && VAR_PATTERN.test(n.text)) {
    const substituted = n.text.replace(VAR_PATTERN, (_, key) => resolveVar(key, context, missing));
    const nodes = valueToNodes(substituted, n);
    return nodes.length === 1 ? nodes[0] : nodes;
  }

  if (n.content) {
    return {
      ...n,
      content: n.content.flatMap((child) => {
        const result = substituteTiptapVariables(child, context, missing);
        return Array.isArray(result) ? result : [result];
      }),
    };
  }

  return n;
}
