import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useTemplates } from '@/lib/hooks/useTemplates';
import { BUILT_IN_EMAIL_TYPES, BUILT_IN_DOCUMENT_TYPES, TEMPLATE_DISPLAY } from '@/features/templates/templateMeta';
import type { Template } from '@/types/api';

function TemplateSkeleton({ count }: { count: number }) {
  return (
    <div className="animate-pulse border-t border-border">
      {Array.from({ length: count }).map((_, i) => (
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

function TemplateSection({
  title,
  types,
  templates,
  isLoading,
  skeletonCount,
}: {
  title: string;
  types: typeof BUILT_IN_EMAIL_TYPES;
  templates: Template[];
  isLoading: boolean;
  skeletonCount: number;
}) {
  const ordered = types
    .map((type) => templates.find((t) => t.builtInType === type))
    .filter((t): t is Template => !!t);

  return (
    <section className="mb-8">
      <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">
        {title}
      </h2>
      {isLoading ? (
        <TemplateSkeleton count={skeletonCount} />
      ) : (
        <div className="border-t border-border">
          {ordered.map((t) => <TemplateRow key={t.id} template={t} />)}
        </div>
      )}
    </section>
  );
}

export default function TemplatesListPage() {
  const { data: templates = [], isLoading } = useTemplates();

  return (
    <div className="px-4 md:px-6 py-6 max-w-2xl">
      <h1 className="font-display text-2xl font-semibold text-foreground mb-6">Templates</h1>

      <TemplateSection
        title="Email templates"
        types={BUILT_IN_EMAIL_TYPES}
        templates={templates}
        isLoading={isLoading}
        skeletonCount={9}
      />

      <TemplateSection
        title="Document templates"
        types={BUILT_IN_DOCUMENT_TYPES}
        templates={templates}
        isLoading={isLoading}
        skeletonCount={1}
      />
    </div>
  );
}
