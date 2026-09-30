# Loyalty staff Activity trail

Tenant-scoped **who did what** for Patron Loyalty staff mutations. Lives in **apps/loyalty** (Setup → Activity), not Platform Admin Audit Trail.

## Boundary

| Surface                                   | Audience          | Purpose                                                                                   |
| ----------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------- |
| **Setup → Activity** (`apps/loyalty`)     | Org owners/admins | Staff points, wallet, program, catalog, campaigns, API keys, CSV import, business profile |
| **Platform Admin → Audit** (`apps/admin`) | Sysplat operators | Auth/platform events (`auth.*`, etc.) — unchanged                                         |

Do not add platform-admin audit UI to the loyalty staff app.

## Who can view

- API: `GET /api/v1/organization/activity-logs` requires `settings:read` (owners/admins).
- UI: Setup → Activity is `adminOnly` (same owner/admin gate as Team / Diagnostics).
- Listing activity does **not** write a view event (avoids flooding the trail from the Activity page).

## Persistence

Events are written with `AuditService.logActivity` → `activity_logs`.

- Actor: prefer explicit `user.userId` at mutation call sites; `AuditService` also falls back to CLS `RequestContext.userId` when omitted.
- Logging is fire-and-forget: a failed activity write must not fail the business operation.
- v1 does **not** add `LoyaltyPointLedger.actorUserId` (or wallet tx actor columns).

## Action catalog

Shared constants: `@queueplatform/shared` → `LOYALTY_ACTIVITY_ACTIONS`, `LOYALTY_ACTIVITY_RESOURCE_TYPES`, `loyaltyActivityActionLabel()`.

Keep action strings ≤ 50 characters (`ActivityLog.action`).

High-risk examples:

- `loyalty.points.adjusted` / `loyalty.points.earned_purchase`
- `loyalty.wallet.adjusted` / `loyalty.gift_card.issued` / `.deleted`
- `loyalty.reward.redeemed` / redemption fulfill & cancel
- Program, rewards, coupons, campaigns, API key rotate/revoke
- `loyalty.patrons.csv_imported` (summary counts + filename)
- `loyalty.org.updated` (business profile)

**Not logged (v1):** Integration/POS/queue automated earns, read endpoints, coupon validate, patron portal self-service.

## Manual check

1. As Staff A (owner/admin), adjust points on a patron.
2. Open Setup → Activity — row shows Staff A, “Adjusted points”, relative time.
3. Delete a gift card and import a CSV — both appear with expected labels/metadata.
