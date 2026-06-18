# Frontend Development Guide

This guide covers all standards for Next.js frontend code in `apps/web/`.

---

## Page Structure

Pages use Next.js App Router with route groups:

| Route group   | Purpose                         | Auth     |
| ------------- | ------------------------------- | -------- |
| `(dashboard)` | Admin, manager, agent UI        | Required |
| `(public)`    | Landing, login, signup, pricing | None     |
| `(kiosk)`     | Customer self-service terminal  | None     |
| `(display)`   | Branch TV display board         | None     |
| `(track)`     | Ticket / appointment tracking   | None     |

### Page file template

```tsx
// Dashboard page: displays <description>.
// Server component — data is fetched server-side or via client components.

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '<Page Title> — QMS',
};

export default function PageName() {
  return <div>{/* page content */}</div>;
}
```

---

## Client Component Rules

Add `'use client'` only when the component:

- Uses React state (`useState`, `useReducer`)
- Uses React effects (`useEffect`)
- Uses browser APIs (`window`, `document`, `localStorage`)
- Uses event handlers that require interactivity

```tsx
// Interactive form component for creating a new branch.
'use client';

import { useState } from 'react';

interface Props {
  onSuccess: (branch: Branch) => void;
}

export function CreateBranchForm({ onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // always use lib/api.ts — never raw fetch()
      const branch = await api.branches.create({ name: '...' });
      onSuccess(branch);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {/* form fields */}
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Branch'}
      </button>
    </form>
  );
}
```

---

## API Calls

**Rule: All API calls go through `lib/api.ts`. Never use `fetch()` directly in components.**

`lib/api.ts` handles:

- Base URL injection
- Auth token injection
- Error normalization into `ApiError`
- Automatic logout on 401

```typescript
// ✅ CORRECT
import { api } from '@/lib/api';
const tickets = await api.tickets.list({ branchId });

// ❌ WRONG
const res = await fetch('http://localhost:4000/api/v1/tickets');
```

---

## Tailwind CSS Class Order

Follow this order within a className string:

1. Layout: `flex`, `grid`, `block`, `inline`, `hidden`
2. Flexbox/Grid: `flex-col`, `items-center`, `justify-between`, `gap-4`
3. Positioning: `relative`, `absolute`, `fixed`, `top-0`, `z-10`
4. Box model: `w-full`, `h-screen`, `max-w-2xl`, `p-4`, `m-0`
5. Typography: `text-sm`, `font-medium`, `leading-tight`, `truncate`
6. Color: `bg-white`, `text-gray-900`, `border-gray-200`
7. Effects: `shadow-sm`, `rounded-lg`, `opacity-50`, `transition`

```tsx
// ✅ CORRECT — ordered
<div className="flex flex-col items-start gap-4 relative w-full p-6 text-sm font-medium bg-white rounded-xl shadow-sm">

// ❌ WRONG — random order
<div className="shadow-sm text-sm flex bg-white gap-4 p-6 rounded-xl items-start flex-col font-medium w-full relative">
```

---

## State Management

- **Auth state** → `lib/auth-store.ts` (Zustand)
- **Server data** → Server components + `lib/api.ts`
- **UI state** → local `useState`
- **Global UI state** (modals, toasts) → Context or Zustand store

Do not use Redux. Do not add new global state management libraries without discussion.

---

## Loading & Error States

Every data-fetching component must show:

- A loading skeleton or spinner while data is fetching
- A clear error message if the request fails
- Empty state UI if the data is an empty list

```tsx
if (loading) return <Skeleton className="h-40 w-full" />;
if (error) return <p className="text-red-500">{error}</p>;
if (!data?.length) return <p className="text-muted-foreground">No items found.</p>;
```

---

## Component Library

Use **shadcn/ui** primitives from `components/ui/`. Do not install alternative UI libraries
without discussion.

Available primitives: `Button`, `Card`, `Input`, `Badge`, `Dialog`, `Select`,
`Tabs`, `Table`, `Avatar`, `Skeleton`, `Tooltip`, `DropdownMenu`

When a shadcn component is needed that doesn't exist yet, add it via:

```bash
pnpm dlx shadcn-ui@latest add <component> --cwd apps/web
```

---

## Fonts & Theming

- Font: Inter (loaded via `next/font` in `app/layout.tsx`)
- Colors: defined in `tailwind.config.js` — use semantic names (`primary`, `muted`, `destructive`)
- Dark mode: not yet implemented — do not add dark mode-specific classes

---

## Realtime (Centrifugo)

Realtime subscriptions are managed in `lib/realtime.ts`.

To subscribe to a channel:

```typescript
import { getRealtimeClient } from '@/lib/realtime';

const client = getRealtimeClient();
const sub = client.newSubscription(`queue:${queueId}`);
sub.on('publication', ({ data }) => {
  // handle realtime update
});
sub.subscribe();
```

Always unsubscribe on component unmount:

```typescript
useEffect(() => {
  const sub = client.newSubscription(`queue:${queueId}`);
  // ...
  return () => sub.unsubscribe();
}, [queueId]);
```
