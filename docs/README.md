# Documentation index — Patron Loyalty (LMS)

> **Repo scope:** This workspace ships **`apps/loyalty`** and shared backend packages. QlessQ queue UI (`apps/web`, `apps/admin`) lives in sibling **`../QMS`**. See [architecture/REPO_BOUNDARIES.md](./architecture/REPO_BOUNDARIES.md).

## Top-level

| Document                             | Purpose                                                         |
| ------------------------------------ | --------------------------------------------------------------- |
| [STANDARDS.md](./STANDARDS.md)       | Engineering standards (shared QMS/LMS lineage; see repo banner) |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Development workflow and PR checklist                           |

## Folders

| Folder                           | Contents                                                          |
| -------------------------------- | ----------------------------------------------------------------- |
| [architecture/](./architecture/) | App boundaries, QlessQ integration, repo scope, hardening plans   |
| [guides/](./guides/)             | API, database, and frontend development guides                    |
| [deployment/](./deployment/)     | Railway deploy, CI/Docker, realtime ops gates, load testing       |
| [operations/](./operations/)     | Release audit and production error runbooks                       |
| [qa/](./qa/)                     | Manual QA matrices (**QMS-oriented** — use QMS repo for queue QA) |
| [compliance/](./compliance/)     | Legal mirrors, support ops, incident response, audit evidence     |

## Quick links (LMS)

- **What ships here:** [architecture/REPO_BOUNDARIES.md](./architecture/REPO_BOUNDARIES.md)
- Patron loyalty product: [architecture/patron-loyalty.md](./architecture/patron-loyalty.md)
- QlessQ ↔ LMS connector: [architecture/qlessq-integration.md](./architecture/qlessq-integration.md)
- Testing & release gates: [operations/TESTING.md](./operations/TESTING.md)
- Pre-launch checklist: [compliance/PATRON_LOYALTY_LAUNCH_CHECKLIST.md](./compliance/PATRON_LOYALTY_LAUNCH_CHECKLIST.md)
- Legal sync workflow: [compliance/COMPLIANCE_NEXT_STEPS.md](./compliance/COMPLIANCE_NEXT_STEPS.md)
- Deploy to Railway: [deployment/DEPLOYMENT_GUIDE.md](./deployment/DEPLOYMENT_GUIDE.md)

## QMS-only (sibling repo)

- Platform vs tenant apps: [architecture/admin-surface.md](./architecture/admin-surface.md) — describes **`../QMS`** apps
- Legacy QMS pre-release: [operations/FINAL_PRE_RELEASE_AUDIT.md](./operations/FINAL_PRE_RELEASE_AUDIT.md)
