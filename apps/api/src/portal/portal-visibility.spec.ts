import {
  resolveContractVisibility,
  resolveMusicFormVisibility,
  resolveDocumentVisibility,
  DOCUMENT_PORTAL_VISIBILITY_REASONS,
  PORTAL_AUDIENCES,
  type ContractStatus,
  type DocumentPortalVisibilityVerdict,
  type PortalDocumentInput,
  type PortalVisibilityVerdict,
} from './portal-visibility';

describe('portal-visibility authority (ADR-0054)', () => {
  // #890: the audience vocabulary itself, ahead of exercising it below.
  describe('PortalAudience', () => {
    it('is exactly CLIENT and BAND, in that order', () => {
      expect(PORTAL_AUDIENCES).toEqual(['CLIENT', 'BAND']);
    });
  });

  describe('resolveContractVisibility', () => {
    const cases: Array<[ContractStatus | null, PortalVisibilityVerdict | null]> = [
      [null, null],
      ['DRAFT', { visible: false, reason: 'until_sent' }],
      ['SENT', { visible: true }],
      ['SIGNED', { visible: true }],
      ['VOID', { visible: false, reason: 'voided' }],
    ];

    it.each(cases)('maps contract status %s to the expected verdict for CLIENT', (status, expected) => {
      expect(resolveContractVisibility(status, 'CLIENT')).toEqual(expected);
    });

    it.each(cases)('is unchanged for %s when the booking is not cancelled', (status, expected) => {
      expect(resolveContractVisibility(status, 'CLIENT', false)).toEqual(expected);
    });

    describe('cancelled booking is the outermost gate (#579)', () => {
      it.each<ContractStatus>(['DRAFT', 'SENT', 'SIGNED', 'VOID'])(
        'hides the %s contract on a cancelled booking',
        (status) => {
          expect(resolveContractVisibility(status, 'CLIENT', true)).toEqual({
            visible: false,
            reason: 'cancelled',
          });
        },
      );

      it('still returns null (no concern) when a cancelled booking has no contract', () => {
        expect(resolveContractVisibility(null, 'CLIENT', true)).toBeNull();
      });
    });

    // #890 / ADR-0073: the contract is a CLIENT-only concern, out of BAND_PORTAL_FIELDS scope.
    describe('BAND audience (#890, ADR-0073)', () => {
      it.each<[ContractStatus | null, boolean]>([
        [null, false],
        ['DRAFT', false],
        ['SENT', false],
        ['SENT', true],
        ['VOID', false],
      ])('is never a live concern for %s (cancelled=%s)', (status, cancelled) => {
        expect(resolveContractVisibility(status, 'BAND', cancelled)).toBeNull();
      });
    });
  });

  describe('resolveDocumentVisibility (#580)', () => {
    const activeContractId = 'c-active';

    it('marks UPLOAD documents as never shared with the client', () => {
      expect(resolveDocumentVisibility({ type: 'UPLOAD' }, activeContractId, 'CLIENT')).toEqual({
        visible: false,
        reason: 'not_shared',
      });
    });

    it('always shows SONG_LIST documents', () => {
      expect(resolveDocumentVisibility({ type: 'SONG_LIST' }, activeContractId, 'CLIENT')).toEqual({
        visible: true,
      });
    });

    // #893, ADR-0073 §4: the call sheet is BAND-only — never a CLIENT concern, regardless of
    // ownership/cancellation context.
    it('marks CALL_SHEET documents as never shared with the client', () => {
      expect(resolveDocumentVisibility({ type: 'CALL_SHEET' }, activeContractId, 'CLIENT')).toEqual({
        visible: false,
        reason: 'not_shared',
      });
    });

    describe('CONTRACT documents', () => {
      it('shows the signed PDF of the active contract', () => {
        expect(
          resolveDocumentVisibility(
            { type: 'CONTRACT', contractId: activeContractId },
            activeContractId,
            'CLIENT',
          ),
        ).toEqual({ visible: true });
      });

      it('hides a superseded contract PDF as voided (its contract is VOID)', () => {
        expect(
          resolveDocumentVisibility({ type: 'CONTRACT', contractId: 'c-old' }, activeContractId, 'CLIENT'),
        ).toEqual({
          visible: false,
          reason: 'voided',
        });
      });

      it('hides a contract PDF with no contract link (unsigned copy) as voided', () => {
        expect(
          resolveDocumentVisibility({ type: 'CONTRACT', contractId: null }, activeContractId, 'CLIENT'),
        ).toEqual({
          visible: false,
          reason: 'voided',
        });
      });

      it('hides any contract PDF as cancelled on a cancelled booking (outermost gate)', () => {
        expect(
          resolveDocumentVisibility(
            { type: 'CONTRACT', contractId: activeContractId },
            activeContractId,
            'CLIENT',
            true,
          ),
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
        expect(
          resolveDocumentVisibility({ type: 'INVOICE', invoice: { status } }, activeContractId, 'CLIENT'),
        ).toEqual(expected);
      });

      it('hides an invoice document whose invoice link has been cleared', () => {
        expect(
          resolveDocumentVisibility({ type: 'INVOICE', invoice: null }, activeContractId, 'CLIENT'),
        ).toEqual({
          visible: false,
          reason: 'until_sent',
        });
      });

      it('leaves a SENT invoice visible even on a cancelled booking (cancellation-fee stays payable)', () => {
        expect(
          resolveDocumentVisibility(
            { type: 'INVOICE', invoice: { status: 'SENT' } },
            activeContractId,
            'CLIENT',
            true,
          ),
        ).toEqual({ visible: true });
      });
    });

    // ADR-0054 amendment (2026-08-18) / #848: ownership is the outermost gate — a document not
    // owned by the booking asking about it is never visible, whatever its own state says. This is
    // the leak a BookingSeries invoice document (bookingId: null, unioned into every member
    // booking's Documents list) would otherwise open onto a member booking's portal.
    describe('ownership is the outermost gate (ADR-0054 amendment, #848)', () => {
      it.each(['SENT', 'PAID', 'ISSUED', 'VOID'])(
        'hides a %s invoice document not owned by this booking',
        (status) => {
          expect(
            resolveDocumentVisibility(
              { type: 'INVOICE', invoice: { status } },
              activeContractId,
              'CLIENT',
              false,
              false,
            ),
          ).toEqual({ visible: false, reason: 'other_booking' });
        },
      );

      it('still hides it on a cancelled booking (both gates agree, ownership wins first)', () => {
        expect(
          resolveDocumentVisibility(
            { type: 'INVOICE', invoice: { status: 'SENT' } },
            activeContractId,
            'CLIENT',
            true,
            false,
          ),
        ).toEqual({ visible: false, reason: 'other_booking' });
      });

      it('defaults ownedByBooking to true, leaving every existing call site unaffected', () => {
        expect(
          resolveDocumentVisibility(
            { type: 'INVOICE', invoice: { status: 'SENT' } },
            activeContractId,
            'CLIENT',
          ),
        ).toEqual({ visible: true });
      });
    });

    // #750: the DTO's Swagger enum is derived from DOCUMENT_PORTAL_VISIBILITY_REASONS, so that
    // array has to stay an accurate description of what this function can emit. These two guards
    // hold it there from both directions — at runtime over every branch, and at compile time.
    describe('reasons stay within the declared document subset (#750)', () => {
      const branches: PortalDocumentInput[] = [
        { type: 'UPLOAD' },
        { type: 'SONG_LIST' },
        { type: 'CALL_SHEET' },
        { type: 'CONTRACT', contractId: activeContractId },
        { type: 'CONTRACT', contractId: 'c-old' },
        { type: 'INVOICE', invoice: { status: 'SENT' } },
        { type: 'INVOICE', invoice: { status: 'ISSUED' } },
        { type: 'INVOICE', invoice: { status: 'VOID' } },
        { type: 'INVOICE', invoice: null },
      ];

      it.each(branches)('emits a declared reason for %j, cancelled or not', (doc) => {
        for (const cancelled of [false, true]) {
          const { reason } = resolveDocumentVisibility(doc, activeContractId, 'CLIENT', cancelled);
          if (reason !== undefined) {
            expect(DOCUMENT_PORTAL_VISIBILITY_REASONS).toContain(reason);
          }
        }
      });

      it('never admits until_published — that gate is booking-level, not per-document', () => {
        // A document verdict cannot be typed with the music-form reason. If this ever compiles,
        // the DTO enum has silently gone out of date and ts-jest fails the suite here.
        // @ts-expect-error -- 'until_published' is not a DocumentPortalVisibilityReason
        const impossible: DocumentPortalVisibilityVerdict = { visible: false, reason: 'until_published' };
        expect(impossible.reason).toBe('until_published');

        expect(DOCUMENT_PORTAL_VISIBILITY_REASONS).not.toContain('until_published');
      });
    });

    // #890 / ADR-0073 §3: BAND document visibility is a total, fail-closed mapping by type,
    // defaulting hidden — independent of the CLIENT-only contract/cancellation/ownership context.
    describe('BAND audience: fail-closed by type (#890, ADR-0073 §3)', () => {
      it.each(['CONTRACT', 'INVOICE', 'SONG_LIST', 'UPLOAD'])(
        'hides every currently-known type (%s) from the band, with no reason',
        (type) => {
          expect(resolveDocumentVisibility({ type }, activeContractId, 'BAND')).toEqual({
            visible: false,
          });
        },
      );

      it('stays hidden regardless of the CLIENT-only context (contract/cancellation/ownership)', () => {
        expect(
          resolveDocumentVisibility(
            { type: 'INVOICE', invoice: { status: 'SENT' } },
            activeContractId,
            'BAND',
            true,
            false,
          ),
        ).toEqual({ visible: false });
      });

      // #893, ADR-0073 §4: the call sheet is the one document type that crosses to the band —
      // fail-closed-by-default, opt-in by row, not opt-out.
      it('shows CALL_SHEET to the band, with no reason', () => {
        expect(resolveDocumentVisibility({ type: 'CALL_SHEET' }, activeContractId, 'BAND')).toEqual({
          visible: true,
        });
      });

      // The forward-compatibility case: a type not yet mirrored into this module's DocumentType
      // union (e.g. a real Prisma enum member landing before its BAND row does) still falls
      // through to hidden rather than throwing — forgetting is safe.
      it('hides an unmapped/unknown type rather than erroring', () => {
        expect(resolveDocumentVisibility({ type: 'FUTURE_TYPE' }, activeContractId, 'BAND')).toEqual({
          visible: false,
        });
      });
    });
  });

  describe('resolveMusicFormVisibility (#533 draft → published)', () => {
    it('is null (no concern) when the config is absent (form off)', () => {
      expect(resolveMusicFormVisibility(false, 'CLIENT', false)).toBeNull();
      expect(resolveMusicFormVisibility(false, 'CLIENT', true)).toBeNull();
    });

    it('is hidden with reason not_published when the form is a draft (on, not published)', () => {
      expect(resolveMusicFormVisibility(true, 'CLIENT', false)).toEqual({
        visible: false,
        reason: 'until_published',
      });
    });

    it('is visible once the form is published', () => {
      expect(resolveMusicFormVisibility(true, 'CLIENT', true)).toEqual({ visible: true });
    });

    it('defaults isPublished to false (a config without a publish is a draft)', () => {
      expect(resolveMusicFormVisibility(true, 'CLIENT')).toEqual({
        visible: false,
        reason: 'until_published',
      });
    });

    // #890 / ADR-0073: out of BAND_PORTAL_FIELDS scope, unconditionally.
    it.each([
      [false, false],
      [true, false],
      [true, true],
    ])('is never a live concern for BAND (hasConfig=%s, isPublished=%s)', (hasConfig, isPublished) => {
      expect(resolveMusicFormVisibility(hasConfig, 'BAND', isPublished)).toBeNull();
    });
  });
});
