import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('joins truthy class names and drops falsy ones', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b');
  });

  it('lets later Tailwind utilities win conflicting earlier ones', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('text-sm', 'text-lg')).toBe('text-lg');
  });

  it('supports conditional object and array inputs', () => {
    expect(cn(['a', 'b'], { c: true, d: false })).toBe('a b c');
  });

  it('returns an empty string when given nothing meaningful', () => {
    expect(cn(false, null, undefined)).toBe('');
  });
});
