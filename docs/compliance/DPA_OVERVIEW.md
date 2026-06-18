# Patron Loyalty — Data Processing Addendum (DPA) Overview

This document summarizes baseline processor commitments QlessQ applies for **Patron Loyalty** tenant organizations.
**QlessQ does not sell personal information.**

> **Mirror note:** Authoritative source is `apps/loyalty/src/content/legal/loyalty-dpa-overview.ts`. Edit that file first, then sync this markdown. See `COMPLIANCE_NEXT_STEPS.md`.

## Roles

- Tenant organization: data controller for Patron Data
- QlessQ: data processor (service provider) for Patron Data processed through the Loyalty Service

## Processing Scope

Patron CRM, loyalty points, tiers, rewards, campaigns, referrals, and analytics. Optional ingestion of QlessQ queue visit outcomes when both products are licensed. No sale of personal information.

## Core Processor Commitments

- Process personal data only on documented tenant instructions
- Technical and organizational safeguards; least-privilege access
- Support deletion, anonymization, and **consent-audit exports** (including patron portal legal consent in `consent_ledger_entries`)
- Incident notification as required by law and contract
- Flow obligations to subprocessors listed at `/subprocessors`
- Notice of material subprocessor changes via the published register

## Cross-Border Processing

Data may be processed in multiple jurisdictions through infrastructure and communications subprocessors. Transfer safeguards must be documented in customer contracts.

## Related Documents

- Patron Loyalty Privacy Policy (`/privacy`)
- Loyalty Program patron notices (`/patron-privacy`, `/patron-terms`)
- Subprocessor register (`/subprocessors`)

**Last updated:** June 17, 2026
