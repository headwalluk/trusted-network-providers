import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        AbortController: 'readonly',
      },
    },
    // Whitespace, quotes, semicolons and trailing commas are Prettier's, not
    // ESLint's: the equivalent core rules are deprecated as of ESLint 10 and
    // `npm run format:check` already enforces .prettierrc.json in CI.
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'prefer-const': 'warn',
      'no-var': 'error',
      eqeqeq: ['warn', 'smart'],
      curly: ['warn', 'all'],
      'prefer-arrow-callback': 'warn',
    },
  },
  {
    ignores: ['node_modules/**', 'dist/**', 'src/assets/*.json'],
  },
];
