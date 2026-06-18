import type { LegalDocumentContent } from './types';

export const loyaltyPrivacyContent: LegalDocumentContent = {
  intro:
    'This Patron Loyalty Privacy Policy describes how QlessQ ("we," "us") collects, uses, and discloses information when you register for and use the Patron Loyalty service (the "Loyalty Service"). It applies to organization administrators and staff. Patron-facing collection is controlled by your organization; see the Loyalty Program Privacy Notice for end patrons.',
  sections: [
    {
      id: 'scope',
      title: '1. Scope',
      body: 'This policy covers the Patron Loyalty product only. If you also use QlessQ queue management, our general Privacy Policy at queueplatform.com may apply to that product separately. Patron Loyalty may process richer patron profile data than queue check-in (for example birthday, gender, city, marketing preferences, loyalty history).',
    },
    {
      id: 'information-we-collect',
      title: '2. Information We Collect',
      body: 'Account information: administrator name, email, organization name, credentials, and billing contact details. Loyalty configuration: tiers, earn rules, rewards, coupons, campaigns, segments, and integration settings. Patron Data you submit or sync: names, contact details, loyalty points and redemptions, wallet balances, referral codes, staff tasks, campaign engagement, and optional profile fields patrons provide through your loyalty portal or staff forms. Technical data: IP address, browser type, usage logs, and security events. Payment data is processed by our payment provider; we do not store full card numbers.',
    },
    {
      id: 'how-we-use',
      title: '3. How We Use Information',
      body: 'We use information to provide and operate the Loyalty Service, authenticate users, deliver campaigns you configure, calculate points and tiers, generate analytics, respond to support requests, maintain security, and comply with legal obligations. We do not sell personal information. We may use contracted service providers (hosting, email/SMS delivery, analytics) under confidentiality and data-protection terms.',
    },
    {
      id: 'qlessq-connection',
      title: '4. Optional QlessQ Connection',
      body: 'When your organization licenses both QlessQ and Patron Loyalty, we may process queue and appointment outcomes (for example completed visits or no-shows) to update loyalty balances and segments. That processing uses shared patron identity where you have linked records. Loyalty-only organizations are not required to use QlessQ; patron activity may be imported or entered manually.',
    },
    {
      id: 'sharing',
      title: '5. How We Share Information',
      body: 'We share information with service providers that help us operate the Loyalty Service, with professional advisers when required by law, and with successors in a merger or acquisition. We process Patron Data on your instructions as your service provider. A subprocessor register is available on request or through your QlessQ agreements.',
    },
    {
      id: 'retention',
      title: '6. Retention and Security',
      body: 'We retain account and Patron Data while your subscription is active and for a reasonable period afterward for backup, audit, and legal compliance. You are responsible for retention settings and patron deletion requests that apply to your patrons. We implement administrative, technical, and organizational safeguards designed to protect information.',
    },
    {
      id: 'rights',
      title: '7. Your Rights',
      body: 'Depending on your location, you may have rights to access, correct, delete, or export personal information we hold about you as an administrator. Patrons should contact your organization first; we assist you in responding to patron requests about Patron Data we process on your behalf.',
    },
  ],
};
