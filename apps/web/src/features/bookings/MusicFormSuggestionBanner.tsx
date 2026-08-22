import { Button } from '@/components/ui/button';
import type { MusicFormSuggestion } from '@/types/api';

// The "this package suggests X special requests and Y genres" banner shown
// after accepting/applying a package template with a music-form suggestion.
// Split out of TemplatesSection so its own singular/plural text branching
// doesn't inflate that component's cyclomatic complexity.
export function MusicFormSuggestionBanner({
  suggestion,
  onAccept,
  onDismiss,
  isAccepting,
}: {
  suggestion: MusicFormSuggestion;
  onAccept: () => void;
  onDismiss: () => void;
  isAccepting: boolean;
}) {
  const hasKeyMoments = suggestion.keyMoments.length > 0;
  const hasGenres = suggestion.genres.length > 0;
  return (
    <div className="mb-4 rounded border border-border bg-primary/5 p-3 space-y-2">
      <p className="text-sm">
        This package suggests{' '}
        {hasKeyMoments && (
          <span className="font-medium">{suggestion.keyMoments.length} special request{suggestion.keyMoments.length === 1 ? '' : 's'}</span>
        )}
        {hasKeyMoments && hasGenres && ' and '}
        {hasGenres && (
          <span className="font-medium">{suggestion.genres.length} genre{suggestion.genres.length === 1 ? '' : 's'}</span>
        )}{' '}
        for the music form.
      </p>
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={onAccept} disabled={isAccepting}>
          {isAccepting ? 'Adding…' : 'Add to music form'}
        </Button>
        <button
          type="button"
          onClick={onDismiss}
          className="text-sm text-muted transition-colors hover:text-foreground"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
