import { LegalDocumentLayout } from '@/components/legal/legal-document-layout';
import { loyaltyPatronTermsContent } from '@/content/legal/loyalty-patron-terms';

export default function LoyaltyPatronTermsPage() {
  return (
    <LegalDocumentLayout documentKey="loyaltyPatronTerms" content={loyaltyPatronTermsContent} />
  );
}
