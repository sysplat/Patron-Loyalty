import * as dns from 'dns/promises';
import { BadRequestException } from '@nestjs/common';

/**
 * Professional email validator that performs DNS MX record lookups to ensure
 * the domain is capable of receiving email, and specifically detects if
 * it is a Google-managed mailbox.
 */
export async function validateEmailExistence(email: string): Promise<{ isGoogle: boolean }> {
  const domain = email.split('@')[1];
  if (!domain) {
    throw new BadRequestException('Invalid email format');
  }

  try {
    const mxRecords = await dns.resolveMx(domain);

    if (!mxRecords || mxRecords.length === 0) {
      throw new BadRequestException(
        `The domain ${domain} cannot receive emails (no MX records found).`,
      );
    }

    // Check if any MX record points to Google
    const isGoogle = mxRecords.some(
      (mx) =>
        mx.exchange.toLowerCase().includes('google.com') ||
        mx.exchange.toLowerCase().includes('googlemail.com'),
    );

    return { isGoogle };
  } catch (error) {
    // ENOTFOUND means the domain doesn't exist
    if ((error as any).code === 'ENOTFOUND') {
      throw new BadRequestException(`The domain ${domain} does not exist.`);
    }

    // NODATA or other DNS errors
    throw new BadRequestException(
      `Could not verify the email domain ${domain}. Please check for typos.`,
    );
  }
}
