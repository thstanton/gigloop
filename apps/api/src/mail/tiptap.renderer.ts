interface TiptapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

interface TiptapNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: TiptapMark[];
  content?: TiptapNode[];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderChildren(node: TiptapNode): string {
  return (node.content ?? []).map(renderNode).join('');
}

function applyMarks(html: string, marks: TiptapMark[]): string {
  return marks.reduce((acc, mark) => {
    switch (mark.type) {
      case 'bold': return `<strong>${acc}</strong>`;
      case 'italic': return `<em>${acc}</em>`;
      case 'underline': return `<u>${acc}</u>`;
      case 'strike': return `<s>${acc}</s>`;
      case 'code': return `<code>${acc}</code>`;
      case 'link': {
        const rawHref = String(mark.attrs?.href ?? '');
        const safeHref = /^https?:|^mailto:/i.test(rawHref) ? escapeHtml(rawHref) : '#';
        return `<a href="${safeHref}">${acc}</a>`;
      }
      default: return acc;
    }
  }, html);
}

function renderNode(node: TiptapNode): string {
  switch (node.type) {
    case 'doc':
      return renderChildren(node);

    case 'paragraph':
      return `<p>${renderChildren(node)}</p>`;

    case 'heading': {
      const level = Number(node.attrs?.level ?? 1);
      return `<h${level}>${renderChildren(node)}</h${level}>`;
    }

    case 'text': {
      const escaped = escapeHtml(node.text ?? '');
      return node.marks?.length ? applyMarks(escaped, node.marks) : escaped;
    }

    case 'hardBreak':
      return '<br>';

    case 'horizontalRule':
      return '<hr>';

    case 'blockquote':
      return `<blockquote>${renderChildren(node)}</blockquote>`;

    case 'bulletList':
      return `<ul>${renderChildren(node)}</ul>`;

    case 'orderedList':
      return `<ol>${renderChildren(node)}</ol>`;

    case 'listItem':
      return `<li>${renderChildren(node)}</li>`;

    case 'codeBlock':
      return `<pre><code>${renderChildren(node)}</code></pre>`;

    case 'variable':
      return `{{${node.attrs?.name ?? ''}}}`;

    case 'lineItems':
      return '{{LINE_ITEMS}}';

    default:
      return renderChildren(node);
  }
}

export function renderTiptap(doc: unknown): string {
  return renderNode(doc as TiptapNode);
}
