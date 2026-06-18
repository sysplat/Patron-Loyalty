# Incident Response Runbook

## Severity Levels

- **SEV-1:** Active cross-tenant exposure, unauthorized PHI/PII disclosure, auth bypass.
- **SEV-2:** High-impact confidentiality/integrity issue without confirmed widespread exposure.
- **SEV-3:** Localized issue, no confirmed data exfiltration.

## Response Targets

- **Acknowledge:** 15 minutes (SEV-1), 30 minutes (SEV-2)
- **Containment plan:** 60 minutes (SEV-1), 4 hours (SEV-2)
- **Executive/legal notification:** immediate for SEV-1

## First-Hour Checklist (SEV-1)

1. Open incident channel and assign Incident Commander.
2. Freeze risky deploys and enable investigation logging.
3. Scope blast radius (tenant IDs, endpoints, timeframe, records touched).
4. Apply containment (revoke tokens, disable channel/path, tighten throttles).
5. Preserve immutable evidence (request IDs, DB snapshots, audit exports).

## Evidence to Preserve

- API logs and immutable audit sink records
- Relevant DB row snapshots and migration versions
- Timeline of operator actions and mitigation changes
- Notification to customers/regulators (if required)

## Jurisdiction Notes (Counsel-validated before use)

- **PIPEDA/PHIPA/HIA:** assess mandatory reporting thresholds and regulator notice windows.
- **GDPR:** assess Article 33/34 breach-notification obligations.
- **US state laws / HIPAA:** evaluate notification obligations per tenant and data class.

## Canada SMS Consent Triage

If the incident involves Canadian recipients or CASL complaints:

1. Pull SMS consent activity records from `GET /tickets/consent/audit` for affected org(s).
2. Verify whether each affected message was transactional and tied to an active queue/appointment workflow.
3. Verify inbound STOP/ARRET events and suppression ledger state for impacted recipients.
4. Confirm legal disclosure versions in effect at send time (policy/version metadata).
5. Coordinate customer and regulator response windows with legal counsel.

## AI subprocessor and credential exposure

If the incident involves AI development/support platforms (e.g. Cursor, LLM providers), production credentials pasted into chat, or suspected leakage through an AI vendor:

1. **Contain:** Stop further pasting of secrets; revoke or rotate exposed API keys, DB credentials, and tokens per `SUPPORT_OPERATIONS.md`.
2. **Scope:** Identify which tenants, records, or `.env` values may have been exposed; preserve chat/session metadata if the vendor provides export.
3. **Vendor:** Open a support ticket with the AI platform; confirm Privacy Mode / zero-retention settings were enabled at time of exposure.
4. **Notify:** Treat as SEV-1 or SEV-2 if Customer Data or production secrets were exposed; involve legal for tenant and regulator notice obligations.
5. **Correct:** Update `SUPPORT_OPERATIONS.md` or tooling hygiene if the root cause was process failure.

## Post-Incident

1. RCA within 5 business days.
2. Corrective actions with owners and due dates.
3. Retest and evidence closure.
4. Add lessons learned to control catalog.
