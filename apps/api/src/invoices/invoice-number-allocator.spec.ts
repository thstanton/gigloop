import { allocate, buildInvoiceNumber, resolveFormat } from './invoice-number-allocator';

describe('resolveFormat', () => {
  it('returns defaults when preferences has no invoiceNumberFormat', () => {
    const fmt = resolveFormat({});
    expect(fmt).toEqual({ prefix: 'INV', includeYear: true, paddingWidth: 3 });
  });

  it('returns defaults when invoiceNumberFormat is undefined', () => {
    const fmt = resolveFormat({ invoiceNumberFormat: undefined });
    expect(fmt).toEqual({ prefix: 'INV', includeYear: true, paddingWidth: 3 });
  });

  it('applies custom prefix', () => {
    const fmt = resolveFormat({ invoiceNumberFormat: { prefix: 'MUSIC' } });
    expect(fmt.prefix).toBe('MUSIC');
  });

  it('applies empty string prefix', () => {
    const fmt = resolveFormat({ invoiceNumberFormat: { prefix: '' } });
    expect(fmt.prefix).toBe('');
  });

  it('applies includeYear=false', () => {
    const fmt = resolveFormat({ invoiceNumberFormat: { includeYear: false } });
    expect(fmt.includeYear).toBe(false);
  });

  it('applies valid paddingWidth values', () => {
    for (const w of [1, 3, 4, 6] as const) {
      const fmt = resolveFormat({ invoiceNumberFormat: { paddingWidth: w } });
      expect(fmt.paddingWidth).toBe(w);
    }
  });

  it('falls back to default paddingWidth for invalid value', () => {
    const fmt = resolveFormat({ invoiceNumberFormat: { paddingWidth: 2 } });
    expect(fmt.paddingWidth).toBe(3);
  });
});

describe('buildInvoiceNumber', () => {
  it('produces default format INV-YYYY-NNN', () => {
    expect(buildInvoiceNumber(1, 2026, { prefix: 'INV', includeYear: true, paddingWidth: 3 })).toBe('INV-2026-001');
  });

  it('custom prefix, no year, 4-digit padding', () => {
    expect(buildInvoiceNumber(1, 2026, { prefix: 'MUSIC', includeYear: false, paddingWidth: 4 })).toBe('MUSIC-0001');
  });

  it('empty prefix with year', () => {
    expect(buildInvoiceNumber(42, 2026, { prefix: '', includeYear: true, paddingWidth: 3 })).toBe('2026-042');
  });

  it('empty prefix, no year', () => {
    expect(buildInvoiceNumber(7, 2026, { prefix: '', includeYear: false, paddingWidth: 1 })).toBe('7');
  });

  it('6-digit padding', () => {
    expect(buildInvoiceNumber(5, 2026, { prefix: 'INV', includeYear: false, paddingWidth: 6 })).toBe('INV-000005');
  });
});

describe('allocate', () => {
  const defaultPrefs = {};
  const currentYear = 2026;

  describe('normal sequence increment', () => {
    it('increments sequence by 1', () => {
      const result = allocate(defaultPrefs, currentYear, 5, currentYear);
      expect(result.nextSeq).toBe(6);
      expect(result.nextYear).toBe(currentYear);
      expect(result.invoiceNumber).toBe('INV-2026-006');
    });

    it('uses seq 1 when currentSeq is 0', () => {
      const result = allocate(defaultPrefs, currentYear, 0, currentYear);
      expect(result.nextSeq).toBe(1);
      expect(result.invoiceNumber).toBe('INV-2026-001');
    });
  });

  describe('year rollover', () => {
    it('resets seq to 1 when seqYear is behind currentYear and includeYear is true', () => {
      const result = allocate(defaultPrefs, 2026, 99, 2025);
      expect(result.nextSeq).toBe(1);
      expect(result.nextYear).toBe(2026);
      expect(result.invoiceNumber).toBe('INV-2026-001');
    });

    it('does not roll over when includeYear is false', () => {
      const prefs = { invoiceNumberFormat: { includeYear: false } };
      const result = allocate(prefs, 2026, 99, 2025);
      expect(result.nextSeq).toBe(100);
    });
  });

  describe('void-slot inheritance', () => {
    it('keeps the same number when the style is unchanged', () => {
      const result = allocate(defaultPrefs, currentYear, 5, currentYear, { invoiceNumber: 'INV-2026-003', year: 2026 });
      expect(result.invoiceNumber).toBe('INV-2026-003');
    });

    it('re-renders the reused sequence with the current template', () => {
      const prefs = { invoiceNumberFormat: { prefix: '', includeYear: false, paddingWidth: 6 } };
      const result = allocate(prefs, currentYear, 5, currentYear, { invoiceNumber: 'INV-2026-006', year: 2026 });
      expect(result.invoiceNumber).toBe('000006');
    });

    it('uses the voided year for the re-rendered number', () => {
      const result = allocate(defaultPrefs, 2027, 5, 2027, { invoiceNumber: 'INV-2026-006', year: 2026 });
      expect(result.invoiceNumber).toBe('INV-2026-006');
    });

    it('falls back to the verbatim number when the sequence is unparseable', () => {
      const result = allocate(defaultPrefs, currentYear, 5, currentYear, { invoiceNumber: 'LEGACY-X', year: 2026 });
      expect(result.invoiceNumber).toBe('LEGACY-X');
    });

    it('does not advance nextSeq when void inherited', () => {
      const result = allocate(defaultPrefs, currentYear, 5, currentYear, { invoiceNumber: 'INV-2026-003', year: 2026 });
      expect(result.nextSeq).toBe(5);
    });

    it('preserves seqYear when void inherited', () => {
      const result = allocate(defaultPrefs, 2026, 5, 2025, { invoiceNumber: 'INV-2025-099', year: 2025 });
      expect(result.nextYear).toBe(2025);
    });

    it('treats null voided as no void', () => {
      const result = allocate(defaultPrefs, currentYear, 5, currentYear, null);
      expect(result.nextSeq).toBe(6);
    });

    it('treats undefined voided as no void', () => {
      const result = allocate(defaultPrefs, currentYear, 5, currentYear);
      expect(result.nextSeq).toBe(6);
    });
  });

  describe('format variants', () => {
    it('no prefix, no year', () => {
      const prefs = { invoiceNumberFormat: { prefix: '', includeYear: false, paddingWidth: 4 } };
      const result = allocate(prefs, currentYear, 0, currentYear);
      expect(result.invoiceNumber).toBe('0001');
    });

    it('custom prefix with year', () => {
      const prefs = { invoiceNumberFormat: { prefix: 'GM', includeYear: true, paddingWidth: 6 } };
      const result = allocate(prefs, currentYear, 0, currentYear);
      expect(result.invoiceNumber).toBe('GM-2026-000001');
    });
  });
});
