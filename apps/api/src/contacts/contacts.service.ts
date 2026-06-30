import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ContactsRepository } from './contacts.repository';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { ChecklistEvaluatorService } from '../checklist/checklist-evaluator.service';

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
    private evaluator: ChecklistEvaluatorService,
  ) {}

  findAll(userId: string) {
    return this.repo.findAll(userId);
  }

  async findOne(userId: string, id: string) {
    const contact = await this.repo.findOne(userId, id);
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
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
      await Promise.all(bookingIds.map((bookingId) => this.evaluator.evaluate(bookingId).catch(() => {})));
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
