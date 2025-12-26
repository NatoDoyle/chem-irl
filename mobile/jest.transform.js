// mobile/jest.transform.js
const path = require('path');
const { createTransformer } = require('babel-jest');

const expoTransformer = createTransformer({
  presets: ['babel-preset-expo'],
});

// React Native Jest files use a mix of Flow and TypeScript syntax
// The issue: Flow arrow function types (callback: number => void) aren't valid TypeScript
// Solution: Use Flow parser first (it can handle both), then strip all type annotations
const rnJestFilesTransformer = createTransformer({
  presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
  plugins: [
    // Strip Flow types (handles Flow arrow syntax: callback: number => void)
    '@babel/plugin-transform-flow-strip-types',
    // Strip TypeScript types (handles TS assertions: ref as string)
    ['@babel/plugin-transform-typescript', { allowNamespaces: true, allowDeclareFields: true, isTSX: false }],
  ],
  // Prioritize Flow parser - it's more lenient and can parse Flow syntax
  // TypeScript parser will handle the rest after Flow strips its annotations
  parserOpts: {
    plugins: ['flow', 'flowComments'], // Flow first - handles arrow function types
  },
});

function isReactNativeJestFile(filename) {
  const rnJestPath = `${path.sep}node_modules${path.sep}react-native${path.sep}jest${path.sep}`;
  return filename.includes(rnJestPath);
}

module.exports = {
  process(src, filename, config, options) {
    if (isReactNativeJestFile(filename)) {
      return rnJestFilesTransformer.process(src, filename, config, options);
    }
    return expoTransformer.process(src, filename, config, options);
  },

  getCacheKey(src, filename, configString, options) {
    if (isReactNativeJestFile(filename)) {
      return rnJestFilesTransformer.getCacheKey(src, filename, configString, options);
    }
    return expoTransformer.getCacheKey(src, filename, configString, options);
  },
};

