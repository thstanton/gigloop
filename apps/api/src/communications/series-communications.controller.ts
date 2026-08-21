import { Controller, Get, NotFoundException, Param, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommunicationsService } from './communications.service';
import { MailService } from '../mail/mail.service';
import { RenderEmailQueryDto } from './dto/render-email-query.dto';
import type { Request } from 'express';

type AuthedRequest = Request & { userId: string };

/**
 * The series-shaped counterpart to `CommunicationsController.render` (#847).
 *
 * A series invoice belongs to no booking, so its cover email cannot be rendered through
 * `/bookings/:bookingId/communications/render` — that path builds a booking-shaped context and
 * scopes the invoice lookup by `bookingId`, which for a series invoice is null. Reaching for it
 * yields a body of pure fallbacks. This route builds the series-shaped context instead
 * (`MailService.buildSeriesContext`, #846) so `series_invoice_cover` renders the series label and
 * the dates covered.
 *
 * Only the *render* half lives here: sending is already owner-aware via
 * `POST /series/:id/invoices/:invoiceId/send`, which logs the send as a `Communication` scoped by
 * `seriesId` (ADR-0080) — read back merged into every member booking's Communications list, not
 * through a route on this controller.
 */
@ApiTags('Communications')
@ApiBearerAuth('clerk-jwt')
@Controller('series/:seriesId/communications')
export class SeriesCommunicationsController {
  constructor(
    private service: CommunicationsService,
    private mail: MailService,
  ) {}

  @ApiOperation({ summary: 'Render a template with series context — returns subject and body for the compose sheet' })
  @ApiResponse({
    status: 200,
    description: 'Rendered subject and body with list of variables that fell back to defaults',
    schema: {
      properties: {
        subject: { type: 'string' },
        body: { type: 'string' },
        missingVariables: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Template or series not found' })
  @Get('render')
  async render(
    @Req() req: AuthedRequest,
    @Param('seriesId') seriesId: string,
    @Query() query: RenderEmailQueryDto,
  ) {
    const template = await this.service.findTemplate(req.userId, query.templateId);
    if (!template) throw new NotFoundException('Template not found');

    // Tenant-scoped inside buildSeriesContext (`bookingSeries.findFirst({ id, userId })`), which
    // throws NotFound for another tenant's series — and its invoice read is scoped by seriesId as
    // well as userId, so a mismatched (series, invoice) pair yields no figures rather than
    // someone else's.
    const context = await this.mail.buildSeriesContext(
      req.userId,
      seriesId,
      query.invoiceId,
      query.issueDate,
      query.dueDate,
    );

    return this.mail.renderForCompose(template, context);
  }
}
