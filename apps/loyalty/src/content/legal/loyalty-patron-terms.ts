import type { LegalDocumentContent } from './types';

export const loyaltyPatronTermsContent: LegalDocumentContent = {
  intro:
    'These Loyalty Program Terms ("Terms") govern your use of the patron loyalty program portal, digital card, and related features (the "Loyalty Program") operated by the business or organization that enrolled you (the "Organization"). QlessQ provides the software on the Organization\'s behalf.',
  sections: [
    {
      id: 'relationship',
      title: '1. Our Relationship',
      body: "The Organization runs the Loyalty Program and decides how points are earned, rewards are offered, and marketing messages are sent. QlessQ is a technology service provider to the Organization. These Terms are between you and the Organization's program rules as implemented through our platform. Contact the Organization with questions about rewards, eligibility, or service complaints.",
    },
    {
      id: 'program-participation',
      title: '2. Program Participation',
      body: "By using your loyalty link, digital card, or portal, you agree to participate according to the Organization's published program rules. Points, tiers, badges, and rewards have no cash value unless the Organization states otherwise. The Organization may change program rules, expire points, or end the program with notice as they determine.",
    },
    {
      id: 'profile-data',
      title: '3. Profile and Personal Information',
      body: 'You may choose to provide optional profile information (such as birthday or city) to receive personalized rewards or birthday offers. Providing optional information is voluntary unless the Organization requires specific fields for a reward you request. Our Loyalty Program Privacy Notice describes how information is handled.',
    },
    {
      id: 'redemptions',
      title: '4. Rewards and Redemptions',
      body: 'Self-serve redemptions through the portal deduct points from your balance when successful. Some rewards may require in-store verification or staff approval. The Organization is responsible for honouring rewards. QlessQ is not responsible for product availability, pricing, or fulfilment by the Organization.',
    },
    {
      id: 'marketing',
      title: '5. Marketing Communications',
      body: 'If you opt in to marketing from the Organization, you may receive promotional email, SMS, or in-app messages about offers and loyalty campaigns. Marketing is optional and separate from transactional loyalty messages (such as redemption confirmations). You may opt out through the method provided in each message or by contacting the Organization.',
    },
    {
      id: 'acceptable-use',
      title: '6. Acceptable Use',
      body: "Do not misuse referral codes, attempt to manipulate points balances, share access links in ways that violate the Organization's rules, or interfere with the Loyalty Program.",
    },
    {
      id: 'limitation',
      title: '7. Limitation of Liability',
      body: "QlessQ is not liable for the Organization's products, services, or marketing practices. Disputes about rewards or patron treatment should be resolved with the Organization.",
    },
  ],
};
