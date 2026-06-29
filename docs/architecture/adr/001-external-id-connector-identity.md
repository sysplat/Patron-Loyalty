# ADR 001: Connector patron identity via `customers.external_id`

**Status:** Accepted  
**Date:** 2026-06-29

## Context

QlessQ forwards queue events with a stable patron key (`customer.externalId`). LMS must resolve patrons without JSON metadata scans or ambiguous email-only matching.

## Decision

1. Add `customers.external_id` (unique per `orgId`) as the **canonical** connector key.
2. Integration lookups (`lookupCustomer`, queue-events) prefer `external_id` column.
3. Legacy `metadata.externalId` remains readable during backfill; new writes use the column only.
4. Backfill script audits orgs still on metadata path.

## Consequences

- **Positive:** Indexable lookups; predictable idempotency keys tied to QlessQ patron id.
- **Negative:** Migration + backfill required for long-lived tenants.
- **Ops:** Staff can see connector activity via integration API key `lastUsedAt`.

## References

- [REPO_BOUNDARIES.md](../REPO_BOUNDARIES.md) — connector identity note
- [qlessq-integration.md](../qlessq-integration.md)
