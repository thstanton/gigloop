import {
  resolveContractVisibility,
  resolveMusicFormVisibility,
  resolveUploadDocumentVisibility,
  type ContractStatus,
  type PortalVisibilityVerdict,
} from './portal-visibility';

describe('portal-visibility authority (ADR-0054)', () => {
  describe('resolveContractVisibility', () => {
    const cases: Array<[ContractStatus | null, PortalVisibilityVerdict | null]> = [
      [null, null],
      ['DRAFT', { visible: false, reason: 'until_sent' }],
      ['SENT', { visible: true }],
      ['SIGNED', { visible: true }],
      ['VOID', { visible: false, reason: 'voided' }],
    ];

    it.each(cases)('maps contract status %s to the expected verdict', (status, expected) => {
      expect(resolveContractVisibility(status)).toEqual(expected);
    });

    it.each(cases)('is unchanged for %s when the booking is not cancelled', (status, expected) => {
      expect(resolveContractVisibility(status, false)).toEqual(expected);
    });

    describe('cancelled booking is the outermost gate (#579)', () => {
      it.each<ContractStatus>(['DRAFT', 'SENT', 'SIGNED', 'VOID'])(
        'hides the %s contract on a cancelled booking',
        (status) => {
          expect(resolveContractVisibility(status, true)).toEqual({ visible: false, reason: 'cancelled' });
        },
      );

      it('still returns null (no concern) when a cancelled booking has no contract', () => {
        expect(resolveContractVisibility(null, true)).toBeNull();
      });
    });
  });

  describe('resolveUploadDocumentVisibility (#579)', () => {
    it('marks UPLOAD documents as never shared with the client', () => {
      expect(resolveUploadDocumentVisibility('UPLOAD')).toEqual({ visible: false, reason: 'not_shared' });
    });

    it.each(['CONTRACT', 'INVOICE', 'SONG_LIST'])(
      'defers %s to the stateful gate (returns null)',
      (type) => {
        expect(resolveUploadDocumentVisibility(type)).toBeNull();
      },
    );
  });

  describe('resolveMusicFormVisibility', () => {
    it('is visible when the config exists (form on)', () => {
      expect(resolveMusicFormVisibility(true)).toEqual({ visible: true });
    });

    it('is null (no concern) when the config is absent (form off)', () => {
      expect(resolveMusicFormVisibility(false)).toBeNull();
    });
  });
});
