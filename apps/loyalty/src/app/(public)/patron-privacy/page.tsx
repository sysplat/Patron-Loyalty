import { LegalDocumentLayout } from '@/components/legal/legal-document-layout';
import { loyaltyPatronPrivacyContent } from '@/content/legal/loyalty-patron-privacy';

export default function LoyaltyPatronPrivacyPage() {
  return (
    <LegalDocumentLayout documentKey="loyaltyPatronPrivacy" content={loyaltyPatronPrivacyContent} />
  );
}
