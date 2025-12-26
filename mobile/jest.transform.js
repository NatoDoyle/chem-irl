const { createTransformer } = require('babel-jest');

const expoTransformer = createTransformer({
  presets: ['babel-preset-expo'],
});

const rnJestTransformer = createTransformer({
  babelrc: false,
  configFile: false,
  presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }]],
  plugins: ['@babel/plugin-transform-flow-strip-types'],
});

function isReactNativeJestFile(filename) {
  return filename.includes('node_modules/react-native/jest/');
}

// Strip TS-style `as` assertions that appear in RN's jest helpers.
// Example: `(ref as string)` -> `(ref)`
function stripTypeScriptAsAssertions(src) {
  return src.replace(/\s+as\s+[A-Za-z_$][A-Za-z0-9_$]*(?:\[\])?/g, '');
}

module.exports = {
  process(src, filename, config, options) {
    if (isReactNativeJestFile(filename)) {
      const patched = stripTypeScriptAsAssertions(src);
      return rnJestTransformer.process(patched, filename, config, options);
    }
    return expoTransformer.process(src, filename, config, options);
  },
};
