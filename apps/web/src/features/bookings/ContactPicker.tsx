import { useCallback } from 'react';
import ContactCombobox from './ContactCombobox';
import type { Contact } from '@/types/api';

interface ContactPickerProps {
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  label?: string;
  /** Sorts contacts of this type first. A preference, never a filter: a customer can also be an
   *  agent or a venue, so the generic picker deliberately does not tell types apart. */
  preferredRole?: string;
  disabled?: boolean;
  disableCreate?: boolean;
}

/** Pick any contact — customer, venue, agent. To fill a part with a player, use `PlayerPicker`. */
export default function ContactPicker({
  value,
  onChange,
  placeholder,
  label,
  preferredRole,
  disabled,
  disableCreate,
}: ContactPickerProps) {
  const arrange = useCallback(
    (contacts: Contact[]) => {
      if (!preferredRole) return contacts;
      return [...contacts].sort((a, b) => {
        const aMatch = a.primaryRole === preferredRole ? 0 : 1;
        const bMatch = b.primaryRole === preferredRole ? 0 : 1;
        return aMatch - bMatch;
      });
    },
    [preferredRole],
  );

  return (
    <ContactCombobox
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      label={label}
      disabled={disabled}
      disableCreate={disableCreate}
      arrange={arrange}
    />
  );
}
