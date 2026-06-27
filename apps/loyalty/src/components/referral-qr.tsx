'use client';

import { QRCodeSVG } from 'qrcode.react';

export function ReferralQr({ value, size = 128 }: { value: string; size?: number }) {
  return (
    <QRCodeSVG
      value={value}
      size={size}
      level="M"
      className="rounded-md bg-white p-2"
      aria-label="Referral invite QR code"
    />
  );
}
