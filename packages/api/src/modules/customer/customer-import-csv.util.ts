/**
 * Minimal RFC 4180 CSV helpers for patron import (no extra dependency).
 */

export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    // Skip completely empty trailing lines
    if (row.length === 1 && row[0] === '' && rows.length > 0) {
      row = [];
      return;
    }
    rows.push(row);
    row = [];
  };

  const input = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      pushField();
      continue;
    }
    if (ch === '\n') {
      pushField();
      pushRow();
      continue;
    }
    if (ch === '\r') {
      continue;
    }
    field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    pushField();
    pushRow();
  }
  return rows;
}

/** Normalize header cells: trim, lower, spaces/hyphens → underscores. */
export function normalizeCsvHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

const HEADER_ALIASES: Record<string, string> = {
  name: 'name',
  email: 'email',
  phone: 'phone',
  phonenumber: 'phone',
  mobile: 'phone',
  external_id: 'externalId',
  externalid: 'externalId',
  tags: 'tags',
  notes: 'notes',
  birthday: 'birthday',
  birthdate: 'birthday',
  dob: 'birthday',
  gender: 'gender',
  address_line1: 'addressLine1',
  address: 'addressLine1',
  address1: 'addressLine1',
  city: 'city',
  region: 'region',
  state: 'region',
  postal_code: 'postalCode',
  postalcode: 'postalCode',
  zip: 'postalCode',
  zipcode: 'postalCode',
  country: 'country',
  marketing_sms_consent: 'marketingSmsConsent',
  marketing_email_consent: 'marketingEmailConsent',
  sms_consent: 'marketingSmsConsent',
  email_consent: 'marketingEmailConsent',
  opening_points: 'openingPoints',
  points: 'openingPoints',
  points_balance: 'openingPoints',
};

export function mapCsvHeaderToField(header: string): string | null {
  const key = normalizeCsvHeader(header);
  return HEADER_ALIASES[key] ?? null;
}

export function csvRowsToObjects(rows: string[][]): {
  records: Array<{ rowNumber: number; record: Record<string, string> }>;
} {
  if (rows.length === 0) {
    return { records: [] };
  }
  const headerCells = rows[0]!;
  const fieldKeys = headerCells.map((h) => mapCsvHeaderToField(h));
  const records: Array<{ rowNumber: number; record: Record<string, string> }> = [];

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r]!;
    const isBlank = cells.every((c) => !c || !c.trim());
    if (isBlank) continue;
    const record: Record<string, string> = {};
    for (let c = 0; c < fieldKeys.length; c++) {
      const key = fieldKeys[c];
      if (!key) continue;
      record[key] = (cells[c] ?? '').trim();
    }
    records.push({ rowNumber: r + 1, record });
  }

  return { records };
}
