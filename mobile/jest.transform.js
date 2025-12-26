// mobile/jest.transform.js
const path = require('path');
const { createTransformer } = require('babel-jest');

const expoTransformer = createTransformer({
  presets: ['babel-preset-expo'],
});

// React Native Jest files use Flow syntax, not TypeScript
// Use Flow parser/transformer for these files
const rnJestFilesTransformer = createTransformer({
  presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
  plugins: ['@babel/plugin-transform-flow-strip-types'],
  parserOpts: {
    plugins: ['flow', 'flowComments'],
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

