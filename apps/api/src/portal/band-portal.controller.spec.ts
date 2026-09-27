import { NotFoundException } from '@nestjs/common';
import { BandPortalController } from './band-portal.controller';
import type { BandPortalService } from './band-portal.service';

// Matches lineups.controller.spec.ts / bookings.controller.spec.ts: every band route must 404 with
// FEATURE_BAND_MEMBERS off, so the band portal is genuinely unreachable until the feature ships
// (ADR-0072).
describe('BandPortalController', () => {
  let controller: BandPortalController;
  let service: { getBandPortalData: jest.Mock };
  const originalFlag = process.env.FEATURE_BAND_MEMBERS;

  beforeEach(() => {
    service = { getBandPortalData: jest.fn().mockResolvedValue({ cancelled: false }) };
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
});
