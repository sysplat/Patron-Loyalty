import { LegalDocumentLayout } from '@/components/legal/legal-document-layout';
import { loyaltyDpaOverviewContent } from '@/content/legal/loyalty-dpa-overview';

export default function LoyaltyDpaPage() {
  return (
    <LegalDocumentLayout documentKey="loyaltyDpaOverview" content={loyaltyDpaOverviewContent} />
  );
}
