# LabLink

![CI](https://github.com/varshita2717/lablink/actions/workflows/ci.yml/badge.svg)

**Making college laboratories more accessible.** Tell the assistant what you want to build. It
finds the lab equipment, plans the slots and prepares the booking, and humans stay in control.

> Work in progress. The full README (problem-alignment table, architecture, demo script, testing
> evidence) is completed in a later segment. See `SPEC_v3.md`.

## Local setup

Requires Node 22+. Works in Windows PowerShell, cmd and bash.

```bash
npm install
cp .env.example .env   # PowerShell: Copy-Item .env.example .env
npm run dev
```

Fill `.env` with your Firebase web config. These values are public identifiers, not secrets;
protection comes from Firestore rules and App Check. `.env` is git-ignored: never commit it.

## Scripts

| Script                  | What it does                                             |
| ----------------------- | -------------------------------------------------------- |
| `npm run lint`          | ESLint (React, hooks, jsx-a11y strict), zero warnings    |
| `npm test`              | Unit and component tests (Vitest, Testing Library, axe)  |
| `npm run test:coverage` | Tests with coverage (90% line threshold on PURE modules) |
| `npm run build`         | Production build into `dist/`                            |
| `npm run deploy:rules`  | Deploy Firestore rules and indexes                       |
| `npm run deploy`        | Build, then deploy to Firebase Hosting                   |

## Deploy (Firebase Hosting, no billing needed)

1. Set your project ID in `.firebaserc` (replace `your-firebase-project-id`).
2. `npx firebase login` (once).
3. `npm run deploy:rules`
4. `npm run deploy` → `https://<project-id>.web.app`

Security headers (CSP, HSTS, etc.), caching and the SPA fallback are configured in `firebase.json`.
