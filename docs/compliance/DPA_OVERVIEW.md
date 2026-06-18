# QlessQ Data Processing Addendum (DPA) Overview

This document summarizes the baseline processor commitments QlessQ applies for tenant organizations.
It is intended for legal and security review workflows and should be attached to customer contracting.
**QlessQ does not sell personal information.**

> **Mirror note:** The authoritative source for the public `/dpa` page is `apps/web/src/content/legal/dpa-overview.ts`. Edit that file first, then sync this markdown copy. See `COMPLIANCE_NEXT_STEPS.md` for the full legal sync workflow.

## Roles

- Tenant organization: data controller (or business)
- QlessQ: data processor (or service provider)

## Processing Scope

QlessQ processes customer and operational data to deliver queue, appointment, and transactional notification services requested by the tenant, and to provide support, security, and reliability for those services when the tenant gives documented instructions (for example a support ticket requesting investigation or correction of data in the tenant account). QlessQ may use aggregated or operational data for internal service analysis and relationship management; it does not sell personal information.

## Core Processor Commitments

- Process personal data only on documented tenant instructions
- Apply technical and organizational safeguards for confidentiality, integrity, and availability
- Restrict personnel access to least privilege and business need
- Support controller requests for deletion/anonymization and consent-audit evidence exports
- Notify controllers of confirmed incidents as required by applicable law and contract
- **Do not sell personal information** processed on behalf of tenants
- Flow equivalent data-protection obligations to subprocessors, including infrastructure, messaging, payment, analytics or CRM, and AI-assisted development and support platforms listed at `/subprocessors`
- Provide notice of material subprocessor changes through the published subprocessor register and, where required, to organization account owners before a new subprocessor begins processing Customer Data

## Cross-Border Processing

QlessQ may process data in multiple jurisdictions through infrastructure and communications subprocessors.
Applicable transfer safeguards must be documented in customer contracting artifacts.

## Customer-Facing References

- Public privacy policy: `/privacy`
- Patron privacy notice: `/patron-privacy`
- DPA overview: `/dpa`
- Subprocessor register: `/subprocessors`
- Incident runbook: `docs/compliance/INCIDENT_RESPONSE_RUNBOOK.md`
- Internal support operations: `docs/compliance/SUPPORT_OPERATIONS.md` (not published to tenants)
- Compliance checklist: `docs/compliance/COMPLIANCE_NEXT_STEPS.md` (internal)
- Counsel review brief: `docs/compliance/COUNSEL_REVIEW_BRIEF.md` (internal)

## Operational Notes

- This overview is not a substitute for executed contract language.
- Legal counsel should validate this against active master service terms before external publication.
