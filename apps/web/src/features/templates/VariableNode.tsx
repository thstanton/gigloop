import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';

function VariableChip({ node }: NodeViewProps) {
  return (
    <NodeViewWrapper as="span" className="contents">
      <span
        className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary mx-0.5 select-none cursor-default"
        contentEditable={false}
      >
        {(node.attrs.label as string) ?? (node.attrs.name as string)}
      </span>
    </NodeViewWrapper>
  );
}

export const VariableNode = Node.create({
  name: 'variable',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      name: { default: null },
      label: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-variable]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { 'data-variable': node.attrs.name }),
      node.attrs.label ?? node.attrs.name,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VariableChip);
  },
});
