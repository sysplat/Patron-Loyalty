const TXN_SMS_COMPLIANCE_FOOTER = (_organizationName: string) => ` Reply STOP to cancel.`;

export function hasLegacySmsComplianceSuffix(body: string): boolean {
  const upper = body.toUpperCase();
  return (
    upper.includes('REPLY STOP') ||
    upper.includes('MSG&DATA RATES') ||
    upper.includes('QUEUEPLATFORM ALERTS') ||
    upper.includes('ALERTS VIA QUEUEPLATFORM') ||
    upper.includes('QLESSQ ALERTS') ||
    upper.includes('ALERTS VIA QLESSQ') ||
    // Legacy brand spelling — keep detecting templates stored before the rename.
    upper.includes('QLEESQ ALERTS') ||
    upper.includes('ALERTS VIA QLEESQ')
  );
}

export function stripLegacySmsComplianceSuffix(body: string): string {
  let result = body.trim();
  if (!result || !hasLegacySmsComplianceSuffix(result)) return result;

  result = result.replace(/\s*alerts via (?:QueuePlatform|QlessQ|QleesQ)\.?\s*/gi, ' ');
  result = result.replace(/\s*(?:QueuePlatform|QlessQ|QleesQ) alerts\.?\s*/gi, ' ');
  result = result.replace(/\s*Msg&data rates may apply\.?\s*/gi, ' ');
  result = result.replace(/\s*Reply STOP to opt out(?:,\s*HELP for help)?\.?\s*$/gi, '');
  return result.trim();
}

export function decorateTransactionalSmsBody(body: string, organizationName: string): string {
  const normalizedBody = body.trim();
  if (!normalizedBody) return normalizedBody;
  if (hasLegacySmsComplianceSuffix(normalizedBody)) {
    return normalizedBody;
  }
  return `${normalizedBody}${TXN_SMS_COMPLIANCE_FOOTER(organizationName)}`;
}
