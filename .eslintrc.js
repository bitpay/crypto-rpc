module.exports = {
  env: {
    browser: true,
    commonjs: true,
    node: true,
    es2022: true,
    mocha: true
  },
  extends: 'eslint:recommended',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  rules: {
    indent: ['error', 2, { SwitchCase: 1 }],
    'linebreak-style': ['error', 'unix'],
    quotes: ['error', 'single'],
    semi: ['error', 'always' ],
    'no-console': ['error', { allow: ['warn', 'error'] }],
    'no-async-promise-executor': 'off',
    'no-prototype-builtins': 'off',
  }
};
