import { LegalDocumentLayout } from '@/components/legal/legal-document-layout';
import { loyaltyTermsContent } from '@/content/legal/loyalty-terms';

export default function LoyaltyTermsPage() {
  return <LegalDocumentLayout documentKey="loyaltyTermsOfService" content={loyaltyTermsContent} />;
}
