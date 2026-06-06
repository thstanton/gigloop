import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SubLabel } from '@/components/common/SubLabel';
import { cn } from '@/lib/utils';
import type { Contact } from '@/types/api';

export interface PersonCardProps {
  role: string;
  contact: Contact;
  commissionArrangement?: string | null;
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

export default function PersonCard({
  role,
  contact,
  commissionArrangement,
  linkState,
  onEdit,
}: PersonCardProps) {
  const initials = getInitials(contact.name);
  const avatarClass =
    role === 'Customer'
      ? 'bg-primary text-primary-foreground'
      : 'bg-muted text-muted-foreground';

  return (
    <div className="py-4 border-b border-border last:border-0 md:flex md:items-center md:gap-3">
      <div
        className={cn(
          'hidden md:flex h-10 w-10 rounded-full items-center justify-center text-sm font-semibold flex-shrink-0',
          avatarClass,
        )}
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <SubLabel>{role}</SubLabel>
          <button
            type="button"
            onClick={onEdit}
            className="text-xs text-primary hover:text-primary/80 transition-colors"
          >
            Edit
          </button>
        </div>
        <Link
          to={`/admin/contacts/${contact.id}`}
          state={linkState}
          className="inline-flex items-center gap-1 group"
        >
          <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
            {contact.name}
          </span>
          <ChevronRight size={14} className="text-muted group-hover:text-primary transition-colors" />
        </Link>
        {(contact.email || contact.phone) && (
          <p className="text-sm text-muted mt-0.5">
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="hover:text-primary transition-colors">{contact.email}</a>
            )}
            {contact.email && contact.phone && ' · '}
            {contact.phone && (
              <a href={`tel:${contact.phone}`} className="hover:text-primary transition-colors">{contact.phone}</a>
            )}
          </p>
        )}
        {commissionArrangement && (
          <p className="text-sm text-muted mt-0.5">
            <span className="text-foreground">Commission</span>
            {' · '}{commissionArrangement}
          </p>
        )}
      </div>
    </div>
  );
}
