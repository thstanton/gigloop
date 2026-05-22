import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ContactsRepository } from './contacts.repository';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Injectable()
export class ContactsService {
  constructor(private repo: ContactsRepository) {}

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
    return this.repo.update(id, dto);
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
