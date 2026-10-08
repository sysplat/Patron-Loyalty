# Loyalty patron experience branding

Merchant-controlled branding for LMS patron surfaces (portal, digital card, referral landing).

## Controls

| Control                             | Where set        | Storage                                               |
| ----------------------------------- | ---------------- | ----------------------------------------------------- |
| Business name                       | Setup → Business | `Organization.name`                                   |
| Logo                                | Setup → Business | `Organization.logoUrl`                                |
| Primary / accent colors (`#RRGGBB`) | Setup → Business | `brandPrimaryColor` / `brandAccentColor`              |
| Program display name                | Setup → Program  | `LoyaltyProgram.displayName` (falls back to org name) |
| Points currency label               | Setup → Program  | `pointsCurrencyName`                                  |

## Surfaces

- `/portal/[code]` — logo, program name, CSS accent vars, tier color pill
- `/card/[code]` — same chrome on compact card
- `/refer/[code]` — invite landing + post-join
- Legal modal — optional co-brand header when opened from portal

Staff shell shows org logo + org name.

## Entitlement

- **Loyalty Starter** and **Enterprise**: `hasCustomBranding = true`
- Free / Professional (QMS): `false`
- Logo upload: owner-only (identity), not plan-gated
- **Saving brand colors** requires `hasCustomBranding`; clearing colors to empty does not

## Public API

Portal, card, and refer responses include:

```ts
branding: {
  (orgName, logoUrl, primaryColor, accentColor, programName, pointsCurrencyName);
}
```

Top-level `orgName` / `pointsCurrencyName` remain for compatibility.

## Fallbacks

- No colors → emerald primary `#10b981`, sky accent `#38bdf8`
- No `displayName` → organization name
- No logo → text-only header
