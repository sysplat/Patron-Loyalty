import { LegalDocumentLayout } from '@/components/legal/legal-document-layout';
import { qplatformIntegrationAddendumContent } from '@/content/legal/qplatform-integration-addendum';

export default function QplatformIntegrationAddendumPage() {
  return (
    <LegalDocumentLayout
      documentKey="qplatformIntegrationAddendum"
      content={qplatformIntegrationAddendumContent}
    />
  );
}
