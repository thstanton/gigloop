import { useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link_ from '@tiptap/extension-link';
import {
  Bold, Italic, Underline as UnderlineIcon,
  List, ListOrdered, Heading2,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { VariableNode } from '@/features/templates/VariableNode';
import { apiPatch } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Contract } from '@/types/api';

// ─── Toolbar ─────────────────────────────────────────────────────────────────

function ToolbarBtn({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={cn(
        'p-1.5 rounded transition-colors',
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted hover:text-foreground hover:bg-muted/40',
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;
  return (
    <div className="flex items-center gap-0.5 px-3 py-2 border-b border-border flex-wrap">
      <ToolbarBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold size={14} />
      </ToolbarBtn>
      <ToolbarBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic size={14} />
      </ToolbarBtn>
      <ToolbarBtn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon size={14} />
      </ToolbarBtn>
      <div className="w-px h-4 bg-border mx-1" />
      <ToolbarBtn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 size={14} />
      </ToolbarBtn>
      <div className="w-px h-4 bg-border mx-1" />
      <ToolbarBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List size={14} />
      </ToolbarBtn>
      <ToolbarBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered size={14} />
      </ToolbarBtn>
    </div>
  );
}

// ─── Sheet ────────────────────────────────────────────────────────────────────

interface Props {
  bookingId: string;
  contract: Contract | null;
  readOnly: boolean;
  open: boolean;
  onClose: () => void;
}

export default function ContractSheet({ bookingId, contract, readOnly, open, onClose }: Props) {
  const queryClient = useQueryClient();
  const content = contract?.content ?? null;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false, code: false }),
      Underline,
      Link_.configure({ openOnClick: false }),
      VariableNode,
    ],
    content: content as Record<string, unknown> | undefined,
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: cn(
          'tiptap-content focus:outline-none min-h-[200px] text-sm',
          readOnly && 'cursor-default select-text',
        ),
      },
    },
  });

  // Sync content and editable when sheet opens or props change
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly);
    if (content != null) {
      editor.commands.setContent(content as Record<string, unknown>);
    }
  }, [editor, content, readOnly]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiPatch(`/bookings/${bookingId}/contracts/${contract!.id}`, { content: editor?.getJSON() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      onClose();
    },
  });

  const handleSave = useCallback(() => {
    saveMutation.mutate();
  }, [saveMutation]);

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <SheetTitle>{readOnly ? 'Contract preview' : 'Edit contract'}</SheetTitle>
        </SheetHeader>

        {!readOnly && <Toolbar editor={editor} />}

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <EditorContent editor={editor} />
        </div>

        {!readOnly && (
          <div className="px-6 py-4 border-t border-border shrink-0 flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} disabled={saveMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
