import type { LegalDocumentContent } from './types';

/**
 * Mirror of the QPlatform Loyalty Integration Addendum for tenants reviewing
 * Patron Loyalty legal pages. Authoritative connector UX lives on QPlatform.
 */
export const qplatformIntegrationAddendumContent: LegalDocumentContent = {
  intro:
    'This Integration Data Processing Addendum ("Addendum") describes how Sysplat QPlatform and Sysplat Patron Loyalty process patron-related data when your organization ("you," the tenant / data controller) explicitly connects queue management to Patron Loyalty. It forms part of your documented instructions to us as your service provider (data processor). Sysplat does not sell personal information.',
  sections: [
    {
      id: 'scope-and-roles',
      title: '1. Scope and Roles',
      body: 'This Addendum applies when an authorized administrator links the Patron Loyalty connector from QPlatform (Settings → Integrations) or equivalent API. Until that link exists, queue data is not forwarded to Patron Loyalty for your organization.\n\nYou are the data controller. Sysplat QPlatform and Sysplat Patron Loyalty are affiliated products of the same platform provider acting as your service provider (processor). Patron Loyalty is not an independent third-party buyer of your data. Third-party infrastructure and messaging vendors remain subprocessors listed at /subprocessors.',
    },
    {
      id: 'your-instruction',
      title: '2. Your Documented Instruction',
      body: 'By connecting the connector and confirming the data-transfer acknowledgment on QPlatform, you instruct us to transmit applicable patron and visit data from QPlatform to Patron Loyalty, including a one-time historical backfill of eligible past events, and to continue forwarding new eligible events while the link remains active. You represent that you have provided appropriate patron notices and have a lawful basis for this processing and any loyalty or marketing use you configure.',
    },
    {
      id: 'data-categories',
      title: '3. Data Categories Received from QPlatform',
      body: 'When linked, Patron Loyalty may receive: patron name, email, phone, and matching identifiers; branch and service identifiers; visit and appointment outcomes (completed / served, no-show); review ratings or content when submitted through QPlatform; and event metadata (timestamps, event type, idempotency identifiers).\n\nMarketing or SMS consent history is not transferred from QPlatform by default. Marketing consent for loyalty campaigns must be collected under Patron Loyalty notices unless you configure a flow that requires otherwise.',
    },
    {
      id: 'loyalty-side-data',
      title: '4. Data Stored in Patron Loyalty',
      body: 'In addition to synced queue outcomes, Patron Loyalty may store points, tiers, rewards, redemptions, campaigns, referrals, staff CRM tasks, and optional profile fields patrons or staff enter (for example birthday, gender, city, preferences). Those fields are governed by these Patron Loyalty Terms and the Loyalty Program Privacy Notice.',
    },
    {
      id: 'disconnect-and-dsar',
      title: '5. Disconnect, Retention, and Privacy Requests',
      body: 'Disconnecting the connector on QPlatform stops new queue-event transfers. Data already in Patron Loyalty remains under your loyalty subscription and retention practices until you delete it. Disconnect does not automatically erase loyalty profiles or points.\n\nAs controller, you respond to patron privacy requests. Apply access, correction, or deletion in both products when both hold related records. Deletion in one product does not automatically cascade to the other unless a documented cross-product workflow is enabled.',
    },
    {
      id: 'incidents',
      title: '6. Security Incidents',
      body: 'Confirmed personal-data incidents affecting Customer Data or Patron Data we process for you are notified as required by applicable law and contract, with coordination across QPlatform and Patron Loyalty when both are involved.',
    },
    {
      id: 'related-documents',
      title: '7. Related Documents',
      body: 'Patron Loyalty Terms (/terms), Privacy (/privacy), DPA (/dpa), and Subprocessors (/subprocessors).\nQPlatform publishes the companion connector Addendum at its /loyalty-integration path, plus QPlatform Terms, Privacy, and patron queue notices.\nIf this Addendum conflicts with a separately executed data processing agreement signed by both parties, the executed agreement controls for the conflict.',
    },
  ],
};
