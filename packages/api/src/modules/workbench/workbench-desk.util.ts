import { BadRequestException } from '@nestjs/common';

export const MIN_COUNTER_NUMBER = 1;
export const MAX_COUNTER_NUMBER = 999;

/** Validates and normalizes journey desk numbers (digits only, bounded). */
export function normalizeWorkbenchDeskNumber(raw: string): string {
  const digitsOnly = String(raw ?? '').replace(/\D/g, '');
  if (!digitsOnly) {
    throw new BadRequestException('Desk number is required');
  }
  const value = Number.parseInt(digitsOnly, 10);
  if (!Number.isFinite(value) || value < MIN_COUNTER_NUMBER || value > MAX_COUNTER_NUMBER) {
    throw new BadRequestException(
      `Desk number must be between ${MIN_COUNTER_NUMBER} and ${MAX_COUNTER_NUMBER}`,
    );
  }
  return String(value);
}
