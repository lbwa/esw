const [, WARNING] = [0, 1]

module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    // add all ECMACScript 2021 globals and automatically sets the ecmaVersion parser option to 12
    es2021: true
  },
  parserOptions: {
    sourceType: 'module',
    tsconfigRootDir: __dirname
  },
  settings: {
    'import/resolver': {
      typescript: {}
    }
  },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'jest'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
    'plugin:jest/recommended'
  ],
  rules: {
    'no-console': WARNING
  },
  overrides: [
    {
      files: ['**/__tests__/**', '**/*.spec.ts'],
      env: {
        jest: true
      }
    }
  ]
}
