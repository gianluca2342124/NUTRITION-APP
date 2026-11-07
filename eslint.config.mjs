import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/** Lint config for shared packages (apps use their framework configs). */
export default tseslint.config(
  { ignores: ['**/node_modules/**', 'apps/**', '**/dist/**', 'data/**', 'scripts/**', 'supabase/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['packages/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
    },
  },
);
