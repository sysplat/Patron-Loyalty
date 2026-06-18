# Cursor plugins for QlessQ

Setup for AI-native / agent-first development on this monorepo (NestJS, Next.js, Prisma, Stripe, Twilio, Railway, Playwright).

**After plugin changes:** Developer → Reload Window.

## Installed locally (`~/.cursor/plugins/local/`)

### AI-native / vibe coding (Cursor official)

| Plugin                  | Purpose                                                            |
| ----------------------- | ------------------------------------------------------------------ |
| **continual-learning**  | Mines transcripts → updates `AGENTS.md` with durable preferences   |
| **agent-compatibility** | Scores repo for agent workflows (startup, validation, docs)        |
| **pstack**              | Rigorous engineering workflows; parallel agents with `poteto-mode` |
| **ralph-loop**          | Self-referential iteration until a completion promise is met       |
| **orchestrate**         | Fan large tasks to parallel cloud agents (needs `CURSOR_API_KEY`)  |
| **cursor-sdk**          | Build automations on `@cursor/sdk`                                 |
| **cli-for-agent**       | Agent-friendly CLI design patterns                                 |
| **create-plugin**       | Scaffold new Cursor plugins                                        |
| **pr-review-canvas**    | PR diffs as interactive Canvas                                     |
| **docs-canvas**         | Architecture/docs as navigable Canvas                              |
| **teaching**            | Learning plans and skill mapping                                   |
| **cursor-team-kit**     | CI, review, ship, verify, deslop, smoke tests                      |

### Stack integrations

| Plugin                   | Purpose                                                         |
| ------------------------ | --------------------------------------------------------------- |
| **prisma**               | Schema rules, migrations, Prisma MCP                            |
| **stripe**               | Best practices, upgrade guidance, Stripe MCP (from `stripe/ai`) |
| **twilio-developer-kit** | SMS, email, compliance, webhooks                                |

## Enable in Cursor (marketplace UI)

If skills/hooks do not appear after reload, run once in Agent chat:

```
/add-plugin continual-learning
/add-plugin agent-compatibility
/add-plugin pstack
/add-plugin stripe
/add-plugin prisma
```

(Cursor has known issues where marketplace install sometimes exposes MCP only; local symlinks above are the fallback.)

## Project MCP (`.cursor/mcp.json`)

| Server         | Use in QMS                                |
| -------------- | ----------------------------------------- |
| **railway**    | Deployments, env, logs                    |
| **playwright** | `apps/e2e` authoring and debugging        |
| **stripe**     | Billing (`STRIPE_SECRET_KEY` from `.env`) |
| **prisma**     | Schema introspection, migrations          |

Enable in **Settings → Features → Model Context Protocol**. Railway/Stripe may prompt on first use.

## Project memory

- **`AGENTS.md`** (repo root) — canonical agent context; continual-learning updates this over time.

## Optional (not installed)

- **Cloudflare** — only if hosting moves off Railway
- **BrowserStack** — cloud browsers; local Playwright is enough today

## Verify

1. Reload Cursor window.
2. Settings → MCP: `railway`, `playwright`, `stripe`, `prisma` enabled.
3. Agent chat: try `/continual-learning` or ask to run **agent-compatibility** on this repo.
