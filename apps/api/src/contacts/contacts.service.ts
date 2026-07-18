import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ContactsRepository } from './contacts.repository';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { ChecklistReevaluator } from '../checklist/checklist-reevaluator.service';

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
    return contact;
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

  create(userId: string, dto: CreateContactDto) {
    return this.repo.create(userId, dto);
  }

  async update(userId: string, id: string, dto: UpdateContactDto) {
    await this.findOne(userId, id);
    const hasAddressChange = Object.keys(dto).some((k) => CONTACT_ADDRESS_FIELDS.has(k));
    const data = hasAddressChange ? { ...dto, ...TRAVEL_TIME_CLEAR } : dto;
    const updated = await this.repo.update(id, data);

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
    await this.findOne(userId, id);
    const bookingCount = await this.repo.countBookings(userId, id);
    if (bookingCount > 0) {
      // TODO: GDPR limitation — contacts with any booking history (including
      // CANCELLED) cannot currently be deleted. The correct solution is to
      // anonymise the contact (scrub PII, keep FK intact) so that booking and
      // invoice financial records remain structurally valid while honouring a
      // right-to-erasure request. Anonymisation is deferred to P2.
      throw new ConflictException(
        'Contact has associated bookings and cannot be deleted',
      );
    }
    return this.repo.delete(id);
  }
}
