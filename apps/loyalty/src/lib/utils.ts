import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPriority(p?: number | null): string {
  const val = p ?? 0;
  if (val >= 10) return 'Urgent';
  if (val >= 5) return 'High';
  return 'Normal';
}

export function formatCustomerPhone(phone?: string | null): string {
  if (!phone) return '';
  const cleanPhone = phone.trim();
  if (cleanPhone.length <= 4) {
    return cleanPhone;
  }
  const last4 = cleanPhone.slice(-4);
  const masked = '*'.repeat(cleanPhone.length - 4);
  return masked + last4;
}

export function formatCustomerName(name?: string | null): string {
  if (!name) return 'Anonymous';
  const trimmed = name.trim();
  if (!trimmed) return 'Anonymous';

  const parts = trimmed.split(/\s+/);
  if (parts.length <= 1) {
    return trimmed;
  }

  const firstName = parts[0];
  const lastName = parts[parts.length - 1];
  const familyInitial = lastName.charAt(0).toUpperCase();
  return `${firstName} ${familyInitial}.`;
}
