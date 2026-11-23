// Firebase initialisation: app, Auth, Firestore and App Check.
// The AI Logic client is created lazily in lib/agent/ (dynamic import) to keep the main bundle small.
// Firebase web config values are public identifiers; protection comes from rules and App Check.
import { initializeApp } from 'firebase/app';
import { ReCaptchaV3Provider, initializeAppCheck } from 'firebase/app-check';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const env = import.meta.env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

export const app = initializeApp(firebaseConfig);

/**
 * App Check (reCAPTCHA v3) is optional: it is initialised only when VITE_RECAPTCHA_SITE_KEY is set.
 * Without it the app still runs; AI Logic calls fail if App Check is enforced for the project,
 * and the chat then shows its "assistant unavailable" fallback.
 * @returns {import('firebase/app-check').AppCheck | null}
 */
function initOptionalAppCheck() {
  const siteKey = env.VITE_RECAPTCHA_SITE_KEY;
  if (!siteKey) return null;
  // Local development only: lets App Check accept a registered debug token.
  if (env.DEV && env.VITE_APPCHECK_DEBUG_TOKEN) {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = env.VITE_APPCHECK_DEBUG_TOKEN;
  }
  try {
    return initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (error) {
    console.error('App Check could not start; continuing without it', error);
    return null;
  }
}

export const appCheck = initOptionalAppCheck();
export const auth = getAuth(app);
export const db = getFirestore(app);
