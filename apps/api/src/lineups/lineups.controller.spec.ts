import { NotFoundException } from '@nestjs/common';
import { LineupsController } from './lineups.controller';
import type { LineupsService } from './lineups.service';
import type { Request } from 'express';

// #883: every route must 404 with FEATURE_BAND_MEMBERS off, so the lineup library is genuinely
// unreachable until the feature goes live (ADR-0072). This is the one place that guarantee is
// exercised directly, rather than trusted from reading the inline guard.

const req = { userId: 'u1' } as unknown as Request & { userId: string };

describe('LineupsController', () => {
  let controller: LineupsController;
  let service: { findAll: jest.Mock; create: jest.Mock; update: jest.Mock; delete: jest.Mock };
  const originalFlag = process.env.FEATURE_BAND_MEMBERS;

  beforeEach(() => {
    service = {
      findAll: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    controller = new LineupsController(service as unknown as LineupsService);
  });

  afterEach(() => {
    process.env.FEATURE_BAND_MEMBERS = originalFlag;
  });

  describe('with the flag off', () => {
    beforeEach(() => {
      delete process.env.FEATURE_BAND_MEMBERS;
    });

    it('findAll 404s without touching the service', () => {
      expect(() => controller.findAll(req)).toThrow(NotFoundException);
      expect(service.findAll).not.toHaveBeenCalled();
    });

    it('create 404s without touching the service', () => {
      expect(() => controller.create(req, { label: 'x' })).toThrow(NotFoundException);
      expect(service.create).not.toHaveBeenCalled();
    });

    it('update 404s without touching the service', () => {
      expect(() => controller.update(req, 'l1', {})).toThrow(NotFoundException);
      expect(service.update).not.toHaveBeenCalled();
    });

    it('delete 404s without touching the service', () => {
      expect(() => controller.delete(req, 'l1')).toThrow(NotFoundException);
      expect(service.delete).not.toHaveBeenCalled();
    });
  });

  describe('with the flag on', () => {
    beforeEach(() => {
      process.env.FEATURE_BAND_MEMBERS = 'true';
    });

    it('findAll reaches the service', async () => {
      await controller.findAll(req);
      expect(service.findAll).toHaveBeenCalledWith('u1');
    });

    it('create reaches the service', async () => {
      await controller.create(req, { label: 'My five-piece' });
      expect(service.create).toHaveBeenCalledWith('u1', { label: 'My five-piece' });
    });
  });
});
