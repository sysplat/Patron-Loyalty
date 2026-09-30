# Patron CSV import

Staff can migrate patrons from an old loyalty or POS list on **Customers → Import CSV**.

## Behavior

- Endpoint: `POST /api/v1/customers/import` (multipart field `file`)
- Permission: `customer:create`; CRM must be enabled
- Cap: 2,000 data rows / ~2MB
- Upsert match order: `external_id` → email → phone
- Duplicate identities in the same file are rejected as row errors
- `opening_points` credits **new** patrons only (points ledger, description `CSV import opening balance`)
- Marketing consent cells (`yes` / `granted` / …) write `GRANTED` (aligned with segments)

## Columns

See template: [`apps/loyalty/public/patron-import-template.csv`](../../apps/loyalty/public/patron-import-template.csv)

Required: `name` plus `email` and/or `phone`.  
Optional: `external_id`, `tags` (`;` or `|`), `notes`, profile fields, consent, `opening_points`.

## UI

Uses staff UI primitives (`PageShell`, `GuideCard`, `ConfirmDialog`, `StatStrip`) per [LOYALTY_STAFF_UI.md](../guides/LOYALTY_STAFF_UI.md).
