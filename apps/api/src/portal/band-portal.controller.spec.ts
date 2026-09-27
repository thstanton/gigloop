import { NotFoundException } from '@nestjs/common';
import { BandPortalController } from './band-portal.controller';
import type { BandPortalService } from './band-portal.service';

// Matches lineups.controller.spec.ts / bookings.controller.spec.ts: every band route must 404 with
// FEATURE_BAND_MEMBERS off, so the band portal is genuinely unreachable until the feature ships
// (ADR-0072).
describe('BandPortalController', () => {
  let controller: BandPortalController;
  let service: { getBandPortalData: jest.Mock; respondToInvite: jest.Mock; getCallSheetPdfBuffer: jest.Mock };
  const originalFlag = process.env.FEATURE_BAND_MEMBERS;

  beforeEach(() => {
    service = {
      getBandPortalData: jest.fn().mockResolvedValue({ cancelled: false }),
      respondToInvite: jest.fn().mockResolvedValue({ cancelled: false }),
      getCallSheetPdfBuffer: jest.fn().mockResolvedValue(Buffer.from('pdf')),
    };
    controller = new BandPortalController(service as unknown as BandPortalService);
  });

  afterEach(() => {
    process.env.FEATURE_BAND_MEMBERS = originalFlag;
  });

  it('404s without touching the service when the flag is off', () => {
    delete process.env.FEATURE_BAND_MEMBERS;
    expect(() => controller.getBandPortalData('token')).toThrow(NotFoundException);
    expect(service.getBandPortalData).not.toHaveBeenCalled();
  });

  it('delegates to the service when the flag is on', () => {
    process.env.FEATURE_BAND_MEMBERS = 'true';
    controller.getBandPortalData('token');
    expect(service.getBandPortalData).toHaveBeenCalledWith('token');
  });

  describe('respondToInvite', () => {
    it('404s without touching the service when the flag is off', () => {
      delete process.env.FEATURE_BAND_MEMBERS;
      expect(() => controller.respondToInvite('token', { response: 'CONFIRMED' })).toThrow(NotFoundException);
      expect(service.respondToInvite).not.toHaveBeenCalled();
    });

    it('delegates to the service when the flag is on', () => {
      process.env.FEATURE_BAND_MEMBERS = 'true';
      controller.respondToInvite('token', { response: 'DECLINED' });
      expect(service.respondToInvite).toHaveBeenCalledWith('token', 'DECLINED');
    });
  });

  describe('downloadCallSheet (#893)', () => {
    function makeRes() {
      return { end: jest.fn() };
    }

    it('404s without touching the service when the flag is off', async () => {
      delete process.env.FEATURE_BAND_MEMBERS;
      const res = makeRes();
      await expect(
        controller.downloadCallSheet('token', res as unknown as Parameters<BandPortalController['downloadCallSheet']>[1]),
      ).rejects.toThrow(NotFoundException);
      expect(service.getCallSheetPdfBuffer).not.toHaveBeenCalled();
      expect(res.end).not.toHaveBeenCalled();
    });

    it('streams the generated buffer directly to the response when the flag is on', async () => {
      process.env.FEATURE_BAND_MEMBERS = 'true';
      const res = makeRes();
      await controller.downloadCallSheet('token', res as unknown as Parameters<BandPortalController['downloadCallSheet']>[1]);
      expect(service.getCallSheetPdfBuffer).toHaveBeenCalledWith('token');
      expect(res.end).toHaveBeenCalledWith(Buffer.from('pdf'));
    });
  });
});
