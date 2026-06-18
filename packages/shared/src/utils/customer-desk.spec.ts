import { describe, expect, it } from 'vitest';
import {
  formatCustomerDeskLabel,
  formatCustomerDeskPhrase,
  formatDeskLabelOrDefault,
  normalizeCustomerDeskNumber,
} from './customer-desk';

describe('customer-desk', () => {
  it('normalizes desk numbers', () => {
    expect(normalizeCustomerDeskNumber('2')).toBe('2');
    expect(normalizeCustomerDeskNumber('Desk 3')).toBe('3');
    expect(normalizeCustomerDeskNumber('')).toBeNull();
  });

  it('formats customer desk labels', () => {
    expect(formatCustomerDeskLabel('1')).toBe('Desk 1');
    expect(formatCustomerDeskLabel(null)).toBeNull();
  });

  it('formats desk phrases with fallback', () => {
    expect(formatCustomerDeskPhrase('2')).toBe('Desk 2');
    expect(formatCustomerDeskPhrase(undefined)).toBe('the service desk');
  });

  it('formats desk label with default fallback', () => {
    expect(formatDeskLabelOrDefault('2')).toBe('Desk 2');
    expect(formatDeskLabelOrDefault(undefined)).toBe('Desk');
  });
});
