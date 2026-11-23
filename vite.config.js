import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Vendor code goes into separate, long-cached chunks so app releases do not invalidate it.
// Groups are matched in order; firebase-ai comes last so the Firebase modules it shares
// (app, util, logger) stay in firebase-core and the AI chunk loads only on the first chat message.
const VENDOR_GROUPS = [
  {
    name: 'firebase-firestore',
    test: /node_modules[\\/]@firebase[\\/](firestore|webchannel-wrapper)[\\/]/,
  },
  { name: 'firebase-auth', test: /node_modules[\\/]@firebase[\\/]auth[\\/]/ },
  {
    name: 'firebase-core',
    test: /node_modules[\\/](@firebase[\\/](?!ai[\\/])|firebase[\\/](?!ai[\\/]))/,
  },
  {
    name: 'react',
    test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
  },
  { name: 'firebase-ai', test: /node_modules[\\/](@firebase|firebase)[\\/]ai[\\/]/ },
];

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    sourcemap: false,
    // The Firestore SDK alone is ~500 kB minified (~150 kB gzip) and is needed on every page,
    // so it cannot be split further. App chunks stay far below this limit.
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        codeSplitting: { groups: VENDOR_GROUPS },
      },
    },
  },
});
