# Zeal Clinic — Dashboard

React admin dashboard for the Zeal Clinic management system: patients,
scheduling, inventory, suppliers, financials, services, team/HR, settings,
reports, and a realtime connection status. Desktop-first.

## Stack

Vite 7 · React 19 · TypeScript · Tailwind CSS 4 · shadcn / Base UI · Zustand ·
React Router 7 · Recharts · date-fns (all clinic times are Asia/Beirut). Path
alias `@/` → `src/`.

## Run

```sh
npm install
npm run dev       # Vite dev server on localhost:5173
npm run build     # tsc -b && vite build → dist/
npm run preview   # preview the built output
```

No test runner; `npm run lint` is permissive.

## Backend

All HTTP goes through `src/lib/api.ts`. In **dev** it calls
`http://localhost:8080/api` directly (no proxy) — run the backend on `:8080` and
allow CORS from the Vite origin. In **prod** the built `dist/` is served
same-origin by the backend binary, so the API is origin-relative. Backend-facing
entity types live in `src/lib/types.ts`.

## Layout

```text
src/
  App.tsx        routes + scope guards
  pages/         routed pages, grouped by section
  components/    ui · layout · shared · data · forms · analytics
  lib/           api · stores (Zustand) · scopes · tz · types · realtime
  hooks/         page title, permissions, loading, confirm, form drafts
```
