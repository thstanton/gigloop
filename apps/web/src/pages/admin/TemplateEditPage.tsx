import { useState, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link_ from '@tiptap/extension-link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon,
  List, ListOrdered, ChevronLeft, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTemplate } from '@/lib/hooks/useTemplate';
import { apiPatch, apiPost } from '@/lib/api';
import { VariableNode } from '@/features/templates/VariableNode';
import {
  TEMPLATE_DISPLAY,
  TEMPLATE_VARIABLES,
} from '@/features/templates/templateMeta';
import { cn } from '@/lib/utils';
import type { BuiltInTemplateType, Template } from '@/types/api';

// ─── Toolbar ─────────────────────────────────────────────────────────────────

function ToolbarButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      disabled={disabled}
      className={cn(
        'p-1.5 rounded transition-colors',
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted hover:text-foreground hover:bg-surface',
        disabled && 'opacity-40 cursor-not-allowed',
      )}
    >
      {children}
    </button>
  );
}

function EditorToolbar({
  editor,
  variables,
}: {
  editor: ReturnType<typeof useEditor>;
  variables: { name: string; label: string }[];
}) {
  if (!editor) return null;

  function insertLink() {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL', prev ?? 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }

  function insertVariable(name: string, label: string) {
    editor.chain().focus().insertContent({ type: 'variable', attrs: { name, label } }).run();
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border bg-surface rounded-t-md">
      <ToolbarButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold size={14} />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic size={14} />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon size={14} />
      </ToolbarButton>

      <div className="w-px h-4 bg-border mx-1" />

      <ToolbarButton active={editor.isActive('link')} onClick={insertLink}>
        <LinkIcon size={14} />
      </ToolbarButton>

      <div className="w-px h-4 bg-border mx-1" />

      <ToolbarButton active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List size={14} />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered size={14} />
      </ToolbarButton>

      {variables.length > 0 && (
        <>
          <div className="w-px h-4 bg-border mx-1" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-muted hover:text-foreground hover:bg-background transition-colors"
              >
                Insert variable
                <ChevronDown size={10} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {variables.map((v) => (
                <DropdownMenuItem
                  key={v.name}
                  onSelect={() => insertVariable(v.name, v.label)}
                  className="text-sm"
                >
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary mr-2">
                    {v.label}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  );
}

// ─── Inner edit form (rendered once template has loaded) ──────────────────────

function TemplateEditor({ template }: { template: Template }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [resetConfirm, setResetConfirm] = useState(false);
  const [saved, setSaved] = useState(false);

  const builtInType = template.builtInType as BuiltInTemplateType | null;
  const meta = builtInType ? TEMPLATE_DISPLAY[builtInType] : null;
  const variables = builtInType ? TEMPLATE_VARIABLES[builtInType] : [];

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        blockquote: false,
        strike: false,
        horizontalRule: false,
      }),
      Underline,
      Link_.configure({ openOnClick: false }),
      VariableNode,
    ],
    content: template.content as Record<string, unknown>,
    editorProps: {
      attributes: {
        class: 'tiptap-content text-sm text-foreground min-h-[240px] px-4 py-3 focus:outline-none',
      },
    },
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      apiPatch<Template>(`/templates/${template.id}`, { content: editor?.getJSON() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template', template.id] });
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => apiPost<Template>(`/templates/${template.id}/reset`, {}),
    onSuccess: (updated) => {
      editor?.commands.setContent(updated.content as Record<string, unknown>);
      queryClient.invalidateQueries({ queryKey: ['template', template.id] });
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setResetConfirm(false);
    },
  });

  const handleSave = useCallback(() => {
    saveMutation.mutate();
  }, [saveMutation]);

  return (
    <div className="px-4 md:px-6 py-6 max-w-2xl">
      <Link
        to="/admin/templates"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors mb-6"
      >
        <ChevronLeft size={14} />
        Templates
      </Link>

      <h1 className="text-2xl font-semibold text-foreground mb-1">
        {meta?.name ?? template.builtInType}
      </h1>
      {meta && (
        <p className="text-sm text-muted mb-6">{meta.description}</p>
      )}

      {/* Editor */}
      <div className="border border-border rounded-md mb-6">
        <EditorToolbar editor={editor} variables={variables} />
        <EditorContent editor={editor} />
      </div>

      {saveMutation.isError && (
        <p className="text-sm text-status-cancelled mb-4">Failed to save. Please try again.</p>
      )}

      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Saving…' : saved ? 'Saved' : 'Save changes'}
        </Button>
        <Button variant="outline" onClick={() => navigate('/admin/templates')}>
          Cancel
        </Button>
      </div>

      {/* Reset to default */}
      {builtInType && (
        <div className="mt-6 pt-6 border-t border-border">
          {resetConfirm ? (
            <div className="space-y-2">
              <p className="text-sm text-muted">
                This will replace your changes with the original template. This cannot be undone.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="text-status-cancelled border-status-cancelled hover:bg-status-cancelled/8"
                disabled={resetMutation.isPending}
                onClick={() => resetMutation.mutate()}
              >
                {resetMutation.isPending ? 'Resetting…' : 'Confirm reset'}
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="text-status-cancelled border-status-cancelled hover:bg-status-cancelled/8"
              onClick={() => setResetConfirm(true)}
            >
              Reset to default
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TemplateEditPage() {
  const { id } = useParams<{ id: string }>();
  const { data: template, isLoading, isError } = useTemplate(id!);

  if (isLoading) {
    return (
      <div className="px-4 md:px-6 py-6 max-w-2xl animate-pulse space-y-4">
        <div className="h-3.5 w-20 bg-border rounded" />
        <div className="h-7 w-56 bg-border rounded" />
        <div className="h-3 w-72 bg-border rounded" />
        <div className="h-64 bg-border rounded-md" />
      </div>
    );
  }

  if (isError || !template) {
    return (
      <div className="px-4 md:px-6 py-6">
        <p className="text-sm text-muted">Template not found.</p>
        <Link to="/admin/templates" className="text-sm text-primary underline underline-offset-2 mt-2 block">
          Back to templates
        </Link>
      </div>
    );
  }

  return <TemplateEditor key={template.id} template={template} />;
}
