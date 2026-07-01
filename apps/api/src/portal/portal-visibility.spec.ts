import {
  resolveContractVisibility,
  resolveMusicFormVisibility,
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
