import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Vendor code goes into separate, long-cached chunks so app releases do not invalidate it.
const VENDOR_GROUPS = [
  {
    name: 'firebase-firestore',
    test: /node_modules[\\/]@firebase[\\/](firestore|webchannel-wrapper)/,
  },
  { name: 'firebase-auth', test: /node_modules[\\/]@firebase[\\/]auth/ },
  { name: 'firebase-core', test: /node_modules[\\/](@firebase|firebase)[\\/]/ },
  {
    name: 'react',
    test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
  },
];

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    sourcemap: false,
    rolldownOptions: {
      output: {
        codeSplitting: { groups: VENDOR_GROUPS },
      },
    },
  },
});
