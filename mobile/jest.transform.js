const { createTransformer } = require('babel-jest');

const expoTransformer = createTransformer({
  presets: ['babel-preset-expo'],
});

const rnFlowTransformer = createTransformer({
  babelrc: false,
  configFile: false,
  presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
  plugins: ['@babel/plugin-transform-flow-strip-types'],
});

const rnTsTransformer = createTransformer({
  babelrc: false,
  configFile: false,
  presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
  plugins: [['@babel/plugin-transform-typescript', { allExtensions: true }]],
});

function isReactNativeJestFile(filename) {
  return filename.includes('node_modules/react-native/jest/');
}

function isReactNativeJestSetup(filename) {
  return filename.endsWith('node_modules/react-native/jest/setup.js');
}

module.exports = {
  process(src, filename, config, options) {
    if (isReactNativeJestFile(filename)) {
      if (isReactNativeJestSetup(filename)) {
        return rnFlowTransformer.process(src, filename, config, options);
      }
      return rnTsTransformer.process(src, filename, config, options);
    }
    return expoTransformer.process(src, filename, config, options);
  },
};
