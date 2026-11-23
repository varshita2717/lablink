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

## Seed the demo data

1. In the Firebase console, enable the **Google** and **Anonymous** sign-in providers and create
   the Firestore doc `config/app` = `{ demoMode: true }`.
2. Open the app, choose **Explore as guest**, switch the **Role (demo)** selector to **Admin**.
3. Go to **Admin** → **Seed demo data**.

Seeding stops if any equipment exists. Dates are relative to the seed day, so on demo day clear the
collections in the Firebase console and seed again.

> Demo mode lets any user switch role. `config/app.demoMode` can only be changed in the console;
> in production it is `false` and roles are assigned by an admin.
