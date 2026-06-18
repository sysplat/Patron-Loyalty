# Patron Loyalty Subprocessor Register

This register lists key subprocessors used to operate **Patron Loyalty** in production and to develop and support the platform.
**QlessQ does not sell personal information.**

> **Mirror note:** Authoritative source is `apps/loyalty/src/content/legal/loyalty-subprocessors.ts`. Edit that file first, then sync this markdown. See `COMPLIANCE_NEXT_STEPS.md`.

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
| PostgreSQL (managed) | Primary application database                   | Patron Data, loyalty accounts, campaigns, operational records  |
| Redis                | Caching, job queues, session metadata          | Operational metadata; limited transient application data       |
| Centrifugo           | Real-time event delivery                       | Operational event metadata for live dashboard updates          |

## Observability (when enabled)

| Vendor | Purpose                      | Data Categories                                               |
| ------ | ---------------------------- | ------------------------------------------------------------- |
| Sentry | Error/performance monitoring | Technical logs, stack traces; PII minimized where practicable |

## Internal Analytics and CRM (when used)

CRM and business analytics platforms — internal relationship management and service analysis only; not for sale of personal information.

## AI-Assisted Development and Support

AI development and support platforms (including Cursor and comparable copilots) and underlying LLM providers — development, debugging, schema work, and support assistance. Passwords/hashes are not shared.

## Public URLs

- Published at: `/subprocessors` on the Patron Loyalty app
- Companion: `/dpa`

**Last reviewed:** June 17, 2026
