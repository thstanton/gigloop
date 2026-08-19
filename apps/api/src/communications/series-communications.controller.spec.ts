import { NotFoundException } from '@nestjs/common';
import { SeriesCommunicationsController } from './series-communications.controller';
import type { CommunicationsService } from './communications.service';
import type { MailService, SeriesEmailContext } from '../mail/mail.service';
import type { Request } from 'express';

// #847: the compose sheet's render half for a series invoice. What this must guarantee is that a
// series cover is rendered against the *series* — reaching for the booking-shaped context is the
// bug it exists to prevent, and it is invisible in the output (a body of plausible fallbacks).

const seriesContext: SeriesEmailContext = {
  customerName: 'Hotel Group',
  greetingName: 'Hotel Group',
  seriesLabel: 'Thursday residency',
  datesCovered: '12 dates from 2026-01-08 to 2026-03-26',
  musicianName: 'Jane Player',
  musicianEmail: 'jane@example.com',
  issueDate: '2026-01-05',
  invoiceTotal: '£6000.00',
  invoiceDueDate: '2026-02-04',
};

const template = { id: 'tpl-1', builtInType: 'series_invoice_cover', content: { type: 'doc' } };

const req = { userId: 'u1' } as unknown as Request & { userId: string };

describe('SeriesCommunicationsController', () => {
  let controller: SeriesCommunicationsController;
  let service: { findTemplate: jest.Mock };
  let mail: { buildSeriesContext: jest.Mock; buildContext: jest.Mock; renderForCompose: jest.Mock };

  beforeEach(() => {
    service = { findTemplate: jest.fn().mockResolvedValue(template) };
    mail = {
      buildSeriesContext: jest.fn().mockResolvedValue(seriesContext),
      buildContext: jest.fn(),
      renderForCompose: jest
        .fn()
        .mockReturnValue({ subject: 'Your invoice for Thursday residency', body: '<p>Hi</p>', missingVariables: [] }),
    };
    controller = new SeriesCommunicationsController(
      service as unknown as CommunicationsService,
      mail as unknown as MailService,
    );
  });

  it('renders the template against the series-shaped context', async () => {
    const result = await controller.render(req, 's1', { templateId: 'tpl-1', invoiceId: 'inv-1' });

    expect(mail.buildSeriesContext).toHaveBeenCalledWith('u1', 's1', 'inv-1', undefined, undefined);
    // The booking-shaped builder must never be reached from here: a series invoice has no booking,
    // so it would resolve nothing and silently produce fallbacks.
    expect(mail.buildContext).not.toHaveBeenCalled();
    expect(mail.renderForCompose).toHaveBeenCalledWith(template, seriesContext);
    expect(result).toEqual({
      subject: 'Your invoice for Thursday residency',
      body: '<p>Hi</p>',
      missingVariables: [],
    });
  });

  it('passes the draft date overrides through', async () => {
    await controller.render(req, 's1', {
      templateId: 'tpl-1',
      invoiceId: 'inv-1',
      issueDate: '2026-01-05',
      dueDate: '2026-02-04',
    });
    expect(mail.buildSeriesContext).toHaveBeenCalledWith('u1', 's1', 'inv-1', '2026-01-05', '2026-02-04');
  });

  it('404s on an unknown template without building any context', async () => {
    service.findTemplate.mockResolvedValue(null);
    await expect(controller.render(req, 's1', { templateId: 'nope' })).rejects.toThrow(NotFoundException);
    expect(mail.buildSeriesContext).not.toHaveBeenCalled();
  });

  it('propagates the tenant-scoped 404 from the context builder', async () => {
    mail.buildSeriesContext.mockRejectedValue(new NotFoundException('Series not found'));
    await expect(controller.render(req, 'someone-elses-series', { templateId: 'tpl-1' })).rejects.toThrow(
      NotFoundException,
    );
  });
});
