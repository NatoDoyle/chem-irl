const { createTransformer } = require('babel-jest');

const expoTransformer = createTransformer({
  presets: ['babel-preset-expo'],
});

// Use Flow parser for react-native/jest files since they contain Flow syntax
// that TypeScript parser can't handle (e.g., callback: number => void)
const rnJestTransformer = createTransformer({
  babelrc: false,
  configFile: false,
  presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
  plugins: [
    '@babel/plugin-transform-flow-strip-types',
    ['@babel/plugin-transform-typescript', { allExtensions: true }],
  ],
  parserOpts: {
    plugins: ['flow', 'flowComments'],
  },
});

function isReactNativeJestFile(filename) {
  return filename.includes('node_modules/react-native/jest/');
}

module.exports = {
  process(src, filename, config, options) {
    if (isReactNativeJestFile(filename)) {
      return rnJestTransformer.process(src, filename, config, options);
    }
    return expoTransformer.process(src, filename, config, options);
  },
  getCacheKey(src, filename, configString, options) {
    if (isReactNativeJestFile(filename) && rnJestTransformer.getCacheKey) {
      return rnJestTransformer.getCacheKey(src, filename, configString, options);
    }
    if (expoTransformer.getCacheKey) {
      return expoTransformer.getCacheKey(src, filename, configString, options);
    }
    return '';
  },
};
