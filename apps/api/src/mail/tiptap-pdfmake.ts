// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfContent = any;

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

function applyMarks(base: PdfContent, marks: TiptapMark[]): PdfContent {
  return marks.reduce((acc: PdfContent, mark) => {
    switch (mark.type) {
      case 'bold': return { ...acc, bold: true };
      case 'italic': return { ...acc, italics: true };
      case 'underline': return { ...acc, decoration: 'underline' };
      case 'strike': return { ...acc, decoration: 'lineThrough' };
      default: return acc;
    }
  }, base);
}

function convertInline(node: TiptapNode): PdfContent {
  if (node.type === 'text') {
    const base: PdfContent = { text: node.text ?? '' };
    return node.marks?.length ? applyMarks(base, node.marks) : base;
  }
  if (node.type === 'hardBreak') return { text: '\n' };
  return { text: '' };
}

function convertInlines(nodes: TiptapNode[]): PdfContent[] {
  return nodes.map(convertInline);
}

function convertNode(node: TiptapNode): PdfContent | PdfContent[] | null {
  switch (node.type) {
    case 'doc':
      return (node.content ?? []).flatMap((child) => {
        const result = convertNode(child);
        return result === null ? [] : Array.isArray(result) ? result : [result];
      });

    case 'paragraph': {
      const inlines = node.content ? convertInlines(node.content) : [];
      const text = inlines.length ? inlines : ' ';
      return { text, margin: [0, 0, 0, 8] };
    }

    case 'heading': {
      const level = Number(node.attrs?.level ?? 2);
      const inlines = node.content ? convertInlines(node.content) : [];
      const fontSize = level === 1 ? 16 : level === 2 ? 13 : 11;
      return { text: inlines, bold: true, fontSize, margin: [0, 12, 0, 6] };
    }

    case 'bulletList':
      return {
        ul: (node.content ?? []).map((item) => {
          const paras = (item.content ?? []).flatMap((child) => {
            const r = convertNode(child);
            return r === null ? [] : Array.isArray(r) ? r : [r];
          });
          return paras.length === 1 ? paras[0] : paras;
        }),
        margin: [0, 0, 0, 8],
      };

    case 'orderedList':
      return {
        ol: (node.content ?? []).map((item) => {
          const paras = (item.content ?? []).flatMap((child) => {
            const r = convertNode(child);
            return r === null ? [] : Array.isArray(r) ? r : [r];
          });
          return paras.length === 1 ? paras[0] : paras;
        }),
        margin: [0, 0, 0, 8],
      };

    case 'blockquote':
      return {
        text: node.content ? convertInlines(node.content as TiptapNode[]) : '',
        margin: [16, 0, 0, 8],
        color: '#555555',
      };

    case 'horizontalRule':
      return { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 487, y2: 0, lineWidth: 0.5, lineColor: '#e5e5e5' }], margin: [0, 8, 0, 8] };

    default:
      return null;
  }
}

export function renderTiptapToPdfmake(doc: unknown): PdfContent[] {
  const result = convertNode(doc as TiptapNode);
  if (!result) return [];
  return Array.isArray(result) ? result : [result];
}
