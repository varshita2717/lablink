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

## App Check and the AI assistant

- **App Check is optional.** It starts only when `VITE_RECAPTCHA_SITE_KEY` (a reCAPTCHA v3 site
  key) is set; without it the app runs normally and logs nothing. If initialisation fails, the
  error is logged once and the app continues without App Check.
- **The assistant needs App Check in practice.** Firebase AI Logic can enforce App Check (and may
  do so by default), in which case AI calls without a valid token are rejected. The chat then shows
  "The assistant is unavailable right now" with a link to the Catalogue, which works without AI.
  To enable it: register the web app with reCAPTCHA v3 in App Check, add your
  `<project-id>.web.app` and `.firebaseapp.com` domains to the key, set `VITE_RECAPTCHA_SITE_KEY`,
  rebuild and redeploy. Limited-use App Check tokens are used for AI Logic calls.
- **Model:** `AI_MODEL_NAME` in `src/lib/config.js` (default `gemini-2.5-flash`). Set
  `VITE_AI_MODEL_NAME` to switch models without a code change, e.g. when a model is retired.

## Seed the demo data

1. In the Firebase console, enable the **Google** and **Anonymous** sign-in providers and create
   the Firestore doc `config/app` = `{ demoMode: true }`.
2. Open the app, choose **Explore as guest**, switch the **Role (demo)** selector to **Admin**.
3. Go to **Admin** → **Seed demo data**.

Seeding stops if any equipment exists. Dates are relative to the seed day, so on demo day clear the
collections in the Firebase console and seed again.

> Demo mode lets any user switch role. `config/app.demoMode` can only be changed in the console;
> in production it is `false` and roles are assigned by an admin.
