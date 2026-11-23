import { useEffect } from 'react';
import { APP_NAME } from '../lib/config.js';

/**
 * Sets a unique document title for the current route.
 * @param {string} title Page title, e.g. "Catalogue".
 */
export default function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
  }, [title]);
}
