import { Link } from 'react-router-dom';
import { ChevronRight, FileText } from 'lucide-react';
import { useTemplates } from '@/lib/hooks/useTemplates';
import { BUILT_IN_EMAIL_TYPES, TEMPLATE_DISPLAY } from '@/features/templates/templateMeta';
import type { Template } from '@/types/api';

function TemplateSkeleton() {
  return (
    <div className="animate-pulse border-t border-border">
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div key={i} className="flex items-center gap-3 py-4 border-b border-border">
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-44 bg-border rounded" />
            <div className="h-3 w-64 bg-border rounded" />
          </div>
          <div className="h-3.5 w-8 bg-border rounded" />
        </div>
      ))}
    </div>
  );
}

function TemplateRow({ template }: { template: Template }) {
  if (!template.builtInType) return null;
  const meta = TEMPLATE_DISPLAY[template.builtInType];
  return (
    <Link
      to={`/admin/templates/${template.id}/edit`}
      className="flex items-center gap-3 py-4 border-b border-border group"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
          {meta.name}
        </p>
        <p className="text-xs text-muted mt-0.5">{meta.description}</p>
      </div>
      <ChevronRight size={16} className="text-muted flex-shrink-0 group-hover:text-primary transition-colors" />
    </Link>
  );
}

export default function TemplatesListPage() {
  const { data: templates = [], isLoading } = useTemplates();

  const emailTemplates = templates.filter(
    (t) => t.builtInType && BUILT_IN_EMAIL_TYPES.includes(t.builtInType),
  );

  // Preserve the canonical display order
  const ordered = BUILT_IN_EMAIL_TYPES
    .map((type) => emailTemplates.find((t) => t.builtInType === type))
    .filter((t): t is Template => !!t);

  return (
    <div className="px-4 md:px-6 py-6 max-w-2xl">
      <h1 className="text-2xl font-semibold text-foreground mb-6">Templates</h1>

      <section>
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">
          Email templates
        </h2>
        {isLoading ? (
          <TemplateSkeleton />
        ) : ordered.length === 0 ? (
          <div className="py-12 text-center">
            <FileText size={32} className="text-muted mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm text-muted">No templates found.</p>
          </div>
        ) : (
          <div className="border-t border-border">
            {ordered.map((t) => <TemplateRow key={t.id} template={t} />)}
          </div>
        )}
      </section>
    </div>
  );
}
