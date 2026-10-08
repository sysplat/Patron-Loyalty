# Patron Loyalty patron UI system

Authoritative layout and component rules for the **public, merchant-branded patron surfaces**:

| Route            | Purpose               |
| ---------------- | --------------------- |
| `/portal/[code]` | Full patron portal    |
| `/card/[code]`   | Compact digital card  |
| `/refer/[code]`  | Referral join landing |

Primitives: `apps/loyalty/src/components/patron/`.  
Gate: `pnpm check:architecture:loyalty-patron-ui` (wired into `validate:ci`).

This is the patron-facing counterpart to the staff dashboard system in [LOYALTY_STAFF_UI.md](./LOYALTY_STAFF_UI.md). Staff pages must **not** import patron primitives, and patron pages must not import `@/components/dashboard`.

---

## Goals

- One professional, mobile-first language across every surface a patron can see.
- Merchant branding (logo, program name, brand colors) applied consistently, never hand-rolled per page.
- No raw `<input>` / `<label>` markup, no hardcoded emerald/sky accents, no page-local loading or error screens.

---

## Page anatomy

```text
PatronShell                brand CSS variables + dark brand atmosphere (+ optional banner)
  PatronContainer          max-w-lg, consistent vertical rhythm (space-y-5)
    PatronBrandHeader      logo + program name + title + subtitle
    PatronCard             hero surface (e.g. PatronBalance)
    PatronSection…         one titled section per concern
    PatronFooterLinks      card view / privacy / terms
```

Compact surfaces (card, referral join) use `PatronShell center` with a single `PatronCard`.

---

## Primitives

| Primitive                                  | When                                                     |
| ------------------------------------------ | -------------------------------------------------------- |
| `PatronShell`                              | Every patron page wrapper; applies brand variables       |
| `PatronContainer`                          | Scrolling multi-section layout                           |
| `PatronBanner`                             | Offline / degraded-state notice pinned above content     |
| `PatronBrandHeader`, `PatronLogo`          | Merchant identity at the top of a surface                |
| `PatronCard`, `PatronSection`              | Content surfaces (`tone`: default, brand, warning, info) |
| `PatronBalance`                            | Points hero (balance, lifetime meta, referral code)      |
| `PatronRowList` + `PatronRow`              | Activity, rewards, wallet, branch lists                  |
| `PatronProgress`, `PatronStampGrid`        | Challenge progress and visit stamps                      |
| `PatronChip`                               | Badges and small labels                                  |
| `PatronButton`, `PatronLinkButton`         | All actions (`variant`: primary, secondary, ghost)       |
| `PatronField` + `PatronInput`              | Any labelled input (generates `id` / `aria-describedby`) |
| `PatronCheckbox`, `PatronInlineLink`       | Consent checkbox and in-copy actions                     |
| `PatronLoadingScreen`, `PatronErrorScreen` | Full-page query states                                   |
| `PatronEmpty`                              | Empty state inside a section                             |
| `PatronFooterLinks`                        | Legal / cross-surface links                              |

---

## Branding contract

Public API responses carry a `branding` object (see [LOYALTY_PATRON_BRANDING.md](../operations/LOYALTY_PATRON_BRANDING.md)). Pages must:

1. Call `resolvePatronBranding(data)` once, after the loading and error guards.
2. Pass the result to `PatronShell`, which sets `--patron-primary` and `--patron-accent`.
3. Reference those variables (or `color-mix(in srgb, var(--patron-primary) …)`) for accents — never a fixed Tailwind brand color.

Tier colors are patron data, not branding: apply `tier.color` inline where the tier is named.

---

## Rules enforced by the gate

For each patron page:

- imports from `@/components/patron`
- wraps content in `PatronShell`
- derives branding with `resolvePatronBranding`
- no raw `<input>` elements
- no `bg-/text-/border-emerald|sky|teal|indigo-*` classes

Add new patron routes to `PATRON_PAGES` in `scripts/architecture/check-loyalty-patron-ui.mjs`.

---

## Accessibility baseline

- Every interactive primitive ships a visible `focus-visible` ring; do not strip it.
- Inputs always have a label via `PatronField`, or an explicit `aria-label` (OTP field).
- Loading screens are `role="status" aria-live="polite"`; progress bars expose `role="progressbar"`.
- Copy is sentence case, patron-facing, and avoids internal jargon (`humanizeType` formats raw enum values).
