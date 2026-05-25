import { Injectable, NotFoundException } from '@nestjs/common';
import { CommunicationsRepository } from './communications.repository';
import { CreateCommunicationDto } from './dto/create-communication.dto';

@Injectable()
export class CommunicationsService {
  constructor(private repo: CommunicationsRepository) {}

  findAll(userId: string, bookingId: string) {
    return this.repo.findAll(userId, bookingId);
  }

  async findOne(userId: string, bookingId: string, id: string) {
    const communication = await this.repo.findOne(userId, bookingId, id);
    if (!communication) throw new NotFoundException('Communication not found');
    return communication;
  }

  async create(userId: string, bookingId: string, dto: CreateCommunicationDto) {
    const booking = await this.repo.findBookingById(userId, bookingId);
    if (!booking) throw new NotFoundException('Booking not found');
    return this.repo.create(userId, bookingId, dto);
  }

  findTemplate(userId: string, templateId: string) {
    return this.repo.findTemplate(userId, templateId);
  }
}
