# QlessQ documentation

## Top-level

| Document                             | Purpose                                  |
| ------------------------------------ | ---------------------------------------- |
| [STANDARDS.md](./STANDARDS.md)       | Engineering standards (master reference) |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Development workflow and PR checklist    |

## Folders

| Folder                           | Contents                                                            |
| -------------------------------- | ------------------------------------------------------------------- |
| [architecture/](./architecture/) | App boundaries, queue session model, platform admin, hardening plan |
| [guides/](./guides/)             | API, database, and frontend development guides                      |
| [deployment/](./deployment/)     | Railway deploy, CI/Docker, realtime ops gates, load testing         |
| [operations/](./operations/)     | Release audit and production error runbooks                         |
| [qa/](./qa/)                     | Manual QA matrices, serve-surface runbooks, enterprise acceptance   |
| [compliance/](./compliance/)     | Legal mirrors, support ops, incident response, audit evidence       |

## Quick links

- Platform vs tenant apps: [architecture/admin-surface.md](./architecture/admin-surface.md)
- Patron loyalty (separate app, not kiosk): [architecture/patron-loyalty.md](./architecture/patron-loyalty.md)
- Legal sync workflow: [compliance/COMPLIANCE_NEXT_STEPS.md](./compliance/COMPLIANCE_NEXT_STEPS.md)
- Pre-release checklist: [operations/FINAL_PRE_RELEASE_AUDIT.md](./operations/FINAL_PRE_RELEASE_AUDIT.md)
- Deploy to Railway: [deployment/DEPLOYMENT_GUIDE.md](./deployment/DEPLOYMENT_GUIDE.md)
