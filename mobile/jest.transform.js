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

function patchReactNativeSource(src, filename) {
  let out = src;

  // (A) Remove TS-style JestMockFn assertions in RN jest mocks (multiline-safe)
  // Example it must fully delete:
  //   alertWithArgs: jest.fn() as JestMockFn<
  //     $FlowFixMe,
  //     $FlowFixMe,
  //   >,
  out = out.replace(/jest\.fn\(\)\s+as\s+JestMockFn<[\s\S]*?>\s*,/g, 'jest.fn(),');
  out = out.replace(/jest\.fn\(\)\s+as\s+JestMockFn<[\s\S]*?>/g, 'jest.fn()');

  // (B) Remove Flow-style cast if present: (jest.fn(): JestMockFn<...>)
  out = out.replace(/\(\s*jest\.fn\(\)\s*:\s*JestMockFn<[\s\S]*?>\s*\)/g, 'jest.fn()');

  // (C) Safety net ONLY for react-native/jest/mocks: remove orphaned type-param lines
  // This catches cases where a prior patch removed "as JestMockFn<" but left the inner lines + ">,".
  const normalizedFilename = filename.split(path.sep).join('/');
  if (normalizedFilename.includes('/react-native/jest/mocks/')) {
    // Remove TS/Flow generic instantiation on jest.fn calls in RN jest mocks:
    //   jest.fn(...)<...>,  => jest.fn(...),
    out = out.replace(/(jest\.fn\([^\n]*\))\s*<[\s\S]*?>\s*,/g, '$1,');

    //   jest.fn(...)<...>   => jest.fn(...)
    out = out.replace(/(jest\.fn\([^\n]*\))\s*<[\s\S]*?>/g, '$1');

    // Clean up orphaned type-param lines
    out = out
      .replace(/^\s*\$FlowFixMe,?\s*$/gm, '')
      .replace(/^\s*>,\s*$/gm, '')
      .replace(/^\s*<\s*$/gm, '')
      .replace(/^\s*JestMockFn<\s*$/gm, '');
  }

  // 2) Older RN jest mocks: "jest.fn()<...>" -> "jest.fn()"
  out = out.replace(/jest\.fn\(\)\s*<[\s\S]*?>/g, 'jest.fn()');

  // 3) Strip TS "as" assertions in expressions, but NEVER break "import * as X"
  out = out
    .split('\n')
    .map((line) => {
      // Do not touch imports (prevents "import * as X" -> "import * X")
      if (/^\s*import\b/.test(line)) return line;

      let l = line;

      // identifier as Type   -> identifier
      l = l.replace(
        /\b([A-Za-z_$][\w$]*)\s+as\s+[A-Za-z0-9_$]+(?:\.[A-Za-z0-9_$]+)*(?:<[^>]*>)?/g,
        '$1',
      );

      // ) as Type / ] as Type / } as Type -> )
      l = l.replace(
        /([)\]}])\s+as\s+[A-Za-z0-9_$]+(?:\.[A-Za-z0-9_$]+)*(?:<[^>]*>)?/g,
        '$1',
      );

      return l;
    })
    .join('\n');

  return out;
}

module.exports = {
  process(src, filename, config, options) {
    const normalized = filename.split(path.sep).join('/');

    if (isReactNativePackageFile(normalized)) {
      const patched = patchReactNativeSource(src, normalized);
      return rnJestTransformer.process(patched, filename, config, options);
    }

    return expoTransformer.process(src, filename, config, options);
  },
};
