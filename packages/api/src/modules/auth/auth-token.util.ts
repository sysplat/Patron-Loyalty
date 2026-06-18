import { createHash, randomBytes } from 'crypto';

export const BCRYPT_ROUNDS = 12;

/** SHA-256 hash for high-entropy short-lived tokens (fast, indexed, no bcrypt needed) */
export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

export const generateToken = () => randomBytes(32).toString('hex');
