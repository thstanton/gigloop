import { useCallback } from 'react';
import { UserRound } from 'lucide-react';
import { useUser } from '@clerk/react';
import ContactCombobox, { type ComboboxContext } from './ContactCombobox';
import { ApiError } from '@/lib/api';
import { rankContactsForChair, type GeoPoint } from '@/lib/bandMatch';
import { useQueryClient } from '@tanstack/react-query';
import type { Contact } from '@/types/api';

interface PlayerPickerProps {
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  /** The part's free-text role: contacts are ranked by soft role/instrument match against it
   *  (#886, ADR-0072 §4), then by haversine distance to `venue`. A ranking aid, never a filter. */
  partRole: string;
  /** The booking's venue, for proximity ranking. Missing coordinates degrade silently. */
  venue?: GeoPoint | null;
  disabled?: boolean;
}

/**
 * Fill a part with a player. Offers an "Add yourself" row above the list (#1036, ADR-0083) — the
 * musician filling their own vacant part without hand-rolling CRM data entry. It reuses the
 * `isAccountOwner` Contact if one exists, otherwise opens the create sheet prefilled from the
 * signed-in Clerk identity.
 */
export function PlayerPicker({ value, onChange, placeholder, partRole, venue, disabled }: PlayerPickerProps) {
  const { user } = useUser();
  const queryClient = useQueryClient();

  const arrange = useCallback(
    (contacts: Contact[]) => rankContactsForChair(contacts, partRole, venue),
    [partRole, venue],
  );

  // #1036 409 recovery: another tab/double-tap won the race to create the account-owner Contact
  // first. Resolve to the now-existing self-contact rather than surfacing a bare error toast — the
  // musician wanted to be assigned as themselves either way.
  function recoverFromRace(err: unknown, ctx: ComboboxContext) {
    if (!(err instanceof ApiError) || err.status !== 409) return;
    void queryClient.refetchQueries({ queryKey: ['contacts'], exact: true }).then(() => {
      const refreshed = queryClient.getQueryData<Contact[]>(['contacts']) ?? [];
      const existing = refreshed.find((c) => c.isAccountOwner);
      if (existing) ctx.select(existing);
    });
  }

  return (
    <ContactCombobox
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      createRole="BAND_MEMBER"
      createTitle="New band member"
      arrange={arrange}
      topSlot={(ctx) => (
        <button
          type="button"
          role="option"
          aria-selected={false}
          onClick={() => {
            const self = ctx.contacts.find((c) => c.isAccountOwner);
            if (self) {
              ctx.select(self);
              return;
            }
            ctx.startCreate({
              title: 'Add yourself',
              name: user?.fullName ?? '',
              greetingName: user?.firstName ?? '',
              email: user?.primaryEmailAddress?.emailAddress ?? '',
              extraPayload: { isAccountOwner: true },
              onError: recoverFromRace,
            });
          }}
          className="w-full text-left px-3 py-2.5 flex items-center gap-2 text-primary hover:bg-accent transition-colors border-b border-border"
        >
          <UserRound size={14} aria-hidden="true" className="flex-shrink-0" />
          <span className="text-sm">Add yourself</span>
        </button>
      )}
    />
  );
}
