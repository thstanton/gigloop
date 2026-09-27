interface TiptapNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
}

function renderChildren(node: TiptapNode): string {
  return (node.content ?? []).map(renderNode).join('');
}

function renderList(node: TiptapNode, ordered: boolean): string {
  return (node.content ?? [])
    .map((item, index) => {
      const marker = ordered ? `${index + 1}.` : '•';
      return `${marker} ${renderChildren(item)}`;
    })
    .join('\n');
}

function renderNode(node: TiptapNode): string {
  switch (node.type) {
    case 'doc':
      return (node.content ?? []).map(renderNode).join('\n');
    case 'paragraph':
    case 'heading':
    case 'blockquote':
    case 'listItem':
      return renderChildren(node);
    case 'text':
      return node.text ?? '';
    case 'hardBreak':
      return '\n';
    case 'bulletList':
      return renderList(node, false);
    case 'orderedList':
      return renderList(node, true);
    case 'horizontalRule':
      return '---';
    case 'variable':
      return `{{${node.attrs?.name ?? ''}}}`;
    case 'lineItems':
      return '{{LINE_ITEMS}}';
    default:
      return renderChildren(node);
  }
}

/** Plain-text output adapter for an already-substituted Tiptap tree. */
export function renderTiptapToPlainText(doc: unknown): string {
  return renderNode(doc as TiptapNode);
}
