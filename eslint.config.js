import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';

const baseLanguageOptions = {
  ecmaVersion: 'latest',
  sourceType: 'module',
};

const sharedRules = {
  'array-callback-return': ['error', {
    checkForEach: true,
  }],
  eqeqeq: ['error', 'smart'],
  'no-constant-binary-expression': 'error',
  'no-duplicate-imports': ['error', {
    includeExports: true,
  }],
  'no-promise-executor-return': 'error',
  'no-shadow': 'error',
  'no-template-curly-in-string': 'error',
  'no-unreachable-loop': 'error',
  'no-unused-vars': ['error', {
    argsIgnorePattern: '^_',
    caughtErrorsIgnorePattern: '^_',
    ignoreRestSiblings: true,
    varsIgnorePattern: '^_',
  }],
  'no-useless-catch': 'error',
  'prefer-object-has-own': 'error',
  radix: 'error',
};

export default defineConfig([
  {
    ignores: [
      'dist/**',
      'node_modules/**',
    ],
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
  },
  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  {
    files: [
      'src/server/**/*.js',
      'src/shared/**/*.js',
      'scripts/**/*.js',
      'eslint.config.js',
      'vite.config.js',
    ],
    languageOptions: {
      ...baseLanguageOptions,
      globals: {
        ...globals.node,
      },
    },
    rules: sharedRules,
  },
  {
    files: [
      'src/client/**/*.js',
      'src/client/**/*.vue',
    ],
    languageOptions: {
      ...baseLanguageOptions,
      globals: {
        ...globals.browser,
      },
    },
    rules: sharedRules,
  },
  {
    files: [
      'test/**/*.js',
      'testing/**/*.js',
    ],
    languageOptions: {
      ...baseLanguageOptions,
      globals: {
        ...globals.node,
      },
    },
    rules: {
      ...sharedRules,
      'no-unused-vars': ['error', {
        args: 'none',
        caughtErrorsIgnorePattern: '^_',
        ignoreRestSiblings: true,
        varsIgnorePattern: '^_',
      }],
    },
  },
]);
