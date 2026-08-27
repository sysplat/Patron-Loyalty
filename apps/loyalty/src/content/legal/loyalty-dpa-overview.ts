import type { LegalDocumentContent } from './types';

export const loyaltyDpaOverviewContent: LegalDocumentContent = {
  intro:
    'This overview summarizes the baseline data-processing commitments Sysplat applies when acting as a service provider for Patron Loyalty tenant organizations. It supports security and legal review workflows and should be read alongside your Patron Loyalty Terms of Service and, when applicable, the QPlatform Integration Addendum. Sysplat does not sell personal information.',
  sections: [
    {
      id: 'roles',
      title: '1. Roles',
      body: 'Tenant organization: data controller (or business) for patron profiles, loyalty balances, campaign audiences, and related Patron Data.\nSysplat: data processor (or service provider) for Patron Data processed through the Loyalty Service.\nSysplat QPlatform: affiliated product of the same platform provider; when linked, also processes and transfers queue outcomes under your instructions.',
    },
    {
      id: 'processing-scope',
      title: '2. Processing Scope',
      body: 'Sysplat processes Patron Data to deliver patron CRM, loyalty points, tiers, rewards, campaigns, referrals, and related analytics requested by the tenant. When Sysplat QPlatform queue management is also licensed and linked, visit and appointment outcomes—including historical backfill on first connect—may be ingested to award loyalty automatically. Sysplat may use aggregated or operational data for internal service analysis; it does not sell personal information.',
    },
    {
      id: 'processor-commitments',
      title: '3. Core Processor Commitments',
      body: 'Process personal data only on documented tenant instructions.\nApply technical and organizational safeguards for confidentiality, integrity, and availability.\nRestrict personnel access to least privilege and business need.\nSupport controller requests for access, correction, deletion, anonymization, and consent-audit evidence exports; when both QPlatform and Patron Loyalty are used, assist across both systems as described at /qplatform-integration (deletion in one product does not automatically cascade unless a documented cross-product workflow is enabled).\nNotify controllers of confirmed personal-data incidents as required by applicable law and contract.\nDo not sell personal information processed on behalf of tenants.\nFlow equivalent data-protection obligations to third-party subprocessors listed at /subprocessors.\nProvide notice of material third-party subprocessor changes through the published register and, where required, to organization account owners before a new subprocessor begins processing Patron Data.',
    },
    {
      id: 'cross-border',
      title: '4. Cross-Border Processing',
      body: 'Sysplat may process data in multiple jurisdictions through infrastructure and communications subprocessors. Applicable transfer safeguards must be documented in customer contracting artifacts. Enterprise customers who require Standard Contractual Clauses or an executed DPA may request them from the legal contact published on this page.',
    },
    {
      id: 'related-documents',
      title: '5. Related Documents',
      body: 'Patron Loyalty Privacy Policy, Loyalty Program Privacy Notice, QPlatform Integration Addendum (/qplatform-integration), and subprocessor register are companion artifacts. This overview is not a substitute for executed contract language.',
    },
  ],
};
