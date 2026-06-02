import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type DigestChecklistItem = {
  id: string;
  bookingId: string;
  label: string;
  state: string;
  completedBy: string;
  dueDate: Date | null;
  requiredForStatus: string | null;
  order: number;
};

type DigestBooking = {
  id: string;
  userId: string;
  date: Date;
  title: string | null;
  eventType: string;
  status: string;
};

@Injectable()
export class DigestRepository {
  constructor(private prisma: PrismaService) {}

  async findUsersWithDigestEnabled() {
    const profiles = await this.prisma.userProfile.findMany({
      where: { digestEmailEnabled: true },
      select: { userId: true, preferences: true },
    });

    const userIds = profiles.map((p) => p.userId);
    const publicProfiles = await this.prisma.publicProfile.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, email: true },
    });

    const publicByUserId = new Map(publicProfiles.map((p) => [p.userId, p]));

    return profiles.map((profile) => ({
      userId: profile.userId,
      preferences: profile.preferences,
      publicProfile: publicByUserId.get(profile.userId) ?? null,
    }));
  }

  async findDigestDataForUser(
    userId: string,
    weekStart: Date,
    weekEnd: Date,
    today: Date,
    reminderLeadDays: number,
  ) {
    const [gigsThisWeek, upcomingBookings] = await Promise.all([
      this.prisma.booking.findMany({
        where: {
          userId,
          date: { gte: weekStart, lte: weekEnd },
          status: { notIn: ['ENQUIRY', 'CANCELLED'] },
        },
        orderBy: { date: 'asc' },
        select: {
          id: true,
          userId: true,
          date: true,
          title: true,
          eventType: true,
          status: true,
        },
      }),
      this.prisma.booking.findMany({
        where: {
          userId,
          date: { gte: today },
          status: { notIn: ['CANCELLED'] },
        },
        orderBy: { date: 'asc' },
        select: {
          id: true,
          userId: true,
          date: true,
          title: true,
          eventType: true,
          status: true,
          checklistItems: {
            where: {
              completedBy: 'USER',
              state: { in: ['PENDING', 'FAILED'] },
            },
            select: {
              id: true,
              bookingId: true,
              label: true,
              state: true,
              completedBy: true,
              dueDate: true,
              requiredForStatus: true,
              order: true,
            },
            orderBy: { order: 'asc' },
          },
        },
      }),
    ]);

    const cutoff = addDays(today, reminderLeadDays);

    const upcomingItems = upcomingBookings
      .map(({ checklistItems, ...booking }) => ({
        booking: booking as DigestBooking,
        items: this.applySurfacingRules(checklistItems as DigestChecklistItem[], cutoff),
      }))
      .filter(({ items }) => items.length > 0);

    return { gigsThisWeek: gigsThisWeek as DigestBooking[], upcomingItems };
  }

  private applySurfacingRules(items: DigestChecklistItem[], cutoff: Date): DigestChecklistItem[] {
    return items.filter((item) => {
      if (item.dueDate !== null) {
        return item.dueDate <= cutoff;
      }
      if (item.requiredForStatus !== null) {
        // Surface only if this is the last remaining item blocking this status transition
        const peers = items.filter((i) => i.requiredForStatus === item.requiredForStatus);
        return peers.length === 1;
      }
      return false;
    });
  }
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
