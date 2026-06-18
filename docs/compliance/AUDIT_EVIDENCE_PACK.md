# Audit Evidence Pack Checklist

This checklist defines the minimum evidence package for external audits and enterprise security reviews.

**Legend:** **In repo** = artifact exists or is produced routinely by CI/scripts. **To produce** = required for a full pack but not yet stored as a standing document; gather at audit time.

## 1) Governance and Policy

| Artifact                                                       | Status                                                                                                                             |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Security audit report (current version)                        | **To produce** — engage third-party assessor or compile from `CONTINUOUS_ASSURANCE.md` controls                                    |
| Control catalog with owner, status, and due dates              | **To produce** — derive from `CONTINUOUS_ASSURANCE.md` + `COMPLIANCE_NEXT_STEPS.md`                                                |
| Incident response runbook                                      | **In repo** — `docs/compliance/INCIDENT_RESPONSE_RUNBOOK.md`                                                                       |
| Data retention and DSAR procedures                             | **In repo (partial)** — `GLOBAL_COMPLIANCE_PROGRAM.md` Workstream 7; admin DSAR tooling planned in `ADMIN_DASHBOARD_COMPLIANCE.md` |
| Published legal artifacts (Terms, Privacy, DPA, subprocessors) | **In repo** — `apps/web/src/content/legal/*.ts`; mirrors in `docs/compliance/DPA_OVERVIEW.md`, `SUBPROCESSORS.md`                  |
| Support and AI ops policy                                      | **In repo** — `docs/compliance/SUPPORT_OPERATIONS.md`                                                                              |

## 2) Technical Evidence

| Artifact                                             | Status                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| CI outputs for lint/typecheck/tests/security checks  | **In repo** — `.github/workflows/ci.yml`, `pnpm validate`          |
| Migration logs and schema versions                   | **In repo** — `packages/database/prisma/migrations/`               |
| Public endpoint throttle test results (429 evidence) | **To produce** — run and archive from staging                      |
| Tenant isolation test evidence (cross-tenant denial) | **In repo** — `security:check:tenant-isolation`, integration specs |

## 3) Privacy and Retention

| Artifact                                                         | Status                                                            |
| ---------------------------------------------------------------- | ----------------------------------------------------------------- |
| PII anonymization job reports (counts, dry-run logs, exceptions) | **To produce** — archive output from scheduled anonymization runs |
| Legal-hold exception list and approvals                          | **To produce** — operational records when used                    |
| DSAR request handling samples (redacted)                         | **To produce** — redacted case files per counsel guidance         |

## 4) Messaging Consent

| Artifact                                                    | Status                                                                       |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Schema evidence for consent fields                          | **In repo** — `packages/database/prisma/schema.prisma`                       |
| UI screenshots for consent capture                          | **To produce** — kiosk/booking flows per release                             |
| Notification send logs proving marketing opt-in enforcement | **To produce** — export from notification logs when marketing campaigns ship |

## 5) Immutable Audit Trail

| Artifact                                       | Status                                                         |
| ---------------------------------------------- | -------------------------------------------------------------- |
| External sink configuration evidence           | **To produce** — when external audit export sink is configured |
| Signature/verification setup (if enabled)      | **To produce** — when enabled                                  |
| Retention lock policy evidence                 | **To produce** — storage provider configuration                |
| Alerting and failed-export monitoring evidence | **To produce** — observability dashboards or runbooks          |

## 6) Operational Cadence

| Artifact                                | Status                                                            |
| --------------------------------------- | ----------------------------------------------------------------- |
| Weekly security review notes            | **To produce** — per `CONTINUOUS_ASSURANCE.md`                    |
| Quarterly tabletop after-action reports | **To produce** — per `INCIDENT_RESPONSE_RUNBOOK.md`               |
| Access review records                   | **To produce** — per `CONTINUOUS_ASSURANCE.md` quarterly controls |

## Packaging Guidance

- Store artifacts with immutable naming and date stamps.
- Include request IDs and commit hashes where possible.
- Redact customer-identifiable data before sharing externally.
- Start from **In repo** items; use this checklist to close **To produce** gaps before enterprise reviews.

**Last updated:** 2026-06-04
