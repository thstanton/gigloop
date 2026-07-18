import { useRef } from 'react';
import { ImageIcon, Trash2, Upload } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/hooks/use-toast';
import { cn } from '@/lib/utils';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Presentational image-upload control: a thumbnail preview plus Upload / Change /
 * Remove buttons. Fully controlled — the container owns the upload/remove mutations
 * and passes the current URL and pending flags. Shared by Settings and onboarding.
 */
export function ImageUploadField({
  label,
  description,
  currentUrl,
  uploading,
  removing,
  onFileSelect,
  onRemove,
  variant = 'square',
  maxSizeBytes = MAX_UPLOAD_BYTES,
}: {
  label: string;
  description?: string;
  currentUrl: string | null;
  uploading: boolean;
  removing: boolean;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
  variant?: 'square' | 'landscape';
  maxSizeBytes?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  let uploadLabel: string;
  if (uploading) uploadLabel = 'Uploading…';
  else if (currentUrl) uploadLabel = 'Change';
  else uploadLabel = 'Upload';

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {description && <p className="text-xs text-muted">{description}</p>}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'border border-border bg-muted/30 flex items-center justify-center overflow-hidden flex-shrink-0',
            variant === 'landscape' ? 'w-32 h-12 rounded-md' : 'w-12 h-12 rounded-full',
          )}
        >
          {currentUrl ? (
            <img
              src={currentUrl}
              alt={label}
              className={cn(
                variant === 'landscape'
                  ? 'max-w-full max-h-full object-contain p-1'
                  : 'w-full h-full object-cover',
              )}
            />
          ) : (
            <ImageIcon size={18} className="text-muted" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading || removing}
            onClick={() => inputRef.current?.click()}
          >
            <Upload size={14} className="mr-1.5" />
            {uploadLabel}
          </Button>
          {currentUrl && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading || removing}
              onClick={onRemove}
            >
              <Trash2 size={14} className="mr-1.5" />
              {removing ? 'Removing…' : 'Remove'}
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > maxSizeBytes) {
              toast({ title: `File too large — maximum size is ${Math.round(maxSizeBytes / 1024 / 1024)} MB`, variant: 'destructive' });
              e.target.value = '';
              return;
            }
            onFileSelect(file);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
