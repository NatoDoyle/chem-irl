const path = require('path');
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

function isReactNativePackageFile(filename) {
  const normalized = filename.split(path.sep).join('/');
  return (
    normalized.includes('/node_modules/react-native/') ||
    normalized.includes('/node_modules/@react-native/')
  );
}

function patchReactNativeSource(src) {
  let out = src;

  // Strip TS-style "as" assertions that appear in RN .js files
  // examples:
  //   (ref as string)
  //   } as ReactNativePublicAPI;
  out = out.replace(/\s+as\s+[A-Za-z0-9_$]+(?=\s*[;,\)\]])/g, '');

  // Some RN jest mocks have invalid-looking generic annotations; drop them
  // example:
  //   jest.fn()<$FlowFixMe, $FlowFixMe>
  out = out.replace(/jest\.fn\(\)\s*<[\s\S]*?>/g, 'jest.fn()');

  return out;
}

module.exports = {
  process(src, filename, config, options) {
    const normalized = filename.split(path.sep).join('/');

    if (isReactNativePackageFile(normalized)) {
      const patched = patchReactNativeSource(src);
      return rnJestTransformer.process(patched, filename, config, options);
    }

    return expoTransformer.process(src, filename, config, options);
  },
};
