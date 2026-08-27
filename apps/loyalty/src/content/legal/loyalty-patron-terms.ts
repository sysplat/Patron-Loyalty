import type { LegalDocumentContent } from './types';

export const loyaltyPatronTermsContent: LegalDocumentContent = {
  intro:
    'These Loyalty Program Terms ("Terms") govern your use of the patron loyalty program portal, digital card, and related features (the "Loyalty Program") operated by the business or organization that enrolled you (the "Organization"). Sysplat provides the software on the Organization\'s behalf.',
  sections: [
    {
      id: 'relationship',
      title: '1. Relationship',
      body: "The Organization runs the Loyalty Program and decides how points are earned, rewards are offered, and marketing messages are sent. Sysplat is a technology service provider to the Organization. These Terms are between you and the Organization's program rules as implemented through our platform. Contact the Organization with questions about rewards, eligibility, or service complaints. Queue or appointment experiences may be governed by separate End-User Terms on Sysplat QPlatform.",
    },
    {
      id: 'participation',
      title: '2. Participation',
      body: "By using your loyalty link, digital card, or portal, you agree to participate according to the Organization's published program rules. Points, tiers, badges, and rewards have no cash value unless the Organization states otherwise. The Organization may change program rules, expire points, or end the program with notice as they determine.",
    },
    {
      id: 'redemptions',
      title: '3. Redemptions',
      body: 'Self-serve redemptions through the portal deduct points from your balance when successful. Some rewards may require in-store verification or staff approval. The Organization is responsible for honouring rewards. Sysplat is not responsible for product availability, pricing, or fulfilment by the Organization.',
    },
    {
      id: 'marketing',
      title: '4. Marketing',
      body: 'If you opt in to marketing from the Organization, you may receive promotional email, SMS, or in-app messages about offers and loyalty campaigns. Marketing is optional and separate from transactional loyalty messages (such as redemption confirmations) and from queue transactional SMS unless the Organization states otherwise. You may opt out through the method provided in each message or by contacting the Organization.',
    },
    {
      id: 'acceptable-use',
      title: '5. Acceptable Use',
      body: 'You agree to use the Loyalty Program only for its intended purpose and not to interfere with or disrupt the service.',
    },
    {
      id: 'limitation',
      title: '6. Limitation of Liability',
      body: "Sysplat is not liable for the Organization's products, services, or marketing practices. Disputes about rewards or patron treatment should be resolved with the Organization.",
    },
  ],
};
