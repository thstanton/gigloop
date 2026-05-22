import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';

function LineItemsPlaceholder(_: NodeViewProps) {
  return (
    <NodeViewWrapper>
      <div
        className="my-2 rounded border border-dashed border-border bg-surface px-4 py-4 text-center text-sm text-muted select-none"
        contentEditable={false}
      >
        Line items table
      </div>
    </NodeViewWrapper>
  );
}

export const LineItemsNode = Node.create({
  name: 'lineItems',
  group: 'block',
  atom: true,

  parseHTML() {
    return [{ tag: 'div[data-line-items]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-line-items': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(LineItemsPlaceholder);
  },
});
