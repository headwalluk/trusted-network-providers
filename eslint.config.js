import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'prefer-const': 'warn',
      'no-var': 'error',
      eqeqeq: ['warn', 'smart'],
      curly: ['warn', 'all'],
      'brace-style': ['warn', '1tbs'],
      semi: ['error', 'always'],
      quotes: ['warn', 'single', { avoidEscape: true }],
      'no-trailing-spaces': 'warn',
      'no-multiple-empty-lines': ['warn', { max: 2, maxEOF: 1 }],
      'comma-dangle': ['warn', 'only-multiline'],
      'arrow-parens': ['warn', 'always'],
      'prefer-arrow-callback': 'warn',
    },
  },
  {
    ignores: ['node_modules/**', 'dist/**', 'src/assets/*.json'],
  },
];
