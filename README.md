# Clinic Dashboard

React dashboard for the clinic management system.

## Stack

- Vite, React, TypeScript
- Tailwind CSS, shadcn/Base UI, lucide-react
- Zustand, React Router, Recharts, Sonner

## Scripts

```sh
npm run dev
npm run build
npm run lint
npm run preview
```

## Notes

- App code lives in `src/`; use the `@/` alias for imports.
- API calls go through `src/lib/api.ts`. `BASE_URL` is currently hardcoded to
  `http://localhost:8080/api` (no Vite proxy), so run the backend on `:8080` for local dev.
- Backend-facing types live in `src/lib/types.ts`.
