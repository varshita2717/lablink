import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default [
  { ignores: ['dist/', 'coverage/', 'node_modules/'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
  },
  {
    files: ['**/*.jsx'],
    ...react.configs.flat.recommended,
  },
  {
    files: ['**/*.jsx'],
    ...react.configs.flat['jsx-runtime'],
  },
  {
    files: ['**/*.jsx'],
    ...reactHooks.configs.flat.recommended,
  },
  {
    files: ['**/*.jsx'],
    ...jsxA11y.flatConfigs.strict,
  },
  {
    files: ['**/*.{js,jsx}'],
    plugins: { react },
    rules: {
      'no-console': ['error', { allow: ['error'] }],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'react/prop-types': 'off',
      'react/no-danger': 'error',
      'no-restricted-properties': [
        'error',
        { property: 'innerHTML', message: 'Render text as React nodes instead.' },
        { property: 'outerHTML', message: 'Render text as React nodes instead.' },
      ],
    },
  },
  {
    files: ['*.config.js', 'tests/**/*.js'],
    languageOptions: { globals: { ...globals.node } },
  },
];
