import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ContactsRepository } from './contacts.repository';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { ChecklistReevaluator } from '../checklist/checklist-reevaluator.service';

const ACCOUNT_OWNER_CONFLICT_MESSAGE = 'Another Contact is already the account owner';

// True for a P2002 raised by `Contact_userId_accountOwner_key` (#1035, ADR-0083) — the partial
// unique index backing the "at most one account-owner Contact per tenant" invariant.
function isAccountOwnerViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002' &&
    Array.isArray(err.meta?.target) &&
    (err.meta.target as unknown[]).includes('userId')
  );
}

const TRAVEL_TIME_CLEAR = {
  travelTimeMinutes: null,
  travelDistanceMetres: null,
  travelTimeCalculatedAt: null,
  travelMode: null,
} as const;

const CONTACT_ADDRESS_FIELDS = new Set([
  'addressLine1', 'addressLine2', 'city', 'county', 'postcode', 'country',
  'latitude', 'longitude', 'placeId',
]);

@Injectable()
export class ContactsService {
  constructor(
    private repo: ContactsRepository,
    private reeval: ChecklistReevaluator,
  ) {}

  findAll(userId: string) {
    return this.repo.findAll(userId);
  }

  async findOne(userId: string, id: string) {
    const contact = await this.repo.findOne(userId, id);
    if (!contact) throw new NotFoundException('Contact not found');
    const { _count, ...rest } = contact;
    return { ...rest, bandMemberCount: _count.bandMemberships };
  }

  // FK-ownership guard (#709 / ADR-0061): reject a write that references a Contact the caller
  // does not own — closes the cross-tenant read via a foreign customer/venue/agent/billTo FK.
  // Nullish ids (an omitted or cleared FK) are skipped; the check is one batched query. A
  // missing or foreign id is a 404, never revealing that the row exists under another tenant.
  async assertOwned(userId: string, ids: (string | null | undefined)[]): Promise<void> {
    const wanted = [...new Set(ids.filter((id): id is string => !!id))];
    if (wanted.length === 0) return;
    const owned = await this.repo.countOwned(userId, wanted);
    if (owned !== wanted.length) throw new NotFoundException('Contact not found');
  }

  async create(userId: string, dto: CreateContactDto) {
    try {
      return await this.repo.create(userId, dto);
    } catch (err) {
      if (isAccountOwnerViolation(err)) throw new ConflictException(ACCOUNT_OWNER_CONFLICT_MESSAGE);
      throw err;
    }
  }

  async update(userId: string, id: string, dto: UpdateContactDto) {
    await this.findOne(userId, id);
    const hasAddressChange = Object.keys(dto).some((k) => CONTACT_ADDRESS_FIELDS.has(k));
    const data = hasAddressChange ? { ...dto, ...TRAVEL_TIME_CLEAR } : dto;
    let updated: Awaited<ReturnType<ContactsRepository['update']>>;
    try {
      updated = await this.repo.update(id, data);
    } catch (err) {
      if (isAccountOwnerViolation(err)) throw new ConflictException(ACCOUNT_OWNER_CONFLICT_MESSAGE);
      throw err;
    }

    // #618: the email precondition reads this contact's email. When it changes, re-evaluate the
    // checklists of the bookings this contact is the customer of, so the precondition resolves (or
    // re-opens) — the same cross-module re-eval the invoices/communications services do.
    if (dto.email !== undefined) {
      const bookingIds = await this.repo.findCustomerBookingIds(userId, id);
      await Promise.all(bookingIds.map((bookingId) => this.reeval.onBookingChanged(bookingId)));
    }
    return updated;
  }

  async delete(userId: string, id: string) {
    const contact = await this.findOne(userId, id);
    // Independent of and in addition to the booking/roster check below (#1035) — the account
    // owner must never be deletable, even for a Contact with no booking history at all.
    if (contact.isAccountOwner) {
      throw new ConflictException('The account-owner Contact cannot be deleted');
    }
    const { bookingCount, bandRosterCount } = await this.repo.countDeletionBlockers(userId, id);
    if (bookingCount > 0 || bandRosterCount > 0) {
      // TODO: GDPR limitation — contacts with any booking history (including
      // CANCELLED) cannot currently be deleted. The correct solution is to
      // anonymise the contact (scrub PII, keep FK intact) so that booking and
      // invoice financial records remain structurally valid while honouring a
      // right-to-erasure request. Anonymisation is deferred to P2.
      throw new ConflictException(deletionBlockedMessage(bookingCount, bandRosterCount));
    }
    return this.repo.delete(id);
  }
}

// Mirrored in ContactEditDrawer.tsx's preventive UI copy (#886) — keep the two in sync, since a
// mismatch means the 409 a direct API call gets doesn't match what the Delete button already said.
function deletionBlockedMessage(bookingCount: number, bandRosterCount: number): string {
  const booking = `${bookingCount} booking${bookingCount === 1 ? '' : 's'}`;
  const roster = `the band roster for ${bandRosterCount} booking${bandRosterCount === 1 ? '' : 's'}`;
  if (bookingCount > 0 && bandRosterCount > 0) {
    return `Contact has ${booking} and is on ${roster}, and cannot be deleted`;
  }
  if (bandRosterCount > 0) {
    return `Contact is on ${roster} and cannot be deleted`;
  }
  return `Contact has ${booking} and cannot be deleted`;
}
