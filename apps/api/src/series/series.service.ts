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

  async findDefaults(userId: string, id: string) {
    const series = await this.repo.findSeriesCustomerId(userId, id);
    if (!series) throw new NotFoundException('Series not found');

    const earliest = await this.repo.findEarliestMemberBooking(userId, id);
    if (!earliest) return {};

    return {
      customerId: series.customerId,
      venueId: earliest.venueId,
      bookingAgentId: earliest.bookingAgentId,
      packageIds: earliest.packages.map((bp) => bp.packageId),
      checklistItems: earliest.checklistItems.map((item) => ({
        key: item.key,
        label: item.label,
        completedBy: item.completedBy as 'USER' | 'CUSTOMER' | 'BAND_MEMBER',
        dependsOn: item.dependsOn,
        autoCompleteRule: item.autoCompleteRule as Record<string, unknown> | null,
        requiredForStatus: item.requiredForStatus as 'PROVISIONAL' | 'CONFIRMED' | 'READY' | 'COMPLETE' | null,
        dueDateRule: item.dueDateRule as Record<string, unknown> | null,
        enabled: true,
      })),
      musicFormConfig: earliest.musicFormConfig
        ? {
            enabledGenres: earliest.musicFormConfig.enabledGenres,
            keyMoments: earliest.musicFormConfig.keyMoments,
          }
        : null,
    };
  }
}
