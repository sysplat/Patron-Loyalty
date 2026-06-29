# ADR 003: `connectorVersion` on queue-event payloads

**Status:** Accepted  
**Date:** 2026-06-29

## Context

QlessQ and LMS evolve queue-event shapes independently. Operators need to detect stale forwarders after schema changes without breaking in-flight connectors.

## Decision

1. All `POST /loyalty/integrations/v1/queue-events` bodies include optional `connectorVersion` (integer, default **1**).
2. Zod schema in `@queueplatform/shared` applies `.default(1)` on parse.
3. LMS logs `connectorVersion` on every `loyalty_connector_ingest` structured log line.
4. Bump process: increment default + document in shared; QlessQ forwarder sets explicit version when rolling out breaking fields.

## Consequences

- **Positive:** Log drains can filter by version; gradual rollout of new event fields.
- **Negative:** QlessQ and LMS must coordinate version bumps (document in both repos).
- **Test:** HTTP contract specs assert default injection; shared dist must be rebuilt after schema edits.

## References

- `packages/shared/src/validators/loyalty-integration.validators.ts`
- [QLESSQ_CONNECTOR_OPS.md](../../operations/QLESSQ_CONNECTOR_OPS.md)
