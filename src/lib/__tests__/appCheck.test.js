import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveAppCheckConfig } from '../config.js';

const { initializeAppCheck } = vi.hoisted(() => ({
  initializeAppCheck: vi.fn(() => ({ app: 'check' })),
}));
vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({ name: 'app' })) }));
vi.mock('firebase/app-check', () => ({
  initializeAppCheck,
  ReCaptchaV3Provider: class {
    constructor(key) {
      this.key = key;
    }
  },
}));
vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => ({})) }));
vi.mock('firebase/firestore', () => ({ getFirestore: vi.fn(() => ({})) }));

describe('resolveAppCheckConfig', () => {
  it('disables App Check when the site key is missing, empty, blank or a placeholder', () => {
    for (const key of [undefined, null, '', '   ', 'undefined', 'null', 42]) {
      expect(
        resolveAppCheckConfig({
          VITE_RECAPTCHA_SITE_KEY: key,
          VITE_APPCHECK_DEBUG_TOKEN: 'tok',
          DEV: true,
        }),
      ).toEqual({
        enabled: false,
        siteKey: '',
        debugToken: null,
      });
    }
    expect(resolveAppCheckConfig(undefined).enabled).toBe(false);
  });

  it('enables App Check with a trimmed, non-empty site key', () => {
    expect(resolveAppCheckConfig({ VITE_RECAPTCHA_SITE_KEY: '  6Lc-site-key ' })).toEqual({
      enabled: true,
      siteKey: '6Lc-site-key',
      debugToken: null,
    });
  });

  it('uses the debug token only with App Check enabled, in development, when non-empty', () => {
    const key = { VITE_RECAPTCHA_SITE_KEY: '6Lc-site-key' };
    expect(
      resolveAppCheckConfig({ ...key, VITE_APPCHECK_DEBUG_TOKEN: 'tok', DEV: true }).debugToken,
    ).toBe('tok');
    expect(
      resolveAppCheckConfig({ ...key, VITE_APPCHECK_DEBUG_TOKEN: 'tok', DEV: false }).debugToken,
    ).toBeNull();
    expect(
      resolveAppCheckConfig({ ...key, VITE_APPCHECK_DEBUG_TOKEN: '  ', DEV: true }).debugToken,
    ).toBeNull();
  });
});

describe('firebase.js App Check initialisation', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    initializeAppCheck.mockClear();
    delete self.FIREBASE_APPCHECK_DEBUG_TOKEN;
  });

  it('never calls initializeAppCheck or sets a debug token without a site key', async () => {
    vi.stubEnv('VITE_RECAPTCHA_SITE_KEY', '');
    vi.stubEnv('VITE_APPCHECK_DEBUG_TOKEN', 'debug-token');
    const { appCheck } = await import('../firebase.js');
    expect(appCheck).toBeNull();
    expect(initializeAppCheck).not.toHaveBeenCalled();
    expect(self.FIREBASE_APPCHECK_DEBUG_TOKEN).toBeUndefined();
  });

  it('initialises App Check with reCAPTCHA v3 when a site key is set', async () => {
    vi.stubEnv('VITE_RECAPTCHA_SITE_KEY', '6Lc-site-key');
    vi.stubEnv('VITE_APPCHECK_DEBUG_TOKEN', '');
    const { appCheck } = await import('../firebase.js');
    expect(appCheck).toEqual({ app: 'check' });
    expect(initializeAppCheck).toHaveBeenCalledOnce();
    expect(initializeAppCheck.mock.calls[0][1].provider.key).toBe('6Lc-site-key');
    expect(self.FIREBASE_APPCHECK_DEBUG_TOKEN).toBeUndefined();
  });
});
