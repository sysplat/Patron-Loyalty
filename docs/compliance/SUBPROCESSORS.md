# QlessQ Subprocessor Register

This register lists key subprocessors used to operate QlessQ in production environments and to develop and support the platform.
**QlessQ does not sell personal information.** Update this file when vendors are added, removed, or materially repurposed; communicate material changes to organization account owners as described in the Privacy Policy and DPA overview.

> **Mirror note:** The authoritative source for the public `/subprocessors` page is `apps/web/src/content/legal/subprocessors.ts`. Edit that file first, then sync this markdown copy. See `COMPLIANCE_NEXT_STEPS.md` for the full legal sync workflow.

## Messaging and Communications

| Vendor          | Purpose                                                           | Data Categories                                   |
| --------------- | ----------------------------------------------------------------- | ------------------------------------------------- |
| Twilio          | Transactional SMS delivery and inbound STOP/HELP webhook handling | Phone number, message content, delivery metadata  |
| Twilio SendGrid | Transactional email delivery                                      | Email address, message content, delivery metadata |

## Billing

| Vendor | Purpose                                     | Data Categories                                             |
| ------ | ------------------------------------------- | ----------------------------------------------------------- |
| Stripe | Subscription billing and payment processing | Billing contact data, subscription metadata, payment events |

## Platform Infrastructure

| Vendor               | Purpose                                        | Data Categories                                                |
| -------------------- | ---------------------------------------------- | -------------------------------------------------------------- |
| Railway              | Application hosting and runtime infrastructure | Application logs, operational metadata, persisted service data |
| PostgreSQL (managed) | Primary application database                   | Customer Data and operational records stored by the Service    |
| Redis                | Caching, job queues, session metadata          | Operational metadata; limited transient application data       |
| Centrifugo           | Real-time event delivery                       | Operational event metadata for live updates                    |

## Observability (when enabled)

| Vendor / category                             | Purpose                            | Data Categories                                                          |
| --------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------ |
| Error monitoring (e.g. Sentry, if configured) | Application errors and performance | Technical logs and operational metadata; PII minimized where practicable |

## Internal Analytics and CRM (when used)

| Vendor / category                | Purpose                                                                    | Data Categories                                                                                                      |
| -------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| CRM and business analytics tools | Internal relationship management and analysis of service usage and support | Tenant account/contact data, support history, aggregated operational metrics — **not sold** or used for ad targeting |

## AI-Assisted Development and Support

| Vendor / category                                                              | Purpose                                                                                      | Data Categories                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI development and support platforms (e.g. Cursor and comparable IDE copilots) | Software development, debugging, schema/migration work, and internal support for the Service | Limited source code and configuration; database schema and migration content; operational metadata                                                                                                                                                                                                                           |
| Large language model providers used through those platforms                    | Inference for development and support assistance                                             | Support-related content submitted by QlessQ personnel when resolving issues (may include environment configuration, database structure changes, database row content, and tenant-scoped identifiers such as a staff email for an authorized support or customization request). Passwords and password hashes are not shared. |

Processing through AI and CRM categories is subject to vendor confidentiality terms and, where available, privacy or zero-retention settings.

## Versioning Notes

- Last reviewed: 2026-06-04
- Published at: `/subprocessors`
- Owner: Platform engineering + legal
- Related artifacts:
  - `/dpa`
  - `/privacy`
  - `docs/compliance/SUPPORT_OPERATIONS.md` (internal)
  - `docs/compliance/COMPLIANCE_NEXT_STEPS.md` (internal)
  - `docs/compliance/COUNSEL_REVIEW_BRIEF.md` (internal)
  - `docs/compliance/AUDIT_EVIDENCE_PACK.md` (internal)
