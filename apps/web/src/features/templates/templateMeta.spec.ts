import { describe, it, expect } from 'vitest';
import {
  BUILT_IN_EMAIL_TYPES,
  BUILT_IN_DOCUMENT_TYPES,
  TEMPLATE_DISPLAY,
  TEMPLATE_VARIABLES,
  ALL_VARIABLES,
  VAR_LABELS,
} from './templateMeta';
import type { BuiltInTemplateType } from '@/types/api';

const ALL_BUILT_IN_TYPES: BuiltInTemplateType[] = [...BUILT_IN_EMAIL_TYPES, ...BUILT_IN_DOCUMENT_TYPES];

describe('templateMeta completeness', () => {
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
    for (const type of ALL_BUILT_IN_TYPES) {
      expect(TEMPLATE_DISPLAY[type].name.length).toBeGreaterThan(0);
    }
  });

  it('every TEMPLATE_DISPLAY entry has a non-empty description', () => {
    for (const type of ALL_BUILT_IN_TYPES) {
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
    for (const type of ALL_BUILT_IN_TYPES) {
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
    for (const type of ALL_BUILT_IN_TYPES) {
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

  it('no duplicate type entries in BUILT_IN_EMAIL_TYPES', () => {
    expect(new Set(BUILT_IN_EMAIL_TYPES).size).toBe(BUILT_IN_EMAIL_TYPES.length);
  });

  it('no duplicate type entries in BUILT_IN_DOCUMENT_TYPES', () => {
    expect(new Set(BUILT_IN_DOCUMENT_TYPES).size).toBe(BUILT_IN_DOCUMENT_TYPES.length);
  });

  it('email and document type lists do not overlap', () => {
    const emailSet = new Set(BUILT_IN_EMAIL_TYPES);
    for (const type of BUILT_IN_DOCUMENT_TYPES) {
      expect(emailSet.has(type)).toBe(false);
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

  it('invoice template includes all invoice-specific variables', () => {
    const names = TEMPLATE_VARIABLES['invoice'].map((v) => v.name);
    expect(names).toContain('invoiceTotal');
    expect(names).toContain('invoiceDueDate');
    expect(names).toContain('issueDate');
    expect(names).toContain('customerName');
    expect(names).toContain('musicianName');
  });
});
