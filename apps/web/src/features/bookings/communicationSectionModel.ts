import type { BookingBandMember, Communication } from '@/types/api';

export interface MemberCommunicationGroup {
  id: string;
  name: string;
  communications: Communication[];
}

export interface CommunicationSectionGroups {
  clientCommunications: Communication[];
  memberGroups: MemberCommunicationGroup[];
}

function isBandCommunication(comm: Communication, bandContactIds: ReadonlySet<string>): boolean {
  const templateType = comm.template?.builtInType;
  return templateType ? templateType.startsWith('band_') : bandContactIds.has(comm.contactId);
}

export function buildCommunicationSectionGroups(
  communications: Communication[],
  bandMembers: BookingBandMember[],
  bandCommunicationsEnabled: boolean,
): CommunicationSectionGroups {
  if (!bandCommunicationsEnabled || bandMembers.length === 0) {
    return { clientCommunications: communications, memberGroups: [] };
  }

  const bandContactIds = new Set(bandMembers.map((member) => member.contactId));
  const clientCommunications: Communication[] = [];
  const bandCommunications: Communication[] = [];
  for (const comm of communications) {
    (isBandCommunication(comm, bandContactIds) ? bandCommunications : clientCommunications).push(comm);
  }

  const communicationsByContact = new Map<string, Communication[]>();
  for (const comm of bandCommunications) {
    const messages = communicationsByContact.get(comm.contactId) ?? [];
    messages.push(comm);
    communicationsByContact.set(comm.contactId, messages);
  }

  const memberGroups: MemberCommunicationGroup[] = bandMembers.map((member) => ({
    id: member.id,
    name: member.contact.name,
    communications: communicationsByContact.get(member.contactId) ?? [],
  }));
  const groupedContactIds = new Set(bandMembers.map((member) => member.contactId));
  for (const comm of bandCommunications) {
    if (groupedContactIds.has(comm.contactId)) continue;
    memberGroups.push({
      id: comm.contactId,
      name: comm.contact.name,
      communications: communicationsByContact.get(comm.contactId) ?? [],
    });
    groupedContactIds.add(comm.contactId);
  }

  return { clientCommunications, memberGroups };
}
