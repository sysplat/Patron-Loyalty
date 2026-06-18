import { LegalDocumentLayout } from '@/components/legal/legal-document-layout';
import { loyaltySubprocessorsContent } from '@/content/legal/loyalty-subprocessors';

export default function LoyaltySubprocessorsPage() {
  return (
    <LegalDocumentLayout documentKey="loyaltySubprocessors" content={loyaltySubprocessorsContent} />
  );
}
