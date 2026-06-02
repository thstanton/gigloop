import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DigestRepository } from './digest.repository';
import { MailService, MailTransportOptions } from '../mail/mail.service';

type DigestBooking = {
  id: string;
  date: Date;
  title: string | null;
  customer: { name: string };
  venue: { name: string } | null;
};

type DigestItem = {
  label: string;
  dueDate: Date | null;
};

type DigestEmailData = {
  gigsThisWeek: DigestBooking[];
  upcomingItems: Array<{ booking: DigestBooking; items: DigestItem[] }>;
  weekStart: Date;
  today: Date;
};

@Injectable()
export class DigestService {
  constructor(
    private readonly digestRepo: DigestRepository,
    private readonly mail: MailService,
  ) {}

  @Cron('0 7 * * 1')
  async sendWeeklyDigest(now: Date = new Date()): Promise<void> {
    const today = startOfUTCDay(now);
    const weekStart = today;
    const weekEnd = addDays(today, 6);

    const users = await this.digestRepo.findUsersWithDigestEnabled();

    const emails: MailTransportOptions[] = [];

    for (const user of users) {
      if (!user.publicProfile?.email) continue;

      const prefs = user.preferences as Record<string, unknown>;
      const reminderLeadDays = typeof prefs.reminderLeadDays === 'number' ? prefs.reminderLeadDays : 7;

      const { gigsThisWeek, upcomingItems } = await this.digestRepo.findDigestDataForUser(
        user.userId,
        weekStart,
        weekEnd,
        today,
        reminderLeadDays,
      );

      if (gigsThisWeek.length === 0 && upcomingItems.length === 0) continue;

      const subject =
        gigsThisWeek.length > 0
          ? `Your week ahead: ${gigsThisWeek.length} booking${gigsThisWeek.length === 1 ? '' : 's'}`
          : 'Your week ahead';

      emails.push({
        to: user.publicProfile.email,
        subject,
        body: buildDigestHtml({ gigsThisWeek, upcomingItems, weekStart, today }),
      });
    }

    await this.mail.sendBatch(emails);
  }
}

function buildDigestHtml(data: DigestEmailData): string {
  const { gigsThisWeek, upcomingItems, weekStart, today } = data;
  const weekEnd = addDays(weekStart, 6);
  const baseUrl = process.env.APP_BASE_URL ?? '';

  const gigRows =
    gigsThisWeek.length > 0
      ? gigsThisWeek
          .map((b) => {
            const venue = b.venue ? ` · ${escapeHtml(b.venue.name)}` : '';
            return `<li><a href="${baseUrl}/admin/bookings/${b.id}">${formatDate(b.date)} · ${escapeHtml(b.customer.name)}${venue}</a></li>`;
          })
          .join('\n')
      : '';

  const gigsSection =
    gigsThisWeek.length > 0
      ? `<ul style="padding-left:1.5em">\n${gigRows}\n</ul>`
      : `<p style="color:#666">Your calendar's clear this week!</p>`;

  const actionBookings =
    upcomingItems.length > 0
      ? upcomingItems
          .map(({ booking, items }) => {
            const bookingTitle = escapeHtml(booking.title ?? `${booking.customer.name} · ${formatDate(booking.date)}`);
            const itemRows = items
              .map((item) => `<li>${formatItemLabel(item, weekStart, weekEnd, today)}</li>`)
              .join('\n');
            return `<div style="margin-bottom:16px"><a href="${baseUrl}/admin/bookings/${booking.id}"><strong>${bookingTitle}</strong></a><ul style="padding-left:1.5em;margin-top:4px">\n${itemRows}\n</ul></div>`;
          })
          .join('\n')
      : '';

  const actionsSection =
    upcomingItems.length > 0
      ? actionBookings
      : `<p style="color:#666">You're all caught up!</p>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
<h1 style="font-size:1.5em;margin-bottom:24px">Your week ahead</h1>
<h2 style="font-size:1.1em;border-bottom:1px solid #e5e7eb;padding-bottom:8px;margin-bottom:12px">Gigs this week</h2>
${gigsSection}
<h2 style="font-size:1.1em;border-bottom:1px solid #e5e7eb;padding-bottom:8px;margin-bottom:12px;margin-top:32px">Actions</h2>
${actionsSection}
</body>
</html>`;
}

function formatItemLabel(item: DigestItem, weekStart: Date, weekEnd: Date, today: Date): string {
  const label = escapeHtml(item.label);
  if (item.dueDate === null) return label;
  if (item.dueDate < today) return `${label} — overdue`;
  if (item.dueDate >= weekStart && item.dueDate <= weekEnd) {
    return `${label} — ${formatDayOfWeek(item.dueDate)}`;
  }
  return label;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function formatDayOfWeek(date: Date): string {
  return date.toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'long' });
}

function startOfUTCDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
