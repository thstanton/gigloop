import { describe, it, expect } from 'vitest';
import {
  BUILT_IN_EMAIL_TYPES,
  BUILT_IN_DOCUMENT_TYPES,
  BUILT_IN_MESSAGE_TYPES,
  ALL_BUILT_IN_TEMPLATE_TYPES,
  BUILT_IN_TEMPLATE_META,
  TEMPLATE_FORMAT,
  TEMPLATE_DISPLAY,
  TEMPLATE_VARIABLES,
  ALL_VARIABLES,
  VAR_LABELS,
} from './templateMeta';

describe('templateMeta completeness', () => {
  it('declares the built-in catalog shape and derives its three groups in table order', () => {
    expect(BUILT_IN_TEMPLATE_META).toHaveLength(18);
    expect(BUILT_IN_EMAIL_TYPES).toHaveLength(14);
    expect(BUILT_IN_DOCUMENT_TYPES).toHaveLength(1);
    expect(BUILT_IN_MESSAGE_TYPES).toHaveLength(3);
    expect(ALL_BUILT_IN_TEMPLATE_TYPES).toHaveLength(18);
    expect(BUILT_IN_TEMPLATE_META.filter((row) => 'featureFlag' in row)).toHaveLength(6);

    for (const row of BUILT_IN_TEMPLATE_META) {
      expect(row.value).toBeTruthy();
      expect(row.name.length).toBeGreaterThan(0);
      expect(row.description.length).toBeGreaterThan(0);
      expect(['email', 'document', 'message']).toContain(row.group);
      expect(['rich', 'plain']).toContain(row.format);
      expect(Array.isArray(row.variables)).toBe(true);
      expect((row.group === 'message') === (row.format === 'plain')).toBe(true);
    }
    expect(ALL_BUILT_IN_TEMPLATE_TYPES).toEqual(BUILT_IN_TEMPLATE_META.map(({ value }) => value));
    expect(BUILT_IN_TEMPLATE_META.every(({ value }) => TEMPLATE_FORMAT[value])).toBe(true);
  });

  it('every built-in email type has an entry in TEMPLATE_DISPLAY', () => {
    for (const type of BUILT_IN_EMAIL_TYPES) {
      expect(TEMPLATE_DISPLAY[type]).toBeDefined();
    }
  });

  it('every built-in document type has an entry in TEMPLATE_DISPLAY', () => {
    for (const type of BUILT_IN_DOCUMENT_TYPES) {
      expect(TEMPLATE_DISPLAY[type]).toBeDefined();
    }
  });

  it('every TEMPLATE_DISPLAY entry has a non-empty name', () => {
    for (const type of ALL_BUILT_IN_TEMPLATE_TYPES) {
      expect(TEMPLATE_DISPLAY[type].name.length).toBeGreaterThan(0);
    }
  });

  it('every TEMPLATE_DISPLAY entry has a non-empty description', () => {
    for (const type of ALL_BUILT_IN_TEMPLATE_TYPES) {
      expect(TEMPLATE_DISPLAY[type].description.length).toBeGreaterThan(0);
    }
  });

  it('every built-in email type has an entry in TEMPLATE_VARIABLES', () => {
    for (const type of BUILT_IN_EMAIL_TYPES) {
      expect(TEMPLATE_VARIABLES[type]).toBeDefined();
    }
  });

  it('every built-in document type has an entry in TEMPLATE_VARIABLES', () => {
    for (const type of BUILT_IN_DOCUMENT_TYPES) {
      expect(TEMPLATE_VARIABLES[type]).toBeDefined();
    }
  });

  it('every TEMPLATE_VARIABLES entry contains objects with name and label', () => {
    for (const type of ALL_BUILT_IN_TEMPLATE_TYPES) {
      for (const v of TEMPLATE_VARIABLES[type]) {
        expect(typeof v.name).toBe('string');
        expect(typeof v.label).toBe('string');
        expect(v.name.length).toBeGreaterThan(0);
        expect(v.label.length).toBeGreaterThan(0);
      }
    }
  });

  it('every variable in TEMPLATE_VARIABLES references a known variable from ALL_VARIABLES', () => {
    const knownNames = new Set(ALL_VARIABLES.map((v) => v.name));
    for (const type of ALL_BUILT_IN_TEMPLATE_TYPES) {
      for (const v of TEMPLATE_VARIABLES[type]) {
        expect(knownNames.has(v.name)).toBe(true);
      }
    }
  });

  it('VAR_LABELS covers every variable in ALL_VARIABLES', () => {
    for (const v of ALL_VARIABLES) {
      expect(VAR_LABELS[v.name]).toBeDefined();
      expect(typeof VAR_LABELS[v.name]).toBe('string');
      expect(VAR_LABELS[v.name].length).toBeGreaterThan(0);
    }
  });

  it('VAR_LABELS values match the labels in ALL_VARIABLES', () => {
    for (const v of ALL_VARIABLES) {
      expect(VAR_LABELS[v.name]).toBe(v.label);
    }
  });

  it('no duplicate variable names in ALL_VARIABLES', () => {
    const names = ALL_VARIABLES.map((v) => v.name);
    expect(new Set(names).size).toBe(names.length);
  });

  // BUILT_IN_EMAIL_TYPES/BUILT_IN_DOCUMENT_TYPES are both derived from one row-per-type table
  // (templateMeta.ts) keyed by BuiltInTemplateType, so a type appearing twice or in both lists is
  // no longer reachable — these assert the derivation's shape against the canonical
  // ALL_BUILT_IN_TEMPLATE_TYPES list, not against the two lists' own concatenation.
  it('every declared built-in type belongs to exactly one of the email/document/message lists', () => {
    const emailSet = new Set(BUILT_IN_EMAIL_TYPES);
    const documentSet = new Set(BUILT_IN_DOCUMENT_TYPES);
    const messageSet = new Set(BUILT_IN_MESSAGE_TYPES);
    for (const type of ALL_BUILT_IN_TEMPLATE_TYPES) {
      expect([emailSet, documentSet, messageSet].filter((set) => set.has(type))).toHaveLength(1);
    }
    expect(BUILT_IN_EMAIL_TYPES.length + BUILT_IN_DOCUMENT_TYPES.length + BUILT_IN_MESSAGE_TYPES.length)
      .toBe(ALL_BUILT_IN_TEMPLATE_TYPES.length);
  });

  // Each page section is rendered in declaration order; pin every derived group against the table.
  it('preserves declaration order in each built-in template group', () => {
    for (const groupTypes of [BUILT_IN_EMAIL_TYPES, BUILT_IN_DOCUMENT_TYPES, BUILT_IN_MESSAGE_TYPES]) {
      const indices = groupTypes.map((type) => ALL_BUILT_IN_TEMPLATE_TYPES.indexOf(type));
      for (let i = 1; i < indices.length; i++) {
        expect(indices[i]).toBeGreaterThan(indices[i - 1]);
      }
    }
  });

  // Spot-checks for expected variable coverage on key templates
  it('contract_and_deposit_cover includes portalLink, invoiceTotal, and invoiceDueDate', () => {
    const names = TEMPLATE_VARIABLES['contract_and_deposit_cover'].map((v) => v.name);
    expect(names).toContain('portalLink');
    expect(names).toContain('invoiceTotal');
    expect(names).toContain('invoiceDueDate');
  });

  it('deposit_invoice_cover includes invoiceTotal and invoiceDueDate but not portalLink content gating', () => {
    const names = TEMPLATE_VARIABLES['deposit_invoice_cover'].map((v) => v.name);
    expect(names).toContain('invoiceTotal');
    expect(names).toContain('invoiceDueDate');
  });

  it('balance_invoice_cover includes invoiceTotal and invoiceDueDate', () => {
    const names = TEMPLATE_VARIABLES['balance_invoice_cover'].map((v) => v.name);
    expect(names).toContain('invoiceTotal');
    expect(names).toContain('invoiceDueDate');
  });

  it('contract template includes all booking-detail variables', () => {
    const names = TEMPLATE_VARIABLES['contract'].map((v) => v.name);
    expect(names).toContain('customerName');
    expect(names).toContain('bookingDate');
    expect(names).toContain('venueName');
    expect(names).toContain('bookingFee');
    expect(names).toContain('setsSchedule');
    expect(names).toContain('musicianName');
  });


});
