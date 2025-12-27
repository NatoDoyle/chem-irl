module.exports = {
  extends: ['expo', 'prettier'],
  plugins: ['prettier'],
  rules: {
    'prettier/prettier': 'error',
    // v8 replacement rules for ban-types defaults
    '@typescript-eslint/no-empty-object-type': 'error',
    '@typescript-eslint/no-unsafe-function-type': 'error',
    '@typescript-eslint/no-wrapper-object-types': 'error',
  },
  ignorePatterns: ['node_modules/', '.expo/', 'dist/', 'docs/', '*.md'],
};
