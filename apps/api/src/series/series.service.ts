import { Injectable, NotFoundException } from '@nestjs/common';
import { SeriesRepository } from './series.repository';

@Injectable()
export class SeriesService {
  constructor(private repo: SeriesRepository) {}

  findAll(userId: string) {
    return this.repo.findAll(userId);
  }

  async findOne(userId: string, id: string) {
    const series = await this.repo.findOne(userId, id);
    if (!series) throw new NotFoundException('Series not found');
    const activeInvoice = series.invoices.find((i) => i.status !== 'VOID') ?? null;
    return {
      id: series.id,
      createdAt: series.createdAt,
      updatedAt: series.updatedAt,
      label: series.label,
      customerId: series.customerId,
      customer: series.customer,
      memberBookingCount: series.bookings.length,
      invoiceStatus: activeInvoice?.status ?? null,
    };
  }
}
