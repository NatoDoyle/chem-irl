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

function patchReactNativeJestFiles(src) {
  let out = src;

  // 1) Strip TS-style `as Type`
  out = out.replace(/\s+as\s+[A-Za-z_$][A-Za-z0-9_$]*(?:\[\])?/g, '');

  // 2) Strip TS-style generic instantiation after a call result, including multiline:
  //    `jest.fn()<$FlowFixMe, $FlowFixMe>` (often split over lines) -> `jest.fn()`
  out = out.replace(/\)\s*<[\s\S]*?>/g, ')');

  return out;
}

module.exports = {
  process(src, filename, config, options) {
    if (isReactNativeJestFile(filename)) {
      const patched = patchReactNativeJestFiles(src);
      return rnJestTransformer.process(patched, filename, config, options);
    }
    return expoTransformer.process(src, filename, config, options);
  },
};
