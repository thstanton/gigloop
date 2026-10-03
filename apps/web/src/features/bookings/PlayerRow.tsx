import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, FileText, ListChecks, Mail, MoreHorizontal, Pencil, PoundSterling, TriangleAlert, UserMinus } from 'lucide-react';
import { ActionMenu, type ActionMenuItem } from '@/components/common/ActionMenu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { BAND_MEMBER_STATUS_LABELS, BAND_MEMBER_STATUS_ORDER, BAND_MEMBER_STATUS_TOKENS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import InlineFeeAdd from './InlineFeeAdd';
import { getInitials, PersonPopover } from './PersonChip';
import type { BandCommunicationKind } from './bandCommunicationMeta';
import type { BookingBandChair, BookingBandMember, BookingBandMemberStatus } from '@/types/api';

// #1057 / ADR-0084 §2: one row of the Players card. The name opens the existing contact popover;
// everything else you can do to this person is in the `⋯` menu. The only per-player control outside
// it is "Invite" on a person who has never been invited — the one send that is the point of the row.

export interface PlayerRowProps {
  member: BookingBandMember;
  /** The parts this person holds — the Take-off confirmation names them. */
  parts: BookingBandChair[];
  /** "{roles} · {packages played}", already composed (`playerMeta`). */
  meta: string;
  backHref: string;
  linkState?: Record<string, string>;
  isChangingStatus: boolean;
  isSavingFee: boolean;
  isTakingOff: boolean;
  onInvite: () => void;
  onChangeStatus: (status: BookingBandMemberStatus) => void;
  onSaveFee: (sessionFee: number | null) => void;
  onTakeOff: () => void;
  /** Temporary home for per-player sends until A4 (#1058) moves them to the card header. */
  onComposeCommunication: (kind: BandCommunicationKind) => void;
}

const firstName = (name: string) => name.split(' ')[0];

export function PlayerRow({
  member,
  parts,
  meta,
  backHref,
  linkState,
  isChangingStatus,
  isSavingFee,
  isTakingOff,
  onInvite,
  onChangeStatus,
  onSaveFee,
  onTakeOff,
  onComposeCommunication,
}: PlayerRowProps) {
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingFee, setEditingFee] = useState(false);
  const [dialog, setDialog] = useState<'answer' | 'takeOff' | null>(null);

  const name = member.contact.name;
  const first = firstName(name);
  const isDeclined = member.status === 'DECLINED';
  const neverInvited = member.status === 'ADDED' && member.invitedAt === null;

  const nameNode = member.isSelf ? (
    <span className="text-base font-semibold text-foreground">You</span>
  ) : (
    <PersonPopover role={meta || 'Player'} contact={member.contact} linkState={linkState}>
      <button
        type="button"
        className={cn(
          'text-left text-base font-semibold truncate hover:underline',
          isDeclined ? 'text-muted line-through' : 'text-foreground',
        )}
      >
        {name}
      </button>
    </PersonPopover>
  );

  function menuItems(close: () => void): ActionMenuItem[] {
    const run = (fn: () => void) => () => {
      close();
      fn();
    };
    return [
      // `invitedAt` — not `status` — answers "once invited": a status set by hand does not mean an
      // invitation went out, and "Resend" of one that never did would be a lie.
      ...(member.invitedAt !== null ? [{ label: 'Resend invitation', icon: <Mail size={14} />, onClick: run(onInvite) }] : []),
      {
        label: `Preview ${first}'s portal`,
        icon: <Eye size={14} />,
        onClick: run(() => navigate(`/band/${member.bandPortalToken}?preview=admin&from=${encodeURIComponent(backHref)}`)),
      },
      { label: 'Change fee', icon: <PoundSterling size={14} />, onClick: run(() => setEditingFee(true)) },
      { label: 'Change answer…', icon: <Pencil size={14} />, onClick: run(() => setDialog('answer')) },
      // Temporary (A4 #1058 moves these to the card header).
      { label: 'Send call sheet', icon: <FileText size={14} />, onClick: run(() => onComposeCommunication('call-sheet')) },
      { label: 'Send final details', icon: <ListChecks size={14} />, onClick: run(() => onComposeCommunication('final-details')) },
      { label: 'Take off this gig…', icon: <UserMinus size={14} />, variant: 'destructive' as const, onClick: run(() => setDialog('takeOff')) },
    ];
  }

  return (
    <div id={`player-${member.id}`} className="flex items-center gap-3 py-3 border-b border-border last:border-b-0">
      <div
        aria-hidden
        className={cn(
          'h-9 w-9 rounded-full flex flex-shrink-0 items-center justify-center bg-accent text-muted font-semibold',
          member.isSelf ? 'text-xs' : 'text-sm',
        )}
      >
        {member.isSelf ? 'You' : getInitials(name)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          {nameNode}
          {/* A decline means a part needs a replacement: the strikethrough name and warning chip
              make that read as action-required, not as just another status. */}
          {isDeclined && (
            <Badge
              variant="outline"
              className={cn(
                'gap-1 flex-shrink-0 border-status-cancelled',
                BAND_MEMBER_STATUS_TOKENS.DECLINED.tint,
                BAND_MEMBER_STATUS_TOKENS.DECLINED.text,
              )}
            >
              <TriangleAlert size={12} aria-hidden />
              {BAND_MEMBER_STATUS_LABELS.DECLINED}
            </Badge>
          )}
        </div>
        {meta && <p className="text-sm text-muted">{meta}</p>}
        {!member.isSelf && (
          <InlineFeeAdd
            value={member.sessionFee}
            label={`fee for ${name}`}
            onSave={onSaveFee}
            isSaving={isSavingFee}
            editing={editingFee}
            onEditingChange={setEditingFee}
          />
        )}
      </div>

      {!member.isSelf && (
        <>
          {neverInvited && (
            <Button variant="outline" size="sm" className="min-h-10" onClick={onInvite} aria-label={`Invite ${name}`}>
              Invite
            </Button>
          )}
          <ActionMenu
            sheetItems={menuItems(() => setSheetOpen(false))}
            dropdownItems={menuItems(() => undefined)}
            sheetTitle={name}
            sheetOpen={sheetOpen}
            onSheetOpenChange={setSheetOpen}
            mobileTrigger={{ icon: <MoreHorizontal size={18} />, ariaLabel: `Actions for ${name}`, className: 'min-h-11 min-w-11 inline-flex items-center justify-center' }}
            desktopTrigger={{ icon: <MoreHorizontal size={18} />, ariaLabel: `Actions for ${name}`, className: 'min-h-11 min-w-11 inline-flex items-center justify-center' }}
          />
        </>
      )}

      <ResponsiveDialog open={dialog === 'answer'} onOpenChange={(open) => !open && setDialog(null)}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{`${first}'s answer`}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>Set where you stand with {first} — nothing is sent.</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="mt-4 flex flex-col gap-2">
            {BAND_MEMBER_STATUS_ORDER.map((status) => (
              <Button
                key={status}
                variant={status === member.status ? 'default' : 'outline'}
                disabled={isChangingStatus}
                onClick={() => {
                  if (status !== member.status) onChangeStatus(status);
                  setDialog(null);
                }}
              >
                {BAND_MEMBER_STATUS_LABELS[status]}
              </Button>
            ))}
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ResponsiveDialog open={dialog === 'takeOff'} onOpenChange={(open) => !open && !isTakingOff && setDialog(null)}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{`Take ${first} off this gig?`}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {parts.length > 0
                ? `This empties ${parts.map((p) => p.role).join(', ')}. ${first} leaves the list, and those parts need someone else.`
                : `${first} leaves the list.`}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogFooter className="mt-4">
            <Button variant="outline" disabled={isTakingOff} onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isTakingOff}
              onClick={() => {
                onTakeOff();
                setDialog(null);
              }}
            >
              {isTakingOff ? '…' : 'Take off this gig'}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}
