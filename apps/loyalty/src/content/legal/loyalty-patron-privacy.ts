import type { LegalDocumentContent } from './types';

export const loyaltyPatronPrivacyContent: LegalDocumentContent = {
  intro:
    'This Loyalty Program Privacy Notice explains how QlessQ processes your personal information on behalf of the organization that operates your loyalty program (the "Organization") when you use the patron loyalty portal, digital card, or related features. This notice is separate from privacy notices you may have seen when joining a queue or booking an appointment.',
  sections: [
    {
      id: 'role',
      title: '1. Our Role',
      body: 'QlessQ acts as a service provider (data processor) to the Organization (the data controller). The Organization decides why and how your loyalty data is used. For requests about your loyalty profile, marketing preferences, or reward history, contact the Organization first; we support them in responding.',
    },
    {
      id: 'information-collected',
      title: '2. Information We Collect',
      body: 'We may process: your name and loyalty identifier; points balance, tier, badges, and challenge progress; reward redemptions and wallet activity; referral code usage; optional profile fields you submit (such as birthday, gender, or city); visit or purchase history linked to your loyalty account when the Organization connects queue, POS, or integration data; and technical data (device, browser, access times) to secure the portal.',
    },
    {
      id: 'how-used',
      title: '3. How We Use Your Information',
      body: 'We use your information to operate the Loyalty Program: displaying your balance and rewards, processing redemptions you request, running campaigns the Organization configures, calculating tiers and gamification, and preventing fraud. We do not sell your personal information. We do not use your loyalty data to train external third-party AI models for advertising.',
    },
    {
      id: 'marketing',
      title: '4. Marketing and CRM',
      body: 'If you opt in, the Organization may use your contact details for promotional email, SMS, or similar messages through Patron Loyalty tools. Marketing consent is optional and does not affect basic loyalty features unless the Organization states otherwise. You may withdraw marketing consent through the Organization or opt-out links in messages.',
    },
    {
      id: 'difference-from-queue',
      title: '5. Difference from Queue Check-In',
      body: 'Joining a walk-in queue or booking an appointment may collect only minimal contact details for operational messages. The loyalty portal may collect additional optional profile fields to personalize offers. Each collection context is governed by the notice presented to you at that time.',
    },
    {
      id: 'retention',
      title: '6. Retention and Security',
      body: "We retain loyalty data according to the Organization's instructions and our platform defaults for security, audit, and legal compliance. The Organization is responsible for retention practices that meet applicable law. We use industry-standard safeguards to protect information in transit and at rest.",
    },
    {
      id: 'rights',
      title: '7. Your Choices',
      body: 'You may update certain profile fields in the portal when enabled. For access, correction, deletion, or marketing opt-out requests, contact the Organization. We will assist the Organization as their service provider.',
    },
  ],
};
