// mobile/jest.transform.js
const path = require('path');
const { createTransformer } = require('babel-jest');

const expoTransformer = createTransformer({
  presets: ['babel-preset-expo'],
});

// React Native Jest files use a mix of Flow and TypeScript syntax
// Use both Flow and TypeScript parsers/transformers to handle all syntax
const rnJestFilesTransformer = createTransformer({
  presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
  plugins: [
    '@babel/plugin-transform-flow-strip-types',
    ['@babel/plugin-transform-typescript', { allowNamespaces: true, allowDeclareFields: true }],
  ],
  parserOpts: {
    plugins: ['flow', 'flowComments', 'typescript', 'typescriptJSX'],
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

