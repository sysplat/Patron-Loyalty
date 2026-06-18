import { describe, it, expect } from 'vitest';
import { registerSchema } from './auth.validators';

const validBase = {
  businessName: 'Acme Corp',
  email: 'owner@acme.com',
  password: 'SecurePass1',
};

describe('registerSchema', () => {
  it('accepts registration when acceptLegal is true', () => {
    const result = registerSchema.safeParse({ ...validBase, acceptLegal: true });
    expect(result.success).toBe(true);
  });

  it('rejects registration when acceptLegal is missing', () => {
    const result = registerSchema.safeParse(validBase);
    expect(result.success).toBe(false);
  });

  it('rejects registration when acceptLegal is false', () => {
    const result = registerSchema.safeParse({ ...validBase, acceptLegal: false });
    expect(result.success).toBe(false);
  });

  it('accepts organizationName with optional first and last name', () => {
    const result = registerSchema.safeParse({
      organizationName: 'Acme Corp',
      firstName: 'Pat',
      lastName: 'Lee',
      email: 'owner@acme.com',
      password: 'SecurePass1',
      acceptLegal: true,
    });
    expect(result.success).toBe(true);
  });
});
