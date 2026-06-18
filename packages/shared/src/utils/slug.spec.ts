import { describe, it, expect } from 'vitest';
import { generateSlug } from './slug';

describe('generateSlug', () => {
  it('converts a business name to a lowercase slug', () => {
    expect(generateSlug('My Awesome Business')).toBe('my-awesome-business');
  });

  it('removes special characters', () => {
    expect(generateSlug('Hello World! @#$%')).toBe('hello-world');
  });

  it('trims leading and trailing hyphens', () => {
    expect(generateSlug('  spaced out  ')).toBe('spaced-out');
  });

  it('handles empty string', () => {
    expect(generateSlug('')).toBe('');
  });
});
