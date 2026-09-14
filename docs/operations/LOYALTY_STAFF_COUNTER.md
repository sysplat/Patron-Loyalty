# Staff Counter — standalone Loyalty

Patron Loyalty works **without** POS or QPlatform. Daily staff flow:

1. Open **Counter** (`/lookup`) — default after login
2. Search by **phone**
3. Enter **sale amount** → **Award points**
4. Optional: open profile to **redeem** rewards

Points are calculated from **Program → PURCHASE earn rules**. Recommended standalone preset: Purchase rule with **1 point** (1 pt per $1).

## Adjust vs Record purchase

| Action              | When to use                                     |
| ------------------- | ----------------------------------------------- |
| **Record purchase** | A real sale — amount goes through Program rules |
| **Adjust points**   | Corrections / goodwill only — raw ± points      |

## When to use Integrations

Connections are optional accelerators; they use the **same** Program rules:

| Lane                | Use when                                                                               |
| ------------------- | -------------------------------------------------------------------------------------- |
| **Standalone**      | Counter only (no external systems)                                                     |
| **POS**             | Square / Clover should auto-send purchase totals                                       |
| **Platforms & API** | QPlatform visits (`queue-events`) or custom apps (`X-Loyalty-Api-Key` + `points/earn`) |

Docs: [qplatform-integration.md](../architecture/qplatform-integration.md)

## Setup checklist

1. Program: active PURCHASE earn rule
2. Rewards: at least one redeemable reward
3. Try Counter with a test phone
4. Optionally connect POS / API under Integrations
