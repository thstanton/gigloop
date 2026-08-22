import { Mail, Pencil, Phone, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LabelValue } from '@/components/common/LabelValue';
import { SubLabel } from '@/components/common/SubLabel';
import { cn } from '@/lib/utils';

// The narrowest contact shape PersonChip actually reads. Widened (#887, ADR-0072 §6) so the Band
// card can pass a `BookingBandMember.contact` — id/name/email only, no phone or commission — and
// still get a working chip; the popover's Call row simply omits itself when phone is absent.
export interface PersonChipContact {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  commissionArrangement?: string | null;
}

export interface PersonChipProps {
  /** 'Customer' | 'Booking agent' plus any free-text chair role (#887, ADR-0072 §3) — a band
   *  member's role(s) on this gig. */
  role: string;
  contact: PersonChipContact;
  linkState?: Record<string, string>;
  /** Optional per-chip edit action. Omitted in the booking People section, whose single
   *  edit affordance lives on the section header. */
  onEdit?: () => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function PersonChip({ role, contact, linkState, onEdit }: PersonChipProps) {
  const initials = getInitials(contact.name);
  const avatarClass =
    role === 'Customer'
      ? 'bg-primary text-primary-foreground'
      : 'bg-accent text-muted';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 hover:bg-muted/50 transition-colors text-left min-w-0"
        >
          <div
            className={cn(
              'h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0',
              avatarClass,
            )}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{contact.name}</p>
            <SubLabel>{role}</SubLabel>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <div className="px-3 py-2 border-b border-border">
          <p className="text-sm font-medium">{contact.name}</p>
          <SubLabel>{role}</SubLabel>
        </div>
        {role === 'Booking agent' && contact.commissionArrangement && (
          <div className="px-3">
            <LabelValue label="Commission">{contact.commissionArrangement}</LabelValue>
          </div>
        )}
        <div className="p-1.5 flex flex-col">
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="flex items-center gap-2.5 rounded px-2 py-1.5 text-sm hover:bg-accent transition-colors text-left"
            >
              <Pencil size={14} className="flex-shrink-0" />
              Edit
            </button>
          )}
          {contact.phone && (
            <a
              href={`tel:${contact.phone}`}
              className="flex items-center gap-2.5 rounded px-2 py-1.5 text-sm hover:bg-accent transition-colors"
            >
              <Phone size={14} className="flex-shrink-0" />
              Call
            </a>
          )}
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="flex items-center gap-2.5 rounded px-2 py-1.5 text-sm hover:bg-accent transition-colors"
            >
              <Mail size={14} className="flex-shrink-0" />
              Email
            </a>
          )}
          <Link
            to={`/admin/contacts/${contact.id}`}
            state={linkState}
            className="flex items-center gap-2.5 rounded px-2 py-1.5 text-sm hover:bg-accent transition-colors"
          >
            <ExternalLink size={14} className="flex-shrink-0" />
            View contact
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
