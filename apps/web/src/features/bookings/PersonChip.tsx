import { Mail, Pencil, Phone, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LabelValue } from '@/components/common/LabelValue';
import { SubLabel } from '@/components/common/SubLabel';
import { cn } from '@/lib/utils';
import type { Contact } from '@/types/api';

export interface PersonChipProps {
  role: 'Customer' | 'Booking agent';
  contact: Contact;
  linkState?: Record<string, string>;
  onEdit: () => void;
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
      : 'bg-muted text-muted-foreground';

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
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-2.5 rounded px-2 py-1.5 text-sm hover:bg-muted transition-colors text-left"
          >
            <Pencil size={14} className="flex-shrink-0" />
            Edit
          </button>
          {contact.phone && (
            <a
              href={`tel:${contact.phone}`}
              className="flex items-center gap-2.5 rounded px-2 py-1.5 text-sm hover:bg-muted transition-colors"
            >
              <Phone size={14} className="flex-shrink-0" />
              Call
            </a>
          )}
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="flex items-center gap-2.5 rounded px-2 py-1.5 text-sm hover:bg-muted transition-colors"
            >
              <Mail size={14} className="flex-shrink-0" />
              Email
            </a>
          )}
          <Link
            to={`/admin/contacts/${contact.id}`}
            state={linkState}
            className="flex items-center gap-2.5 rounded px-2 py-1.5 text-sm hover:bg-muted transition-colors"
          >
            <ExternalLink size={14} className="flex-shrink-0" />
            View contact
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
