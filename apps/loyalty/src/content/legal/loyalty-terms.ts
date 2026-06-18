import type { LegalDocumentContent } from './types';

export const loyaltyTermsContent: LegalDocumentContent = {
  intro:
    'These Patron Loyalty Terms of Service ("Terms") govern your access to and use of the Patron Loyalty customer relationship and loyalty management service (the "Loyalty Service") provided by QlessQ. By creating a Patron Loyalty account, you agree to these Terms on behalf of yourself and the organization you represent.',
  sections: [
    {
      id: 'service',
      title: '1. Description of the Loyalty Service',
      body: 'Patron Loyalty is a separately licensed product from QlessQ queue management. It provides tools to manage patron profiles, loyalty points, tiers, rewards, coupons, referrals, marketing campaigns, and related analytics. The Loyalty Service may optionally connect to QlessQ queue data when both products are licensed for your organization; loyalty-only accounts may ingest patron activity through imports, staff entry, or the Integration API.',
    },
    {
      id: 'accounts',
      title: '2. Accounts and Security',
      body: 'You are responsible for account credentials and all activity under your organization. Provide accurate registration information and notify us promptly of unauthorized access. We may suspend accounts that violate these Terms or pose a security risk.',
    },
    {
      id: 'patron-data',
      title: '3. Patron and Customer Data',
      body: 'You retain ownership of patron data you submit ("Patron Data"), including contact details, loyalty balances, campaign audiences, and profile fields such as birthday or location when collected through the Loyalty Service. You grant us a limited license to host, process, and transmit Patron Data to provide the Loyalty Service. You are the data controller for your patrons; QlessQ acts as your service provider (processor) for Patron Data unless otherwise agreed in writing. You must provide appropriate privacy notices to patrons—including links to our Loyalty Program Privacy Notice and Terms—and obtain any required consent before sending marketing messages or collecting optional profile fields.',
    },
    {
      id: 'marketing-compliance',
      title: '4. Marketing and Messaging Compliance',
      body: 'Campaigns, SMS, email, and other outreach sent through Patron Loyalty must comply with applicable law, including CASL and similar anti-spam rules where your patrons are located. You are responsible for documenting consent, honouring opt-outs, and ensuring message content is accurate. Transactional loyalty messages (for example reward confirmations) should be distinguished from promotional messages in your patron notices.',
    },
    {
      id: 'acceptable-use',
      title: '5. Acceptable Use',
      body: 'You agree not to use the Loyalty Service for unlawful, harassing, or fraudulent purposes; to send unsolicited spam; to scrape or reverse engineer the Service except as permitted by law; or to process personal data without a lawful basis. High-risk categories prohibited for QlessQ queue services are also prohibited for Patron Loyalty unless we expressly approve otherwise in writing.',
    },
    {
      id: 'fees',
      title: '6. Fees and Trials',
      body: 'Paid loyalty plans, billing cycles, and trials are described at signup or on our pricing page. Fees are non-refundable except where required by law. Failure to pay may result in suspension.',
    },
    {
      id: 'disclaimers',
      title: '7. Disclaimers and Liability',
      body: 'THE LOYALTY SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. POINTS BALANCES, TIER STATUS, CAMPAIGN DELIVERY, AND REWARD FULFILMENT DEPEND ON YOUR CONFIGURATION AND OPERATIONS; WE DO NOT GUARANTEE SPECIFIC MARKETING OUTCOMES. TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR TOTAL LIABILITY SHALL NOT EXCEED AMOUNTS YOU PAID FOR PATRON LOYALTY IN THE TWELVE (12) MONTHS BEFORE THE CLAIM.',
    },
    {
      id: 'termination',
      title: '8. Termination',
      body: 'You may stop using the Loyalty Service at any time. We may suspend or terminate access for breach of these Terms or non-payment. Provisions that should survive termination (including data responsibilities and limitations of liability) will survive.',
    },
  ],
};
