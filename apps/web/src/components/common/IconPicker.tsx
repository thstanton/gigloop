import { cn } from '@/lib/utils';
import { PACKAGE_ICON_OPTIONS } from '@/lib/constants';
import { PackageIcon } from './PackageIcon';

/**
 * Grid of selectable package icons. Used wherever a package/format icon is
 * chosen — package templates and per-booking Package re-iconing. Pass
 * `label={null}` to render the grid bare (e.g. inside a compact popover).
 */
export function IconPicker({
  value,
  onChange,
  label = 'Icon',
}: {
  value: string;
  onChange: (icon: string) => void;
  label?: string | null;
}) {
  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-foreground mb-2">{label}</label>
      )}
      <div className="flex flex-wrap gap-2">
        {PACKAGE_ICON_OPTIONS.map((icon) => (
          <button
            key={icon}
            type="button"
            onClick={() => onChange(icon)}
            className={cn(
              'w-9 h-9 flex items-center justify-center rounded border transition-colors',
              value === icon
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-surface text-muted hover:text-foreground',
            )}
            aria-label={icon}
            title={icon}
          >
            <PackageIcon icon={icon} size={18} strokeWidth={1.75} />
          </button>
        ))}
      </div>
    </div>
  );
}
