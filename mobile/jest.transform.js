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

  // 1) RN jest mocks: "jest.fn() as JestMockFn<...>" -> "jest.fn()"
  out = out.replace(/jest\.fn\(\)\s+as\s+JestMockFn<[\s\S]*?>/g, 'jest.fn()');

  // 2) Older RN jest mocks: "jest.fn()<...>" -> "jest.fn()"
  out = out.replace(/jest\.fn\(\)\s*<[\s\S]*?>/g, 'jest.fn()');

  // 3) Strip TS "as" assertions ONLY when they follow a closing token.
  // This fixes cases like: "} as ReactNativePublicAPI;" and "(x) as Foo"
  // without breaking: "import * as Foo from '...'"
  out = out.replace(/([)\]}])\s+as\s+[A-Za-z0-9_$]+(?:<[\s\S]*?>)?/g, '$1');

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
