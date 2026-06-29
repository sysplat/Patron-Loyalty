# Architecture decision records (Patron Loyalty)

Lightweight ADRs for cross-cutting decisions. Full context lives in linked docs.

| ID                                                 | Title                                                 | Status   |
| -------------------------------------------------- | ----------------------------------------------------- | -------- |
| [001](./001-external-id-connector-identity.md)     | Connector patron identity via `customers.external_id` | Accepted |
| [002](./002-loyalty-bff-cookie-auth.md)            | Loyalty staff auth — HttpOnly cookie BFF              | Accepted |
| [003](./003-connector-version-field.md)            | `connectorVersion` on queue-event payloads            | Accepted |
| [004](./004-api-deploy-profile-module-registry.md) | `API_DEPLOY_PROFILE` module registry                  | Accepted |

**When to add an ADR:** schema or auth contract changes, deploy profile changes, or QlessQ ↔ LMS integration semantics.
