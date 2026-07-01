import {
  resolveContractVisibility,
  resolveMusicFormVisibility,
  resolveDocumentVisibility,
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

  describe('resolveDocumentVisibility (#580)', () => {
    const activeContractId = 'c-active';

    it('marks UPLOAD documents as never shared with the client', () => {
      expect(resolveDocumentVisibility({ type: 'UPLOAD' }, activeContractId)).toEqual({
        visible: false,
        reason: 'not_shared',
      });
    });

    it('always shows SONG_LIST documents', () => {
      expect(resolveDocumentVisibility({ type: 'SONG_LIST' }, activeContractId)).toEqual({ visible: true });
    });

    describe('CONTRACT documents', () => {
      it('shows the signed PDF of the active contract', () => {
        expect(
          resolveDocumentVisibility({ type: 'CONTRACT', contractId: activeContractId }, activeContractId),
        ).toEqual({ visible: true });
      });

      it('hides a superseded contract PDF as voided (its contract is VOID)', () => {
        expect(resolveDocumentVisibility({ type: 'CONTRACT', contractId: 'c-old' }, activeContractId)).toEqual({
          visible: false,
          reason: 'voided',
        });
      });

      it('hides a contract PDF with no contract link (unsigned copy) as voided', () => {
        expect(resolveDocumentVisibility({ type: 'CONTRACT', contractId: null }, activeContractId)).toEqual({
          visible: false,
          reason: 'voided',
        });
      });

      it('hides any contract PDF as cancelled on a cancelled booking (outermost gate)', () => {
        expect(
          resolveDocumentVisibility({ type: 'CONTRACT', contractId: activeContractId }, activeContractId, true),
        ).toEqual({ visible: false, reason: 'cancelled' });
      });
    });

    describe('INVOICE documents', () => {
      const invoiceCases: Array<[string, PortalVisibilityVerdict]> = [
        ['SENT', { visible: true }],
        ['PAID', { visible: true }],
        ['ISSUED', { visible: false, reason: 'until_sent' }],
        ['VOID', { visible: false, reason: 'voided' }],
        ['DRAFT', { visible: false, reason: 'until_sent' }],
      ];

      it.each(invoiceCases)('maps a %s invoice document to the expected verdict', (status, expected) => {
        expect(resolveDocumentVisibility({ type: 'INVOICE', invoice: { status } }, activeContractId)).toEqual(expected);
      });

      it('hides an invoice document whose invoice link has been cleared', () => {
        expect(resolveDocumentVisibility({ type: 'INVOICE', invoice: null }, activeContractId)).toEqual({
          visible: false,
          reason: 'until_sent',
        });
      });

      it('leaves a SENT invoice visible even on a cancelled booking (cancellation-fee stays payable)', () => {
        expect(
          resolveDocumentVisibility({ type: 'INVOICE', invoice: { status: 'SENT' } }, activeContractId, true),
        ).toEqual({ visible: true });
      });
    });
  });

  describe('resolveMusicFormVisibility (#533 draft → published)', () => {
    it('is null (no concern) when the config is absent (form off)', () => {
      expect(resolveMusicFormVisibility(false, false)).toBeNull();
      expect(resolveMusicFormVisibility(false, true)).toBeNull();
    });

    it('is hidden with reason not_published when the form is a draft (on, not published)', () => {
      expect(resolveMusicFormVisibility(true, false)).toEqual({ visible: false, reason: 'until_published' });
    });

    it('is visible once the form is published', () => {
      expect(resolveMusicFormVisibility(true, true)).toEqual({ visible: true });
    });

    it('defaults isPublished to false (a config without a publish is a draft)', () => {
      expect(resolveMusicFormVisibility(true)).toEqual({ visible: false, reason: 'until_published' });
    });
  });
});
