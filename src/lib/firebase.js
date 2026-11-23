// Firebase initialisation: app, Auth, Firestore and App Check.
// The AI Logic client is created lazily in lib/agent/ (dynamic import) to keep the main bundle small.
// Firebase web config values are public identifiers; protection comes from rules and App Check.
import { initializeApp } from 'firebase/app';
import { ReCaptchaV3Provider, initializeAppCheck } from 'firebase/app-check';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { resolveAppCheckConfig } from './config.js';

const env = import.meta.env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

export const app = initializeApp(firebaseConfig);

const appCheckConfig = resolveAppCheckConfig(env);

/**
 * App Check (reCAPTCHA v3) is optional. initializeAppCheck runs only when VITE_RECAPTCHA_SITE_KEY
 * is a non-empty string (see resolveAppCheckConfig). When it does not run, the App Check
 * component is never created, so Firebase AI Logic sends requests without an App Check header.
 * @returns {import('firebase/app-check').AppCheck | null}
 */
function initOptionalAppCheck() {
  if (!appCheckConfig.enabled) return null;
  if (appCheckConfig.debugToken) {
    // Local development only (resolveAppCheckConfig never returns a token outside DEV).
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = appCheckConfig.debugToken;
  }
  try {
    return initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckConfig.siteKey),
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
