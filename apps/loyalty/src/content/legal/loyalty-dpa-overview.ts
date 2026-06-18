import type { LegalDocumentContent } from './types';

export const loyaltyDpaOverviewContent: LegalDocumentContent = {
  intro:
    'This overview summarizes the baseline data-processing commitments QlessQ applies when acting as a service provider for Patron Loyalty tenant organizations. It supports security and legal review workflows and should be read alongside your Patron Loyalty Terms of Service. QlessQ does not sell personal information.',
  sections: [
    {
      id: 'roles',
      title: '1. Roles',
      body: 'Tenant organization: data controller (or business) for patron profiles, loyalty balances, campaign audiences, and related Patron Data.\nQlessQ: data processor (or service provider) for Patron Data processed through the Loyalty Service.',
    },
    {
      id: 'processing-scope',
      title: '2. Processing Scope',
      body: 'QlessQ processes Patron Data to deliver patron CRM, loyalty points, tiers, rewards, campaigns, referrals, and related analytics requested by the tenant. When QlessQ queue management is also licensed, visit and appointment outcomes may be ingested to award loyalty automatically. QlessQ may use aggregated or operational data for internal service analysis; it does not sell personal information.',
    },
    {
      id: 'processor-commitments',
      title: '3. Core Processor Commitments',
      body: 'Process personal data only on documented tenant instructions.\nApply technical and organizational safeguards for confidentiality, integrity, and availability.\nRestrict personnel access to least privilege and business need.\nSupport controller requests for deletion, anonymization, and consent-audit evidence exports (including patron portal legal consent records).\nNotify controllers of confirmed incidents as required by applicable law and contract.\nDo not sell personal information processed on behalf of tenants.\nFlow equivalent data-protection obligations to subprocessors listed at /subprocessors.\nProvide notice of material subprocessor changes through the published subprocessor register and, where required, to organization account owners before a new subprocessor begins processing Patron Data.',
    },
    {
      id: 'cross-border',
      title: '4. Cross-Border Processing',
      body: 'QlessQ may process data in multiple jurisdictions through infrastructure and communications subprocessors. Applicable transfer safeguards must be documented in customer contracting artifacts.',
    },
    {
      id: 'related-documents',
      title: '5. Related Documents',
      body: 'Patron Loyalty Privacy Policy, Loyalty Program patron notices, subprocessor register, and incident response runbook are maintained as companion artifacts. This overview is not a substitute for executed contract language; legal counsel should validate it against active Patron Loyalty terms before external publication.',
    },
  ],
};
