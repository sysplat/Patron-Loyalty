import type { LegalDocumentContent } from './types';

export const loyaltySubprocessorsContent: LegalDocumentContent = {
  intro:
    'This register lists key subprocessors QlessQ uses to operate Patron Loyalty in production environments and to develop and support the platform. QlessQ does not sell personal information. It is updated when vendors are added, removed, or materially repurposed; material changes are communicated to organization account owners as described in our Privacy Policy and DPA overview.',
  sections: [
    {
      id: 'messaging',
      title: '1. Messaging and Communications',
      body: 'Twilio — transactional SMS delivery and inbound STOP/HELP webhook handling. Data categories: phone number, message content, delivery metadata.\n\nTwilio SendGrid — transactional email delivery. Data categories: email address, message content, delivery metadata.',
    },
    {
      id: 'billing',
      title: '2. Billing',
      body: 'Stripe — subscription billing and payment processing. Data categories: billing contact data, subscription metadata, payment events.',
    },
    {
      id: 'infrastructure',
      title: '3. Platform Infrastructure',
      body: 'Railway — application hosting and runtime infrastructure. Data categories: application logs, operational metadata, persisted service data.\n\nPostgreSQL (managed database) — primary data store for organizations, patrons, loyalty accounts, campaigns, and related records. Data categories: Patron Data and account data stored by the Loyalty Service.\n\nRedis — caching, job queues, session and rate-limiting metadata. Data categories: operational metadata; limited transient application data.\n\nCentrifugo — real-time event delivery to connected clients. Data categories: operational event metadata required for live dashboard updates.',
    },
    {
      id: 'observability',
      title: '4. Observability (when enabled)',
      body: 'Error and performance monitoring providers (for example Sentry, when configured) — application error reporting and performance diagnostics. Data categories: technical logs, stack traces, and operational metadata; configured to minimize personal information where practicable.',
    },
    {
      id: 'analytics-crm',
      title: '5. Internal Analytics and CRM (when used)',
      body: "CRM and business analytics platforms — internal relationship management and analysis of service usage, support interactions, and aggregated operational trends. Data categories: tenant account and contact information, support history, and aggregated or operational metrics. Used only for QlessQ's own business operations and service improvement; not for sale of personal information or third-party advertising lists.",
    },
    {
      id: 'ai-tooling',
      title: '6. AI-Assisted Development and Support',
      body: 'AI development and support platforms (including Cursor and comparable IDE copilots) and the large language model providers they use — software development, debugging, database schema and migration work, and customer support assistance for the Loyalty Service. Data categories: limited source code and configuration; database schema and migration content; operational and support-related content submitted by QlessQ personnel when investigating or resolving issues. End-user passwords and password hashes are not shared with these tools. Processing is subject to vendor confidentiality terms and, where available, privacy or zero-retention settings that limit storage and model training on submitted content.',
    },
    {
      id: 'versioning',
      title: '7. Versioning and Ownership',
      body: 'Last reviewed: June 17, 2026.\nOwner: Platform engineering and legal.\nMaterial changes to this register are reflected in the published version date above and communicated to organization account owners when required.',
    },
  ],
};
