import { LegalDocumentLayout } from '@/components/legal/legal-document-layout';
import { loyaltyPrivacyContent } from '@/content/legal/loyalty-privacy';

export default function LoyaltyPrivacyPage() {
  return <LegalDocumentLayout documentKey="loyaltyPrivacyPolicy" content={loyaltyPrivacyContent} />;
}
